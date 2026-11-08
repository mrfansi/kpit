import assert from "node:assert/strict";
import test from "node:test";
import { computeMonthlyReport, emptyMonthlyReportContent } from "./monthly-report";
import { formatDayShort } from "./date-utils";
import { appendTimelineActivities, applyNotes, applyPreviousActions, deriveNotes, draftSummaryFromNumbers, entryMismatchQuestions, entrySource, fieldId, htmlToText, markManualActual, markManualTarget, refreshFromEntries, resolveTarget, timelineLines, type EntryRef, type TargetRef } from "./monthly-report-import";
import type { MonthlyObservation, MonthlyPreviousAction, MonthlyReportContent } from "./monthly-report-types";

const obs = (month: string, patch: Partial<MonthlyObservation> = {}): MonthlyObservation => ({ month, actual: null, target: 100, source: "", targetSource: "t", state: "missing", numerator: null, denominator: null, ...patch });
function report(observations: MonthlyObservation[]): MonthlyReportContent {
  const content = emptyMonthlyReportContent();
  content.metrics = [{ kpiId: 7, name: "Cash", definition: "", unit: "Rp", direction: "higher_better", definitionConfirmed: false, aggregation: null, aggregationNote: "", observations, sharedMetricKey: "", sharingReviewed: false, reconciliationNote: "", deviationCause: "", deviationEvidence: "" }];
  return content;
}
const entry = (periodDate: string, value: number, note: string | null = null): EntryRef => ({ kpiId: 7, periodDate, value, note });

test("entry source is the note after a stable prefix, and stays readable without a note", () => {
  assert.equal(entrySource(entry("2026-10-01", 1)), "Entri KPI Okt 2026");
  assert.equal(entrySource(entry("2026-10-01", 1, " Dari sheet finance ")), "Entri KPI Okt 2026: Dari sheet finance");
});

test("refresh updates only missing or entry-sourced rows and lists what changed", () => {
  const content = report([
    obs("2026-08-01", { actual: 5, state: "provided", source: "KPI entry #3 (2026-08-01)" }),
    obs("2026-09-01", { actual: 6, state: "provided", source: "Laporan audit" }),
    obs("2026-10-01", { state: "missing" }),
    obs("2026-11-01", { state: "untracked" }),
    obs("2026-12-01", { actual: 9, state: "provided", source: "Entri KPI Des 2026", numerator: 9, denominator: 1 }),
  ]);
  const entries = ["2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01"].map((m) => entry(m, 50, "n"));
  const { content: next, changes } = refreshFromEntries(content, entries);
  const rows = next.metrics[0].observations;
  assert.deepEqual(rows.map((r) => r.actual), [50, 6, 50, null, 9]);
  assert.equal(rows[0].source, "Entri KPI Agu 2026: n");
  assert.equal(rows[2].state, "provided");
  assert.equal(rows[1], content.metrics[0].observations[1]);
  assert.equal(changes.length, 2);
  assert.equal(refreshFromEntries(next, entries).changes.length, 0);
});

test("a hand-edited actual becomes manual: refresh and the mismatch check leave it alone", () => {
  const row = obs("2026-10-01", { actual: 2, state: "provided", source: "Entri KPI Okt 2026: sheet" });
  const edited = markManualActual({ ...row, actual: 9 });
  assert.equal(edited.source, "Manual (Entri KPI Okt 2026: sheet)");
  assert.equal(markManualActual({ ...edited, actual: 8 }).source, edited.source);
  assert.equal(markManualActual(obs("2026-10-01", { actual: 1, state: "provided", source: "x".repeat(500) })).source.length, 500);
  const content = report([edited]);
  assert.equal(refreshFromEntries(content, [entry("2026-10-01", 50)]).changes.length, 0);
  assert.equal(entryMismatchQuestions(content, "2026-10-01", [entry("2026-10-01", 50)]).length, 0);
});

test("mismatch question names current/previous month only and ignores hand-edited rows", () => {
  const content = report([
    obs("2026-09-01", { actual: 1, state: "provided", source: "Entri KPI Sep 2026" }),
    obs("2026-10-01", { actual: 2, state: "provided", source: "Entri KPI Okt 2026" }),
  ]);
  const questions = entryMismatchQuestions(content, "2026-10-01", [entry("2026-09-01", 1), entry("2026-10-01", 3)]);
  assert.deepEqual(questions.map((q) => q.path), ["metrics.0.observations.2026-10-01.entry"]);
  content.metrics[0].observations[1].source = "Angka final CFO";
  assert.equal(entryMismatchQuestions(content, "2026-10-01", [entry("2026-10-01", 3)]).length, 0);
});

