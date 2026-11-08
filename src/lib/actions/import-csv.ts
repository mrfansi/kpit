"use server";

import { db } from "@/lib/db";
import { kpis, kpiEntries } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseCSV } from "@/lib/csv-parser";
import { parsePlainNumber, kpiNameLookup, checkEntry, MAX_IMPORT_ROWS } from "@/lib/csv-import-utils";
import { requireAdmin } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";

export interface ImportRow {
  /** Nomor baris CSV asal (header = baris 1), supaya pesan error import menunjuk baris yang sama dengan preview. */
  rowIndex?: number;
  kpiName: string;
  kpiId?: number;
  periodDate: string;
  value: number;
  note?: string;
  /** Nilai kpi_entries yang sudah ada untuk (kpiId, periodDate) ini, kalau ada — dipakai preview untuk menandai baris yang akan menimpa data lama. */
  existingValue?: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

const kpiColumns = {
  id: kpis.id,
  name: kpis.name,
  unit: kpis.unit,
  minValue: kpis.minValue,
  maxValue: kpis.maxValue,
  period: kpis.period,
  isActive: kpis.isActive,
};

/**
 * Satu query per file, bukan per 50 baris: D1 membatasi 50 query per invocation.
 * shortcut: mengambil semua pasangan KPI x periode yang disebut, lalu mencocokkan di JS; upgrade bila tabel entri sangat besar.
 */
async function findExisting(rows: { kpiId: number; periodDate: string }[]) {
  const kpiIds = JSON.stringify([...new Set(rows.map((r) => r.kpiId))]);
  const periods = JSON.stringify([...new Set(rows.map((r) => r.periodDate))]);
  const found = await db
    .select({ kpiId: kpiEntries.kpiId, periodDate: kpiEntries.periodDate, value: kpiEntries.value, numerator: kpiEntries.numerator, denominator: kpiEntries.denominator })
    .from(kpiEntries)
    .where(and(
      sql`${kpiEntries.kpiId} in (select value from json_each(${kpiIds}))`,
      sql`${kpiEntries.periodDate} in (select value from json_each(${periods}))`,
    ));
  return new Map(found.map((e) => [`${e.kpiId}:${e.periodDate}`, e]));
}

/** Validate and resolve CSV rows against DB KPIs */
export async function resolveCSVRows(text: string): Promise<{
  resolved: (ImportRow & { rowIndex: number })[];
  errors: { row: number; message: string }[];
}> {
  await requireAdmin();
  const { headers, rows } = parseCSV(text);
  if (rows.length > MAX_IMPORT_ROWS) {
    return { resolved: [], errors: [{ row: 0, message: `Terlalu banyak baris (maks ${MAX_IMPORT_ROWS}).` }] };
  }
  const errors: { row: number; message: string }[] = [];
  const resolved: (ImportRow & { rowIndex: number })[] = [];

  const hasName = headers.includes("kpi_name");
  const hasId   = headers.includes("kpi_id");
  if (!hasName && !hasId) {
    return { resolved: [], errors: [{ row: 0, message: "Header wajib mengandung 'kpi_name' atau 'kpi_id'" }] };
  }
  if (!headers.includes("period_date")) {
    return { resolved: [], errors: [{ row: 0, message: "Header wajib mengandung 'period_date'" }] };
  }
  if (!headers.includes("value")) {
    return { resolved: [], errors: [{ row: 0, message: "Header wajib mengandung 'value'" }] };
  }

  const allKPIs = await db.select(kpiColumns).from(kpis);
  const kpiById = new Map(allKPIs.map((k) => [k.id, k]));
  const findByName = kpiNameLookup(allKPIs);

  const idx = (col: string) => headers.indexOf(col);
  const seen = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    let kpi: (typeof allKPIs)[number] | undefined;
    if (hasId) {
      const raw = row[idx("kpi_id")];
      const kpiId = Number(raw);
      if (isNaN(kpiId)) { errors.push({ row: rowNum, message: `kpi_id tidak valid: "${raw}"` }); continue; }
      kpi = kpiById.get(kpiId);
      if (!kpi) { errors.push({ row: rowNum, message: `KPI id ${kpiId} tidak ditemukan` }); continue; }
    } else {
      const found = findByName(row[idx("kpi_name")] ?? "");
      if ("error" in found) { errors.push({ row: rowNum, message: found.error }); continue; }
      kpi = found.kpi;
    }

    const periodDate = row[idx("period_date")] ?? "";
    const rawValue = row[idx("value")];
    const value = parsePlainNumber(rawValue);
    if (isNaN(value)) {
      errors.push({ row: rowNum, message: `value tidak valid: "${rawValue}" (pakai angka polos, titik sebagai desimal, tanpa pemisah ribuan)` });
      continue;
    }
    const entryError = checkEntry(kpi, periodDate, value);
    if (entryError) { errors.push({ row: rowNum, message: `${kpi.name}: ${entryError}` }); continue; }

    const key = `${kpi.id}:${periodDate}`;
    const firstRow = seen.get(key);
    if (firstRow !== undefined) {
      errors.push({ row: rowNum, message: `Duplikat KPI dan periode yang sama dengan baris ${firstRow}` });
      continue;
    }
    seen.set(key, rowNum);

    const note = headers.includes("note") ? (row[idx("note")] || undefined) : undefined;
    resolved.push({ rowIndex: rowNum, kpiName: kpi.name, kpiId: kpi.id, periodDate, value, note });
  }

