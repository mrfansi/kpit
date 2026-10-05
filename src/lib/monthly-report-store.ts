import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, domains, kpiEntries, kpis, kpiTargets, monthlyReports, monthlyReportRevisions } from "@/lib/db/schema";
import type { MonthlyReportBundle, MonthlyReportContent, MonthlyReportMetric, MonthlyObservation } from "@/lib/monthly-report-types";
import { computeMonthlyReport, emptyMonthlyReportContent, previousReportMonth, reportMonths } from "@/lib/monthly-report";
import { monthlyReportContentSchema, monthSchema } from "@/lib/validations/monthly-report";

export class MonthlyReportError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Domain = { id: number; name: string; slug: string };
type Peer = { domain: Domain; period: string; content: MonthlyReportContent };
const validPeriod = (period: string) => { if (!monthSchema.safeParse(period).success) throw new MonthlyReportError(400, "Invalid report month; use YYYY-MM-01."); };

async function context(slug: string, period: string) {
  validPeriod(period);
  const [domain] = await db.select({ id: domains.id, name: domains.name, slug: domains.slug }).from(domains).where(eq(domains.slug, slug)).limit(1);
  if (!domain) return null;
  const [record] = await db.select().from(monthlyReports).where(and(eq(monthlyReports.domainId, domain.id), eq(monthlyReports.period, period))).limit(1);
  const peers = await db.select({ domainId: monthlyReports.domainId, period: monthlyReports.period, content: monthlyReports.content, id: domains.id, name: domains.name, slug: domains.slug })
    .from(monthlyReports).innerJoin(domains, eq(monthlyReports.domainId, domains.id))
    .where(and(eq(monthlyReports.period, period)));
  return { domain, record, peers: peers.filter((p) => p.domainId !== domain.id).map((p) => ({ domain: { id: p.id, name: p.name, slug: p.slug }, period: p.period, content: monthlyReportContentSchema.parse(p.content) })) };
}

async function initialContent(domainId: number, period: string): Promise<MonthlyReportContent> {
  const content = emptyMonthlyReportContent();
  const active = await db.select().from(kpis).where(and(eq(kpis.domainId, domainId), eq(kpis.isActive, true))).orderBy(kpis.sortOrder, kpis.name);
  const [prior] = await db.select().from(monthlyReports).where(and(eq(monthlyReports.domainId, domainId), lt(monthlyReports.period, period))).orderBy(desc(monthlyReports.period)).limit(1);
  const previous = prior ? monthlyReportContentSchema.parse(prior.content) : null;
  const previousById = new Map(previous?.metrics.map((m) => [m.kpiId, m]) ?? []);
  const ids = new Set(active.map((k) => k.id));
  // Archived KPIs remain visible until a report explicitly resolves a changed set.
  for (const metric of previous?.metrics ?? []) ids.add(metric.kpiId);
  if (previous) content.division = previous.division;
  const months = [...new Set([previousReportMonth(period), ...reportMonths(period)])].sort();
  const allEntries = ids.size ? await db.select().from(kpiEntries).where(and(inArray(kpiEntries.kpiId, [...ids]), inArray(kpiEntries.periodDate, months))).orderBy(desc(kpiEntries.createdAt), desc(kpiEntries.id)) : [];
  const allTargets = ids.size ? await db.select().from(kpiTargets).where(and(inArray(kpiTargets.kpiId, [...ids]), inArray(kpiTargets.periodDate, months))) : [];
  const entries = new Map<string, typeof allEntries[number]>();
  for (const entry of allEntries) if (!entries.has(`${entry.kpiId}:${entry.periodDate}`)) entries.set(`${entry.kpiId}:${entry.periodDate}`, entry);
  const targets = new Map(allTargets.map((t) => [`${t.kpiId}:${t.periodDate}`, t]));
  const activeById = new Map(active.map((k) => [k.id, k]));
  content.metrics = [...ids].map((id): MonthlyReportMetric => {
    const kpi = activeById.get(id);
    const old = previousById.get(id);
    const baseline = kpi ?? old;
    if (!baseline) throw new MonthlyReportError(500, "KPI snapshot missing");
    const priorObs = new Map(old?.observations.map((o) => [o.month, o]) ?? []);
    const observations: MonthlyObservation[] = months.map((month) => {
      // Preserve authored/corrected historical rows, but never carry last month's value into the new current month.
      const historical = month !== period ? priorObs.get(month) : undefined;
      if (historical) return historical;
      const entry = kpi?.period === "monthly" ? entries.get(`${id}:${month}`) : undefined;
      const override = targets.get(`${id}:${month}`);
      return {
        month, actual: entry?.value ?? null, target: override?.target ?? kpi?.target ?? null,
        source: entry ? `KPI entry #${entry.id} (${entry.periodDate})` : "",
        targetSource: override ? `KPI target override #${override.id} (${month})` : kpi ? `KPI default target #${kpi.id} (${month})` : "",
        state: entry ? "provided" : "missing", numerator: null, denominator: null,
      };
    });
    return {
      kpiId: id, name: old?.name ?? kpi!.name, definition: old?.definition ?? kpi!.description ?? "",
      unit: old?.unit ?? kpi!.unit, direction: old?.direction ?? kpi!.direction,
      definitionConfirmed: old?.definitionConfirmed ?? false, aggregation: old?.aggregation ?? null,
      aggregationNote: old?.aggregationNote ?? "", observations,
      sharedMetricKey: old?.sharedMetricKey ?? "", sharingReviewed: old?.sharingReviewed ?? false,
      reconciliationNote: old?.reconciliationNote ?? "", deviationCause: "", deviationEvidence: "",
    };
  });
  return content;
}

