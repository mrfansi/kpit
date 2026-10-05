import assert from "node:assert/strict";
import test from "node:test";
import { computeMonthlyReport, emptyMonthlyReportContent, reportMonths } from "./monthly-report";
import type { MonthlyReportContent, MonthlyReportMetric, MonthlyObservation } from "./monthly-report-types";

const period = "2026-04-01";
function observed(month: string, actual: number | null, target = 10): MonthlyObservation {
  return { month, actual, target, source: actual === null ? "" : `ledger ${month}`, targetSource: `target registry ${month}`, state: actual === null ? "missing" : "provided", numerator: null, denominator: null };
}
function metric(observations: MonthlyObservation[]): MonthlyReportMetric {
  return { kpiId: 7, name: "Revenue", definition: "Monthly booked revenue", unit: "Rp", direction: "higher_better", definitionConfirmed: true, aggregation: "sum", aggregationNote: "Sum booked monthly flows", observations, sharedMetricKey: "", sharingReviewed: true, reconciliationNote: "", deviationCause: "", deviationEvidence: "" };
}
function content(observations: MonthlyObservation[]): MonthlyReportContent {
  return { ...emptyMonthlyReportContent(), division: "sales_marketing", summary: ["Growth", "Pipeline", "Delivery"], worstOutcome: "Late deal", metrics: [metric(observations)], risksReviewed: true, decisionsReviewed: true, actions: [{ action: "Close deals", pic: "Owner", deadline: "2026-05-15" }] };
}

test("exact reporting month never falls back to an older observation and partial YTD never becomes a number", () => {
  const report = content([observed("2026-03-01", 6), observed("2026-01-01", 4), observed("2026-02-01", 5)]);
  const result = computeMonthlyReport(report, period);
  assert.equal(result.metrics[0].current.value, null);
  assert.equal(result.metrics[0].current.state, "missing");
  assert.equal(result.metrics[0].ytd.value, null);
  assert.equal(result.metrics[0].ytd.state, "missing");
  assert.ok(result.questions.some((q) => q.path === "metrics.0.observations.2026-04-01"));
});

test("legitimate zero misses true target even when status threshold would be green", () => {
  const report = content([...reportMonths(period).map((month) => observed(month, month === period ? 0 : 12)), observed("2025-12-01", 12)]);
  const result = computeMonthlyReport(report, period);
  assert.equal(result.metrics[0].current.value, 0);
  assert.equal(result.metrics[0].missedTarget, true);
  assert.ok(result.questions.some((q) => q.path === "metrics.0.deviation"));
  assert.equal(result.metrics[0].ytd.value, 36);
  assert.equal(result.metrics[0].ytd.target, 40);
});

test("ratio YTD sums numerator/denominator and weights targets, never averages monthly percentages", () => {
  const report = content([...reportMonths(period).map((month, i) => ({ ...observed(month, i === 0 ? 50 : 100, i === 0 ? 60 : 90), numerator: i === 0 ? 1 : 9, denominator: i === 0 ? 2 : 9 })), observed("2025-12-01", 100)]);
  report.metrics[0].unit = "%";
  report.metrics[0].aggregation = "ratio";
  report.metrics[0].deviationCause = "Known acquisition gap";
  report.metrics[0].deviationEvidence = "CRM snapshot";
  const result = computeMonthlyReport(report, period);
  assert.equal(result.metrics[0].ytd.value, 28 / 29 * 100);
  assert.equal(result.metrics[0].ytd.target, (60 * 2 + 90 * 27) / 29);
});

test("shared key mismatches block completion, matching peer requires attestation", () => {
  const report = content([...reportMonths(period).map((month) => observed(month, 11)), observed("2025-12-01", 11)]);
  report.metrics[0].sharedMetricKey = "booked-revenue";
  report.metrics[0].reconciliationNote = "Checked period, definition, and source";
  const peer = content([...reportMonths(period).map((month) => observed(month, month === period ? 12 : 11)), observed("2025-12-01", 11)]);
  peer.metrics[0].sharedMetricKey = "booked-revenue";
  const result = computeMonthlyReport(report, period, [{ domain: { id: 2, name: "Finance", slug: "finance" }, period, content: peer }]);
  assert.equal(result.reconciliations[0].state, "conflict");
  assert.equal(result.ready, false);
  peer.metrics[0].observations.find((o) => o.month === period)!.actual = 11;
  const matched = computeMonthlyReport(report, period, [{ domain: { id: 2, name: "Finance", slug: "finance" }, period, content: peer }]);
  assert.equal(matched.reconciliations[0].state, "matched");
  assert.ok(!matched.questions.some((q) => q.path === "metrics.0.sharedMetricKey"));
});

