"use server";

import { db } from "@/lib/db";
import { kpis, kpiEntries } from "@/lib/db/schema";
import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseCSV } from "@/lib/csv-parser";
import { parsePlainNumber, kpiNameLookup, MAX_IMPORT_ROWS } from "@/lib/csv-import-utils";
import { isValidCalendarDate } from "@/lib/date-utils";
import { checkValueBounds } from "@/lib/kpi-bounds";
import { requireAdmin, requireAuth } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";

export interface ImportRow {
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
type KPIRef = { name: string; unit: string; minValue: number | null; maxValue: number | null; period: string };

/**
 * Aturan yang sama dengan form input: tanggal sah, KPI bulanan wajib tanggal 01
 * (dashboard hanya membaca tanggal 01), dan nilai dalam batas KPI. Dipakai di
 * resolve (preview) dan di import, karena baris import datang dari browser.
 */
function checkEntry(kpi: KPIRef, periodDate: string, value: number): string | null {
  if (!isValidCalendarDate(periodDate)) return `period_date tidak valid: "${periodDate}" (format: YYYY-MM-DD)`;
  if (kpi.period === "monthly" && !periodDate.endsWith("-01")) {
    return `period_date harus tanggal 01 untuk KPI bulanan: "${periodDate}"`;
  }
  return checkValueBounds(value, kpi);
}

/** Validate and resolve CSV rows against DB KPIs */
export async function resolveCSVRows(text: string): Promise<{
  resolved: (ImportRow & { rowIndex: number })[];
  errors: { row: number; message: string }[];
}> {
  await requireAuth();
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
    const existingMap = new Map<string, number>();
    for (let i = 0; i < resolved.length; i += 50) {
      const existing = await db
        .select({ kpiId: kpiEntries.kpiId, periodDate: kpiEntries.periodDate, value: kpiEntries.value })
        .from(kpiEntries)
        .where(or(...resolved.slice(i, i + 50).map((row) =>
          and(eq(kpiEntries.kpiId, row.kpiId!), eq(kpiEntries.periodDate, row.periodDate))
        )));
      for (const entry of existing) existingMap.set(`${entry.kpiId}:${entry.periodDate}`, entry.value);
    }
    for (const row of resolved) {
      row.existingValue = existingMap.get(`${row.kpiId}:${row.periodDate}`);
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
    const rowNum = i + 2;
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
    const [first, ...rest] = validRows.map((row) => [
      db.delete(kpiEntries).where(
        and(eq(kpiEntries.kpiId, row.kpiId), eq(kpiEntries.periodDate, row.periodDate))
      ),
      db.insert(kpiEntries).values({
        kpiId: row.kpiId,
        periodDate: row.periodDate,
        value: row.value,
        note: row.note,
      }),
    ] as const).flat();
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