async function bundle(domain: Domain, period: string, content: MonthlyReportContent, revision: number, updatedAt: Date | null, peers: Peer[]): Promise<MonthlyReportBundle> {
  const computed = computeMonthlyReport(content, period, peers);
  const active = await db.select({ id: kpis.id }).from(kpis).where(and(eq(kpis.domainId, domain.id), eq(kpis.isActive, true)));
  const currentSet = new Set(active.map((k) => k.id));
  const snapshotSet = new Set(content.metrics.map((m) => m.kpiId));
  const changed = [...currentSet].some((id) => !snapshotSet.has(id));
  const [prior] = await db.select({ content: monthlyReports.content }).from(monthlyReports).where(and(eq(monthlyReports.domainId, domain.id), lt(monthlyReports.period, period))).orderBy(desc(monthlyReports.period)).limit(1);
  const priorSet = new Set(prior ? monthlyReportContentSchema.parse(prior.content).metrics.map((m) => m.kpiId) : []);
  const priorChanged = !!prior && (priorSet.size !== snapshotSet.size || [...priorSet].some((id) => !snapshotSet.has(id)));
  const [saved] = await db.select({ content: monthlyReports.content }).from(monthlyReports).where(and(eq(monthlyReports.domainId, domain.id), eq(monthlyReports.period, period))).limit(1);
  const savedSet = new Set(saved ? monthlyReportContentSchema.parse(saved.content).metrics.map((m) => m.kpiId) : []);
  const newlyAdded = !!saved && [...currentSet].some((id) => !savedSet.has(id));
  if (changed) computed.questions.push({ id: "metrics.registry", path: "metrics", question: "Daftar KPI aktif telah berubah; sinkronkan snapshot KPI tanpa menghapus data lama secara diam-diam." });
  if ((priorChanged || newlyAdded || currentSet.size !== snapshotSet.size) && !content.kpiSetChangeNote.trim()) computed.questions.push({ id: "kpiSetChangeNote", path: "kpiSetChangeNote", question: "Jelaskan dan konfirmasi perubahan set KPI terhadap laporan sebelumnya atau daftar KPI aktif." });
  for (const peer of peers) if (content.division && peer.content.division === content.division) computed.questions.push({ id: `division.duplicate.${peer.domain.id}`, path: "division", question: `Divisi ${content.division} juga dipakai ${peer.domain.name}; selesaikan pemetaan agar satu divisi tidak mempunyai dua deck terpisah.` });
  return { domain, period, content, ...computed, ready: computed.questions.length === 0, revision, updatedAt: updatedAt?.toISOString() ?? null };
}
async function reportSnapshot(domainId: number, period: string, saved?: MonthlyReportContent): Promise<MonthlyReportContent> {
  if (!saved) return initialContent(domainId, period);
  const initialized = await initialContent(domainId, period);
  const included = new Set(saved.metrics.map((metric) => metric.kpiId));
  const additions = initialized.metrics.filter((metric) => !included.has(metric.kpiId));
  return additions.length ? { ...saved, metrics: [...saved.metrics, ...additions] } : saved;
}


