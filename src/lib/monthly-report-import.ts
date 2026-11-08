// Pure derivations that copy data the PIC already keeps elsewhere (KPI entries, comments, action plans,
// timeline) into a monthly report. No DB or React imports: shared by the store, the API and the editor.
import { computeMonthlyReport, previousReportMonth, SHORT_MONTHS } from "./monthly-report";
import type { MonthlyObservation, MonthlyReportAction, MonthlyReportContent, ReportQuestion } from "./monthly-report-types";

export type EntryRef = { kpiId: number; periodDate: string; value: number; note: string | null; numerator?: number | null; denominator?: number | null };
export type ImportResult = { content: MonthlyReportContent; changes: string[] };
export type NotesImport = { causes: { kpiId: number; text: string }[]; actions: MonthlyReportAction[]; /** Last report's actions, for the follow-up list. */ previousActions?: MonthlyReportAction[] };
export type TimelineLine = { id: number; text: string };

export const monthLabel = (month: string) => `${SHORT_MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
const clip = (text: string, max: number) => text.length > max ? text.slice(0, max) : text;
export const nextMonthFirst = (period: string) => { const d = new Date(`${period}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); };

// ---- Gap 1 + 11: observations sourced from KPI entries ----

// Stable prefix: refresh recognises rows it wrote (and the legacy "KPI entry #id" format) by it, never by the free-text note.
export const ENTRY_SOURCE_PREFIX = "Entri KPI";
const LEGACY_ENTRY_SOURCE_PREFIX = "KPI entry #";

export function entrySource(entry: Pick<EntryRef, "periodDate" | "note">): string {
  const note = entry.note?.trim();
  return clip(`${ENTRY_SOURCE_PREFIX} ${monthLabel(entry.periodDate)}${note ? `: ${note}` : ""}`, 500);
}

// Refreshable = missing, or copied from a KPI entry. A hand-typed numerator/denominator (the entry has none) is the PIC's
// and is never overwritten; when the entry carries parts, they are the source of truth for entry-sourced rows.
const hasParts = (p: { numerator?: number | null; denominator?: number | null }) => (p.numerator ?? null) !== null || (p.denominator ?? null) !== null;
const entrySourced = (o: MonthlyObservation) => o.state === "provided" && (o.source.startsWith(ENTRY_SOURCE_PREFIX) || o.source.startsWith(LEGACY_ENTRY_SOURCE_PREFIX));
function refreshable(o: MonthlyObservation, entry?: EntryRef) {
  if (o.state === "missing") return o.actual === null;
  return entrySourced(o) && (!hasParts(o) || !!entry && hasParts(entry));
}
// A hand-typed Realisasi, Pembilang or Penyebut leaves the refreshable set: the source no longer starts with the entry prefix.
export function markManualActual(o: MonthlyObservation): MonthlyObservation {
  return entrySourced(o) ? { ...o, source: clip(`Manual (${o.source})`, 500) } : o;
}
const stale = (o: MonthlyObservation, entry: EntryRef | undefined): entry is EntryRef =>
  !!entry && refreshable(o, entry) && (o.actual !== entry.value || o.numerator !== (entry.numerator ?? null) || o.denominator !== (entry.denominator ?? null));
// Entry-sourced value whose entry was deleted since. Only for KPIs whose entries were actually looked up (monthly and active):
// for the others "no entry" means "not checked", not "deleted".
const orphaned = (o: MonthlyObservation, entry: EntryRef | undefined, kpiId: number, checked?: ReadonlySet<number>) =>
  !entry && !!checked?.has(kpiId) && entrySourced(o) && o.actual !== null;
const entryKey = (kpiId: number, month: string) => `${kpiId}:${month}`;
const entryMap = (entries: EntryRef[]) => new Map(entries.map((e) => [entryKey(e.kpiId, e.periodDate), e]));
const show = (value: number | null) => value === null ? "kosong" : String(value);

