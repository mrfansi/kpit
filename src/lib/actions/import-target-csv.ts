"use server";

import { db } from "@/lib/db";
import { kpis, kpiTargets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseCSV } from "@/lib/csv-parser";
import { requireAdmin, requireAuth } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";
import { validatePeriodDate, buildRowError } from "@/lib/csv-import-utils";

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

  await requireAuth();
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
    if (!validatePeriodDate(periodDate)) { errors.push(buildRowError(rowNum, `period_date tidak valid: "${periodDate}"`)); continue; }

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
  const session = await requireAdmin();
  let imported = 0;
  const errors: { row: number; message: string }[] = [];

  try {
    await db.transaction(async (tx) => {
      for (const row of rows) {
        const existing = await tx.select({ id: kpiTargets.id }).from(kpiTargets)
          .where(and(eq(kpiTargets.kpiId, row.kpiId), eq(kpiTargets.periodDate, row.periodDate))).limit(1);

        const data = { target: row.target, thresholdGreen: row.thresholdGreen, thresholdYellow: row.thresholdYellow };
        if (existing[0]) {
          await tx.update(kpiTargets).set(data).where(eq(kpiTargets.id, existing[0].id));
        } else {
          await tx.insert(kpiTargets).values({ kpiId: row.kpiId, periodDate: row.periodDate, ...data });
        }
        imported++;
      }
    });
  } catch (err) {
    errors.push({ row: 0, message: err instanceof Error ? err.message : "Gagal menyimpan" });
    imported = 0;
  }

  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "create", entity: "kpi_target", detail: `CSV import: ${imported} target` });
  revalidatePath("/");
  return { imported, errors };
}