test("a deleted entry raises one question and refresh turns the row into missing", () => {
  const content = report([
    obs("2026-09-01", { actual: 1, state: "provided", source: "Entri KPI Sep 2026" }),
    obs("2026-10-01", { actual: 2, state: "provided", source: "Entri KPI Okt 2026", numerator: 2, denominator: 1 }),
  ]);
  const checked = new Set([7]);
  const questions = entryMismatchQuestions(content, "2026-10-01", [entry("2026-09-01", 1)], checked);
  assert.deepEqual(questions.map((q) => q.path), ["metrics.0.observations.2026-10-01.entry"]);
  assert.match(questions[0].question, /Entri KPI Cash Okt 2026 sudah dihapus/);
  assert.equal(entryMismatchQuestions(content, "2026-10-01", [], undefined).length, 0, "unchecked KPIs are never flagged");
  assert.equal(entryMismatchQuestions(content, "2026-10-01", [], new Set([99])).length, 0);
  const { content: next, changes } = refreshFromEntries(content, [entry("2026-09-01", 1)], checked);
  assert.deepEqual(next.metrics[0].observations[1], obs("2026-10-01"));
  assert.equal(next.metrics[0].observations[0], content.metrics[0].observations[0]);
  assert.equal(changes.length, 1);
  assert.match(changes[0], /dihapus/);
  assert.equal(entryMismatchQuestions(next, "2026-10-01", [entry("2026-09-01", 1)], checked).length, 0);
});

test("htmlToText strips tags, keeps paragraph breaks and decodes entities", () => {
  assert.equal(htmlToText("<p>Biaya &amp; vendor naik</p><ul><li>Satu</li><li>Dua&nbsp;lagi</li></ul>"), "Biaya & vendor naik\nSatu\nDua lagi");
});

test("notes: newest comment per KPI and only open or in-progress plans due from next month", () => {
  const notes = deriveNotes(
    [{ id: 1, kpiId: 7, content: "<p>lama</p>", createdAt: new Date(1000) }, { id: 2, kpiId: 7, content: "<p>baru</p>", createdAt: new Date(2000) }, { id: 3, kpiId: 8, content: "<p> </p>", createdAt: new Date(3000) }],
    [
      { title: "Renegosiasi", owner: "Sari", dueDate: "2026-11-15", status: "in_progress" },
      { title: "Terlambat", owner: "Sari", dueDate: "2026-10-31", status: "open" },
      { title: "Selesai", owner: "Sari", dueDate: "2026-12-01", status: "done" },
    ],
    "2026-10-01",
  );
  assert.deepEqual(notes.causes, [{ kpiId: 7, text: "baru", evidence: `Komentar KPI #2 (${formatDayShort(new Date(2000))})` }]);
  assert.deepEqual(notes.actions, [{ action: "Renegosiasi", pic: "Sari", deadline: "2026-11-15" }]);
});

test("applyNotes fills only empty fields", () => {
  const notes = { causes: [{ kpiId: 7, text: "Vendor naik" }], actions: [{ action: "A", pic: "P", deadline: "2026-11-01" }] };
  const miss = obs("2026-10-01", { actual: 5, state: "provided" });
  assert.equal(applyNotes(report([obs("2026-10-01", { actual: 150, state: "provided" })]), notes, "2026-10-01").changes.length, 1);
  const filled = applyNotes(report([miss]), notes, "2026-10-01");
  assert.equal(filled.content.metrics[0].deviationCause, "Vendor naik");
  assert.equal(filled.content.actions.length, 1);
  assert.equal(filled.changes.length, 2);
  const edited = report([miss]);
  edited.metrics[0].deviationCause = "Tulisan PIC";
  edited.actions = [{ action: "X", pic: "Y", deadline: "" }];
  const kept = applyNotes(edited, notes, "2026-10-01");
  assert.equal(kept.content, edited);
  assert.equal(kept.changes.length, 0);
});

