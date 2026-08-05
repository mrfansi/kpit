import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { enforceAIRateLimit } from "@/lib/ai/rate-limit";
import {
  getKPIActionPlans,
  getKPIById,
  getKPIComments,
  getKPIEntries,
  getKPITargets,
} from "@/lib/queries";
import { getAchievementPct, getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue } from "@/lib/period";

/**
 * Klien hanya menyebut KPI dan periodenya; seluruh angka diambil di server.
 *
 * Route AI lain di aplikasi ini menerima riwayat lengkap dari body request,
 * yang berarti siapa pun yang bisa memanggilnya dapat menyuntikkan angka palsu
 * ke dalam prompt. Draf ini masuk ke komentar resmi periode, jadi datanya harus
 * berasal dari DB, bukan dari yang dikirim pemanggil.
 */
const draftSchema = z.object({
  kpiId: z.number().int().positive(),
  periodDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format periode harus YYYY-MM-DD"),
});

function previousPeriod(periodDate: string): string {
  const [y, m] = periodDate.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  // Hanya admin yang bisa memposting komentar, jadi tidak ada gunanya membakar
  // kuota AI untuk viewer yang tidak akan bisa memakai hasilnya.
  if (authResult.session.user.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const limited = enforceAIRateLimit(authResult.session.user.id, "draft-comment");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
  }

  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "KPI atau periode tidak valid." }, { status: 400 });
  }
  const { kpiId, periodDate } = parsed.data;

  const kpi = await getKPIById(kpiId);
  if (!kpi) {
    return NextResponse.json({ error: "KPI tidak ditemukan." }, { status: 404 });
  }

  const prevPeriod = previousPeriod(periodDate);
  const [entries, targetOverrides, comments, actionPlans] = await Promise.all([
    getKPIEntries(kpiId),
    getKPITargets(kpiId),
    getKPIComments(kpiId),
    getKPIActionPlans(kpiId),
  ]);

  const entry = entries.find((e) => e.periodDate === periodDate) ?? null;
  if (!entry) {
    // Tanpa angka periode ini, draf apa pun hanya akan jadi karangan.
    return NextResponse.json(
      {
        error: `Belum ada data untuk ${formatPeriodDate(periodDate, "MMMM yyyy")}. Isi nilainya dulu sebelum membuat draf.`,
      },
      { status: 422 }
    );
  }

  const prevEntry = entries.find((e) => e.periodDate === prevPeriod) ?? null;

  const baseTarget = {
    target: kpi.target,
    thresholdGreen: kpi.thresholdGreen,
    thresholdYellow: kpi.thresholdYellow,
  };
  const effectiveTarget =
    targetOverrides.find((t) => t.periodDate === periodDate) ?? baseTarget;

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
  // model membaca kalimatnya, bukan markup — dan agar markup tidak ikut
  // dipantulkan balik ke dalam draf baru.
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
    return NextResponse.json({ draft: cleanAIOutput(result.text) });
  } catch (error) {
    return handleAIError(error);
  }
}
