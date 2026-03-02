import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { domains, kpiComments, kpiEntries, kpiTargets, kpis, type KPI, type KPIComment, type KPIEntry, type KPITarget } from "./db/schema";

export async function getAllDomains() {
  return db.select().from(domains).orderBy(domains.name);
}

export async function getDomainBySlug(slug: string) {
  const rows = await db.select().from(domains).where(eq(domains.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getKPIsByDomain(domainId: number): Promise<KPI[]> {
  return db.select().from(kpis).where(and(eq(kpis.domainId, domainId), eq(kpis.isActive, true))).orderBy(kpis.sortOrder, kpis.name);
}

export async function getAllKPIs(): Promise<KPI[]> {
  return db.select().from(kpis).where(eq(kpis.isActive, true)).orderBy(kpis.domainId, kpis.sortOrder, kpis.name);
}

export async function getArchivedKPIs(): Promise<KPI[]> {
  return db.select().from(kpis).where(eq(kpis.isActive, false)).orderBy(kpis.domainId, kpis.name);
}

export async function getKPIById(id: number): Promise<KPI | null> {
  const rows = await db.select().from(kpis).where(eq(kpis.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getLatestEntry(kpiId: number, atOrBeforeDate?: string): Promise<KPIEntry | null> {
  const conditions = [eq(kpiEntries.kpiId, kpiId)];
  if (atOrBeforeDate) conditions.push(lte(kpiEntries.periodDate, atOrBeforeDate));

  const rows = await db
    .select()
    .from(kpiEntries)
    .where(and(...conditions))
    .orderBy(desc(kpiEntries.periodDate))
    .limit(1);
  return rows[0] ?? null;
}

export async function getKPIEntries(kpiId: number, fromDate?: string, toDate?: string): Promise<KPIEntry[]> {
  const conditions = [eq(kpiEntries.kpiId, kpiId)];
  if (fromDate) conditions.push(gte(kpiEntries.periodDate, fromDate));
  if (toDate) conditions.push(lte(kpiEntries.periodDate, toDate));

  return db
    .select()
    .from(kpiEntries)
    .where(and(...conditions))
    .orderBy(kpiEntries.periodDate);
}

export async function getKPIsWithLatestEntry(domainId?: number, atOrBeforeDate?: string) {
  const allKPIs = domainId ? await getKPIsByDomain(domainId) : await getAllKPIs();
  if (allKPIs.length === 0) return [];

  const kpiIds = allKPIs.map((k) => k.id);
  const dateCondition = atOrBeforeDate ? lte(kpiEntries.periodDate, atOrBeforeDate) : undefined;

  // Batch 1: latest entry per KPI (single query via row_number window function emulated with MAX)
  const latestEntriesRaw = await db
    .select()
    .from(kpiEntries)
    .where(and(inArray(kpiEntries.kpiId, kpiIds), ...(dateCondition ? [dateCondition] : [])))
    .orderBy(kpiEntries.kpiId, desc(kpiEntries.periodDate));

  // Build map: kpiId → latest entry
  const latestEntryMap = new Map<number, typeof latestEntriesRaw[0]>();
  for (const entry of latestEntriesRaw) {
    if (!latestEntryMap.has(entry.kpiId)) {
      latestEntryMap.set(entry.kpiId, entry);
    }
  }

  // Batch 2: last 6 entries per KPI for sparkline (reuse sorted data above)
  const sparklineMap = new Map<number, typeof latestEntriesRaw>();
  for (const entry of [...latestEntriesRaw].reverse()) {
    const arr = sparklineMap.get(entry.kpiId) ?? [];
    if (arr.length < 6) arr.push(entry);
    sparklineMap.set(entry.kpiId, arr);
  }

  // Batch 3: target overrides for all KPIs at their latest period
  const periodDates = [...latestEntryMap.values()].map((e) => e.periodDate);
  const targetOverrides = periodDates.length > 0
    ? await db
        .select()
        .from(kpiTargets)
        .where(and(inArray(kpiTargets.kpiId, kpiIds), inArray(kpiTargets.periodDate, periodDates)))
    : [];

  const targetOverrideMap = new Map<string, typeof targetOverrides[0]>();
  for (const t of targetOverrides) {
    targetOverrideMap.set(`${t.kpiId}:${t.periodDate}`, t);
  }

  return allKPIs.map((kpi) => {
    const latestEntry = latestEntryMap.get(kpi.id) ?? null;
    const sparklineEntries = (sparklineMap.get(kpi.id) ?? []).slice().reverse();

    const override = latestEntry ? targetOverrideMap.get(`${kpi.id}:${latestEntry.periodDate}`) : undefined;
    const effectiveTarget = override
      ? { target: override.target, thresholdGreen: override.thresholdGreen, thresholdYellow: override.thresholdYellow }
      : { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };

    return { kpi, latestEntry, sparklineEntries, effectiveTarget };
  });
}

/** Ambil target override untuk periode tertentu, fallback ke nilai default KPI */
export async function getEffectiveTarget(
  kpi: KPI,
  periodDate: string
): Promise<{ target: number; thresholdGreen: number; thresholdYellow: number }> {
  const rows = await db
    .select()
    .from(kpiTargets)
    .where(and(eq(kpiTargets.kpiId, kpi.id), eq(kpiTargets.periodDate, periodDate)))
    .limit(1);

  if (rows[0]) {
    return { target: rows[0].target, thresholdGreen: rows[0].thresholdGreen, thresholdYellow: rows[0].thresholdYellow };
  }
  return { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };
}

/** Ambil semua target override untuk satu KPI, diurutkan terbaru dulu */
export async function getKPITargets(kpiId: number): Promise<KPITarget[]> {
  return db
    .select()
    .from(kpiTargets)
    .where(eq(kpiTargets.kpiId, kpiId))
    .orderBy(desc(kpiTargets.periodDate));
}

/**
 * Ambil entry untuk MoM dan YoY comparison.
 * @param kpiId
 * @param currentPeriodDate  ISO date awal bulan (YYYY-MM-DD)
 */
export async function getPeriodComparisonEntries(kpiId: number, currentPeriodDate: string) {
  const d = new Date(currentPeriodDate);

  const prevMonthDate = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10);
  const prevYearDate  = new Date(d.getFullYear() - 1, d.getMonth(), 1).toISOString().slice(0, 10);

  const [prevMonth, prevYear] = await Promise.all([
    getLatestEntry(kpiId, prevMonthDate),
    getLatestEntry(kpiId, prevYearDate),
  ]);

  return { prevMonth, prevYear };
}

/** Ambil semua komentar untuk satu KPI, terbaru dulu */
export async function getKPIComments(kpiId: number): Promise<KPIComment[]> {
  return db
    .select()
    .from(kpiComments)
    .where(eq(kpiComments.kpiId, kpiId))
    .orderBy(desc(kpiComments.createdAt));
}
