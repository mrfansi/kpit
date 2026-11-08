import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { domains, monthlyReportRevisions, monthlyReports, users } from "@/lib/db/schema";
import { computeMonthlyReport } from "@/lib/monthly-report";
import { getMonthlyReportBundle, MonthlyReportError } from "@/lib/monthly-report-store";
import type { MonthlyReportBundle } from "@/lib/monthly-report-types";
import { monthlyReportContentSchema } from "@/lib/validations/monthly-report";

export type ReportStatus = { kind: "none" | "draft" | "ready"; label: string };

// Same source as the editor's open-question list (bundle.questions), so N always matches it.
export function reportStatus(bundle: Pick<MonthlyReportBundle, "revision" | "questions">): ReportStatus {
  if (bundle.revision === 0) return { kind: "none", label: "Belum dibuat" };
  if (bundle.questions.length) return { kind: "draft", label: `Draf, ${bundle.questions.length} pertanyaan` };
  return { kind: "ready", label: "Siap" };
}

export type ReportSummary = { status: ReportStatus; revision: number; updatedAt: string | null; updatedBy: string | null };

// Bundles load in parallel (each is one domain lookup plus one parallel batch); authors come from one extra query.
export async function getReportSummaries(domainRows: { id: number; slug: string }[], period: string): Promise<Map<number, ReportSummary>> {
  const [bundles, authors] = await Promise.all([
    Promise.all(domainRows.map((d) => getMonthlyReportBundle(d.slug, period))),
    db.select({ domainId: monthlyReports.domainId, name: users.name, email: users.email }).from(monthlyReports)
      .leftJoin(users, eq(users.id, monthlyReports.updatedBy)).where(eq(monthlyReports.period, period)),
  ]);
  const byDomain = new Map(authors.map((a) => [a.domainId, a.name || a.email || null]));
  const result = new Map<number, ReportSummary>();
  bundles.forEach((bundle, i) => {
    if (bundle) result.set(domainRows[i].id, { status: reportStatus(bundle), revision: bundle.revision, updatedAt: bundle.updatedAt, updatedBy: byDomain.get(domainRows[i].id) ?? null });
  });
  return result;
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

// Deck source for one stored revision. Peers are the current peer reports (reconciliation compares against them today).
export async function getRevisionBundle(domainSlug: string, period: string, revision: number): Promise<MonthlyReportBundle> {
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
  return { domain, period, content, ...computed, revision, updatedAt: row.createdAt.toISOString() };
}

export function formatRevisionTime(date: Date | string): string {
  return new Date(date).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
}
