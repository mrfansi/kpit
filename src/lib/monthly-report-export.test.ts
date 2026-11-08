import assert from "node:assert/strict";
import test from "node:test";
import { renderMonthlyReportMarkdown, renderMonthlyReportPresentation } from "./monthly-report-export";
import type { MonthlyReportBundle } from "./monthly-report-types";
import { DEFAULT_BRAND_STYLE } from "./presentation/brand";

function bundle(division: MonthlyReportBundle["content"]["division"] = "operation", decisions = false): MonthlyReportBundle {
  const observation = { month: "2026-10-01", actual: 4, target: 5, source: "ledger <script>alert(1)</script> | ref", targetSource: "approved target", state: "provided" as const, numerator: null, denominator: null };
  const computed = { value: 4, target: 5, state: "provided" as const, source: observation.source, targetSource: observation.targetSource, calculation: "monthly recorded input" };
  return {
    domain: { id: 1, name: "Operations", slug: "operations" }, period: "2026-10-01", revision: 2, updatedAt: null, ready: true, questions: [], reconciliations: [],
    metrics: [{ kpiId: 1, current: computed, previous: { ...computed, value: 3, source: "September ledger" }, ytd: { ...computed, value: 40, target: 50, calculation: "sum Jan–Oct" }, momPercent: 33.333, missedTarget: true }],
    content: {
      division, summary: ["Progress 1", "Progress 2"], worstOutcome: "Target missed", narrativeSource: "management report", kpiSetChangeNote: "unchanged",
      metrics: [{ kpiId: 1, name: "Orders", definition: "completed orders", unit: "", direction: "higher_better", definitionConfirmed: true, aggregation: "sum", aggregationNote: "sum months", observations: [observation], sharedMetricKey: "", sharingReviewed: true, reconciliationNote: "", deviationCause: "delays", deviationEvidence: "case log" }],
      risksReviewed: true, risks: [{ issue: "delay", impact: "lost orders", escalationOwner: "COO" }], actions: [{ action: "repair", pic: "Ops", deadline: "2026-11-10" }], previousActions: [], decisionsReviewed: true,
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
  assert.match(output, /sum Jan–Oct/);
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

test("brand reaches deck and appendix with escaped footer and independent red status", () => {
  const output = renderMonthlyReportPresentation(bundle(), {
    ...DEFAULT_BRAND_STYLE,
    colors: { ...DEFAULT_BRAND_STYLE.colors, primary: "#663399", accent: "#cc5500" },
    footerText: '<script>alert("footer")</script> & Company',
  });
  assert.match(output, /--primary: #663399/);
  assert.match(output, /--accent: #cc5500/);
  assert.match(output, /--red: #ef4444/);
  assert.match(output, /class="badge badge-red">1 KPI: Target meleset/);
  assert.match(output, /<footer class="brand-footer">&lt;script&gt;alert\(&quot;footer&quot;\)&lt;\/script&gt; &amp; Company<\/footer>/);
  assert.doesNotMatch(output, /<script>alert\("footer"\)<\/script>/);
  assert.match(output, /background: var\(--card-bg\); border: 1px solid var\(--card-border\); border-radius: var\(--radius\)/);
  assert.match(output, /background: var\(--bg-start\); color: var\(--text\); font-family: var\(--font-body\)/);
});

function trendSlide(output: string) { return output.match(/<section[^>]*data-slide="trend"[\s\S]*?<\/section>/)![0]; }

test("trend cells carry values and markers; sources move to deduplicated slide footnotes", () => {
  const slide = trendSlide(renderMonthlyReportPresentation(bundle()));
  const body = slide.replace(/<div class="text-small" role="note"[\s\S]*$/, "");
  assert.doesNotMatch(body, /Sumber:|perhitungan:/);
  assert.match(body, /3 \(target: 5\) \[1\]/);
  assert.match(body, /4 \(target: 5\) \[2\]/);
  const numbers = [...slide.matchAll(/<p>\[(\d+)\] /g)].map((m) => m[1]);
  assert.deepEqual(numbers, numbers.map((_, i) => String(i + 1)));
  assert.equal(new Set([...slide.matchAll(/<p>\[\d+\] (.*?)<\/p>/g)].map((m) => m[1])).size, numbers.length);
  assert.match(slide, /\[\d+\] Sumber: September ledger; target: approved target; perhitungan: monthly recorded input/);
  assert.match(slide, /sum Jan–Oct/);
  const same = bundle();
  same.metrics[0].ytd = { ...same.metrics[0].current };
  assert.match(trendSlide(renderMonthlyReportPresentation(same)), /4 \(target: 5\) \[2\][^]*4 \(target: 5\) \[2\]/);
});

test("sparkline needs two provided observations and is hidden from assistive tech", () => {
  const report = bundle();
  assert.doesNotMatch(trendSlide(renderMonthlyReportPresentation(report)), /<svg/);
  const base = report.content.metrics[0].observations[0];
  report.content.metrics[0].observations = [base, { ...base, month: "2026-09-01", actual: 3 }, { ...base, month: "2026-08-01", actual: null, state: "untracked" }];
  assert.match(trendSlide(renderMonthlyReportPresentation(report)), /<svg[^>]*aria-hidden="true"/);
});

test("previous actions appear above next month's actions only when present", () => {
  const report = bundle();
  assert.doesNotMatch(renderMonthlyReportPresentation(report), /Tindak lanjut bulan lalu/);
  assert.doesNotMatch(renderMonthlyReportMarkdown(report, "full"), /Tindak lanjut bulan lalu/);
  report.content.previousActions = [{ action: "fix <b>queue</b>", pic: "Ops", deadline: "2026-10-15", status: "in_progress", note: "" }];
  const html = renderMonthlyReportPresentation(report);
  assert.ok(html.indexOf("Tindak lanjut bulan lalu") < html.indexOf("Aksi bulan depan</th>"));
  assert.match(html, /fix &lt;b&gt;queue&lt;\/b&gt;/);
  assert.match(html, /Berjalan/);
  for (const format of ["full", "brief"] as const) {
    const md = renderMonthlyReportMarkdown(report, format);
    assert.ok(md.indexOf("Tindak lanjut bulan lalu") < md.indexOf("repair"));
    assert.match(md, /status: Berjalan/);
  }
});

test("YTD label falls back to YTD and honours a custom range label", () => {
  const report = bundle();
  assert.match(renderMonthlyReportMarkdown(report, "full"), /; YTD: /);
  report.metrics[0].ytd = { ...report.metrics[0].ytd, label: "YTD Mar–Okt" };
  assert.match(renderMonthlyReportMarkdown(report, "full"), /YTD Mar–Okt: /);
  assert.match(renderMonthlyReportPresentation(report), /YTD Mar–Okt: 40/);
});

test("cover opens and closing cover ends the core slides, before appendices, both uncounted", () => {
  const report = bundle();
  report.domain.name = "Ops <b>";
  const output = renderMonthlyReportPresentation(report, DEFAULT_BRAND_STYLE, new Date("2026-11-08T05:00:00Z"));
  const keys = [...output.matchAll(/data-slide="([\w-]+)"/g)].map((m) => m[1]);
  assert.equal(keys[0], "cover");
  assert.equal(keys.at(-1), "closing");
  assert.equal(keys.length, 6 + 2);
  assert.ok(output.indexOf('data-slide="closing"') < output.indexOf('class="memo-appendices"'));
  const cover = output.match(/<section[^>]*data-slide="cover"[\s\S]*?<\/section>/)![0];
  assert.match(cover, /Laporan bulanan/);
  assert.match(cover, /Oktober 2026/);
  assert.match(cover, /Dibuat 8 November 2026/);
  assert.match(output.match(/<section[^>]*data-slide="closing"[\s\S]*?<\/section>/)![0], /Terima kasih[\s\S]*Oktober 2026/);
  assert.match(cover, /<h2 class="title-medium">Operation<\/h2>/);
  assert.match(output, /var total = 8;/);
  assert.match(output, /6 slide inti/);
  const finance = bundle("finance");
  finance.domain.name = "Ops <b>";
  for (const text of [renderMonthlyReportPresentation(finance), renderMonthlyReportMarkdown(finance, "full")]) {
    assert.doesNotMatch(text, /—/);
    assert.doesNotMatch(text, /<b>/);
  }
});

test("KPI slide has a status column: Tercapai or Meleset with the gap", () => {
  const report = bundle();
  const kpi = (output: string) => output.match(/<section[^>]*data-slide="kpi"[\s\S]*?<\/section>/)![0];
  const missed = kpi(renderMonthlyReportPresentation(report));
  assert.match(missed, /<th scope="col">Status<\/th>/);
  assert.match(missed, /<td>Meleset \(selisih 1\)<\/td>/);
  report.metrics[0].missedTarget = false;
  report.metrics[0].current = { ...report.metrics[0].current, value: 5 };
  assert.match(kpi(renderMonthlyReportPresentation(report)), /<td>Tercapai<\/td>/);
  report.metrics[0].current = { ...report.metrics[0].current, value: null, state: "untracked" };
  assert.doesNotMatch(kpi(renderMonthlyReportPresentation(report)), /Tercapai/);
});

test("sparkline stays inside the KPI's YTD window and leaves gaps for missing months", () => {
  const report = bundle();
  const metric = report.content.metrics[0];
  const base = metric.observations[0];
  const at = (month: string, actual: number) => ({ ...base, month, actual });
  // Jul, Sep and Oct provided: Jul is an isolated point, Sep-Oct form the only line, Aug stays empty.
  metric.observations = [at("2026-10-01", 4), at("2026-09-01", 3), at("2026-07-01", 2)];
  const svg = trendSlide(renderMonthlyReportPresentation(report)).match(/<svg[\s\S]*?<\/svg>/)![0];
  assert.equal((svg.match(/<polyline/g) ?? []).length, 1);
  assert.equal((svg.match(/<circle/g) ?? []).length, 3);
  assert.match(svg, /cx="52\.7"/);
  assert.match(svg, /<polyline points="69\.6,/);
  // YTD window starting in September: Oct alone is not enough, and January is ignored.
  metric.ytdStartMonth = "2026-09-01";
  metric.observations = [at("2026-10-01", 4), at("2026-01-01", 9)];
  assert.doesNotMatch(trendSlide(renderMonthlyReportPresentation(report)), /<svg/);
  metric.observations = [at("2026-10-01", 4), at("2026-09-01", 3), at("2026-01-01", 900)];
  const windowed = trendSlide(renderMonthlyReportPresentation(report)).match(/<svg[\s\S]*?<\/svg>/)![0];
  assert.equal((windowed.match(/<circle/g) ?? []).length, 2);
  assert.match(windowed, /<polyline points="2\.0,22\.0 78\.0,2\.0"/);
});
