import { cache } from "react";
import { and, desc, eq, getTableColumns, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { domains, kpiActionPlans, kpiComments, kpiEntries, kpiTargets, kpis, type KPI, type KPIActionPlan, type KPIComment, type KPIEntry, type KPITarget } from "./db/schema";
import { activeActionPlanStatuses, getActionPlanSummary } from "./action-plan";
import { shiftMonth } from "./period";

// Memoized per render pass: the root layout and the page both ask for it. Outside a render it is a plain call.
export const getAllDomains = cache(async () => db.select().from(domains).orderBy(domains.name));

export async function getDomainBySlug(slug: string) {
  const rows = await db.select().from(domains).where(eq(domains.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getDomainById(id: number) {
  const rows = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getKPIsByDomain(domainId: number): Promise<KPI[]> {
  return db.select().from(kpis).where(and(eq(kpis.domainId, domainId), eq(kpis.isActive, true))).orderBy(kpis.sortOrder, kpis.name);
}

export async function getAllKPIs(): Promise<KPI[]> {
  return db.select().from(kpis).where(eq(kpis.isActive, true)).orderBy(kpis.domainId, kpis.sortOrder, kpis.name);
}

export async function getEntriesForPeriod(periodDate: string): Promise<KPIEntry[]> {
  return db.select().from(kpiEntries).where(eq(kpiEntries.periodDate, periodDate));
}

export async function getArchivedKPIs(): Promise<KPI[]> {
  return db.select().from(kpis).where(eq(kpis.isActive, false)).orderBy(kpis.domainId, kpis.name);
}

export async function getKPIById(id: number): Promise<KPI | null> {
  const rows = await db.select().from(kpis).where(eq(kpis.id, id)).limit(1);
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
  const inScope = and(eq(kpis.isActive, true), domainId ? eq(kpis.domainId, domainId) : undefined);
  const cutoff = atOrBeforeDate ? lte(kpiEntries.periodDate, atOrBeforeDate) : undefined;
  // Only the 12 newest entries per KPI are read: the newest is the latest, all 12 feed the sparkline.
  const ranked = db
    .select({
      ...getTableColumns(kpiEntries),
      rn: sql<number>`row_number() over (partition by ${kpiEntries.kpiId} order by ${kpiEntries.periodDate} desc, ${kpiEntries.id} desc)`.as("rn"),
    })
    .from(kpiEntries)
    .innerJoin(kpis, eq(kpis.id, kpiEntries.kpiId))
    .where(and(inScope, cutoff))
    .as("ranked");

  const [allKPIs, rows, targetOverrides] = await Promise.all([
    domainId ? getKPIsByDomain(domainId) : getAllKPIs(),
    db
      .select({ id: ranked.id, kpiId: ranked.kpiId, value: ranked.value, periodDate: ranked.periodDate, note: ranked.note, numerator: ranked.numerator, denominator: ranked.denominator, createdAt: ranked.createdAt })
      .from(ranked)
      .where(lte(ranked.rn, 12))
      .orderBy(sql`${ranked.rn}`),
    // Target overrides sitting on each KPI's latest period.
    db
      .select(getTableColumns(kpiTargets))
      .from(kpiTargets)
      .innerJoin(kpis, eq(kpis.id, kpiTargets.kpiId))
      .where(and(
        inScope,
        sql`${kpiTargets.periodDate} = (select max(${kpiEntries.periodDate}) from ${kpiEntries} where ${kpiEntries.kpiId} = ${kpiTargets.kpiId}${atOrBeforeDate ? sql` and ${kpiEntries.periodDate} <= ${atOrBeforeDate}` : sql``})`,
      )),
  ]);

  // rows are newest-first per KPI (ordered by rank).
  const newestFirst = new Map<number, KPIEntry[]>();
  for (const row of rows) {
    const list = newestFirst.get(row.kpiId);
    if (list) list.push(row);
    else newestFirst.set(row.kpiId, [row]);
  }
  const targetOverrideMap = new Map(targetOverrides.map((t) => [`${t.kpiId}:${t.periodDate}`, t]));

  return allKPIs.map((kpi) => {
    const history = newestFirst.get(kpi.id) ?? [];
    const latestEntry = history[0] ?? null;
    // Chronological (oldest → newest): consumers draw left→right and treat the second-last entry as previous.
    const sparklineEntries = history.slice().reverse();

    const override = latestEntry ? targetOverrideMap.get(`${kpi.id}:${latestEntry.periodDate}`) : undefined;
    const effectiveTarget = override
      ? { target: override.target, thresholdGreen: override.thresholdGreen, thresholdYellow: override.thresholdYellow }
      : { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };

    return { kpi, latestEntry, sparklineEntries, effectiveTarget };
  });
}

export type EffectiveTarget = { target: number; thresholdGreen: number; thresholdYellow: number; overridden: boolean };
export type TargetResolver = (kpi: KPI, periodDate: string) => EffectiveTarget;

/** Pure: per-period override when present, otherwise the KPI's own default target. */
export function buildTargetResolver(overrides: KPITarget[]): TargetResolver {
  const byKey = new Map(overrides.map((row) => [`${row.kpiId}:${row.periodDate}`, row]));
  return (kpi, periodDate) => {
    const override = byKey.get(`${kpi.id}:${periodDate}`);
    const { target, thresholdGreen, thresholdYellow } = override ?? kpi;
    return { target, thresholdGreen, thresholdYellow, overridden: Boolean(override) };
  };
}

/** Load overrides once (all KPIs, or only `kpiIds`, chunked for D1's bound-parameter limit) and resolve in memory. */
export async function getTargetResolver(kpiIds?: number[]): Promise<TargetResolver> {
  if (!kpiIds) return buildTargetResolver(await db.select().from(kpiTargets));
  const rows: KPITarget[] = [];
  const ids = [...new Set(kpiIds)];
  for (let offset = 0; offset < ids.length; offset += 90) {
    rows.push(...await db.select().from(kpiTargets).where(inArray(kpiTargets.kpiId, ids.slice(offset, offset + 90))));
  }
  return buildTargetResolver(rows);
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
 * Batch-fetch previous month and previous year entries for multiple KPIs.
 * Returns a Map<kpiId, { prevMonth, prevYear }>.
 */
export async function getBatchPeriodComparison(
  kpiIds: number[],
  currentPeriodDate: string
): Promise<Map<number, { prevMonth: KPIEntry | null; prevYear: KPIEntry | null }>> {
  if (kpiIds.length === 0) return new Map();

  const [y, m] = currentPeriodDate.split("-").map(Number);
  const prevMonthDate = shiftMonth(currentPeriodDate, -1);
  const prevYearDate = `${y - 1}-${String(m).padStart(2, "0")}-01`;

  const prevMonthEntries: KPIEntry[] = [];
  const prevYearEntries: KPIEntry[] = [];
  const uniqueIds = [...new Set(kpiIds)];
  for (let offset = 0; offset < uniqueIds.length; offset += 99) {
    const ids = uniqueIds.slice(offset, offset + 99);
    const [monthEntries, yearEntries] = await Promise.all([
      db.select().from(kpiEntries)
        .where(and(inArray(kpiEntries.kpiId, ids), eq(kpiEntries.periodDate, prevMonthDate))),
      db.select().from(kpiEntries)
        .where(and(inArray(kpiEntries.kpiId, ids), eq(kpiEntries.periodDate, prevYearDate))),
    ]);
    prevMonthEntries.push(...monthEntries);
    prevYearEntries.push(...yearEntries);
  }

  const prevMonthMap = new Map<number, KPIEntry>();
  for (const e of prevMonthEntries) prevMonthMap.set(e.kpiId, e);

  const prevYearMap = new Map<number, KPIEntry>();
  for (const e of prevYearEntries) prevYearMap.set(e.kpiId, e);

  const result = new Map<number, { prevMonth: KPIEntry | null; prevYear: KPIEntry | null }>();
  for (const id of kpiIds) {
    result.set(id, {
      prevMonth: prevMonthMap.get(id) ?? null,
      prevYear: prevYearMap.get(id) ?? null,
    });
  }
  return result;
}

/** Ambil semua komentar untuk satu KPI, terbaru dulu */
export async function getKPIComments(kpiId: number): Promise<KPIComment[]> {
  return db
    .select()
    .from(kpiComments)
    .where(eq(kpiComments.kpiId, kpiId))
    .orderBy(desc(kpiComments.createdAt));
}

export async function getKPIActionPlans(kpiId: number): Promise<KPIActionPlan[]> {
  return db
    .select()
    .from(kpiActionPlans)
    .where(eq(kpiActionPlans.kpiId, kpiId))
    .orderBy(kpiActionPlans.dueDate, desc(kpiActionPlans.updatedAt));
}

/** Count of open action plans per KPI, one grouped query; scoped to a domain when given. */
export async function getActionPlanCounts(domainId?: number): Promise<Map<number, number>> {
  const rows = await db
    .select({ kpiId: kpiActionPlans.kpiId, total: sql<number>`count(*)` })
    .from(kpiActionPlans)
    .innerJoin(kpis, eq(kpis.id, kpiActionPlans.kpiId))
    .where(and(inArray(kpiActionPlans.status, activeActionPlanStatuses), domainId ? eq(kpis.domainId, domainId) : undefined))
    .groupBy(kpiActionPlans.kpiId);
  return new Map(rows.map((row) => [row.kpiId, row.total]));
}

export async function getAllActionPlansWithKPI() {
  return db
    .select({
      action: kpiActionPlans,
      kpi: {
        id: kpis.id,
        name: kpis.name,
      },
      domain: {
        id: domains.id,
        name: domains.name,
        slug: domains.slug,
      },
    })
    .from(kpiActionPlans)
    .innerJoin(kpis, eq(kpiActionPlans.kpiId, kpis.id))
    .innerJoin(domains, eq(kpis.domainId, domains.id))
    .orderBy(kpiActionPlans.dueDate, desc(kpiActionPlans.updatedAt));
}

export async function getReportActionPlansWithKPI(domainId?: number) {
  const conditions = domainId ? [eq(kpis.domainId, domainId)] : [];

  return db
    .select({
      action: kpiActionPlans,
      kpi: {
        id: kpis.id,
        name: kpis.name,
      },
      domain: {
        id: domains.id,
        name: domains.name,
        slug: domains.slug,
      },
    })
    .from(kpiActionPlans)
    .innerJoin(kpis, eq(kpiActionPlans.kpiId, kpis.id))
    .innerJoin(domains, eq(kpis.domainId, domains.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(kpiActionPlans.dueDate, desc(kpiActionPlans.updatedAt));
}

export async function getActionPlanDashboardSummary() {
  const actions = await db.select().from(kpiActionPlans);
  return getActionPlanSummary(actions);
}

export async function getAllKPIEntriesBatch(
  kpiIds: number[],
  from?: string,
  to?: string
) {
  if (kpiIds.length === 0) return [];
  const entries: KPIEntry[] = [];
  const uniqueIds = [...new Set(kpiIds)];
  // Reserve two parameters for the optional date bounds.
  for (let offset = 0; offset < uniqueIds.length; offset += 98) {
    const conditions = [inArray(kpiEntries.kpiId, uniqueIds.slice(offset, offset + 98))];
    if (from) conditions.push(gte(kpiEntries.periodDate, from));
    if (to) conditions.push(lte(kpiEntries.periodDate, to));
    entries.push(...await db.select().from(kpiEntries).where(and(...conditions)));
  }
  return entries.sort((a, b) => a.periodDate.localeCompare(b.periodDate) || a.id - b.id);
}