export async function getMonthlyReportBundle(domainSlug: string, period: string): Promise<MonthlyReportBundle | null> {
  const found = await context(domainSlug, period);
  if (!found) return null;
  const content = await reportSnapshot(found.domain.id, period, found.record ? monthlyReportContentSchema.parse(found.record.content) : undefined);
  return bundle(found.domain, period, content, found.record?.revision ?? 0, found.record?.updatedAt ?? null, found.peers);
}

export async function saveMonthlyReport(domainSlug: string, period: string, input: unknown, expectedRevision: number, user: { id: string; email?: string | null }): Promise<MonthlyReportBundle> {
  const found = await context(domainSlug, period);
  if (!found) throw new MonthlyReportError(404, "Domain not found");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new MonthlyReportError(400, "Invalid revision");
  const content = monthlyReportContentSchema.parse(input);
  const snapshot = await reportSnapshot(found.domain.id, period, found.record ? monthlyReportContentSchema.parse(found.record.content) : undefined);
  const requiredIds = new Set(snapshot.metrics.map((m) => m.kpiId));
  const suppliedIds = new Set(content.metrics.map((m) => m.kpiId));
  if (requiredIds.size !== suppliedIds.size || [...requiredIds].some((id) => !suppliedIds.has(id))) throw new MonthlyReportError(400, "Report must retain all KPI snapshot IDs; refresh the report to incorporate changed KPIs.");
  const registry = await db.select({ id: kpis.id }).from(kpis).where(eq(kpis.domainId, found.domain.id));
  const owned = new Set(registry.map((k) => k.id));
  const [prior] = await db.select({ content: monthlyReports.content }).from(monthlyReports).where(and(eq(monthlyReports.domainId, found.domain.id), lt(monthlyReports.period, period))).orderBy(desc(monthlyReports.period)).limit(1);
  for (const metric of prior ? monthlyReportContentSchema.parse(prior.content).metrics : []) owned.add(metric.kpiId);
  for (const metric of found.record ? monthlyReportContentSchema.parse(found.record.content).metrics : []) owned.add(metric.kpiId);
  if ([...suppliedIds].some((id) => !owned.has(id))) throw new MonthlyReportError(400, "Report contains KPI outside this domain or its saved history.");
  const allowedMonths = new Set([previousReportMonth(period), ...reportMonths(period)]);
  for (const metric of content.metrics) {
    if (metric.observations.some((o) => !allowedMonths.has(o.month))) throw new MonthlyReportError(400, `Observation outside selected report months: ${metric.name}`);
    const required = snapshot.metrics.find((m) => m.kpiId === metric.kpiId)!;
    if (required.observations.some((o) => !metric.observations.some((row) => row.month === o.month))) throw new MonthlyReportError(400, `Missing required month for ${metric.name}`);
  }
  if (!user.id) throw new MonthlyReportError(403, "Authenticated editor required");
  const now = new Date();
  try {
    db.transaction((tx) => {
      let reportId: number;
      if (expectedRevision === 0) {
        const [inserted] = tx.insert(monthlyReports).values({ domainId: found.domain.id, period, content, revision: 1, createdBy: user.id, updatedBy: user.id, createdAt: now, updatedAt: now }).returning({ id: monthlyReports.id }).all();
        reportId = inserted.id;
      } else {
        const [changed] = tx.update(monthlyReports).set({ content, revision: expectedRevision + 1, updatedBy: user.id, updatedAt: now })
          .where(and(eq(monthlyReports.domainId, found.domain.id), eq(monthlyReports.period, period), eq(monthlyReports.revision, expectedRevision)))
          .returning({ id: monthlyReports.id }).all();
        if (!changed) throw new MonthlyReportError(409, "Report has changed. Reload the latest revision.");
        reportId = changed.id;
      }
      tx.insert(monthlyReportRevisions).values({ reportId, revision: expectedRevision + 1, content, authorId: user.id, createdAt: now }).run();
      tx.insert(auditLogs).values({ userId: user.id, userEmail: user.email ?? null, action: expectedRevision === 0 ? "create" : "update", entity: "monthly_report", entityId: `${found.domain.id}:${period}`, detail: `Revision ${expectedRevision + 1}` }).run();
    });
  } catch (error) {
    if (error instanceof MonthlyReportError) throw error;
    if (error instanceof Error && /UNIQUE constraint failed: monthly_reports/.test(error.message)) throw new MonthlyReportError(409, "Report has changed. Reload the latest revision.");
    throw error;
  }
  const result = await getMonthlyReportBundle(domainSlug, period);
  if (!result) throw new MonthlyReportError(404, "Domain not found");
  return result;
}
