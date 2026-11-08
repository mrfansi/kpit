import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditInsert } from "@/lib/db/audit";
import { domains, kpiActionPlans, kpiComments, kpiEntries, kpis, kpiTargets, monthlyReports, monthlyReportRevisions, timelineProjectLogs, timelineProjects, timelineProjectStatuses } from "@/lib/db/schema";
import type { MonthlyReportBundle, MonthlyReportContent, MonthlyReportMetric, MonthlyObservation } from "@/lib/monthly-report-types";
import { computeMonthlyReport, emptyMonthlyReportContent, previousReportMonth, reportMonths } from "@/lib/monthly-report";
import { monthlyReportContentSchema, monthSchema } from "@/lib/validations/monthly-report";
import { applyNotes, deriveNotes, entryMismatchQuestions, entrySource, nextMonthFirst, resolveTarget, timelineLines, type EntryRef, type NotesImport, type TargetRef, type TimelineLine } from "@/lib/monthly-report-import";
import { inChunks } from "@/lib/db/chunks";

export class MonthlyReportError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Domain = { id: number; name: string; slug: string };
type Peer = { domain: Domain; period: string; content: MonthlyReportContent };
const validPeriod = (period: string) => { if (!monthSchema.safeParse(period).success) throw new MonthlyReportError(400, "Invalid report month; use YYYY-MM-01."); };
const monthsFor = (period: string) => [...new Set([previousReportMonth(period), ...reportMonths(period)])].sort();
const unique = (ids: number[]) => [...new Set(ids)];

type Found = {
  domain: Domain;
  record: typeof monthlyReports.$inferSelect | undefined;
  /** The saved report's content, parsed once. */
  saved: MonthlyReportContent | undefined;
  active: (typeof kpis.$inferSelect)[];
  /** Latest earlier report of the domain (any month), and its month. */
  previous: MonthlyReportContent | null;
  previousPeriod: string | null;
  peers: Peer[];
};

// Every read that only needs domain ids, for all requested domains at once (constant query count, not one set per domain).
async function loadFounds(period: string, domainIds: number[]): Promise<Found[]> {
  validPeriod(period);
  const ids = unique(domainIds);
  // A saved report only knows the KPIs that existed by the end of its month; later ones belong to later reports.
  const cutoff = new Date(`${nextMonthFirst(period)}T00:00:00+07:00`);
  const [domainRows, reports, activeRows, priors] = await Promise.all([
    inChunks(ids, 0, (chunk) => db.select({ id: domains.id, name: domains.name, slug: domains.slug }).from(domains).where(inArray(domains.id, chunk))),
    db.select({ record: monthlyReports, name: domains.name, slug: domains.slug }).from(monthlyReports).innerJoin(domains, eq(monthlyReports.domainId, domains.id)).where(eq(monthlyReports.period, period)),
    inChunks(ids, 0, (chunk) => db.select().from(kpis).where(and(inArray(kpis.domainId, chunk), eq(kpis.isActive, true))).orderBy(kpis.sortOrder, kpis.name)),
    inChunks(ids, 2, (chunk) => db.select({ domainId: monthlyReports.domainId, period: monthlyReports.period, content: monthlyReports.content }).from(monthlyReports)
      .where(and(inArray(monthlyReports.domainId, chunk), eq(monthlyReports.period, sql`(select max(p.period) from monthly_reports p where p.domain_id = ${monthlyReports.domainId} and p.period < ${period})`)))),
  ]);
  const parsed = reports.map((r) => ({ record: r.record, domain: { id: r.record.domainId, name: r.name, slug: r.slug }, content: monthlyReportContentSchema.parse(r.record.content) }));
  const byDomain = new Map(domainRows.map((d) => [d.id, d]));
  return ids.flatMap((id) => {
    const domain = byDomain.get(id);
    if (!domain) return [];
    const own = parsed.find((p) => p.domain.id === id);
    const prior = priors.find((p) => p.domainId === id);
    const list = activeRows.filter((k) => k.domainId === id);
    return [{
      domain, record: own?.record, saved: own?.content,
      active: own ? list.filter((k) => k.createdAt < cutoff) : list,
      previous: prior ? monthlyReportContentSchema.parse(prior.content) : null, previousPeriod: prior?.period ?? null,
      peers: parsed.filter((p) => p.domain.id !== id).map((p) => ({ domain: p.domain, period, content: p.content })),
    }];
  });
}

