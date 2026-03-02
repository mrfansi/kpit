"use server";

import { db } from "@/lib/db";
import { kpiTargets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { z } from "zod";

const TargetSchema = z.object({
  target: z.number().finite().positive(),
  thresholdGreen: z.number().finite().positive(),
  thresholdYellow: z.number().finite().positive(),
}).refine(d => d.thresholdGreen >= d.thresholdYellow, {
  message: "thresholdGreen harus >= thresholdYellow",
});

export async function upsertTarget(kpiId: number, periodDate: string, data: {
  target: number;
  thresholdGreen: number;
  thresholdYellow: number;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  TargetSchema.parse(data);
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
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await db.delete(kpiTargets).where(eq(kpiTargets.id, id));
  revalidatePath("/");
  revalidatePath(`/kpi/${kpiId}`);
}
