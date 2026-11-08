import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { AIServiceError } from "@/lib/ai/types";
import { and, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  kpiActionPlans,
  kpiComments,
  kpiEntries,
  kpiTargets,
  type KPI,
  type KPIActionPlan,
  type KPIComment,
  type KPIEntry,
  type KPITarget,
} from "@/lib/db/schema";
import { getKPIById } from "@/lib/queries";
import { getAchievementPct, getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue, shiftMonth } from "@/lib/period";

/**
 * Penyusunan draf catatan bulanan, dipakai route tunggal maupun batch.
 *
 * Prompt-nya tinggal di sini, bukan di route, supaya kedua pemanggil tidak
 * menyimpan dua salinan yang perlahan menyimpang.
 */

export type DraftFailureReason = "not_found" | "no_data" | "ai_error";

export type DraftResult =
  | { ok: true; kpiId: number; kpiName: string; draft: string }
  | { ok: false; kpiId: number; kpiName: string; reason: DraftFailureReason; message: string };

export interface DraftInputs {
  kpi: KPI;
  entries: KPIEntry[];
  targets: KPITarget[];
  comments: KPIComment[];
  actionPlans: KPIActionPlan[];
}

/**
 * Muat data draf untuk banyak KPI sekaligus: empat query konstan, berapa pun jumlah KPI
 * (D1 membatasi 50 query per invokasi, jadi N x 5 query per KPI tidak muat).
 * Hanya baris yang dipakai prompt yang diambil: entri periode ini dan sebelumnya, target
 * periode ini, komentar periode sebelumnya, dan semua action plan.
 */
export async function loadDraftInputs(kpis: KPI[], periodDate: string): Promise<Map<number, DraftInputs>> {
  const ids = kpis.map((k) => k.id);
  const prevPeriod = shiftMonth(periodDate, -1);
  const [entries, targets, comments, actionPlans] = await Promise.all([
    db.select().from(kpiEntries).where(and(inArray(kpiEntries.kpiId, ids), inArray(kpiEntries.periodDate, [periodDate, prevPeriod]))),
    db.select().from(kpiTargets).where(and(inArray(kpiTargets.kpiId, ids), inArray(kpiTargets.periodDate, [periodDate]))),
    db.select().from(kpiComments).where(and(inArray(kpiComments.kpiId, ids), inArray(kpiComments.periodDate, [prevPeriod]))).orderBy(desc(kpiComments.createdAt)),
    db.select().from(kpiActionPlans).where(inArray(kpiActionPlans.kpiId, ids)).orderBy(kpiActionPlans.dueDate, desc(kpiActionPlans.updatedAt)),
  ]);
  return new Map(
    kpis.map((kpi) => [
      kpi.id,
      {
        kpi,
        entries: entries.filter((r) => r.kpiId === kpi.id),
        targets: targets.filter((r) => r.kpiId === kpi.id),
        comments: comments.filter((r) => r.kpiId === kpi.id),
        actionPlans: actionPlans.filter((r) => r.kpiId === kpi.id),
      },
    ]),
  );
}

/**
 * Menyusun draf untuk satu KPI. Kegagalan dikembalikan sebagai nilai, bukan
 * dilempar — batch harus bisa sebagian berhasil: sembilan KPI dengan dua yang
 * gagal jauh lebih berguna daripada tidak ada sama sekali.
 */
