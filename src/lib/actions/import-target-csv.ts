"use server";

import { db } from "@/lib/db";
import { kpis, kpiTargets } from "@/lib/db/schema";
import { checkThresholdCoherence } from "@/lib/kpi-coherence";
import { and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseCSV } from "@/lib/csv-parser";
import { requireAdmin } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";
import { parsePlainNumber, kpiNameLookup, MAX_IMPORT_ROWS } from "@/lib/csv-import-utils";
import { isValidCalendarDate } from "@/lib/date-utils";
import { z } from "zod";

export interface TargetImportRow {
  rowIndex: number;
  kpiId: number;
  kpiName: string;
  periodDate: string;
  target: number;
  thresholdGreen: number;
  thresholdYellow: number;
  /** Target kpi_targets yang sudah ada untuk (kpiId, periodDate) ini, kalau ada — dipakai preview untuk menandai baris yang akan menimpa. */
  existingTarget?: number;
}

// Server-side schema: importTargetRows is a 'use server' action callable
// directly via RPC, bypassing resolveTargetCSVRows. Re-validate every row.
const TargetRowSchema = z.object({
  kpiId: z.number().int().positive(),
  periodDate: z.string().refine(isValidCalendarDate, "period_date tidak valid")
    .refine((d) => d.endsWith("-01"), "period_date harus tanggal 01 (target berlaku per bulan)"),
  target: z.number().finite().nonnegative(),
  thresholdGreen: z.number().finite().nonnegative(),
  thresholdYellow: z.number().finite().nonnegative(),
});

function parseNonNegativeFloat(raw: string | undefined): number {
  const n = parsePlainNumber(raw);
  return n >= 0 ? n : NaN;
}