test("timeline lines use progress logged by the end of the WIB month", () => {
  const project = { id: 3, name: "Rilis app", progress: 90, endDate: "2026-12-30", estimatedLaunchDate: null, status: null };
  const log = (id: number, at: string, before: number, after: number) => ({ id, projectId: 3, progressBefore: before, progressAfter: after, createdAt: new Date(at) });
  const logs = [log(1, "2026-09-20T00:00:00Z", 10, 30), log(2, "2026-10-31T16:59:00Z", 30, 50), log(3, "2026-10-31T17:00:00Z", 50, 90)];
  // 17:00Z on 31 Oct is already 1 Nov in WIB.
  assert.equal(timelineLines([project], logs, "2026-10-01")[0].text, "Rilis app: progress 30%→50%, tanpa status, selesai 2026-12-30 (sumber: Timeline project #3)");
  assert.match(timelineLines([project], logs, "2026-09-01")[0].text, /progress 10%→30%/);
  assert.match(timelineLines([project], [], "2026-10-01")[0].text, /progress 90%/);
});

test("timeline lines use that month's logs and append once", () => {
  const project = { id: 3, name: "Rilis app", progress: 70, endDate: "2026-11-30", estimatedLaunchDate: "2026-12-05", status: "On track" };
  const lines = timelineLines(
    [project, { ...project, id: 30, name: "Tanpa log", progress: 20, estimatedLaunchDate: null, status: null }],
    [{ id: 2, projectId: 3, progressBefore: 50, progressAfter: 70, createdAt: new Date(2000) }, { id: 1, projectId: 3, progressBefore: 40, progressAfter: 50, createdAt: new Date(1000) }],
    "1970-01-01",
  );
  assert.equal(lines[0].text, "Rilis app: progress 40%→70%, On track, estimasi rilis 2026-12-05 (sumber: Timeline project #3)");
  assert.equal(lines[1].text, "Tanpa log: progress 20%, tanpa status, selesai 2026-11-30 (sumber: Timeline project #30)");
  const once = appendTimelineActivities(emptyMonthlyReportContent(), lines);
  assert.equal(once.content.activities.length, 2);
  assert.equal(appendTimelineActivities(once.content, lines).changes.length, 0);
  assert.equal(appendTimelineActivities(once.content, [{ id: 30, text: "x" }]).changes.length, 0);
});

test("field ids come from the question path", () => {
  assert.equal(fieldId("metrics.3.observations.2026-10-01"), "f-metrics-3-observations-2026-10-01");
});

test("refresh copies numerator and denominator into entry-sourced rows and leaves hand-typed parts alone", () => {
  const withParts = (periodDate: string): EntryRef => ({ ...entry(periodDate, 75), numerator: 3, denominator: 4 });
  const content = report([
    obs("2026-09-01", { actual: 75, state: "provided", source: "Entri KPI Sep 2026" }),
    obs("2026-10-01", { state: "missing" }),
    markManualActual(obs("2026-11-01", { actual: 75, state: "provided", source: "Entri KPI Nov 2026", numerator: 6, denominator: 8 })),
  ]);
  const { content: next, changes } = refreshFromEntries(content, ["2026-09-01", "2026-10-01", "2026-11-01"].map(withParts));
  const [sep, oct, nov] = next.metrics[0].observations;
  assert.deepEqual([sep.numerator, sep.denominator, oct.numerator, oct.denominator, oct.actual], [3, 4, 3, 4, 75]);
  assert.equal(nov, content.metrics[0].observations[2]);
  assert.equal(changes.length, 2);
  assert.match(changes[0], /pembilang dan penyebut/);
  assert.equal(refreshFromEntries(next, ["2026-09-01", "2026-10-01"].map(withParts)).changes.length, 0);
});

test("previous actions import fills only an empty follow-up list, with the plan status it brings", () => {
  const actions: MonthlyPreviousAction[] = [{ action: "Renegosiasi vendor", pic: "Sari", deadline: "2026-10-31", status: "", note: "" }];
  const filled = applyPreviousActions(emptyMonthlyReportContent(), actions);
  assert.deepEqual(filled.content.previousActions, actions);
  assert.equal(filled.changes.length, 1);
  const marked = { ...filled.content, previousActions: [{ ...filled.content.previousActions[0], status: "done" as const }] };
  assert.equal(applyPreviousActions(marked, [{ ...actions[0], status: "dropped" }]).content, marked);
});

