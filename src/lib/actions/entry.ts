"use server";

import { type NewKPIEntry } from "@/lib/db/schema";
import { kpiEntries } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { upsertKPIEntry } from "@/lib/db/entries";

const EntrySchema = z.object({
  kpiId: z.number().int().positive(),
  value: z.number().finite(),
  periodDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
});

export async function createEntry(data: Omit<NewKPIEntry, "createdAt">) {
  EntrySchema.parse(data);
  await upsertKPIEntry({ ...data, note: data.note ?? undefined });
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