test("worst outcome counts as one of the mandatory three to five summary points", () => {
  const report = content([...reportMonths(period).map((month) => observed(month, 11)), observed("2025-12-01", 11)]);
  report.summary = ["Growth", "Pipeline"];
  assert.ok(!computeMonthlyReport(report, period).questions.some((q) => q.path === "summary"));
  report.summary = ["Growth"];
  assert.ok(computeMonthlyReport(report, period).questions.some((q) => q.path === "summary"));
  report.summary = ["A", "B", "C", "D", "E"];
  assert.ok(computeMonthlyReport(report, period).questions.some((q) => q.path === "summary"));
});

test("latest YTD is selected month's sourced end-state despite absent Jan–Feb; previous month remains required", () => {
  const report = content([observed("2026-03-01", 30), observed(period, 40)]);
  report.narrativeSource = "Monthly report narrative";
  report.metrics[0].aggregation = "latest";
  report.metrics[0].aggregationNote = "End-of-month position";
  const computed = computeMonthlyReport(report, period);
  assert.equal(computed.metrics[0].ytd.value, 40);
  assert.equal(computed.metrics[0].ytd.target, 10);
  assert.ok(!computed.questions.some((q) => q.path.includes("2026-01-01") || q.path.includes("2026-02-01")));
  assert.ok(!computed.questions.some((q) => q.path === "metrics.0.ytd"));
});

test("ratio source rounding to two decimals is accepted, but mismatched input is flagged", () => {
  const rows = [...reportMonths(period).map((month) => ({ ...observed(month, 33.33), numerator: 1, denominator: 3 })), { ...observed("2025-12-01", 33.33), numerator: 1, denominator: 3 }];
  const report = content(rows);
  report.metrics[0].aggregation = "ratio";
  report.metrics[0].unit = "%";
  assert.ok(!computeMonthlyReport(report, period).questions.some((q) => q.path.endsWith(".actual")));
  rows[3].actual = 34;
  assert.ok(computeMonthlyReport(report, period).questions.some((q) => q.path.endsWith(".actual")));
});

test("latest validates all exported historic supplied numbers and known target on untracked actual", () => {
  const rows = [observed("2026-01-01", 20), observed("2026-02-01", 30), observed("2026-03-01", 40), observed(period, 50)];
  const report = content(rows);
  report.metrics[0].aggregation = "latest";
  rows[0].source = "";
  rows[0].targetSource = "";
  const result = computeMonthlyReport(report, period);
  assert.ok(result.questions.some((q) => q.path === "metrics.0.observations.2026-01-01.source"));
  assert.ok(result.questions.some((q) => q.path === "metrics.0.observations.2026-01-01.targetSource"));
  assert.equal(result.ready, false);
  rows[0].source = "January ledger";
  rows[0].targetSource = "January budget";
  rows[3].state = "untracked";
  rows[3].actual = null;
  assert.equal(computeMonthlyReport(report, period).metrics[0].ytd.target, 10);
});

test("YTD targets remain independent of untracked actual and ratio only needs known weights for targets", () => {
  const rows = [observed("2026-01-01", null, 100), observed("2026-02-01", 120, 100), observed("2025-12-01", 90, 100)];
  rows[0].state = "untracked";
  const report = content(rows);
  const result = computeMonthlyReport(report, "2026-02-01");
  assert.equal(result.metrics[0].ytd.value, null);
  assert.equal(result.metrics[0].ytd.state, "untracked");
  assert.equal(result.metrics[0].ytd.target, 200);
  assert.match(result.metrics[0].ytd.targetSource, /target registry 2026-01-01/);
  report.metrics[0].aggregation = "ratio";
  rows[0].denominator = 1;
  rows[1].denominator = 3;
  rows[1].numerator = 3.6;
  assert.equal(computeMonthlyReport(report, "2026-02-01").metrics[0].ytd.target, 100);
  rows[0].target = null;
  assert.equal(computeMonthlyReport(report, "2026-02-01").metrics[0].ytd.target, null);
});

test("shared facts compare historic inputs and YTD, but not division-specific budgets", () => {
  const rows = [...reportMonths("2026-02-01").map((month) => observed(month, month.endsWith("01-01") ? 20 : 100)), observed("2025-12-01", 10)];
  const report = content(rows);
  report.metrics[0].sharedMetricKey = "revenue";
  report.metrics[0].reconciliationNote = "Verified booked revenue basis";
  const peer = structuredClone(report);
  peer.metrics[0].observations[0].actual = 30;
  peer.metrics[0].observations[1].target = 999;
  const peers = [{ domain: { id: 2, name: "Finance", slug: "finance" }, period: "2026-02-01", content: peer }];
  const mismatch = computeMonthlyReport(report, "2026-02-01", peers);
  assert.equal(mismatch.reconciliations[0].state, "conflict");
  assert.match(mismatch.reconciliations[0].detail, /2026-01-01/);
  assert.equal(mismatch.metrics[0].ytd.value, 120);
  peer.metrics[0].observations[0].actual = 20;
  assert.equal(computeMonthlyReport(report, "2026-02-01", peers).reconciliations[0].state, "matched");
  peer.metrics[0].aggregation = "average";
  assert.equal(computeMonthlyReport(report, "2026-02-01", peers).reconciliations[0].state, "conflict");
});

