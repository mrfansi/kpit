"use server";

import { db } from "@/lib/db";
import { kpiEntries, kpis } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseCSV } from "@/lib/csv-parser";

export interface ImportRow {
  kpiName: string;
  kpiId?: number;
  periodDate: string;
  value: number;
  note?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

/** Validate and resolve CSV rows against DB KPIs */
export async function resolveCSVRows(text: string): Promise<{
  resolved: (ImportRow & { rowIndex: number })[];
  errors: { row: number; message: string }[];
}> {
  const { headers, rows } = parseCSV(text);
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

  const allKPIs = await db.select({ id: kpis.id, name: kpis.name }).from(kpis);
  const kpiByName = new Map(allKPIs.map((k) => [k.name.toLowerCase(), k.id]));
  const kpiById   = new Map(allKPIs.map((k) => [k.id, k.name]));

  const idx = (col: string) => headers.indexOf(col);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    let kpiId: number | undefined;
    let kpiName = "";
    if (hasId) {
      const raw = row[idx("kpi_id")];
      kpiId = Number(raw);
      if (isNaN(kpiId)) { errors.push({ row: rowNum, message: `kpi_id tidak valid: "${raw}"` }); continue; }
      if (!kpiById.has(kpiId)) { errors.push({ row: rowNum, message: `KPI id ${kpiId} tidak ditemukan` }); continue; }
      kpiName = kpiById.get(kpiId)!;
    } else {
      kpiName = row[idx("kpi_name")] ?? "";
      const found = kpiByName.get(kpiName.toLowerCase());
      if (!found) { errors.push({ row: rowNum, message: `KPI "${kpiName}" tidak ditemukan` }); continue; }
      kpiId = found;
    }

    const periodDate = row[idx("period_date")] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodDate)) {
      errors.push({ row: rowNum, message: `period_date tidak valid: "${periodDate}" (format: YYYY-MM-DD)` });
      continue;
    }

    const value = parseFloat(row[idx("value")] ?? "");
    if (isNaN(value)) {
      errors.push({ row: rowNum, message: `value tidak valid: "${row[idx("value")]}"` });
      continue;
    }

    const note = headers.includes("note") ? (row[idx("note")] || undefined) : undefined;
    resolved.push({ rowIndex: rowNum, kpiName, kpiId, periodDate, value, note });
  }

  return { resolved, errors };
}

/** Upsert resolved rows into kpi_entries */
export async function importCSVRows(rows: ImportRow[]): Promise<ImportResult> {
  let imported = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  for (const row of rows) {
    try {
      if (!row.kpiId) { skipped++; continue; }
      await db.delete(kpiEntries).where(
        and(eq(kpiEntries.kpiId, row.kpiId), eq(kpiEntries.periodDate, row.periodDate))
      );
      await db.insert(kpiEntries).values({ kpiId: row.kpiId, periodDate: row.periodDate, value: row.value, note: row.note });
      imported++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/");
  return { imported, skipped, errors };
}

