"use server";

import { db } from "@/lib/db";
import { kpis, kpiTargets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseCSV } from "@/lib/csv-parser";
import { requireAdmin, requireAuth } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";
import { validatePeriodDate, buildRowError, MAX_IMPORT_ROWS } from "@/lib/csv-import-utils";
import { z } from "zod";

export interface TargetImportRow {
  rowIndex: number;
  kpiId: number;
  kpiName: string;
  periodDate: string;
  target: number;
  thresholdGreen: number;
  thresholdYellow: number;
}

// Server-side schema: importTargetRows is a 'use server' action callable
// directly via RPC, bypassing resolveTargetCSVRows. Re-validate every row.
const TargetRowSchema = z.object({
  kpiId: z.number().int().positive(),
  periodDate: z.string().refine(validatePeriodDate, "period_date tidak valid"),
  target: z.number().finite().positive(),
  thresholdGreen: z.number().finite().positive(),
  thresholdYellow: z.number().finite().positive(),
});

function parsePositiveFloat(raw: string | undefined): number {
  const n = parseFloat(raw ?? "");
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

export async function resolveTargetCSVRows(text: string): Promise<{
  resolved: TargetImportRow[];
  errors: { row: number; message: string }[];
}> {
  // Authenticate BEFORE parsing attacker-controlled CSV.
  await requireAuth();

  const { headers, rows } = parseCSV(text);
  if (rows.length > MAX_IMPORT_ROWS) {
    return { resolved: [], errors: [{ row: 0, message: `Terlalu banyak baris (maks ${MAX_IMPORT_ROWS}).` }] };
  }
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
    if (!validatePeriodDate(periodDate)) { errors.push(buildRowError(rowNum, `period_date tidak valid: "${periodDate}"`)); continue; }

    const target = parsePositiveFloat(row[idx("target")]);
    if (isNaN(target)) { errors.push({ row: rowNum, message: `target tidak valid (harus angka positif): "${row[idx("target")]}"` }); continue; }

    const tgIdx = idx("threshold_green");
    const tyIdx = idx("threshold_yellow");

    // When a threshold column is present but the cell is non-numeric/non-positive,
    // reject the row instead of silently coercing to a default.
    let thresholdGreen = target * 0.9;
    if (tgIdx >= 0 && (row[tgIdx] ?? "").trim() !== "") {
      thresholdGreen = parsePositiveFloat(row[tgIdx]);
      if (isNaN(thresholdGreen)) { errors.push({ row: rowNum, message: `threshold_green tidak valid: "${row[tgIdx]}"` }); continue; }
    }

    let thresholdYellow = target * 0.7;
    if (tyIdx >= 0 && (row[tyIdx] ?? "").trim() !== "") {
      thresholdYellow = parsePositiveFloat(row[tyIdx]);
      if (isNaN(thresholdYellow)) { errors.push({ row: rowNum, message: `threshold_yellow tidak valid: "${row[tyIdx]}"` }); continue; }
    }

    resolved.push({ rowIndex: rowNum, kpiId, kpiName, periodDate, target, thresholdGreen, thresholdYellow });
  }

  return { resolved, errors };
}

export async function importTargetRows(rows: TargetImportRow[]): Promise<{ imported: number; errors: { row: number; message: string }[] }> {
  const session = await requireAdmin();
  let imported = 0;
  const errors: { row: number; message: string }[] = [];

  if (rows.length > MAX_IMPORT_ROWS) {
    return { imported: 0, errors: [{ row: 0, message: `Terlalu banyak baris (maks ${MAX_IMPORT_ROWS}).` }] };
  }

  // Verify KPI existence against the DB (FK is also enforced, this gives a
  // clean per-row error instead of a constraint failure).
  const existingKpiIds = new Set((await db.select({ id: kpis.id }).from(kpis)).map((k) => k.id));

  try {
    await db.transaction(async (tx) => {
      for (const raw of rows) {
        const rowNum = raw?.rowIndex ?? 0;
        const parsed = TargetRowSchema.safeParse(raw);
        if (!parsed.success) {
          errors.push({ row: rowNum, message: parsed.error.issues[0]?.message ?? "Baris tidak valid" });
          continue;
        }
        if (!existingKpiIds.has(parsed.data.kpiId)) {
          errors.push({ row: rowNum, message: `KPI id ${parsed.data.kpiId} tidak ditemukan` });
          continue;
        }

        const { kpiId, periodDate, target, thresholdGreen, thresholdYellow } = parsed.data;
        const data = { target, thresholdGreen, thresholdYellow };

        const existing = await tx.select({ id: kpiTargets.id }).from(kpiTargets)
          .where(and(eq(kpiTargets.kpiId, kpiId), eq(kpiTargets.periodDate, periodDate))).limit(1);

        if (existing[0]) {
          await tx.update(kpiTargets).set(data).where(eq(kpiTargets.id, existing[0].id));
        } else {
          await tx.insert(kpiTargets).values({ kpiId, periodDate, ...data });
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