async function context(slug: string, period: string): Promise<Found | null> {
  validPeriod(period);
  const [domain] = await db.select({ id: domains.id }).from(domains).where(eq(domains.slug, slug)).limit(1);
  return domain ? (await loadFounds(period, [domain.id]))[0] ?? null : null;
}

// Archived KPIs remain visible until a report explicitly resolves a changed set.
function snapshotIds({ active, previous }: Found) {
  const ids = new Set(active.map((k) => k.id));
  for (const metric of previous?.metrics ?? []) ids.add(metric.kpiId);
  return ids;
}
// KPIs the report does not hold yet: all of them for a new report, only newly added ones for a saved report.
function missingIds(found: Found): number[] {
  const included = new Set(found.saved?.metrics.map((m) => m.kpiId));
  return [...snapshotIds(found)].filter((id) => !included.has(id));
}

// Latest entry per `kpiId:periodDate` (newest createdAt, then id).
async function latestEntries(ids: number[], months: string[]) {
  const rows = await inChunks(ids, months.length, (chunk) => db.select().from(kpiEntries).where(and(inArray(kpiEntries.kpiId, chunk), inArray(kpiEntries.periodDate, months))).orderBy(desc(kpiEntries.createdAt), desc(kpiEntries.id)));
  const latest = new Map<string, typeof rows[number]>();
  for (const entry of rows) if (!latest.has(`${entry.kpiId}:${entry.periodDate}`)) latest.set(`${entry.kpiId}:${entry.periodDate}`, entry);
  return latest;
}

type NoteRows = {
  comments: { id: number; kpiId: number; content: string; createdAt: Date }[];
  plans: { kpiId: number; title: string; owner: string; dueDate: string; status: string; updatedAt: Date }[];
};
async function loadNoteRows(kpiIds: number[], period: string): Promise<NoteRows> {
  const [comments, plans] = await Promise.all([
    inChunks(kpiIds, 1, (chunk) => db.select({ id: kpiComments.id, kpiId: kpiComments.kpiId, content: kpiComments.content, createdAt: kpiComments.createdAt }).from(kpiComments).where(and(inArray(kpiComments.kpiId, chunk), eq(kpiComments.periodDate, period)))),
    inChunks(kpiIds, 0, (chunk) => db.select({ kpiId: kpiActionPlans.kpiId, title: kpiActionPlans.title, owner: kpiActionPlans.owner, dueDate: kpiActionPlans.dueDate, status: kpiActionPlans.status, updatedAt: kpiActionPlans.updatedAt }).from(kpiActionPlans).where(inArray(kpiActionPlans.kpiId, chunk))),
  ]);
  plans.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || +b.updatedAt - +a.updatedAt);
  return { comments, plans };
}

// Projects whose schedule overlaps the month, with progress taken from the logs up to the end of that WIB month.
async function loadTimelineLines(period: string): Promise<TimelineLine[]> {
  const next = nextMonthFirst(period);
  const projects = await db.select({ id: timelineProjects.id, name: timelineProjects.name, progress: timelineProjects.progress, endDate: timelineProjects.endDate, estimatedLaunchDate: timelineProjects.estimatedLaunchDate, status: timelineProjectStatuses.name })
    .from(timelineProjects).leftJoin(timelineProjectStatuses, eq(timelineProjects.statusId, timelineProjectStatuses.id))
    .where(and(lt(timelineProjects.startDate, next), gte(timelineProjects.endDate, period))).orderBy(timelineProjects.sortOrder, timelineProjects.id);
  const end = new Date(`${next}T00:00:00+07:00`);
  const logs = await inChunks(projects.map((p) => p.id), 1, (chunk) => db.select().from(timelineProjectLogs).where(and(inArray(timelineProjectLogs.projectId, chunk), lt(timelineProjectLogs.createdAt, end))));
  return timelineLines(projects, logs, period);
}

