// Pure derivations that copy data the PIC already keeps elsewhere (KPI entries, comments, action plans,
// timeline) into a monthly report. No DB or React imports: shared by the store, the API and the editor.
import { computeMonthlyReport, previousReportMonth, SHORT_MONTHS } from "./monthly-report";
import { formatDayShort, formatNumber2 } from "./date-utils";
import type { ComputedReportMetric, MonthlyObservation, MonthlyPreviousAction, MonthlyReportAction, MonthlyReportContent, ReportQuestion } from "./monthly-report-types";

export type EntryRef = { kpiId: number; periodDate: string; value: number; note: string | null; numerator?: number | null; denominator?: number | null };
export type ImportResult = { content: MonthlyReportContent; changes: string[] };
/** `evidence` fills an empty deviationEvidence together with the cause. `previousActions` carry the status of their matching action plan. */
export type NotesImport = { causes: { kpiId: number; text: string; evidence?: string }[]; actions: MonthlyReportAction[]; /** Last month's report actions, for the follow-up list. */ previousActions?: MonthlyPreviousAction[] };
/** Target the KPI registry currently gives a month; `source` is the generated targetSource text. */
export type TargetRef = { kpiId: number; periodDate: string; target: number; source: string };
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

// Generated target sources, written by the store; refresh recognises them by prefix, so a hand-typed source is never touched.
const TARGET_OVERRIDE_PREFIX = "KPI target override #";
const TARGET_DEFAULT_PREFIX = "KPI default target #";
export function resolveTarget(kpi: { id: number; target: number }, override: { id: number; target: number } | undefined, month: string): TargetRef {
  return override
    ? { kpiId: kpi.id, periodDate: month, target: override.target, source: `${TARGET_OVERRIDE_PREFIX}${override.id} (${month})` }
    : { kpiId: kpi.id, periodDate: month, target: kpi.target, source: `${TARGET_DEFAULT_PREFIX}${kpi.id} (${month})` };
}
const targetGenerated = (o: MonthlyObservation) => o.targetSource.startsWith(TARGET_OVERRIDE_PREFIX) || o.targetSource.startsWith(TARGET_DEFAULT_PREFIX);
const targetStale = (o: MonthlyObservation, ref: TargetRef | undefined): ref is TargetRef => !!ref && targetGenerated(o) && o.target !== ref.target;
// A hand-typed Target leaves the refreshable set: the source no longer starts with a generated prefix.
export function markManualTarget(o: MonthlyObservation): MonthlyObservation {
  return targetGenerated(o) ? { ...o, targetSource: clip(`Manual (${o.targetSource})`, 500) } : o;
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
const targetMap = (targets: TargetRef[] = []) => new Map(targets.map((t) => [entryKey(t.kpiId, t.periodDate), t]));
const show = (value: number | null) => value === null ? "kosong" : String(value);

// checkedKpiIds: KPIs whose entries were loaded; without it a missing entry is never treated as deleted.
export function refreshFromEntries(content: MonthlyReportContent, entries: EntryRef[], checkedKpiIds?: ReadonlySet<number>, targets?: TargetRef[]): ImportResult {
  const byKey = entryMap(entries);
  const targetByKey = targetMap(targets);
  const changes: string[] = [];
  const metrics = content.metrics.map((metric) => {
    let touched = false;
    const observations = metric.observations.map((o) => {
      const entry = byKey.get(entryKey(metric.kpiId, o.month));
      const label = `${metric.name}, ${monthLabel(o.month)}`;
      let next = o;
      if (orphaned(o, entry, metric.kpiId, checkedKpiIds)) {
        changes.push(`${label}: ${show(o.actual)} → kosong (entri dihapus)`);
        next = { ...o, actual: null, state: "missing" as const, source: "", numerator: null, denominator: null };
      } else if (stale(o, entry)) {
        changes.push(`${label}: ${o.actual !== entry.value ? `${show(o.actual)} → ${entry.value}` : "pembilang dan penyebut diperbarui"}`);
        next = { ...o, actual: entry.value, state: "provided" as const, source: entrySource(entry), numerator: entry.numerator ?? null, denominator: entry.denominator ?? null };
      }
      const ref = targetByKey.get(entryKey(metric.kpiId, o.month));
      if (targetStale(next, ref)) {
        changes.push(`${label}: target ${show(next.target)} → ${ref.target}`);
        next = { ...next, target: ref.target, targetSource: ref.source };
      }
      if (next !== o) touched = true;
      return next;
    });
    return touched ? { ...metric, observations } : metric;
  });
  return { content: changes.length ? { ...content, metrics } : content, changes };
}

// Saved observation (current and previous month) behind the latest KPI entry. Same rule as refresh, so one click clears it.
export function entryMismatchQuestions(content: MonthlyReportContent, period: string, entries: EntryRef[], checkedKpiIds?: ReadonlySet<number>, targets?: TargetRef[]): ReportQuestion[] {
  const byKey = entryMap(entries);
  const targetByKey = targetMap(targets);
  const questions: ReportQuestion[] = [];
  content.metrics.forEach((metric, index) => {
    for (const month of [previousReportMonth(period), period]) {
      const o = metric.observations.find((row) => row.month === month);
      const entry = byKey.get(entryKey(metric.kpiId, month));
      if (!o) continue;
      const path = `metrics.${index}.observations.${month}.entry`;
      const ref = targetByKey.get(entryKey(metric.kpiId, month));
      if (targetStale(o, ref)) {
        const targetPath = `metrics.${index}.observations.${month}.target`;
        questions.push({ id: targetPath, path: targetPath, question: `Target ${metric.name} ${monthLabel(month)} (${show(o.target)}) berbeda dari target KPI terbaru (${ref.target}). Tarik ulang dari entri KPI, atau ubah sumber target bila sengaja berbeda.` });
      }
      if (orphaned(o, entry, metric.kpiId, checkedKpiIds)) {
        questions.push({ id: path, path, question: `Entri KPI ${metric.name} ${monthLabel(month)} sudah dihapus; tarik ulang atau ubah sumber bila sengaja.` });
      } else if (entry && entrySourced(o) && !refreshable(o, entry) && o.actual !== entry.value) {
        // Parts typed on an entry that has none: refresh skips the row, but the value still disagrees.
        questions.push({ id: path, path, question: `Nilai ${metric.name} ${monthLabel(month)} (${show(o.actual)}) berbeda dari entri KPI terbaru (${entry.value}), tetapi pembilang/penyebut laporan tidak ikut tarik ulang. Hapus pembilang/penyebut lalu tarik ulang, atau ubah sumber realisasi bila sengaja berbeda.` });
      } else if (stale(o, entry)) {
        const what = o.actual !== entry.value ? `Nilai ${metric.name} ${monthLabel(month)} (${show(o.actual)}) berbeda dari entri KPI terbaru (${entry.value})` : `Pembilang/penyebut ${metric.name} ${monthLabel(month)} berbeda dari entri KPI terbaru`;
        questions.push({ id: path, path, question: `${what}. Tarik ulang dari entri KPI, atau ubah sumber realisasi bila sengaja berbeda.` });
      }
    }
  });
  return questions;
}

// ---- Follow-up of last month's actions ----

// Fills a report without a follow-up list; otherwise only the empty status of a row matching an imported one. A status the PIC set is never replaced.
const previousKey = (a: Pick<MonthlyPreviousAction, "action" | "pic" | "deadline">) => `${a.action}\u0000${a.pic}\u0000${a.deadline}`;
const STATUS_LABEL = { done: "selesai", in_progress: "berjalan", dropped: "dibatalkan" } as const;
export function applyPreviousActions(content: MonthlyReportContent, actions: MonthlyPreviousAction[]): ImportResult {
  if (!actions.length) return { content, changes: [] };
  if (!content.previousActions.length) return { content: { ...content, previousActions: actions.map((a) => ({ ...a })) }, changes: actions.map((a) => a.action) };
  const byKey = new Map(actions.map((a) => [previousKey(a), a]));
  const changes: string[] = [];
  const previousActions = content.previousActions.map((row) => {
    const status = row.status ? "" : byKey.get(previousKey(row))?.status;
    if (!status) return row;
    changes.push(`${row.action}: ${STATUS_LABEL[status]}`);
    return { ...row, status };
  });
  return { content: changes.length ? { ...content, previousActions } : content, changes };
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

// Action plan state behind a promised action; "open" counts as running because the PIC has started tracking it.
const PLAN_STATUS: Record<string, MonthlyPreviousAction["status"]> = { done: "done", open: "in_progress", in_progress: "in_progress", cancelled: "dropped" };

// previousActions: last month's report actions; each gets the status of the plan with the same title, owner and due date.
export function deriveNotes(comments: CommentRow[], plans: PlanRow[], period: string, previousActions?: MonthlyReportAction[]): NotesImport {
  const time = (c: CommentRow) => +new Date(c.createdAt);
  const newest = new Map<number, CommentRow>();
  for (const c of comments) {
    const best = newest.get(c.kpiId);
    if (!best || time(c) > time(best) || time(c) === time(best) && c.id > best.id) newest.set(c.kpiId, c);
  }
  const causes = [...newest.values()]
    .map((c) => ({ kpiId: c.kpiId, text: clip(htmlToText(c.content), 10000), evidence: `Komentar KPI #${c.id} (${formatDayShort(new Date(c.createdAt))})` }))
    .filter((c) => c.text);
  const firstNext = nextMonthFirst(period);
  const actions = plans
    .filter((p) => (p.status === "open" || p.status === "in_progress") && /^\d{4}-\d{2}-\d{2}/.test(p.dueDate) && p.dueDate.slice(0, 10) >= firstNext)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 100)
    .map((p) => ({ action: clip(p.title, 10000), pic: clip(p.owner, 500), deadline: p.dueDate.slice(0, 10) }));
  if (!previousActions) return { causes, actions };
  const byKey = new Map<string, MonthlyPreviousAction["status"]>();
  for (const p of plans) { const key = previousKey({ action: p.title, pic: p.owner, deadline: p.dueDate.slice(0, 10) }); if (!byKey.has(key)) byKey.set(key, PLAN_STATUS[p.status] ?? ""); }
  return { causes, actions, previousActions: previousActions.map((a) => ({ ...a, status: byKey.get(previousKey(a)) ?? "", note: "" })) };
}

// Fills only empty fields: a PIC-written cause or action list is never replaced.
// A cause is copied only for a KPI whose current month misses its target (the report's own missedTarget rule).
export function applyNotes(content: MonthlyReportContent, notes: NotesImport, period: string): ImportResult {
  const changes: string[] = [];
  const cause = new Map(notes.causes.map((c) => [c.kpiId, c]));
  const missed = cause.size ? computeMonthlyReport(content, period).metrics.map((m) => m.missedTarget) : [];
  const metrics = content.metrics.map((metric, index) => {
    const found = cause.get(metric.kpiId);
    if (!found || !missed[index] || metric.deviationCause.trim()) return metric;
    changes.push(`Penyebab deviasi ${metric.name}`);
    return { ...metric, deviationCause: found.text, deviationEvidence: metric.deviationEvidence.trim() ? metric.deviationEvidence : found.evidence ?? metric.deviationEvidence };
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

// ---- Facts from the numbers: a deterministic first draft of the summary, never AI ----

// Callers fill only empty fields with the result. `computed.metrics` is computeMonthlyReport's output for `content`, same order.
// Summary: the missed KPIs with their gap (all when at most 3, else the 2 furthest plus a count) and the largest absolute MoM change.
// worstOutcome: the KPI with the largest relative miss (gap / |target|; plain gap when the target is 0), "" when nothing missed.
export function draftSummaryFromNumbers(content: MonthlyReportContent, computed: { metrics: ComputedReportMetric[] }, period: string): { summary: string[]; worstOutcome: string } {
  const text = (value: number, unit: string) => `${formatNumber2(value)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
  const rows = content.metrics.flatMap((metric, i) => {
    const m = computed.metrics[i];
    return m ? [{ metric, m, index: i }] : [];
  });
  const missed = rows
    .filter(({ m }) => m.missedTarget && m.current.value !== null && m.current.target !== null)
    .map((r) => {
      const gap = Math.abs(r.m.current.value! - r.m.current.target!);
      const target = Math.abs(r.m.current.target!);
      return { ...r, gap, relative: target > 0 ? gap / target : gap };
    })
    .sort((a, b) => b.relative - a.relative || a.index - b.index);
  const line = ({ metric, m, gap }: (typeof missed)[number]) => `${metric.name} meleset dari target: aktual ${text(m.current.value!, metric.unit)} vs target ${text(m.current.target!, metric.unit)} (selisih ${text(gap, metric.unit)}).`;
  const summary: string[] = [];
  if (missed.length <= 3) summary.push(...missed.map(line));
  else summary.push(...missed.slice(0, 2).map(line), `${missed.length - 2} KPI lain juga meleset: ${missed.slice(2).map((r) => r.metric.name).join(", ")}.`);
  const measured = rows.filter(({ m }) => m.current.state === "provided" && m.current.value !== null && m.current.target !== null).length;
  if (!missed.length && measured) summary.push(`Semua ${measured} KPI bertarget mencapai target ${monthLabel(period)}.`);
  const moved = rows.filter(({ m }) => m.momPercent !== null && m.momPercent !== 0).sort((a, b) => Math.abs(b.m.momPercent!) - Math.abs(a.m.momPercent!) || a.index - b.index)[0];
  if (moved) summary.push(`Perubahan bulan ke bulan terbesar: ${moved.metric.name} ${moved.m.momPercent! > 0 ? "naik" : "turun"} ${formatNumber2(Math.abs(moved.m.momPercent!))}% (${text(moved.m.previous.value!, moved.metric.unit)} → ${text(moved.m.current.value!, moved.metric.unit)}).`);
  const worst = missed[0];
  return { summary, worstOutcome: worst ? `${worst.metric.name} meleset paling jauh dari target ${monthLabel(period)}: aktual ${text(worst.m.current.value!, worst.metric.unit)} vs target ${text(worst.m.current.target!, worst.metric.unit)} (selisih ${text(worst.gap, worst.metric.unit)}${worst.m.current.target ? `, ${formatNumber2(worst.relative * 100)}% dari target` : ""}).` : "" };
}
