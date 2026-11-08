import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditInsert } from "@/lib/db/audit";
import { domains, kpiComments, kpiEntries, kpis, kpiTargets, monthlyReports, monthlyReportRevisions, timelineProjectLogs, timelineProjects, timelineProjectStatuses } from "@/lib/db/schema";
import type { MonthlyReportBundle, MonthlyReportContent, MonthlyReportMetric, MonthlyObservation } from "@/lib/monthly-report-types";
import { computeMonthlyReport, emptyMonthlyReportContent, previousReportMonth, reportMonths } from "@/lib/monthly-report";
import { monthlyReportContentSchema, monthSchema } from "@/lib/validations/monthly-report";
import { applyNotes, deriveNotes, entryMismatchQuestions, entrySource, nextMonthFirst, timelineLines, type EntryRef, type NotesImport, type TimelineLine } from "@/lib/monthly-report-import";
import { getReportActionPlansWithKPI } from "@/lib/queries";

export class MonthlyReportError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Domain = { id: number; name: string; slug: string };
type Peer = { domain: Domain; period: string; content: MonthlyReportContent };
const validPeriod = (period: string) => { if (!monthSchema.safeParse(period).success) throw new MonthlyReportError(400, "Invalid report month; use YYYY-MM-01."); };

type Found = {
  domain: Domain;
  record: typeof monthlyReports.$inferSelect | undefined;
  active: (typeof kpis.$inferSelect)[];
  previous: MonthlyReportContent | null;
  peers: Peer[];
};

// One domain lookup, then every read that only needs domain.id runs in a single round trip.
async function context(slug: string, period: string): Promise<Found | null> {
  validPeriod(period);
  const [domain] = await db.select({ id: domains.id, name: domains.name, slug: domains.slug }).from(domains).where(eq(domains.slug, slug)).limit(1);
  if (!domain) return null;
  const [[record], peers, active, [prior]] = await Promise.all([
    db.select().from(monthlyReports).where(and(eq(monthlyReports.domainId, domain.id), eq(monthlyReports.period, period))).limit(1),
    db.select({ domainId: monthlyReports.domainId, period: monthlyReports.period, content: monthlyReports.content, id: domains.id, name: domains.name, slug: domains.slug })
      .from(monthlyReports).innerJoin(domains, eq(monthlyReports.domainId, domains.id))
      .where(and(eq(monthlyReports.period, period))),
    db.select().from(kpis).where(and(eq(kpis.domainId, domain.id), eq(kpis.isActive, true))).orderBy(kpis.sortOrder, kpis.name),
    db.select({ content: monthlyReports.content }).from(monthlyReports).where(and(eq(monthlyReports.domainId, domain.id), lt(monthlyReports.period, period))).orderBy(desc(monthlyReports.period)).limit(1),
  ]);
  return {
    domain, record, active,
    previous: prior ? monthlyReportContentSchema.parse(prior.content) : null,
    peers: peers.filter((p) => p.domainId !== domain.id).map((p) => ({ domain: { id: p.id, name: p.name, slug: p.slug }, period: p.period, content: monthlyReportContentSchema.parse(p.content) })),
  };
}

// Archived KPIs remain visible until a report explicitly resolves a changed set.
function snapshotIds({ active, previous }: Found) {
  const ids = new Set(active.map((k) => k.id));
  for (const metric of previous?.metrics ?? []) ids.add(metric.kpiId);
  return ids;
}

// D1 allows 100 bound parameters per statement: split ids so they fit beside the other parameters.
async function inChunks<T>(ids: number[], fixedParams: number, run: (chunk: number[]) => Promise<T[]>): Promise<T[]> {
  const size = 100 - fixedParams;
  const chunks: number[][] = [];
  for (let offset = 0; offset < ids.length; offset += size) chunks.push(ids.slice(offset, offset + size));
  return (await Promise.all(chunks.map(run))).flat();
}

// Latest entry per `kpiId:periodDate` (newest createdAt, then id).
async function latestEntries(ids: number[], months: string[]) {
  const rows = await inChunks(ids, months.length, (chunk) => db.select().from(kpiEntries).where(and(inArray(kpiEntries.kpiId, chunk), inArray(kpiEntries.periodDate, months))).orderBy(desc(kpiEntries.createdAt), desc(kpiEntries.id)));
  const latest = new Map<string, typeof rows[number]>();
  for (const entry of rows) if (!latest.has(`${entry.kpiId}:${entry.periodDate}`)) latest.set(`${entry.kpiId}:${entry.periodDate}`, entry);
  return latest;
}

