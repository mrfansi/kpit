"use server";

import { db } from "@/lib/db";
import { kpis, kpiTargets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseCSV } from "@/lib/csv-parser";

export interface TargetImportRow {
  rowIndex: number;
  kpiId: number;
  kpiName: string;
  periodDate: string;
  target: number;
  thresholdGreen: number;
  thresholdYellow: number;
}

export async function resolveTargetCSVRows(text: string): Promise<{
  resolved: TargetImportRow[];
  errors: { row: number; message: string }[];
}> {
  const { headers, rows } = parseCSV(text);
  const errors: { row: number; message: string }[] = [];
  const resolved: TargetImportRow[] = [];

  const hasName = headers.includes("kpi_name");
  const hasId = headers.includes("kpi_id");

  if (!hasName && !hasId) return { resolved: [], errors: [{ row: 0, message: "Header wajib mengandung 'kpi_name' atau 'kpi_id'" }] };
  if (!headers.includes("period_date")) return { resolved: [], errors: [{ row: 0, message: "Header wajib mengandung 'period_date'" }] };
  if (!headers.includes("target")) return { resolved: [], errors: [{ row: 0, message: "Header wajib mengandung 'target'" }] };

  const allKPIs = await db.select({ id: kpis.id, name: kpis.name }).from(kpis);
  const kpiByName = new Map(allKPIs.map((k) => [k.name.toLowerCase(), k]));
  const kpiById = new Map(allKPIs.map((k) => [k.id, k.name]));
  const idx = (col: string) => headers.indexOf(col);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    let kpiId: number | undefined;
    let kpiName = "";

    if (hasId) {
      const raw = row[idx("kpi_id")];
      kpiId = Number(raw);
      if (isNaN(kpiId) || !kpiById.has(kpiId)) { errors.push({ row: rowNum, message: `KPI id "${raw}" tidak valid/ditemukan` }); continue; }
      kpiName = kpiById.get(kpiId)!;
    } else {
      kpiName = row[idx("kpi_name")] ?? "";
      const found = kpiByName.get(kpiName.toLowerCase());
      if (!found) { errors.push({ row: rowNum, message: `KPI "${kpiName}" tidak ditemukan` }); continue; }
      kpiId = found.id;
    }

    const periodDate = row[idx("period_date")] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodDate)) { errors.push({ row: rowNum, message: `period_date tidak valid: "${periodDate}"` }); continue; }

    const target = parseFloat(row[idx("target")] ?? "");
    if (isNaN(target)) { errors.push({ row: rowNum, message: `target tidak valid: "${row[idx("target")]}"` }); continue; }

    const tgIdx = idx("threshold_green");
    const tyIdx = idx("threshold_yellow");
    const thresholdGreen = tgIdx >= 0 ? parseFloat(row[tgIdx] ?? "") : NaN;
    const thresholdYellow = tyIdx >= 0 ? parseFloat(row[tyIdx] ?? "") : NaN;

    resolved.push({
      rowIndex: rowNum,
      kpiId: kpiId!,
      kpiName,
      periodDate,
      target,
      thresholdGreen: isNaN(thresholdGreen) ? target * 0.9 : thresholdGreen,
      thresholdYellow: isNaN(thresholdYellow) ? target * 0.7 : thresholdYellow,
    });
  }

  return { resolved, errors };
}

export async function importTargetRows(rows: TargetImportRow[]): Promise<{ imported: number; errors: { row: number; message: string }[] }> {
  let imported = 0;
  const errors: { row: number; message: string }[] = [];

  for (const row of rows) {
    try {
      const existing = await db.select({ id: kpiTargets.id }).from(kpiTargets)
        .where(and(eq(kpiTargets.kpiId, row.kpiId), eq(kpiTargets.periodDate, row.periodDate))).limit(1);

      const data = { target: row.target, thresholdGreen: row.thresholdGreen, thresholdYellow: row.thresholdYellow };
      if (existing[0]) {
        await db.update(kpiTargets).set(data).where(eq(kpiTargets.id, existing[0].id));
      } else {
        await db.insert(kpiTargets).values({ kpiId: row.kpiId, periodDate: row.periodDate, ...data });
      }
      imported++;
    } catch (err) {
      errors.push({ row: row.rowIndex, message: err instanceof Error ? err.message : "Gagal menyimpan" });
    }
  }

  revalidatePath("/");
  return { imported, errors };
}