test("peer requires confirmed basis and every provided observation source before ready reconciliation", () => {
  const rows = [...reportMonths("2026-02-01").map((month) => observed(month, 100)), observed("2025-12-01", 100)];
  const report = content(rows);
  report.narrativeSource = "Decision log";
  report.metrics[0].sharedMetricKey = "revenue";
  report.metrics[0].reconciliationNote = "Checked accounting basis";
  const peer = structuredClone(report);
  peer.summary = [];
  peer.metrics[0].observations[1].source = "";
  const peers = [{ domain: { id: 2, name: "Finance", slug: "finance" }, period: "2026-02-01", content: peer }];
  const missingSource = computeMonthlyReport(report, "2026-02-01", peers);
  assert.equal(missingSource.reconciliations[0].state, "awaiting_peer");
  assert.equal(missingSource.ready, false);
  peer.metrics[0].observations[1].source = "Finance ledger";
  peer.metrics[0].definitionConfirmed = false;
  assert.equal(computeMonthlyReport(report, "2026-02-01", peers).reconciliations[0].state, "awaiting_peer");
  peer.metrics[0].definitionConfirmed = true;
  const matched = computeMonthlyReport(report, "2026-02-01", peers);
  assert.equal(matched.reconciliations[0].state, "matched");
  assert.equal(matched.ready, true);
});

test("overflow-safe averages and weighted ratios stay finite; impossible sums, targets and MoM ask", () => {
  const rows = [observed("2026-01-01", 1e308, 1e308), observed("2026-02-01", 1e308, 1e308), observed("2025-12-01", 1e308, 1e308)];
  const report = content(rows);
  report.metrics[0].aggregation = "average";
  report.narrativeSource = "Monthly ledger";
  const averageResult = computeMonthlyReport(report, "2026-02-01");
  assert.equal(averageResult.metrics[0].ytd.value, 1e308);
  assert.equal(averageResult.metrics[0].ytd.target, 1e308);
  report.metrics[0].aggregation = "sum";
  const overflow = computeMonthlyReport(report, "2026-02-01");
  assert.equal(overflow.metrics[0].ytd.value, null);
  assert.equal(overflow.metrics[0].ytd.target, null);
  assert.ok(overflow.questions.some((q) => q.path === "metrics.0.ytd.value"));
  assert.ok(overflow.questions.some((q) => q.path === "metrics.0.ytd.target"));
  report.metrics[0].aggregation = "ratio";
  rows[0].actual = rows[1].actual = 100;
  rows[0].numerator = rows[1].numerator = 1e308;
  rows[0].denominator = rows[1].denominator = 1e308;
  rows[0].target = rows[1].target = 100;
  assert.equal(computeMonthlyReport(report, "2026-02-01").metrics[0].ytd.target, 100);
  report.metrics[0].aggregation = "latest";
  rows[0].actual = 1e-300;
  rows[1].actual = 1e308;
  const mom = computeMonthlyReport(report, "2026-02-01");
  assert.equal(mom.metrics[0].momPercent, null);
  assert.ok(mom.questions.some((q) => q.path === "metrics.0.momPercent"));
  rows[0].actual = -1e308;
  const finiteMom = computeMonthlyReport(report, "2026-02-01");
  assert.equal(finiteMom.metrics[0].momPercent, 200);
  assert.ok(!finiteMom.questions.some((q) => q.path === "metrics.0.momPercent"));
});

test("weighted target avoids product overflow and nonrepresentable ratio remains a clarification", () => {
  const rows = [observed("2026-01-01", 100, 1e308), observed("2026-02-01", 100, 1e308), observed("2025-12-01", 100, 1e308)];
  const report = content(rows);
  report.metrics[0].aggregation = "ratio";
  for (const row of rows) {
    row.numerator = 1e308;
    row.denominator = 1e308;
  }
  const weighted = computeMonthlyReport(report, "2026-02-01");
  assert.equal(weighted.metrics[0].ytd.target, 1e308);
  rows[0].denominator = rows[1].denominator = 1e-300;
  const impossible = computeMonthlyReport(report, "2026-02-01");
  assert.equal(impossible.metrics[0].ytd.value, null);
  assert.ok(impossible.questions.some((q) => q.path === "metrics.0.ytd.value"));
  assert.equal(impossible.ready, false);
});