async function loadNotes(domainId: number, kpiIds: number[], period: string): Promise<NotesImport> {
  const [comments, plans] = await Promise.all([
    inChunks(kpiIds, 1, (chunk) => db.select({ id: kpiComments.id, kpiId: kpiComments.kpiId, content: kpiComments.content, createdAt: kpiComments.createdAt }).from(kpiComments).where(and(inArray(kpiComments.kpiId, chunk), eq(kpiComments.periodDate, period)))),
    getReportActionPlansWithKPI(domainId),
  ]);
  const owned = new Set(kpiIds);
  return deriveNotes(comments, plans.filter((p) => owned.has(p.kpi.id)).map((p) => p.action), period);
}

// Projects whose schedule overlaps the month, with progress taken from the logs up to the end of that WIB month.
async function loadTimelineLines(period: string): Promise<TimelineLine[]> {
  const next = nextMonthFirst(period);
  const [projects, logs] = await Promise.all([
    db.select({ id: timelineProjects.id, name: timelineProjects.name, progress: timelineProjects.progress, endDate: timelineProjects.endDate, estimatedLaunchDate: timelineProjects.estimatedLaunchDate, status: timelineProjectStatuses.name })
      .from(timelineProjects).leftJoin(timelineProjectStatuses, eq(timelineProjects.statusId, timelineProjectStatuses.id))
      .where(and(lt(timelineProjects.startDate, next), gte(timelineProjects.endDate, period))).orderBy(timelineProjects.sortOrder, timelineProjects.id),
    db.select().from(timelineProjectLogs).where(lt(timelineProjectLogs.createdAt, new Date(`${next}T00:00:00+07:00`))),
  ]);
  return timelineLines(projects, logs, period);
}

async function initialContent(found: Found, period: string): Promise<MonthlyReportContent> {
  const { active, previous } = found;
  const content = emptyMonthlyReportContent();
  const previousById = new Map(previous?.metrics.map((m) => [m.kpiId, m]) ?? []);
  const ids = snapshotIds(found);
  if (previous) { content.division = previous.division; content.previousActions = previous.actions.map((a) => ({ ...a, status: "", note: "" })); }
  const months = [...new Set([previousReportMonth(period), ...reportMonths(period)])].sort();
  const kpiIds = [...ids];
  const [entries, allTargets, notes] = await Promise.all([
    latestEntries(kpiIds, months),
    inChunks(kpiIds, months.length, (chunk) => db.select().from(kpiTargets).where(and(inArray(kpiTargets.kpiId, chunk), inArray(kpiTargets.periodDate, months)))),
    loadNotes(found.domain.id, kpiIds, period),
  ]);
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
        source: entry ? entrySource(entry) : "",
        targetSource: override ? `KPI target override #${override.id} (${month})` : kpi ? `KPI default target #${kpi.id} (${month})` : "",
        state: entry ? "provided" : "missing", numerator: entry?.numerator ?? null, denominator: entry?.denominator ?? null,
      };
    });
    return {
      kpiId: id, name: old?.name ?? kpi!.name, definition: old?.definition ?? kpi!.description ?? "",
      unit: old?.unit ?? kpi!.unit, direction: old?.direction ?? kpi!.direction,
      definitionConfirmed: old?.definitionConfirmed ?? false, aggregation: old?.aggregation ?? null,
      aggregationNote: old?.aggregationNote ?? "", observations,
      sharedMetricKey: old?.sharedMetricKey ?? "", sharingReviewed: old?.sharingReviewed ?? false,
      reconciliationNote: old?.reconciliationNote ?? "", deviationCause: "", deviationEvidence: "",
      // A start month from another year (e.g. carried over in January) is dropped: YTD restarts in January.
      ytdStartMonth: old?.ytdStartMonth?.slice(0, 4) === period.slice(0, 4) ? old.ytdStartMonth : null,
    };
  });
  return applyNotes(content, notes, period).content;
}