export async function draftCommentForKPI(
  kpiId: number,
  periodDate: string,
  preloaded?: DraftInputs
): Promise<DraftResult> {
  const kpi = preloaded?.kpi ?? (await getKPIById(kpiId));
  if (!kpi) {
    return {
      ok: false,
      kpiId,
      kpiName: `KPI #${kpiId}`,
      reason: "not_found",
      message: "KPI tidak ditemukan.",
    };
  }

  const prevPeriod = shiftMonth(periodDate, -1);
  const { entries, targets: targetOverrides, comments, actionPlans } =
    preloaded ?? (await loadDraftInputs([kpi], periodDate)).get(kpi.id)!;

  const entry = entries.find((e) => e.periodDate === periodDate) ?? null;
  if (!entry) {
    // Tanpa angka periode ini, draf apa pun hanya akan jadi karangan.
    return {
      ok: false,
      kpiId,
      kpiName: kpi.name,
      reason: "no_data",
      message: `Belum ada data untuk ${formatPeriodDate(periodDate, "MMMM yyyy")}.`,
    };
  }

  const prevEntry = entries.find((e) => e.periodDate === prevPeriod) ?? null;

  const effectiveTarget = targetOverrides.find((t) => t.periodDate === periodDate) ?? {
    target: kpi.target,
    thresholdGreen: kpi.thresholdGreen,
    thresholdYellow: kpi.thresholdYellow,
  };

  const status = getKPIStatus(entry.value, { ...kpi, ...effectiveTarget });
  const achievement = getAchievementPct(entry.value, effectiveTarget.target, kpi.direction);
  const prevComment = comments.find((c) => c.periodDate === prevPeriod) ?? null;
  const openActions = actionPlans.filter(
    (a) => a.status === "open" || a.status === "in_progress"
  );

  const unit = kpi.unit;
  const deltaText = prevEntry
    ? `${formatValue(prevEntry.value, unit)} pada ${formatPeriodDate(prevPeriod, "MMMM yyyy")} (selisih ${
        entry.value > prevEntry.value ? "+" : ""
      }${(entry.value - prevEntry.value).toFixed(2)} ${unit})`
    : "tidak ada data periode sebelumnya sebagai pembanding";

  const actionsText =
    openActions.length > 0
      ? openActions
          .map(
            (a) =>
              `- ${sanitizeInput(a.title, 200)} (PIC ${sanitizeInput(a.owner, 100)}, tenggat ${a.dueDate}, status ${a.status})`
          )
          .join("\n")
      : "Belum ada action plan yang berjalan.";

  // Komentar tersimpan sebagai HTML dari rich text editor. Tag-nya dibuang agar
  // model membaca kalimatnya, bukan markup — dan agar markup tidak dipantulkan
  // balik ke dalam draf baru.
  const prevCommentText = prevComment
    ? sanitizeInput(prevComment.content.replace(/<[^>]*>/g, " "), 800)
    : "Tidak ada catatan periode sebelumnya.";

  const prompt = `Kamu adalah analis KPI senior. Tulis DRAF catatan bulanan untuk satu KPI, dalam Bahasa Indonesia. Draf ini akan disunting manusia sebelum dipublikasikan.

KPI: ${sanitizeInput(kpi.name, 200)}
${kpi.description ? `Deskripsi: ${sanitizeInput(kpi.description, 300)}\n` : ""}Satuan: ${sanitizeInput(unit, 50)}
Arah: ${kpi.direction === "lower_better" ? "semakin rendah semakin baik" : "semakin tinggi semakin baik"}

Periode: ${formatPeriodDate(periodDate, "MMMM yyyy")}
Nilai: ${formatValue(entry.value, unit)}
Target: ${formatValue(effectiveTarget.target, unit)}
Pencapaian: ${achievement !== null ? `${achievement}%` : "tidak dapat dihitung"}
Status: ${statusConfig[status].label}
Periode sebelumnya: ${deltaText}
${entry.note ? `Catatan saat input: ${sanitizeInput(entry.note, 300)}\n` : ""}
Action plan yang berjalan:
${actionsText}

Catatan periode sebelumnya:
${prevCommentText}

Instruksi:
- Langsung tulis catatannya, tanpa kalimat pengantar
- 2-4 kalimat, satu paragraf
- Kalimat pertama menyebut angka dan posisinya terhadap target
- Sebut arah pergerakan dibanding periode sebelumnya kalau datanya ada
- Kalau catatan periode sebelumnya menjanjikan tindakan, singgung apakah pergerakan bulan ini konsisten dengan itu
- JANGAN mengarang penyebab yang tidak didukung data di atas. Kalau penyebabnya tidak diketahui, tulis bahwa penyebabnya masih perlu ditelusuri
- Jangan mengulang nama KPI di awal kalimat, langsung ke substansi
- Jangan gunakan markdown atau bullet point`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt, { temperature: 0.4 });
    return { ok: true, kpiId, kpiName: kpi.name, draft: cleanAIOutput(result.text) };
  } catch (error) {
    console.error("AI draft error:", error instanceof AIServiceError ? [error.code, error.cause] : error);
    return {
      ok: false,
      kpiId,
      kpiName: kpi.name,
      reason: "ai_error",
      message: error instanceof Error ? error.message : "Layanan AI gagal merespons.",
    };
  }
}
