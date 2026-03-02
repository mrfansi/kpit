"use server";

import { db } from "@/lib/db";
import { kpiEntries, type NewKPIEntry } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
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

export interface BulkEntryRow {
  kpiId: number;
  periodDate: string;
  value: number;
  note?: string;
}

export async function bulkCreateEntries(rows: BulkEntryRow[]): Promise<{ saved: number }> {
  if (rows.length === 0) return { saved: 0 };

  const periodDate = rows[0].periodDate;
  const kpiIds = rows.map((r) => r.kpiId);

  // Delete existing entries for these KPIs in this period
  await db.delete(kpiEntries).where(
    and(inArray(kpiEntries.kpiId, kpiIds), eq(kpiEntries.periodDate, periodDate))
  );

  // Insert all rows
  await db.insert(kpiEntries).values(rows);

  revalidatePath("/");
  for (const row of rows) {
    revalidatePath(`/kpi/${row.kpiId}`);
  }

  return { saved: rows.length };
}