// Reads shared by every domain's bundle: one query per table however many domains are built.
type Shared = {
  months: string[];
  entries: Map<string, typeof kpiEntries.$inferSelect>;
  targets: Map<string, typeof kpiTargets.$inferSelect>;
  notes: NoteRows;
};

// `check` also reads the latest entries and targets of the report month and the one before, for the saved reports' mismatch questions.
async function loadShared(founds: Found[], period: string, check: boolean): Promise<Shared> {
  const initialIds = unique(founds.flatMap(missingIds));
  const saved = check ? founds.filter((f) => f.saved) : [];
  const months = initialIds.length ? monthsFor(period) : [previousReportMonth(period), period];
  const entryIds = unique([...initialIds, ...saved.flatMap((f) => f.active.filter((k) => k.period === "monthly").map((k) => k.id))]);
  const targetIds = unique([...initialIds, ...saved.flatMap((f) => f.active.map((k) => k.id))]);
  const [entries, targetRows, notes] = await Promise.all([
    latestEntries(entryIds, months),
    inChunks(targetIds, months.length, (chunk) => db.select().from(kpiTargets).where(and(inArray(kpiTargets.kpiId, chunk), inArray(kpiTargets.periodDate, months)))),
    loadNoteRows(initialIds, period),
  ]);
  return { months, entries, targets: new Map(targetRows.map((t) => [`${t.kpiId}:${t.periodDate}`, t])), notes };
}