// checkedKpiIds: KPIs whose entries were loaded; without it a missing entry is never treated as deleted.
export function refreshFromEntries(content: MonthlyReportContent, entries: EntryRef[], checkedKpiIds?: ReadonlySet<number>): ImportResult {
  const byKey = entryMap(entries);
  const changes: string[] = [];
  const metrics = content.metrics.map((metric) => {
    let touched = false;
    const observations = metric.observations.map((o) => {
      const entry = byKey.get(entryKey(metric.kpiId, o.month));
      if (orphaned(o, entry, metric.kpiId, checkedKpiIds)) {
        touched = true;
        changes.push(`${metric.name}, ${monthLabel(o.month)}: ${show(o.actual)} → kosong (entri dihapus)`);
        return { ...o, actual: null, state: "missing" as const, source: "", numerator: null, denominator: null };
      }
      if (!stale(o, entry)) return o;
      touched = true;
      changes.push(`${metric.name}, ${monthLabel(o.month)}: ${o.actual !== entry.value ? `${show(o.actual)} → ${entry.value}` : "pembilang dan penyebut diperbarui"}`);
      return { ...o, actual: entry.value, state: "provided" as const, source: entrySource(entry), numerator: entry.numerator ?? null, denominator: entry.denominator ?? null };
    });
    return touched ? { ...metric, observations } : metric;
  });
  return { content: changes.length ? { ...content, metrics } : content, changes };
}

// Saved observation (current and previous month) behind the latest KPI entry. Same rule as refresh, so one click clears it.
export function entryMismatchQuestions(content: MonthlyReportContent, period: string, entries: EntryRef[], checkedKpiIds?: ReadonlySet<number>): ReportQuestion[] {
  const byKey = entryMap(entries);
  const questions: ReportQuestion[] = [];
  content.metrics.forEach((metric, index) => {
    for (const month of [previousReportMonth(period), period]) {
      const o = metric.observations.find((row) => row.month === month);
      const entry = byKey.get(entryKey(metric.kpiId, month));
      if (!o) continue;
      const path = `metrics.${index}.observations.${month}.entry`;
      if (orphaned(o, entry, metric.kpiId, checkedKpiIds)) {
        questions.push({ id: path, path, question: `Entri KPI ${metric.name} ${monthLabel(month)} sudah dihapus; tarik ulang atau ubah sumber bila sengaja.` });
        continue;
      }
      if (!stale(o, entry)) continue;
      const what = o.actual !== entry.value ? `Nilai ${metric.name} ${monthLabel(month)} (${show(o.actual)}) berbeda dari entri KPI terbaru (${entry.value})` : `Pembilang/penyebut ${metric.name} ${monthLabel(month)} berbeda dari entri KPI terbaru`;
      questions.push({ id: path, path, question: `${what}. Tarik ulang dari entri KPI, atau ubah sumber realisasi bila sengaja berbeda.` });
    }
  });
  return questions;
}

// ---- Follow-up of last month's actions ----

// Only for a report without a follow-up list yet; never replaces rows the PIC already marked.
export function applyPreviousActions(content: MonthlyReportContent, actions: MonthlyReportAction[]): ImportResult {
  if (content.previousActions.length || !actions.length) return { content, changes: [] };
  return { content: { ...content, previousActions: actions.map((a) => ({ ...a, status: "", note: "" })) }, changes: actions.map((a) => a.action) };
}

// ---- Gap 2: deviation cause and next-month actions from comments and action plans ----

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
export function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity])
    .replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n")
    .trim();
}

type CommentRow = { id: number; kpiId: number; content: string; createdAt: Date | number };
type PlanRow = { title: string; owner: string; dueDate: string; status: string };