test("previous actions take the status of the action plan with the same title, owner and due date", () => {
  const plan = (title: string, status: string, owner = "Sari", dueDate = "2026-10-31") => ({ title, owner, dueDate, status });
  const previous = ["A", "B", "C", "D", "E"].map((action) => ({ action, pic: "Sari", deadline: "2026-10-31" }));
  const notes = deriveNotes([], [plan("A", "done"), plan("B", "open"), plan("C", "in_progress"), plan("D", "cancelled"), plan("E", "done", "Budi")], "2026-11-01", previous);
  assert.deepEqual(notes.previousActions?.map((a) => a.status), ["done", "in_progress", "in_progress", "dropped", ""]);
  assert.deepEqual(deriveNotes([], [], "2026-11-01", previous).previousActions?.map((a) => a.status), ["", "", "", "", ""]);
  assert.equal(deriveNotes([], [], "2026-11-01").previousActions, undefined);

  // A saved follow-up list gets only the empty statuses filled; a set status stays.
  const content = emptyMonthlyReportContent();
  content.previousActions = [{ ...previous[0], status: "", note: "n" }, { ...previous[1], status: "dropped", note: "" }, { ...previous[2], status: "", note: "" }];
  const filled = applyPreviousActions(content, notes.previousActions!);
  assert.deepEqual(filled.content.previousActions.map((a) => a.status), ["done", "dropped", "in_progress"]);
  assert.equal(filled.content.previousActions[0].note, "n");
  assert.equal(filled.changes.length, 2);
});

test("a cause from a KPI comment also fills an empty deviation evidence, never a written one", () => {
  const notes = { causes: [{ kpiId: 7, text: "Vendor naik", evidence: "Komentar KPI #2 (5 Nov 2026)" }], actions: [] };
  const miss = obs("2026-10-01", { actual: 5, state: "provided" });
  const filled = applyNotes(report([miss]), notes, "2026-10-01");
  assert.deepEqual([filled.content.metrics[0].deviationCause, filled.content.metrics[0].deviationEvidence], ["Vendor naik", "Komentar KPI #2 (5 Nov 2026)"]);
  const written = report([miss]);
  written.metrics[0].deviationEvidence = "Laporan audit";
  assert.equal(applyNotes(written, notes, "2026-10-01").content.metrics[0].deviationEvidence, "Laporan audit");
  const noEvidence = applyNotes(report([miss]), { causes: [{ kpiId: 7, text: "Vendor naik" }], actions: [] }, "2026-10-01");
  assert.equal(noEvidence.content.metrics[0].deviationEvidence, "");
});

const kpi = { id: 7, target: 100 };
const targetRef = (month: string, override?: { id: number; target: number }): TargetRef => resolveTarget(kpi, override, month);

test("generated targets refresh and raise a question; hand-typed targets are left alone", () => {
  const generated = obs("2026-10-01", { actual: 5, state: "provided", source: "Entri KPI Okt 2026", target: 99.5, targetSource: "KPI target override #4 (2026-10-01)" });
  const content = report([
    obs("2026-08-01", { target: 90, targetSource: "KPI default target #7 (2026-08-01)" }),
    obs("2026-09-01", { target: 80, targetSource: "Target CEO rapat Sep" }),
    generated,
  ]);
  const targets = [targetRef("2026-08-01"), targetRef("2026-09-01"), targetRef("2026-10-01", { id: 4, target: 98 })];
  const questions = entryMismatchQuestions(content, "2026-10-01", [], undefined, targets);
  assert.deepEqual(questions.map((q) => q.path), ["metrics.0.observations.2026-10-01.target"]);
  assert.match(questions[0].question, /Target Cash Okt 2026 \(99\.5\) berbeda dari target KPI terbaru \(98\)/);
  const { content: next, changes } = refreshFromEntries(content, [], undefined, targets);
  const [aug, sep, oct] = next.metrics[0].observations;
  assert.deepEqual([aug.target, aug.targetSource], [100, "KPI default target #7 (2026-08-01)"]);
  assert.equal(sep, content.metrics[0].observations[1]);
  assert.deepEqual([oct.target, oct.targetSource, oct.actual], [98, "KPI target override #4 (2026-10-01)", 5]);
  assert.equal(changes.length, 2);
  assert.match(changes[1], /Okt 2026: target 99\.5 → 98/);
  assert.equal(refreshFromEntries(next, [], undefined, targets).changes.length, 0);
  assert.equal(entryMismatchQuestions(next, "2026-10-01", [], undefined, targets).length, 0);
  // Without targets (older callers) nothing changes.
  assert.equal(refreshFromEntries(content, []).changes.length, 0);

  // Typing a target by hand makes the row manual: the generated source no longer matches.
  const manual = markManualTarget({ ...generated, target: 97 });
  assert.equal(manual.targetSource, "Manual (KPI target override #4 (2026-10-01))");
  assert.equal(markManualTarget(manual), manual);
  assert.equal(refreshFromEntries(report([manual]), [], undefined, targets).changes.length, 0);
});