// Observations, definitions and notes for `ids`, built from the previous report and the live KPI data.
function initialContent(found: Found, period: string, ids: number[], shared: Shared): MonthlyReportContent {
  const { active, previous, previousPeriod } = found;
  const content = emptyMonthlyReportContent();
  const previousById = new Map(previous?.metrics.map((m) => [m.kpiId, m]) ?? []);
  const own = new Set(ids);
  // Follow-ups and risks only make sense from the immediately preceding month; a report from months back is not "last month's".
  const lastMonth = previous && previousPeriod === previousReportMonth(period) ? previous : null;
  const notes = deriveNotes(shared.notes.comments.filter((c) => own.has(c.kpiId)), shared.notes.plans.filter((p) => own.has(p.kpiId)), period, lastMonth?.actions);
  if (previous) content.division = previous.division;
  if (lastMonth) { content.previousActions = notes.previousActions ?? []; content.risks = lastMonth.risks; }
  const activeById = new Map(active.map((k) => [k.id, k]));
  content.metrics = ids.map((id): MonthlyReportMetric => {
    const kpi = activeById.get(id);
    const old = previousById.get(id);
    const baseline = kpi ?? old;
    if (!baseline) throw new MonthlyReportError(500, "KPI snapshot missing");
    const priorObs = new Map(old?.observations.map((o) => [o.month, o]) ?? []);
    const observations: MonthlyObservation[] = shared.months.map((month) => {
      // Preserve authored/corrected historical rows, but never carry last month's value into the new current month.
      const historical = month !== period ? priorObs.get(month) : undefined;
      if (historical) return historical;
      const entry = kpi?.period === "monthly" ? shared.entries.get(`${id}:${month}`) : undefined;
      const override = shared.targets.get(`${id}:${month}`);
      const target = kpi || override ? resolveTarget(kpi ?? { id, target: override!.target }, override, month) : undefined;
      return {
        month, actual: entry?.value ?? null, target: target?.target ?? null,
        source: entry ? entrySource(entry) : "", targetSource: target?.source ?? "",
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

// A new report is built from live data; a saved one only gains the KPIs it does not hold yet.
function reportSnapshot(found: Found, period: string, shared: Shared): MonthlyReportContent {
  const missing = missingIds(found);
  if (!found.saved) return initialContent(found, period, missing, shared);
  if (!missing.length) return found.saved;
  return { ...found.saved, metrics: [...found.saved.metrics, ...initialContent(found, period, missing, shared).metrics] };
}

function bundle(found: Found, period: string, content: MonthlyReportContent, entries: EntryRef[], checkedKpiIds: ReadonlySet<number>, targets: TargetRef[]): MonthlyReportBundle {
  const { domain, peers, active, previous, record, saved } = found;
  const computed = computeMonthlyReport(content, period, peers);
  const currentSet = new Set(active.map((k) => k.id));
  const snapshotSet = new Set(content.metrics.map((m) => m.kpiId));
  const changed = [...currentSet].some((id) => !snapshotSet.has(id));
  const priorSet = new Set(previous?.metrics.map((m) => m.kpiId));
  const priorChanged = !!previous && (priorSet.size !== snapshotSet.size || [...priorSet].some((id) => !snapshotSet.has(id)));
  const savedSet = new Set(saved?.metrics.map((m) => m.kpiId));
  const newlyAdded = !!saved && [...currentSet].some((id) => !savedSet.has(id));
  if (changed) computed.questions.push({ id: "metrics.registry", path: "metrics", question: "Daftar KPI aktif telah berubah; sinkronkan snapshot KPI tanpa menghapus data lama secara diam-diam." });
  if ((priorChanged || newlyAdded || currentSet.size !== snapshotSet.size) && !content.kpiSetChangeNote.trim()) computed.questions.push({ id: "kpiSetChangeNote", path: "kpiSetChangeNote", question: "Jelaskan dan konfirmasi perubahan set KPI terhadap laporan sebelumnya atau daftar KPI aktif." });
  for (const peer of peers) if (content.division && peer.content.division === content.division) computed.questions.push({ id: `division.duplicate.${peer.domain.id}`, path: "division", question: `Divisi ${content.division} juga dipakai ${peer.domain.name}; selesaikan pemetaan agar satu divisi tidak mempunyai dua deck terpisah.` });
  computed.questions.push(...entryMismatchQuestions(content, period, entries, checkedKpiIds, targets));
  return { domain, period, content, ...computed, ready: computed.questions.length === 0, revision: record?.revision ?? 0, updatedAt: record?.updatedAt.toISOString() ?? null };
}

// Bundles for several domains from shared reads: constant query count (about 8), whatever the number of domains.
export async function getMonthlyReportBundles(period: string, domainIds: number[]): Promise<Map<number, MonthlyReportBundle>> {
  const founds = await loadFounds(period, domainIds);
  // A saved report is checked against the latest entries and targets of its current and previous month; a new one was just built from them.
  const shared = await loadShared(founds, period, true);
  const checkMonths = [previousReportMonth(period), period];
  const bundles = new Map<number, MonthlyReportBundle>();
  for (const found of founds) {
    const content = reportSnapshot(found, period, shared);
    const checkIds = found.saved ? found.active.filter((k) => k.period === "monthly").map((k) => k.id) : [];
    const checked = new Set(checkIds);
    const entries = [...shared.entries.values()].filter((e) => checked.has(e.kpiId));
    const targets = found.saved ? found.active.flatMap((k) => checkMonths.map((month) => resolveTarget(k, shared.targets.get(`${k.id}:${month}`), month))) : [];
    bundles.set(found.domain.id, bundle(found, period, content, entries, checked, targets));
  }
  return bundles;
}

export async function getMonthlyReportBundle(domainSlug: string, period: string): Promise<MonthlyReportBundle | null> {
  validPeriod(period);
  const [domain] = await db.select({ id: domains.id }).from(domains).where(eq(domains.slug, domainSlug)).limit(1);
  return domain ? (await getMonthlyReportBundles(period, [domain.id])).get(domain.id) ?? null : null;
}

export type MonthlyReportImportKind = "entries" | "notes" | "timeline";
// checkedKpiIds: KPIs whose entries were looked up, so refresh can tell "entry deleted" from "not checked".
// targets: what the KPI registry gives each report month now, for refreshing rows whose target came from it.
export type MonthlyReportImport = { entries: EntryRef[]; checkedKpiIds: number[]; targets: TargetRef[] } | NotesImport | { lines: TimelineLine[] };

// Raw material for the editor's "pull" buttons. Nothing is saved: the editor applies it to its own unsaved content.
export async function getMonthlyReportImport(domainSlug: string, period: string, kind: MonthlyReportImportKind): Promise<MonthlyReportImport | null> {
  validPeriod(period);
  const [domain] = await db.select({ id: domains.id }).from(domains).where(eq(domains.slug, domainSlug)).limit(1);
  if (!domain) return null;
  if (kind === "timeline") return { lines: await loadTimelineLines(period) };
  const active = await db.select({ id: kpis.id, period: kpis.period, target: kpis.target }).from(kpis).where(and(eq(kpis.domainId, domain.id), eq(kpis.isActive, true)));
  if (kind === "notes") {
    const [rows, [prior]] = await Promise.all([
      loadNoteRows(active.map((k) => k.id), period),
      db.select({ period: monthlyReports.period, content: monthlyReports.content }).from(monthlyReports).where(and(eq(monthlyReports.domainId, domain.id), lt(monthlyReports.period, period))).orderBy(desc(monthlyReports.period)).limit(1),
    ]);
    // Only the immediately preceding month's report counts as "last month's" actions.
    const previousActions = prior?.period === previousReportMonth(period) ? monthlyReportContentSchema.parse(prior.content).actions : [];
    return deriveNotes(rows.comments, rows.plans, period, previousActions);
  }
  // Archived KPIs are never queried, so refresh cannot touch their observations.
  const months = monthsFor(period);
  const checkedKpiIds = active.filter((k) => k.period === "monthly").map((k) => k.id);
  const [entries, targetRows] = await Promise.all([
    latestEntries(checkedKpiIds, months),
    inChunks(active.map((k) => k.id), months.length, (chunk) => db.select().from(kpiTargets).where(and(inArray(kpiTargets.kpiId, chunk), inArray(kpiTargets.periodDate, months)))),
  ]);
  const overrides = new Map(targetRows.map((t) => [`${t.kpiId}:${t.periodDate}`, t]));
  return {
    entries: [...entries.values()].map(({ kpiId, periodDate, value, note, numerator, denominator }) => ({ kpiId, periodDate, value, note, numerator, denominator })),
    checkedKpiIds,
    targets: active.flatMap((k) => months.map((month) => resolveTarget(k, overrides.get(`${k.id}:${month}`), month))),
  };
}

export async function saveMonthlyReport(domainSlug: string, period: string, input: unknown, expectedRevision: number, user: { id: string; email?: string | null }): Promise<MonthlyReportBundle> {
  const found = await context(domainSlug, period);
  if (!found) throw new MonthlyReportError(404, "Domain not found");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new MonthlyReportError(400, "Invalid revision");
  const content = monthlyReportContentSchema.parse(input);
  const [snapshot, registry] = await Promise.all([loadShared([found], period, false).then((shared) => reportSnapshot(found, period, shared)), db.select({ id: kpis.id }).from(kpis).where(eq(kpis.domainId, found.domain.id))]);
  const requiredIds = new Set(snapshot.metrics.map((m) => m.kpiId));
  const suppliedIds = new Set(content.metrics.map((m) => m.kpiId));
  if (requiredIds.size !== suppliedIds.size || [...requiredIds].some((id) => !suppliedIds.has(id))) throw new MonthlyReportError(400, "Report must retain all KPI snapshot IDs; refresh the report to incorporate changed KPIs.");
  const owned = new Set(registry.map((k) => k.id));
  for (const metric of found.previous?.metrics ?? []) owned.add(metric.kpiId);
  for (const metric of found.saved?.metrics ?? []) owned.add(metric.kpiId);
  if ([...suppliedIds].some((id) => !owned.has(id))) throw new MonthlyReportError(400, "Report contains KPI outside this domain or its saved history.");
  const allowedMonths = new Set(monthsFor(period));
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