export function deriveNotes(comments: CommentRow[], plans: PlanRow[], period: string): NotesImport {
  const time = (c: CommentRow) => +new Date(c.createdAt);
  const newest = new Map<number, CommentRow>();
  for (const c of comments) {
    const best = newest.get(c.kpiId);
    if (!best || time(c) > time(best) || time(c) === time(best) && c.id > best.id) newest.set(c.kpiId, c);
  }
  const causes = [...newest.values()].map((c) => ({ kpiId: c.kpiId, text: clip(htmlToText(c.content), 10000) })).filter((c) => c.text);
  const firstNext = nextMonthFirst(period);
  const actions = plans
    .filter((p) => (p.status === "open" || p.status === "in_progress") && /^\d{4}-\d{2}-\d{2}/.test(p.dueDate) && p.dueDate.slice(0, 10) >= firstNext)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 100)
    .map((p) => ({ action: clip(p.title, 10000), pic: clip(p.owner, 500), deadline: p.dueDate.slice(0, 10) }));
  return { causes, actions };
}

// Fills only empty fields: a PIC-written cause or action list is never replaced.
// A cause is copied only for a KPI whose current month misses its target (the report's own missedTarget rule).
export function applyNotes(content: MonthlyReportContent, notes: NotesImport, period: string): ImportResult {
  const changes: string[] = [];
  const cause = new Map(notes.causes.map((c) => [c.kpiId, c.text]));
  const missed = cause.size ? computeMonthlyReport(content, period).metrics.map((m) => m.missedTarget) : [];
  const metrics = content.metrics.map((metric, index) => {
    const text = cause.get(metric.kpiId);
    if (!text || !missed[index] || metric.deviationCause.trim()) return metric;
    changes.push(`Penyebab deviasi ${metric.name}`);
    return { ...metric, deviationCause: text };
  });
  const fillActions = !content.actions.length && notes.actions.length > 0;
  if (fillActions) changes.push(`${notes.actions.length} tindakan dari action plan`);
  return { content: changes.length ? { ...content, metrics, actions: fillActions ? notes.actions : content.actions } : content, changes };
}

// ---- Gap 4: timeline projects as activities ----

type ProjectRow = { id: number; name: string; progress: number; endDate: string; estimatedLaunchDate: string | null; status: string | null };
type LogRow = { projectId: number; progressBefore: number | null; progressAfter: number | null; createdAt: Date | number; id: number };

// The source tag doubles as the duplicate key; the closing ")" keeps #3 from matching #30.
const timelineTag = (id: number) => `Timeline project #${id})`;

// Months are WIB (Asia/Jakarta) like the rest of the report. Callers pass projects overlapping the month and logs created before
// the month's end; "to" is the last progress logged by then (current progress only when nothing was logged), "from" the first in-month change.
export function timelineLines(projects: ProjectRow[], logs: LogRow[], period: string): TimelineLine[] {
  const start = +new Date(`${period}T00:00:00+07:00`);
  const end = +new Date(`${nextMonthFirst(period)}T00:00:00+07:00`);
  const ordered = logs.filter((l) => +new Date(l.createdAt) < end).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt) || a.id - b.id);
  return projects.map((p) => {
    const own = ordered.filter((l) => l.projectId === p.id);
    const from = own.find((l) => +new Date(l.createdAt) >= start && l.progressBefore !== null)?.progressBefore ?? null;
    const to = [...own].reverse().find((l) => l.progressAfter !== null)?.progressAfter ?? p.progress;
    const progress = from !== null && from !== to ? `progress ${from}%→${to}%` : `progress ${to}%`;
    const date = p.estimatedLaunchDate ? `estimasi rilis ${p.estimatedLaunchDate}` : `selesai ${p.endDate}`;
    return { id: p.id, text: `${p.name}: ${progress}, ${p.status ?? "tanpa status"}, ${date} (sumber: ${timelineTag(p.id)}` };
  });
}

export function appendTimelineActivities(content: MonthlyReportContent, lines: TimelineLine[]): ImportResult {
  const fresh = lines.filter((line) => !content.activities.some((a) => a.includes(timelineTag(line.id))));
  return { content: fresh.length ? { ...content, activities: [...content.activities, ...fresh.map((l) => l.text)] } : content, changes: fresh.map((l) => l.text) };
}

// ---- Gap 9: question path -> field id ----

export const fieldId = (path: string) => `f-${path.replaceAll(".", "-")}`;