test("a row sourced from an entry still raises a question when parts keep refresh from touching it", () => {
  const row = obs("2026-10-01", { actual: 98.46, state: "provided", source: "Entri KPI Okt 2026", numerator: 64, denominator: 65 });
  const content = report([row]);
  assert.equal(refreshFromEntries(content, [entry("2026-10-01", 50)]).changes.length, 0);
  const questions = entryMismatchQuestions(content, "2026-10-01", [entry("2026-10-01", 50)]);
  assert.deepEqual(questions.map((q) => q.path), ["metrics.0.observations.2026-10-01.entry"]);
  assert.match(questions[0].question, /98\.46\) berbeda dari entri KPI terbaru \(50\)/);
  assert.equal(entryMismatchQuestions(content, "2026-10-01", [entry("2026-10-01", 98.46)]).length, 0);
  assert.equal(entryMismatchQuestions(report([{ ...row, source: "Manual (Entri KPI Okt 2026)" }]), "2026-10-01", [entry("2026-10-01", 50)]).length, 0);
});

test("draftSummaryFromNumbers lists missed KPIs with their gap and the largest MoM change, and names the worst miss", () => {
  const period = "2026-10-01";
  const metric = (kpiId: number, name: string, unit: string, prev: number, current: number, target: number, direction: "higher_better" | "lower_better" = "higher_better") => ({
    ...report([obs("2026-09-01", { actual: prev, state: "provided", target, source: "s" }), obs(period, { actual: current, state: "provided", target, source: "s" })]).metrics[0],
    kpiId, name, unit, direction,
  });
  const content: MonthlyReportContent = { ...emptyMonthlyReportContent(), metrics: [metric(1, "Uptime", "%", 99, 98, 99.5), metric(2, "Bug", "", 10, 20, 15, "lower_better"), metric(3, "Rilis", "", 5, 5, 5)] };
  const computed = computeMonthlyReport(content, period);
  const draft = draftSummaryFromNumbers(content, computed, period);
  assert.deepEqual(draft.summary, [
    "Bug meleset dari target: aktual 20 vs target 15 (selisih 5).",
    "Uptime meleset dari target: aktual 98% vs target 99,5% (selisih 1,5%).",
    "Perubahan bulan ke bulan terbesar: Bug naik 100% (10 → 20).",
  ]);
  assert.equal(draft.worstOutcome, "Bug meleset paling jauh dari target Okt 2026: aktual 20 vs target 15 (selisih 5, 33,33% dari target).");
  assert.deepEqual(draftSummaryFromNumbers(content, computed, period), draft, "deterministic");

  // Nothing missed: a single positive line, no worst outcome; no numbers: nothing.
  const fine = { ...content, metrics: [metric(3, "Rilis", "", 5, 6, 5)] };
  const ok = draftSummaryFromNumbers(fine, computeMonthlyReport(fine, period), period);
  assert.deepEqual(ok.summary, ["Semua 1 KPI bertarget mencapai target Okt 2026.", "Perubahan bulan ke bulan terbesar: Rilis naik 20% (5 → 6)."]);
  assert.equal(ok.worstOutcome, "");
  assert.deepEqual(draftSummaryFromNumbers(emptyMonthlyReportContent(), { metrics: [] }, period), { summary: [], worstOutcome: "" });

  // More than three misses: the two furthest plus a count of the rest.
  const many = { ...content, metrics: [1, 2, 3, 4, 5].map((id) => metric(id, `K${id}`, "", 10, 10, 10 + id)) };
  const lines = draftSummaryFromNumbers(many, computeMonthlyReport(many, period), period).summary;
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^K5 meleset/);
  assert.equal(lines[2], "3 KPI lain juga meleset: K3, K2, K1.");
});
