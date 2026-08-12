"use server";

import { db } from "@/lib/db";
import { kpiTargets, kpis } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";
import { z } from "zod";
import { checkThresholdCoherence } from "@/lib/kpi-coherence";

/**
 * Bentuk numerik saja. Aturan urutan hijau/kuning TIDAK dicek di sini karena
 * aturannya bergantung pada arah KPI, dan arah itu milik baris `kpis` —
 * bukan sesuatu yang boleh dikirim (atau dilupakan) oleh klien.
 */
const TargetSchema = z.object({
  target: z.number().finite().positive(),
  thresholdGreen: z.number().finite().positive(),
  thresholdYellow: z.number().finite().positive(),
});

export type UpsertTargetResult = { error: string } | undefined;

export async function upsertTarget(kpiId: number, periodDate: string, data: {
  target: number;
  thresholdGreen: number;
  thresholdYellow: number;
}): Promise<UpsertTargetResult> {
  const session = await requireAdmin();

  const parsed = TargetSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nilai target tidak valid." };
  }

  const kpi = db
    .select({ direction: kpis.direction })
    .from(kpis)
    .where(eq(kpis.id, kpiId))
    .limit(1)
    .all()[0];

  if (!kpi) return { error: "KPI tidak ditemukan." };

  // Arah diambil dari KPI-nya sendiri. Sebelumnya arah ini opsional dan form
  // tidak pernah mengirimnya, sehingga tiap KPI "lower_better" selalu ditolak.
  const blocking = checkThresholdCoherence({
    direction: kpi.direction,
    target: parsed.data.target,
    thresholdGreen: parsed.data.thresholdGreen,
    thresholdYellow: parsed.data.thresholdYellow,
  }).find((issue) => issue.level === "error");

  if (blocking) return { error: blocking.message };

  const targetData = {
    target: parsed.data.target,
    thresholdGreen: parsed.data.thresholdGreen,
    thresholdYellow: parsed.data.thresholdYellow,
  };

  // Select-then-write atomic; the UNIQUE(kpi_id, period_date) index plus this
  // transaction prevent duplicate target rows under concurrent saves.
  db.transaction((tx) => {
    const existing = tx
      .select({ id: kpiTargets.id })
      .from(kpiTargets)
      .where(and(eq(kpiTargets.kpiId, kpiId), eq(kpiTargets.periodDate, periodDate)))
      .limit(1)
      .all();

    if (existing[0]) {
      tx.update(kpiTargets).set(targetData).where(eq(kpiTargets.id, existing[0].id)).run();
    } else {
      tx.insert(kpiTargets).values({ kpiId, periodDate, ...targetData }).run();
    }

    logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "kpi_target", entityId: String(kpiId), detail: `periode ${periodDate}` }, tx);
  });
  revalidatePath("/");
  revalidatePath(`/kpi/${kpiId}`);
  redirect(`/admin/kpi/${kpiId}/targets?success=Target+periode+berhasil+disimpan`);
}

export async function deleteTarget(id: number, kpiId: number) {
  const session = await requireAdmin();
  await db.delete(kpiTargets).where(eq(kpiTargets.id, id));
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "delete", entity: "kpi_target", entityId: String(id) });
  revalidatePath("/");
  revalidatePath(`/kpi/${kpiId}`);
}
