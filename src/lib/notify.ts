import { db } from "@/lib/db";
import { kpis, kpiTargets } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getKPIStatus } from "@/lib/kpi-status";

export async function notifyRedKPI(kpiName: string, value: number, target: number, period: string) {
  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL;
  if (!webhookUrl) return; // skip if not configured

  const message = `🔴 KPI Alert: "${kpiName}" nilai ${value} di bawah target ${target} pada periode ${period}`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message, content: message }),
    });
  } catch {
    // silently fail — notification is best-effort
  }
}

interface EnteredValue {
  kpiId: number;
  value: number;
  periodDate: string;
}

/**
 * Kirim alert untuk entry yang membuat KPI-nya jadi merah.
 *
 * Dipanggil dari SEMUA jalur tulis entry (single, bulk, import CSV) — kalau hanya
 * dipasang di satu jalur, KPI yang jatuh merah lewat jalur lain akan lolos diam-diam.
 *
 * Best-effort: no-op kalau NOTIFY_WEBHOOK_URL tidak diset, dan tidak pernah
 * melempar error — kegagalan notifikasi tidak boleh membatalkan penyimpanan data.
 */
export async function notifyRedEntries(entries: EnteredValue[]) {
  if (!process.env.NOTIFY_WEBHOOK_URL || entries.length === 0) return;

  try {
    const kpiIds = [...new Set(entries.map((e) => e.kpiId))];
    const rows = await db.select().from(kpis).where(inArray(kpis.id, kpiIds));
    const kpiById = new Map(rows.map((k) => [k.id, k]));

    for (const entry of entries) {
      const kpi = kpiById.get(entry.kpiId);
      if (!kpi) continue;

      // Target bisa di-override per periode; memakai target default di sini akan
      // membunyikan alarm palsu pada KPI yang targetnya memang diturunkan bulan itu.
      const override = await db
        .select()
        .from(kpiTargets)
        .where(and(eq(kpiTargets.kpiId, kpi.id), eq(kpiTargets.periodDate, entry.periodDate)))
        .get();

      const effective = override ?? kpi;
      const status = getKPIStatus(entry.value, {
        target: effective.target,
        thresholdGreen: effective.thresholdGreen,
        thresholdYellow: effective.thresholdYellow,
        direction: kpi.direction,
      });

      if (status === "red") {
        await notifyRedKPI(kpi.name, entry.value, effective.target, entry.periodDate);
      }
    }
  } catch {
    // best-effort: jangan sampai kegagalan notifikasi menggagalkan simpan data
  }
}