async function bundle(found: Found, period: string, content: MonthlyReportContent, revision: number, updatedAt: Date | null, entries: EntryRef[] = []): Promise<MonthlyReportBundle> {
  const { domain, peers, active, previous, record } = found;
  const computed = computeMonthlyReport(content, period, peers);
  const currentSet = new Set(active.map((k) => k.id));
  const snapshotSet = new Set(content.metrics.map((m) => m.kpiId));
  const changed = [...currentSet].some((id) => !snapshotSet.has(id));
  const priorSet = new Set(previous?.metrics.map((m) => m.kpiId));
  const priorChanged = !!previous && (priorSet.size !== snapshotSet.size || [...priorSet].some((id) => !snapshotSet.has(id)));
  const savedSet = new Set(record ? monthlyReportContentSchema.parse(record.content).metrics.map((m) => m.kpiId) : []);
  const newlyAdded = !!record && [...currentSet].some((id) => !savedSet.has(id));
  if (changed) computed.questions.push({ id: "metrics.registry", path: "metrics", question: "Daftar KPI aktif telah berubah; sinkronkan snapshot KPI tanpa menghapus data lama secara diam-diam." });
  if ((priorChanged || newlyAdded || currentSet.size !== snapshotSet.size) && !content.kpiSetChangeNote.trim()) computed.questions.push({ id: "kpiSetChangeNote", path: "kpiSetChangeNote", question: "Jelaskan dan konfirmasi perubahan set KPI terhadap laporan sebelumnya atau daftar KPI aktif." });
  for (const peer of peers) if (content.division && peer.content.division === content.division) computed.questions.push({ id: `division.duplicate.${peer.domain.id}`, path: "division", question: `Divisi ${content.division} juga dipakai ${peer.domain.name}; selesaikan pemetaan agar satu divisi tidak mempunyai dua deck terpisah.` });
  computed.questions.push(...entryMismatchQuestions(content, period, entries));
  return { domain, period, content, ...computed, ready: computed.questions.length === 0, revision, updatedAt: updatedAt?.toISOString() ?? null };
}
async function reportSnapshot(found: Found, period: string): Promise<MonthlyReportContent> {
  const saved = found.record ? monthlyReportContentSchema.parse(found.record.content) : undefined;
  if (!saved) return initialContent(found, period);
  // Entries and targets only matter when a KPI is missing from the saved snapshot.
  const included = new Set(saved.metrics.map((metric) => metric.kpiId));
  if ([...snapshotIds(found)].every((id) => included.has(id))) return saved;
  const initialized = await initialContent(found, period);
  const additions = initialized.metrics.filter((metric) => !included.has(metric.kpiId));
  return additions.length ? { ...saved, metrics: [...saved.metrics, ...additions] } : saved;
}

export async function getMonthlyReportBundle(domainSlug: string, period: string): Promise<MonthlyReportBundle | null> {
  const found = await context(domainSlug, period);
  if (!found) return null;
  // A saved report is checked against the latest entries of its current and previous month; a new one was just built from them.
  const checkIds = found.record ? found.active.filter((k) => k.period === "monthly").map((k) => k.id) : [];
  const [content, entries] = await Promise.all([
    reportSnapshot(found, period),
    checkIds.length ? latestEntries(checkIds, [previousReportMonth(period), period]).then((latest): EntryRef[] => [...latest.values()]) : Promise.resolve<EntryRef[]>([]),
  ]);
  return bundle(found, period, content, found.record?.revision ?? 0, found.record?.updatedAt ?? null, entries);
}

export type MonthlyReportImportKind = "entries" | "notes" | "timeline";
export type MonthlyReportImport = { entries: EntryRef[] } | NotesImport | { lines: TimelineLine[] };

// Raw material for the editor's "pull" buttons. Nothing is saved: the editor applies it to its own unsaved content.
export async function getMonthlyReportImport(domainSlug: string, period: string, kind: MonthlyReportImportKind): Promise<MonthlyReportImport | null> {
  validPeriod(period);
  const [domain] = await db.select({ id: domains.id }).from(domains).where(eq(domains.slug, domainSlug)).limit(1);
  if (!domain) return null;
  if (kind === "timeline") return { lines: await loadTimelineLines(period) };
  const active = await db.select({ id: kpis.id, period: kpis.period }).from(kpis).where(and(eq(kpis.domainId, domain.id), eq(kpis.isActive, true)));
  if (kind === "notes") {
    const [notes, [prior]] = await Promise.all([
      loadNotes(domain.id, active.map((k) => k.id), period),
      db.select({ content: monthlyReports.content }).from(monthlyReports).where(and(eq(monthlyReports.domainId, domain.id), lt(monthlyReports.period, period))).orderBy(desc(monthlyReports.period)).limit(1),
    ]);
    return { ...notes, previousActions: prior ? monthlyReportContentSchema.parse(prior.content).actions : [] };
  }
  // Archived KPIs are never queried, so refresh cannot touch their observations.
  const months = [...new Set([previousReportMonth(period), ...reportMonths(period)])];
  const entries = await latestEntries(active.filter((k) => k.period === "monthly").map((k) => k.id), months);
  return { entries: [...entries.values()].map(({ kpiId, periodDate, value, note, numerator, denominator }) => ({ kpiId, periodDate, value, note, numerator, denominator })) };
}

