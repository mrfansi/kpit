"use server";

import { db } from "@/lib/db";
import { kpiTargets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";
import { z } from "zod";
import type { KPIDirection } from "@/lib/kpi-status";

const TargetSchema = z.object({
  target: z.number().finite().positive(),
  thresholdGreen: z.number().finite().positive(),
  thresholdYellow: z.number().finite().positive(),
  direction: z.enum(["higher_better", "lower_better"]).optional(),
}).refine(d => {
  if (d.direction === "lower_better") {
    return d.thresholdGreen <= d.thresholdYellow;
  }
  return d.thresholdGreen >= d.thresholdYellow;
}, {
  message: "Threshold hijau dan kuning tidak konsisten dengan arah KPI",
});

export async function upsertTarget(kpiId: number, periodDate: string, data: {
  target: number;
  thresholdGreen: number;
  thresholdYellow: number;
  direction?: KPIDirection;
}) {
  const session = await requireAdmin();
  TargetSchema.parse(data);
  const existing = await db
    .select({ id: kpiTargets.id })
    .from(kpiTargets)
    .where(and(eq(kpiTargets.kpiId, kpiId), eq(kpiTargets.periodDate, periodDate)))
    .limit(1);

  const targetData = {
    target: data.target,
    thresholdGreen: data.thresholdGreen,
    thresholdYellow: data.thresholdYellow,
  };

  if (existing[0]) {
    await db.update(kpiTargets).set(targetData).where(eq(kpiTargets.id, existing[0].id));
  } else {
    await db.insert(kpiTargets).values({ kpiId, periodDate, ...targetData });
  }

  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "kpi_target", entityId: String(kpiId), detail: `periode ${periodDate}` });
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