export async function resolveTargetCSVRows(text: string): Promise<{
  resolved: TargetImportRow[];
  errors: { row: number; message: string }[];
}> {
  // Authenticate BEFORE parsing attacker-controlled CSV.
  await requireAdmin();

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

  const allKPIs = await db
    .select({ id: kpis.id, name: kpis.name, direction: kpis.direction, isActive: kpis.isActive })
    .from(kpis);
  const findByName = kpiNameLookup(allKPIs);
  const kpiById = new Map(allKPIs.map((k) => [k.id, k]));
  const idx = (col: string) => headers.indexOf(col);
  const seen = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    let kpi: (typeof allKPIs)[number] | undefined;
    if (hasId) {
      const raw = row[idx("kpi_id")];
      kpi = kpiById.get(Number(raw));
      if (!kpi) { errors.push({ row: rowNum, message: `KPI id "${raw}" tidak valid/ditemukan` }); continue; }
    } else {
      const found = findByName(row[idx("kpi_name")] ?? "");
      if ("error" in found) { errors.push({ row: rowNum, message: found.error }); continue; }
      kpi = found.kpi;
    }
    const { id: kpiId, name: kpiName, direction } = kpi;

    const periodDate = row[idx("period_date")] ?? "";
    if (!isValidCalendarDate(periodDate)) { errors.push({ row: rowNum, message: `period_date tidak valid: "${periodDate}"` }); continue; }
    if (!periodDate.endsWith("-01")) { errors.push({ row: rowNum, message: `period_date harus tanggal 01 (target berlaku per bulan): "${periodDate}"` }); continue; }

    const target = parseNonNegativeFloat(row[idx("target")]);
    if (isNaN(target)) { errors.push({ row: rowNum, message: `target tidak valid (harus angka nol atau positif): "${row[idx("target")]}"` }); continue; }

    const tgIdx = idx("threshold_green");
    const tyIdx = idx("threshold_yellow");

    // Default ambang mengikuti arah KPI: untuk lower_better, hijau/kuning ada di
    // ATAS target (kalau tidak, nilai tepat di target malah merah).
    // When a threshold column is present but the cell is non-numeric/negative,
    // reject the row instead of silently coercing to a default.
    const lowerBetter = direction === "lower_better";
    let thresholdGreen = target * (lowerBetter ? 1.1 : 0.9);
    if (tgIdx >= 0 && (row[tgIdx] ?? "").trim() !== "") {
      thresholdGreen = parseNonNegativeFloat(row[tgIdx]);
      if (isNaN(thresholdGreen)) { errors.push({ row: rowNum, message: `threshold_green tidak valid: "${row[tgIdx]}"` }); continue; }
    }

    let thresholdYellow = target * (lowerBetter ? 1.3 : 0.7);
    if (tyIdx >= 0 && (row[tyIdx] ?? "").trim() !== "") {
      thresholdYellow = parseNonNegativeFloat(row[tyIdx]);
      if (isNaN(thresholdYellow)) { errors.push({ row: rowNum, message: `threshold_yellow tidak valid: "${row[tyIdx]}"` }); continue; }
    }

    const incoherent = checkThresholdCoherence({ direction, target, thresholdGreen, thresholdYellow })
      .find((issue) => issue.level === "error");
    if (incoherent) { errors.push({ row: rowNum, message: `${kpiName}: ${incoherent.message}` }); continue; }

    const key = `${kpiId}:${periodDate}`;
    const firstRow = seen.get(key);
    if (firstRow !== undefined) { errors.push({ row: rowNum, message: `Duplikat KPI dan periode yang sama dengan baris ${firstRow}` }); continue; }
    seen.set(key, rowNum);

    resolved.push({ rowIndex: rowNum, kpiId, kpiName, periodDate, target, thresholdGreen, thresholdYellow });
  }

  // Cek target lama yang bertabrakan, supaya preview bisa memperingatkan
  // admin sebelum target lama ditimpa.
  if (resolved.length > 0) {
    // Satu query per file (bukan per 50 baris): D1 membatasi 50 query per invocation.
    // shortcut: mengambil semua pasangan KPI x periode yang disebut lalu mencocokkan di JS; upgrade bila tabel target sangat besar.
    const kpiIds = JSON.stringify([...new Set(resolved.map((r) => r.kpiId))]);
    const periods = JSON.stringify([...new Set(resolved.map((r) => r.periodDate))]);
    const existing = await db
      .select({ kpiId: kpiTargets.kpiId, periodDate: kpiTargets.periodDate, target: kpiTargets.target })
      .from(kpiTargets)
      .where(and(
        sql`${kpiTargets.kpiId} in (select value from json_each(${kpiIds}))`,
        sql`${kpiTargets.periodDate} in (select value from json_each(${periods}))`,
      ));
    const existingMap = new Map(existing.map((entry) => [`${entry.kpiId}:${entry.periodDate}`, entry.target]));
    for (const row of resolved) {
      row.existingTarget = existingMap.get(`${row.kpiId}:${row.periodDate}`);
    }
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
  const directionById = new Map(
    (await db.select({ id: kpis.id, direction: kpis.direction }).from(kpis)).map((k) => [k.id, k.direction]),
  );
  const seen = new Set<string>();

  try {
    const statements = [];
    for (const [i, raw] of rows.entries()) {
        const rowNum = raw?.rowIndex ?? i + 2;
        const parsed = TargetRowSchema.safeParse(raw);
        if (!parsed.success) {
          errors.push({ row: rowNum, message: parsed.error.issues[0]?.message ?? "Baris tidak valid" });
          continue;
        }
        const { kpiId, periodDate, target, thresholdGreen, thresholdYellow } = parsed.data;
        const direction = directionById.get(kpiId);
        if (!direction) {
          errors.push({ row: rowNum, message: `KPI id ${kpiId} tidak ditemukan` });
          continue;
        }
        const incoherent = checkThresholdCoherence({ direction, target, thresholdGreen, thresholdYellow })
          .find((issue) => issue.level === "error");
        if (incoherent) {
          errors.push({ row: rowNum, message: incoherent.message });
          continue;
        }
        if (seen.has(`${kpiId}:${periodDate}`)) {
          errors.push({ row: rowNum, message: "Duplikat KPI dan periode yang sama dalam satu import" });
          continue;
        }
        seen.add(`${kpiId}:${periodDate}`);
        const data = { target, thresholdGreen, thresholdYellow };

        statements.push(db.insert(kpiTargets).values({ kpiId, periodDate, ...data })
          .onConflictDoUpdate({
            target: [kpiTargets.kpiId, kpiTargets.periodDate],
            set: data,
          }));
      }
    const [first, ...rest] = statements;
    if (first) await db.batch([first, ...rest]);
    imported = statements.length;
  } catch (err) {
    console.error("importTargetRows batch failed", err);
    errors.push({ row: 0, message: "Gagal menyimpan ke database" });
    imported = 0;
  }

  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "create", entity: "kpi_target", detail: `CSV import: ${imported} target` });
  revalidatePath("/");
  return { imported, errors };
}