export async function saveMonthlyReport(domainSlug: string, period: string, input: unknown, expectedRevision: number, user: { id: string; email?: string | null }): Promise<MonthlyReportBundle> {
  const found = await context(domainSlug, period);
  if (!found) throw new MonthlyReportError(404, "Domain not found");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new MonthlyReportError(400, "Invalid revision");
  const content = monthlyReportContentSchema.parse(input);
  const [snapshot, registry] = await Promise.all([reportSnapshot(found, period), db.select({ id: kpis.id }).from(kpis).where(eq(kpis.domainId, found.domain.id))]);
  const requiredIds = new Set(snapshot.metrics.map((m) => m.kpiId));
  const suppliedIds = new Set(content.metrics.map((m) => m.kpiId));
  if (requiredIds.size !== suppliedIds.size || [...requiredIds].some((id) => !suppliedIds.has(id))) throw new MonthlyReportError(400, "Report must retain all KPI snapshot IDs; refresh the report to incorporate changed KPIs.");
  const owned = new Set(registry.map((k) => k.id));
  for (const metric of found.previous?.metrics ?? []) owned.add(metric.kpiId);
  for (const metric of found.record ? monthlyReportContentSchema.parse(found.record.content).metrics : []) owned.add(metric.kpiId);
  if ([...suppliedIds].some((id) => !owned.has(id))) throw new MonthlyReportError(400, "Report contains KPI outside this domain or its saved history.");
  const allowedMonths = new Set([previousReportMonth(period), ...reportMonths(period)]);
  for (const metric of content.metrics) {
    if (metric.observations.some((o) => !allowedMonths.has(o.month))) throw new MonthlyReportError(400, `Observation outside selected report months: ${metric.name}`);
    const required = snapshot.metrics.find((m) => m.kpiId === metric.kpiId)!;
    if (required.observations.some((o) => !metric.observations.some((row) => row.month === o.month))) throw new MonthlyReportError(400, `Missing required month for ${metric.name}`);
  }
  if (!user.id) throw new MonthlyReportError(403, "Authenticated editor required");
  if ((found.record?.revision ?? 0) !== expectedRevision) throw new MonthlyReportError(409, "Report has changed. Reload the latest revision.");
  const now = new Date();
  const guard = and(eq(monthlyReports.domainId, found.domain.id), eq(monthlyReports.period, period), eq(monthlyReports.revision, expectedRevision || 1));
  const revisionInsert = db.insert(monthlyReportRevisions).values({
    // A stale scalar lookup yields NULL: the NOT NULL guard aborts the whole batch.
    reportId: sql`(select ${monthlyReports.id} from ${monthlyReports} where ${guard})`,
    revision: expectedRevision + 1, content, authorId: user.id, createdAt: now,
  });
  const audit = auditInsert({ userId: user.id, userEmail: user.email ?? undefined, action: expectedRevision === 0 ? "create" : "update", entity: "monthly_report", entityId: `${found.domain.id}:${period}`, detail: `Revision ${expectedRevision + 1}` });
  try {
    if (expectedRevision === 0) {
      await db.batch([
        db.insert(monthlyReports).values({ domainId: found.domain.id, period, content, revision: 1, createdBy: user.id, updatedBy: user.id, createdAt: now, updatedAt: now }),
        revisionInsert,
        audit,
      ]);
    } else {
      await db.batch([
        revisionInsert,
        db.update(monthlyReports).set({ content, revision: expectedRevision + 1, updatedBy: user.id, updatedAt: now }).where(guard),
        audit,
      ]);
    }
  } catch (error) {
    let cause: unknown = error;
    while (cause instanceof Error) {
      if (/UNIQUE constraint failed: monthly_report(?:s|_revisions)\.|NOT NULL constraint failed: monthly_report_revisions\.report_id/.test(cause.message)) throw new MonthlyReportError(409, "Report has changed. Reload the latest revision.");
      cause = cause.cause;
    }
    throw error;
  }
  const result = await getMonthlyReportBundle(domainSlug, period);
  if (!result) throw new MonthlyReportError(404, "Domain not found");
  return result;
}
