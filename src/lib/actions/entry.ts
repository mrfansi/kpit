"use server";

import { type NewKPIEntry } from "@/lib/db/schema";
import { kpiEntries, kpis } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { upsertKPIEntry } from "@/lib/db/entries";
import { requireAdmin } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";
import { checkValueBounds } from "@/lib/kpi-bounds";

const EntrySchema = z.object({
  kpiId: z.number().int().positive(),
  value: z.number().finite(),
  periodDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(50000).optional(),
});

const BulkEntrySchema = z.array(EntrySchema).min(1);

/** Cek entri existing untuk satu KPI+periode — dipakai form input untuk peringatan sebelum menimpa. */
export async function getExistingEntry(kpiId: number, periodDate: string): Promise<{ value: number } | null> {
  await requireAdmin();
  const row = await db
    .select({ value: kpiEntries.value })
    .from(kpiEntries)
    .where(and(eq(kpiEntries.kpiId, kpiId), eq(kpiEntries.periodDate, periodDate)))
    .get();
  return row ?? null;
}

export type EntryResult = { error: string } | { success: true };

function invalidDataMessage(error: z.ZodError) {
  const path = error.issues[0]?.path.join(".");
  return path ? `Data tidak valid (${path})` : "Data tidak valid";
}

export async function createEntry(data: Omit<NewKPIEntry, "createdAt">): Promise<EntryResult> {
  const session = await requireAdmin();
  const parsed = EntrySchema.safeParse(data);
  if (!parsed.success) return { error: invalidDataMessage(parsed.error) };
  try {
    const kpi = await db
      .select({ id: kpis.id, minValue: kpis.minValue, maxValue: kpis.maxValue, unit: kpis.unit, name: kpis.name })
      .from(kpis)
      .where(eq(kpis.id, data.kpiId))
      .get();
    if (!kpi) return { error: "KPI tidak ditemukan" };

    const boundsError = checkValueBounds(data.value, kpi);
    if (boundsError) return { error: `${kpi.name}: ${boundsError}` };

    await upsertKPIEntry({ ...data, note: data.note ?? undefined });
    await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "create", entity: "kpi_entry", entityId: String(data.kpiId), detail: `periode ${data.periodDate}` });
    revalidatePath("/");
    revalidatePath(`/kpi/${data.kpiId}`);
    return { success: true };
  } catch (error) {
    console.error("createEntry failed", error);
    throw error;
  }
}

export async function updateEntry(id: number, value: number, note?: string): Promise<EntryResult> {
  const session = await requireAdmin();
  if (!Number.isFinite(value)) return { error: "Nilai tidak valid" };

  try {
    // Batas KPI-nya diambil lewat entri, karena pemanggil hanya menyebut id entri.
    const row = await db
      .select({ minValue: kpis.minValue, maxValue: kpis.maxValue, unit: kpis.unit, name: kpis.name })
      .from(kpiEntries)
      .innerJoin(kpis, eq(kpiEntries.kpiId, kpis.id))
      .where(eq(kpiEntries.id, id))
      .get();
    if (!row) return { error: "Entri tidak ditemukan" };

    const boundsError = checkValueBounds(value, row);
    if (boundsError) return { error: `${row.name}: ${boundsError}` };

    await db.update(kpiEntries).set({ value, note: note?.trim() ? note : null }).where(eq(kpiEntries.id, id));
    await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "kpi_entry", entityId: String(id) });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("updateEntry failed", error);
    throw error;
  }
}

export async function deleteEntry(id: number, kpiId: number) {
  const session = await requireAdmin();
  await db.delete(kpiEntries).where(eq(kpiEntries.id, id));
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "delete", entity: "kpi_entry", entityId: String(id) });
  revalidatePath("/");
  revalidatePath(`/kpi/${kpiId}`);
}

interface BulkEntryRow {
  kpiId: number;
  periodDate: string;
  value: number;
  note?: string;
}

export async function bulkCreateEntries(rows: BulkEntryRow[]): Promise<{ saved: number } | { error: string }> {
  const session = await requireAdmin();
  if (rows.length === 0) return { saved: 0 };

  const parsed = BulkEntrySchema.safeParse(rows);
  if (!parsed.success) return { error: invalidDataMessage(parsed.error) };
  const parsedRows = parsed.data;

  const periodDate = parsedRows[0].periodDate;
  if (!parsedRows.every((row) => row.periodDate === periodDate)) {
    return { error: "Semua entri bulk harus berada dalam periode yang sama" };
  }

  const kpiIds = parsedRows.map((r) => r.kpiId);

  try {
    // Verify every referenced KPI exists before writing (no orphan entries).
    const kpiById = new Map<number, Pick<typeof kpis.$inferSelect, "id" | "name" | "unit" | "minValue" | "maxValue">>();
    for (let i = 0; i < kpiIds.length; i += 100) {
      const kpiRows = await db
        .select({
          id: kpis.id,
          name: kpis.name,
          unit: kpis.unit,
          minValue: kpis.minValue,
          maxValue: kpis.maxValue,
        })
        .from(kpis)
        .where(inArray(kpis.id, kpiIds.slice(i, i + 100)));
      for (const kpi of kpiRows) kpiById.set(kpi.id, kpi);
    }
    if (kpiIds.some((id) => !kpiById.has(id))) {
      return { error: "Sebagian KPI tidak ditemukan" };
    }

    // Semua baris diperiksa dulu, dan seluruh bulk ditolak kalau ada satu yang
    // di luar batas. Menyimpan sebagian akan meninggalkan periode yang setengah
    // terisi tanpa jejak baris mana yang gagal.
    const boundsErrors = parsedRows.flatMap((row) => {
      const kpi = kpiById.get(row.kpiId)!;
      const error = checkValueBounds(row.value, kpi);
      return error ? [`${kpi.name}: ${error}`] : [];
    });
    if (boundsErrors.length > 0) {
      return { error: boundsErrors.join(" ") };
    }

    const deletes = kpiIds.map((kpiId) => db.delete(kpiEntries).where(
      and(eq(kpiEntries.kpiId, kpiId), eq(kpiEntries.periodDate, periodDate))
    ));
    const [first, ...rest] = deletes;
    await db.batch([first!, ...rest, ...parsedRows.map((row) => db.insert(kpiEntries).values(row))]);

    await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "create", entity: "kpi_entry", detail: `bulk ${parsedRows.length} entri periode ${periodDate}` });

    revalidatePath("/");
    for (const row of parsedRows) {
      revalidatePath(`/kpi/${row.kpiId}`);
    }

    return { saved: parsedRows.length };
  } catch (error) {
    console.error("bulkCreateEntries failed", error);
    throw error;
  }
}
