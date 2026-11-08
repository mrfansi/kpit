import assert from "node:assert/strict";
import test from "node:test";
import { emptyMonthlyReportContent } from "./monthly-report";
import { appendTimelineActivities, applyNotes, applyPreviousActions, deriveNotes, entryMismatchQuestions, entrySource, fieldId, htmlToText, markManualActual, refreshFromEntries, timelineLines, type EntryRef } from "./monthly-report-import";
import type { MonthlyObservation, MonthlyReportContent } from "./monthly-report-types";

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
  assert.deepEqual(notes.causes, [{ kpiId: 7, text: "baru" }]);
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

test("previous actions import fills only an empty follow-up list, with empty status", () => {
  const actions = [{ action: "Renegosiasi vendor", pic: "Sari", deadline: "2026-10-31" }];
  const filled = applyPreviousActions(emptyMonthlyReportContent(), actions);
  assert.deepEqual(filled.content.previousActions, [{ ...actions[0], status: "", note: "" }]);
  assert.equal(filled.changes.length, 1);
  const marked = { ...filled.content, previousActions: [{ ...filled.content.previousActions[0], status: "done" as const }] };
  assert.equal(applyPreviousActions(marked, actions).content, marked);
});
