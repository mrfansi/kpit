import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "./db";
import { domains, kpiEntries, kpis, type KPI, type KPIEntry } from "./db/schema";

export async function getAllDomains() {
  return db.select().from(domains).orderBy(domains.name);
}

export async function getDomainBySlug(slug: string) {
  const rows = await db.select().from(domains).where(eq(domains.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getKPIsByDomain(domainId: number): Promise<KPI[]> {
  return db.select().from(kpis).where(and(eq(kpis.domainId, domainId), eq(kpis.isActive, true)));
}

export async function getAllKPIs(): Promise<KPI[]> {
  return db.select().from(kpis).where(eq(kpis.isActive, true)).orderBy(kpis.domainId, kpis.name);
}

export async function getKPIById(id: number): Promise<KPI | null> {
  const rows = await db.select().from(kpis).where(eq(kpis.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getLatestEntry(kpiId: number): Promise<KPIEntry | null> {
  const rows = await db
    .select()
    .from(kpiEntries)
    .where(eq(kpiEntries.kpiId, kpiId))
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

export async function getKPIsWithLatestEntry(domainId?: number) {
  const allKPIs = domainId ? await getKPIsByDomain(domainId) : await getAllKPIs();
  return Promise.all(
    allKPIs.map(async (kpi) => ({
      kpi,
      latestEntry: await getLatestEntry(kpi.id),
    }))
  );
}
