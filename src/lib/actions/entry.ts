"use server";

import { type NewKPIEntry, type KPIEntry } from "@/lib/db/schema";
import { kpiEntries, kpis } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { formatChanges, logAudit } from "@/lib/db/audit";
import { checkEntry } from "@/lib/csv-import-utils";
import { checkValueBounds } from "@/lib/kpi-bounds";

const EntrySchema = z.object({
  kpiId: z.number().int().positive(),
  value: z.number().finite(),
  periodDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(50000).optional(),
  numerator: z.number().finite().nullish(),
  denominator: z.number().finite().nullish(),
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

/**
 * Nilai rasio dihitung di server dari pembilang/penyebut (x100 untuk unit %), jadi
 * angka dari klien tidak pernah menentukan nilai yang tersimpan. Tanpa bagian: nilai apa adanya.
 */
function resolveParts(
  unit: string,
  entry: { value: number; numerator?: number | null; denominator?: number | null },
): { error: string } | { value: number; numerator: number | null; denominator: number | null } {
  const { numerator, denominator } = entry;
  if (numerator == null && denominator == null) return { value: entry.value, numerator: null, denominator: null };
  if (numerator == null || denominator == null) return { error: "Pembilang dan penyebut harus diisi keduanya" };
  if (denominator <= 0) return { error: "Penyebut harus lebih dari 0" };
  const value = unit === "%" ? (numerator * 100) / denominator : numerator / denominator;
  if (!Number.isFinite(value)) return { error: "Nilai hasil hitung tidak valid" };
  return { value, numerator, denominator };
}

export async function createEntry(data: Omit<NewKPIEntry, "createdAt">): Promise<EntryResult> {
  const session = await requireAdmin();
  const parsed = EntrySchema.safeParse(data);
  if (!parsed.success) return { error: invalidDataMessage(parsed.error) };
  try {
    const kpi = await db
      .select({ id: kpis.id, minValue: kpis.minValue, maxValue: kpis.maxValue, unit: kpis.unit, name: kpis.name, period: kpis.period })
      .from(kpis)
      .where(eq(kpis.id, parsed.data.kpiId))
      .get();
    if (!kpi) return { error: "KPI tidak ditemukan" };

    const resolved = resolveParts(kpi.unit, parsed.data);
    if ("error" in resolved) return { error: `${kpi.name}: ${resolved.error}` };
    const entry = { ...parsed.data, ...resolved };

    const entryError = checkEntry(kpi, entry.periodDate, entry.value);
    if (entryError) return { error: `${kpi.name}: ${entryError}` };

    const [removed] = await db.batch([
      db.delete(kpiEntries)
        .where(and(eq(kpiEntries.kpiId, entry.kpiId), eq(kpiEntries.periodDate, entry.periodDate)))
        .returning(),
      db.insert(kpiEntries).values(entry),
    ]);
    const old = removed[0];
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? undefined,
      action: old ? "update" : "create",
      entity: "kpi_entry",
      entityId: `${entry.kpiId}:${entry.periodDate}`,
      detail: formatChanges(
        old ? { value: old.value, note: old.note, numerator: old.numerator, denominator: old.denominator } : {},
        { value: entry.value, note: entry.note, numerator: entry.numerator, denominator: entry.denominator },
      ),
    });
    revalidatePath("/");
    revalidatePath(`/kpi/${entry.kpiId}`);
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
      .select({ kpiId: kpiEntries.kpiId, periodDate: kpiEntries.periodDate, value: kpiEntries.value, note: kpiEntries.note, numerator: kpiEntries.numerator, denominator: kpiEntries.denominator, minValue: kpis.minValue, maxValue: kpis.maxValue, unit: kpis.unit, name: kpis.name })
      .from(kpiEntries)
      .innerJoin(kpis, eq(kpiEntries.kpiId, kpis.id))
      .where(eq(kpiEntries.id, id))
      .get();
    if (!row) return { error: "Entri tidak ditemukan" };

    const boundsError = checkValueBounds(value, row);
    if (boundsError) return { error: `${row.name}: ${boundsError}` };

    const newNote = note?.trim() ? note : null;
    // Nilai yang diedit tidak lagi cocok dengan pembilang/penyebut lama, jadi keduanya dikosongkan.
    await db.update(kpiEntries).set({ value, note: newNote, numerator: null, denominator: null }).where(eq(kpiEntries.id, id));
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? undefined,
      action: "update",
      entity: "kpi_entry",
      entityId: `${row.kpiId}:${row.periodDate}`,
      detail: formatChanges(
        { value: row.value, note: row.note, numerator: row.numerator, denominator: row.denominator },
        { value, note: newNote, numerator: null, denominator: null },
      ),
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("updateEntry failed", error);
    throw error;
  }
}

