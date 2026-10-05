import assert from "node:assert/strict";
import test from "node:test";
import { renderMonthlyReportMarkdown, renderMonthlyReportPresentation } from "./monthly-report-export";
import type { MonthlyReportBundle } from "./monthly-report-types";

function bundle(division: MonthlyReportBundle["content"]["division"] = "operation", decisions = false): MonthlyReportBundle {
  const observation = { month: "2026-10-01", actual: 4, target: 5, source: "ledger <script>alert(1)</script> | ref", targetSource: "approved target", state: "provided" as const, numerator: null, denominator: null };
  const computed = { value: 4, target: 5, state: "provided" as const, source: observation.source, targetSource: observation.targetSource, calculation: "monthly recorded input" };
  return {
    domain: { id: 1, name: "Operations", slug: "operations" }, period: "2026-10-01", revision: 2, updatedAt: null, ready: true, questions: [], reconciliations: [],
    metrics: [{ kpiId: 1, current: computed, previous: { ...computed, value: 3, source: "September ledger" }, ytd: { ...computed, value: 40, target: 50, calculation: "sum Jan–Oct" }, momPercent: 33.333, missedTarget: true }],
    content: {
      division, summary: ["Progress 1", "Progress 2"], worstOutcome: "Target missed", narrativeSource: "management report", kpiSetChangeNote: "unchanged",
      metrics: [{ kpiId: 1, name: "Orders", definition: "completed orders", unit: "", direction: "higher_better", definitionConfirmed: true, aggregation: "sum", aggregationNote: "sum months", observations: [observation], sharedMetricKey: "", sharingReviewed: true, reconciliationNote: "", deviationCause: "delays", deviationEvidence: "case log" }],
      risksReviewed: true, risks: [{ issue: "delay", impact: "lost orders", escalationOwner: "COO" }], actions: [{ action: "repair", pic: "Ops", deadline: "2026-11-10" }], decisionsReviewed: true,
      decisions: decisions ? [{ request: "Approve staffing", options: "hire or defer", impact: "capacity" }] : [],
      finance: { incomeStatement: { unit: "Rp", rows: [{ label: "Revenue", value: 100, source: "bank book", state: "provided" }] }, cashFlow: { unit: "Rp", rows: [{ label: "Cash", value: 70, source: "cash book", state: "provided" }] }, balanceSheet: { unit: "Rp", rows: [{ label: "Assets", value: 200, source: "balance book", state: "provided" }] } },
      channelBreakdowns: [{ channel: "Direct", metric: "Orders", value: 2, unit: "", source: "CRM", state: "provided" }], activities: ["demo"], appendices: [{ title: "Evidence", content: "<img src=x onerror=alert(1)>", source: "archive" }], aiNotes: "AI-assisted draft",
    },
  };
}

test("core count excludes unlimited appendix sections for each division", () => {
  for (const [division, expected] of [["operation", 6], ["finance", 9], ["hr_partnership", 5]] as const) {
    const report = bundle(division);
    report.content.appendices = Array.from({ length: 21 }, (_, index) => ({ title: `Attachment ${index}`, content: "Raw data", source: "ledger" }));
    const output = renderMonthlyReportPresentation(report);
    assert.equal((output.match(/class="slide memo-slide"/g) ?? []).length, expected);
    assert.equal((output.match(/class="memo-appendix-page"/g) ?? []).length, 23);
  }
  assert.equal((renderMonthlyReportPresentation(bundle("operation", true)).match(/class="slide memo-slide"/g) ?? []).length, 7);
  assert.equal((renderMonthlyReportPresentation(bundle("finance", true)).match(/class="slide memo-slide"/g) ?? []).length, 10);
  assert.equal((renderMonthlyReportPresentation(bundle("hr_partnership", true)).match(/class="slide memo-slide"/g) ?? []).length, 5);
});

test("computed sources and escaped author content stay attached to every value", () => {
  const output = renderMonthlyReportPresentation(bundle());
  assert.doesNotMatch(output, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(output, /<img src=x/);
  assert.match(output, /ledger &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(output, /sum Jan–Oct/);
  assert.match(output, /Sumber: September ledger/);
  assert.match(output, /bukti: case log/);
});

test("Markdown distinguishes confirmed untracked from missing and keeps appendix sources", () => {
  const report = bundle();
  report.metrics[0].current = { ...report.metrics[0].current, value: null, state: "untracked" };
  report.content.metrics[0].observations[0] = { ...report.content.metrics[0].observations[0], actual: null, state: "untracked" };
  const full = renderMonthlyReportMarkdown(report, "full");
  assert.match(full, /belum dilacak/);
  assert.match(full, /ledger &lt;script&gt;alert\(1\)&lt;\/script&gt; \\\| ref/);
  assert.match(full, /### Breakdown channel/);
  assert.match(full, /Sumber: management report/);
  assert.doesNotMatch(renderMonthlyReportMarkdown(report, "brief"), /### Breakdown channel/);
});

test("all-untracked measurements do not claim targets were met", () => {
  const report = bundle();
  report.metrics[0].current = { ...report.metrics[0].current, state: "untracked", value: null };
  report.metrics[0].previous = { ...report.metrics[0].previous, state: "untracked", value: null };
  report.metrics[0].ytd = { ...report.metrics[0].ytd, state: "untracked", value: null };
  report.metrics[0].missedTarget = false;
  report.content.metrics[0].observations[0] = { ...report.content.metrics[0].observations[0], state: "untracked", actual: null };
  const markdown = renderMonthlyReportMarkdown(report, "full");
  const presentation = renderMonthlyReportPresentation(report);
  assert.match(markdown, /belum dilacak/);
  assert.match(presentation, /belum dilacak/);
  assert.doesNotMatch(markdown, /Semua KPI terukur memenuhi target/);
  assert.doesNotMatch(presentation, /Semua KPI terukur memenuhi target/);
  assert.match(markdown, /Sumber: management report/);
  assert.match(presentation, /Sumber: management report/);
});