  // Cek entri lama yang bertabrakan dengan baris yang akan diimport, supaya
  // preview bisa memperingatkan admin sebelum data lama ditimpa.
  if (resolved.length > 0) {
    const existing = await findExisting(resolved.map((row) => ({ kpiId: row.kpiId!, periodDate: row.periodDate })));
    for (const row of resolved) {
      row.existingValue = existing.get(`${row.kpiId}:${row.periodDate}`)?.value;
    }
  }

  return { resolved, errors };
}

/** Upsert resolved rows into kpi_entries */
export async function importCSVRows(rows: ImportRow[]): Promise<ImportResult> {
  const session = await requireAdmin();
  let imported = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  if (rows.length > MAX_IMPORT_ROWS) {
    return { imported: 0, skipped: rows.length, errors: [{ row: 0, message: `Terlalu banyak baris (maks ${MAX_IMPORT_ROWS}).` }] };
  }

  // Baris datang dari browser (action ini bisa dipanggil langsung), jadi aturan
  // resolveCSVRows diperiksa ulang terhadap data KPI di DB.
  const kpiById = new Map((await db.select(kpiColumns).from(kpis)).map((k) => [k.id, k]));
  const seen = new Set<string>();
  const validRows: (ImportRow & { rowIndex: number; kpiId: number })[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = row.rowIndex ?? i + 2;
    const kpi = row.kpiId ? kpiById.get(row.kpiId) : undefined;
    const rowError = !kpi
      ? "kpiId tidak ditemukan"
      : !Number.isFinite(row.value)
        ? "value tidak valid"
        : checkEntry(kpi, row.periodDate, row.value)
          ?? (seen.has(`${kpi.id}:${row.periodDate}`) ? "Duplikat KPI dan periode yang sama dalam satu import" : null);
    if (rowError) {
      errors.push({ row: rowNum, message: kpi ? `${kpi.name}: ${rowError}` : rowError });
      skipped++;
    } else {
      seen.add(`${row.kpiId}:${row.periodDate}`);
      validRows.push({ ...row, rowIndex: rowNum, kpiId: row.kpiId! });
    }
  }

  try {
    const existing = await findExisting(validRows);
    const [first, ...rest] = validRows.map((row) => {
      // Nilai tidak berubah: pembilang/penyebut lama tetap cocok, jadi dipertahankan.
      const old = existing.get(`${row.kpiId}:${row.periodDate}`);
      const parts = old?.value === row.value
        ? { numerator: old.numerator, denominator: old.denominator }
        : {};
      return [
        db.delete(kpiEntries).where(
          and(eq(kpiEntries.kpiId, row.kpiId), eq(kpiEntries.periodDate, row.periodDate))
        ),
        db.insert(kpiEntries).values({
          kpiId: row.kpiId,
          periodDate: row.periodDate,
          value: row.value,
          note: row.note,
          ...parts,
        }),
      ] as const;
    }).flat();
    if (first) await db.batch([first, ...rest]);
    imported = validRows.length;
  } catch (err) {
    console.error("importCSVRows batch failed", err);
    for (const row of validRows) {
      errors.push({ row: row.rowIndex, message: "Gagal menyimpan ke database" });
      skipped++;
    }
    imported = 0;
  }

  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "create", entity: "kpi_entry", detail: `CSV import: ${imported} entri` });

  revalidatePath("/");
  return { imported, skipped, errors };
}

