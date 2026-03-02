"use server";

import { db } from "@/lib/db";
import { kpiTargets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function upsertTarget(kpiId: number, periodDate: string, data: {
  target: number;
  thresholdGreen: number;
  thresholdYellow: number;
}) {
  const existing = await db
    .select({ id: kpiTargets.id })
    .from(kpiTargets)
    .where(and(eq(kpiTargets.kpiId, kpiId), eq(kpiTargets.periodDate, periodDate)))
    .limit(1);

  if (existing[0]) {
    await db.update(kpiTargets).set(data).where(eq(kpiTargets.id, existing[0].id));
  } else {
    await db.insert(kpiTargets).values({ kpiId, periodDate, ...data });
  }

  revalidatePath("/");
  revalidatePath(`/kpi/${kpiId}`);
  redirect(`/admin/kpi/${kpiId}/targets?success=Target+periode+berhasil+disimpan`);
}

export async function deleteTarget(id: number, kpiId: number) {
  await db.delete(kpiTargets).where(eq(kpiTargets.id, id));
  revalidatePath("/");
  revalidatePath(`/kpi/${kpiId}`);
}
