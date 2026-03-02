"use server";

import { db } from "@/lib/db";
import { kpiEntries, type NewKPIEntry } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createEntry(data: Omit<NewKPIEntry, "createdAt">) {
  await db
    .delete(kpiEntries)
    .where(and(eq(kpiEntries.kpiId, data.kpiId), eq(kpiEntries.periodDate, data.periodDate)));
  await db.insert(kpiEntries).values(data);
  revalidatePath("/");
  revalidatePath(`/kpi/${data.kpiId}`);
}

export async function updateEntry(id: number, value: number, note?: string) {
  await db.update(kpiEntries).set({ value, note }).where(eq(kpiEntries.id, id));
  revalidatePath("/");
}

export async function deleteEntry(id: number, kpiId: number) {
  await db.delete(kpiEntries).where(eq(kpiEntries.id, id));
  revalidatePath("/");
  revalidatePath(`/kpi/${kpiId}`);
}