export async function deleteEntry(id: number, kpiId: number) {
  const session = await requireAdmin();
  const [deleted]: KPIEntry[] = await db.delete(kpiEntries).where(eq(kpiEntries.id, id)).returning();
  if (deleted) {
    await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "delete", entity: "kpi_entry", entityId: `${deleted.kpiId}:${deleted.periodDate}`, detail: formatChanges({ value: deleted.value }, {}) });
  }
  revalidatePath("/");
  revalidatePath(`/kpi/${kpiId}`);
}

interface BulkEntryRow {
  kpiId: number;
  periodDate: string;
  value: number;
  note?: string;
  numerator?: number | null;
  denominator?: number | null;
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
  if (new Set(kpiIds).size !== kpiIds.length) {
    return { error: "Satu KPI tidak boleh muncul lebih dari sekali dalam satu bulk" };
  }

  try {
    // Verify every referenced KPI exists before writing (no orphan entries).
    const kpiById = new Map<number, Pick<typeof kpis.$inferSelect, "id" | "name" | "unit" | "minValue" | "maxValue" | "period">>();
    for (let i = 0; i < kpiIds.length; i += 100) {
      const kpiRows = await db
        .select({
          id: kpis.id,
          name: kpis.name,
          unit: kpis.unit,
          minValue: kpis.minValue,
          maxValue: kpis.maxValue,
          period: kpis.period,
        })
        .from(kpis)
        .where(inArray(kpis.id, kpiIds.slice(i, i + 100)));
      for (const kpi of kpiRows) kpiById.set(kpi.id, kpi);
    }
    if (kpiIds.some((id) => !kpiById.has(id))) {
      return { error: "Sebagian KPI tidak ditemukan" };
    }

    // Semua baris diperiksa dulu (aturan yang sama dengan form tunggal), dan
    // seluruh bulk ditolak kalau ada satu yang salah. Menyimpan sebagian akan
    // meninggalkan periode yang setengah terisi tanpa jejak baris mana yang gagal.
    const rowErrors: string[] = [];
    const resolvedRows = parsedRows.map((row) => {
      const kpi = kpiById.get(row.kpiId)!;
      const resolved = resolveParts(kpi.unit, row);
      const error = "error" in resolved ? resolved.error : checkEntry(kpi, row.periodDate, resolved.value);
      if (error) rowErrors.push(`${kpi.name}: ${error}`);
      return { ...row, ...("error" in resolved ? {} : resolved) };
    });
    if (rowErrors.length > 0) {
      return { error: rowErrors.join(" ") };
    }

    const deletes = kpiIds.map((kpiId) => db.delete(kpiEntries).where(
      and(eq(kpiEntries.kpiId, kpiId), eq(kpiEntries.periodDate, periodDate))
    ).returning());
    const [first, ...rest] = deletes;
    const results = await db.batch([first!, ...rest, ...resolvedRows.map((row) => db.insert(kpiEntries).values(row))]);

    // Hasil batch: satu array baris terhapus per KPI, lalu hasil insert.
    const oldByKpi = new Map(
      (results.slice(0, kpiIds.length).flat() as unknown as KPIEntry[]).map((e) => [e.kpiId, e]),
    );
    const changes = resolvedRows.flatMap((row) => {
      const old = oldByKpi.get(row.kpiId);
      const diff = old
        ? formatChanges(
            { value: old.value, note: old.note, numerator: old.numerator, denominator: old.denominator },
            { value: row.value, note: row.note, numerator: row.numerator, denominator: row.denominator },
          )
        : "";
      return diff ? [`${kpiById.get(row.kpiId)!.name} (${row.kpiId}) ${diff}`] : [];
    });
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? undefined,
      action: "create",
      entity: "kpi_entry",
      detail: `bulk ${parsedRows.length} entri periode ${periodDate}${oldByKpi.size > 0 ? `, menimpa ${oldByKpi.size}` : ""}${changes.length > 0 ? `: ${changes.join("; ")}` : ""}`,
    });

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
