import { and, countDistinct, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { domains, kpiEntries, kpis, monthlyReportRevisions, monthlyReports, users } from "@/lib/db/schema";
import { computeMonthlyReport } from "@/lib/monthly-report";
import { getMonthlyReportBundles, MonthlyReportError } from "@/lib/monthly-report-store";
import type { MonthlyReportBundle } from "@/lib/monthly-report-types";
import { monthlyReportContentSchema } from "@/lib/validations/monthly-report";
import { formatDateTimeJakarta } from "@/lib/date-utils";

export type ReportStatus = { kind: "none" | "draft" | "ready"; label: string };

// Same source as the editor's open-question list (bundle.questions), so N always matches it.
export function reportStatus(bundle: Pick<MonthlyReportBundle, "revision" | "questions">): ReportStatus {
  if (bundle.revision === 0) return { kind: "none", label: "Belum dibuat" };
  if (bundle.questions.length) return { kind: "draft", label: `Draf, ${bundle.questions.length} pertanyaan` };
  return { kind: "ready", label: "Siap" };
}

export type ReportSummary = { status: ReportStatus; revision: number; updatedAt: string | null; updatedBy: string | null };

// Only domains with a saved report build a bundle (the status needs its question count); one shared read set covers all of them.
export async function getReportSummaries(domainRows: { id: number }[], period: string): Promise<Map<number, ReportSummary>> {
  const saved = await db.select({ domainId: monthlyReports.domainId, name: users.name, email: users.email }).from(monthlyReports)
    .leftJoin(users, eq(users.id, monthlyReports.updatedBy)).where(eq(monthlyReports.period, period));
  const byDomain = new Map(saved.map((a) => [a.domainId, a.name || a.email || null]));
  const savedIds = domainRows.map((d) => d.id).filter((id) => byDomain.has(id));
  const bundles = savedIds.length ? await getMonthlyReportBundles(period, savedIds) : new Map<number, MonthlyReportBundle>();
  const result = new Map<number, ReportSummary>();
  for (const d of domainRows) {
    const bundle = bundles.get(d.id);
    result.set(d.id, bundle
      ? { status: reportStatus(bundle), revision: bundle.revision, updatedAt: bundle.updatedAt, updatedBy: byDomain.get(d.id) ?? null }
      : { status: reportStatus({ revision: 0, questions: [] }), revision: 0, updatedAt: null, updatedBy: null });
  }
  return result;
}

export type KpiEntryCount = { filled: number; total: number };

// One grouped query for every domain: active monthly KPIs vs those with an entry in the period. Domains without KPIs are absent.
export async function getKpiEntryCounts(period: string): Promise<Map<number, KpiEntryCount>> {
  const rows = await db.select({ domainId: kpis.domainId, total: countDistinct(kpis.id), filled: countDistinct(kpiEntries.kpiId) }).from(kpis)
    .leftJoin(kpiEntries, and(eq(kpiEntries.kpiId, kpis.id), eq(kpiEntries.periodDate, period)))
    .where(and(eq(kpis.isActive, true), eq(kpis.period, "monthly"))).groupBy(kpis.domainId);
  return new Map(rows.map((r) => [r.domainId, { filled: r.filled, total: r.total }]));
}

export async function listRevisions(domainSlug: string, period: string) {
  const [domain] = await db.select({ id: domains.id, name: domains.name, slug: domains.slug }).from(domains).where(eq(domains.slug, domainSlug)).limit(1);
  if (!domain) return null;
  const rows = await db.select({ revision: monthlyReportRevisions.revision, createdAt: monthlyReportRevisions.createdAt, authorId: monthlyReportRevisions.authorId, name: users.name, email: users.email })
    .from(monthlyReportRevisions)
    .innerJoin(monthlyReports, eq(monthlyReportRevisions.reportId, monthlyReports.id))
    .leftJoin(users, eq(users.id, monthlyReportRevisions.authorId))
    .where(and(eq(monthlyReports.domainId, domain.id), eq(monthlyReports.period, period)))
    .orderBy(desc(monthlyReportRevisions.revision));
  return { domain, revisions: rows.map((r) => ({ revision: r.revision, createdAt: r.createdAt, author: r.name || r.email || r.authorId })) };
}

// Deck source for one explicitly requested stored revision. Always rendered from its stored content as an archive (archivedAt set),
// without the readiness gate, so an explicit revision link always opens. Peers are the current peer reports.
export async function getRevisionBundle(domainSlug: string, period: string, revision: number): Promise<MonthlyReportBundle & { archivedAt: string }> {
  const [domain] = await db.select({ id: domains.id, name: domains.name, slug: domains.slug }).from(domains).where(eq(domains.slug, domainSlug)).limit(1);
  if (!domain) throw new MonthlyReportError(404, "Domain tidak ditemukan.");
  const [[row], peerRows] = await Promise.all([
    db.select({ content: monthlyReportRevisions.content, createdAt: monthlyReportRevisions.createdAt }).from(monthlyReportRevisions)
      .innerJoin(monthlyReports, eq(monthlyReportRevisions.reportId, monthlyReports.id))
      .where(and(eq(monthlyReports.domainId, domain.id), eq(monthlyReports.period, period), eq(monthlyReportRevisions.revision, revision))).limit(1),
    db.select({ period: monthlyReports.period, content: monthlyReports.content, id: domains.id, name: domains.name, slug: domains.slug })
      .from(monthlyReports).innerJoin(domains, eq(monthlyReports.domainId, domains.id))
      .where(and(eq(monthlyReports.period, period), ne(monthlyReports.domainId, domain.id))),
  ]);
  if (!row) throw new MonthlyReportError(404, "Revisi tidak ditemukan.");
  const content = monthlyReportContentSchema.parse(row.content);
  const peers = peerRows.map((p) => ({ domain: { id: p.id, name: p.name, slug: p.slug }, period: p.period, content: monthlyReportContentSchema.parse(p.content) }));
  const computed = computeMonthlyReport(content, period, peers);
  const createdAt = row.createdAt.toISOString();
  return { domain, period, content, ...computed, revision, updatedAt: createdAt, archivedAt: createdAt };
}

export function formatRevisionTime(date: Date | string): string {
  return formatDateTimeJakarta(date);
}
