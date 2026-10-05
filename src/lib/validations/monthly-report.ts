import { z } from "zod";
import { REPORT_DIVISIONS } from "@/lib/monthly-report-types";

const short = z.string().trim().max(500);
const prose = z.string().trim().max(10000);
const nullableNumber = z.number().finite().nullable();
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, "Invalid calendar date");
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/);
const observationSchema = z.object({
  month: monthSchema, actual: nullableNumber, target: nullableNumber, source: short, targetSource: short,
  state: z.enum(["missing", "provided", "untracked"]), numerator: nullableNumber, denominator: nullableNumber,
}).strict().superRefine((o, ctx) => {
  if (o.state === "provided" && o.actual === null) ctx.addIssue({ code: "custom", path: ["actual"], message: "Provided actual requires a number" });
  if (o.state !== "provided" && o.actual !== null) ctx.addIssue({ code: "custom", path: ["actual"], message: "Unknown/untracked actual must be null" });
  if (o.denominator !== null && o.denominator <= 0) ctx.addIssue({ code: "custom", path: ["denominator"], message: "Denominator must be positive" });
});
const metricSchema = z.object({
  kpiId: z.number().int().positive(), name: short, definition: prose, unit: short,
  direction: z.enum(["higher_better", "lower_better"]), definitionConfirmed: z.boolean(),
  aggregation: z.enum(["sum", "average", "latest", "ratio"]).nullable(), aggregationNote: prose,
  observations: z.array(observationSchema).max(240), sharedMetricKey: short, sharingReviewed: z.boolean(), reconciliationNote: prose,
  deviationCause: prose, deviationEvidence: prose,
}).strict().superRefine((m, ctx) => {
  const seen = new Set<string>();
  for (const [i, o] of m.observations.entries()) {
    if (seen.has(o.month)) ctx.addIssue({ code: "custom", path: ["observations", i, "month"], message: "Duplicate observation month" });
    seen.add(o.month);
  }
}).transform((metric) => {
  metric.observations.sort((a, b) => a.month.localeCompare(b.month));
  return metric;
});
const statementRow = z.object({ label: short, value: nullableNumber, source: short, state: z.enum(["missing", "provided", "untracked"]) }).strict().superRefine((r, ctx) => {
  if (r.state === "provided" && r.value === null || r.state !== "provided" && r.value !== null) ctx.addIssue({ code: "custom", path: ["value"], message: "Value must match observation state" });
});
const statement = z.object({ unit: short, rows: z.array(statementRow) }).strict();
const channel = z.object({ channel: short, metric: short, value: nullableNumber, unit: short, source: short, state: z.enum(["missing", "provided", "untracked"]) }).strict().superRefine((r, ctx) => {
  if (r.state === "provided" && r.value === null || r.state !== "provided" && r.value !== null) ctx.addIssue({ code: "custom", path: ["value"], message: "Value must match observation state" });
});
export const monthlyReportContentSchema = z.object({
  division: z.enum(Object.keys(REPORT_DIVISIONS) as [keyof typeof REPORT_DIVISIONS, ...Array<keyof typeof REPORT_DIVISIONS>]).nullable(),
  summary: z.array(prose).max(4), worstOutcome: prose, narrativeSource: prose, kpiSetChangeNote: prose,
  metrics: z.array(metricSchema).max(300), risksReviewed: z.boolean(),
  risks: z.array(z.object({ issue: prose, impact: prose, escalationOwner: short }).strict()).max(100),
  actions: z.array(z.object({ action: prose, pic: short, deadline: calendarDate.or(z.literal("")) }).strict()).max(100),
  decisionsReviewed: z.boolean(), decisions: z.array(z.object({ request: prose, options: prose, impact: prose }).strict()).max(100),
  finance: z.object({ incomeStatement: statement, cashFlow: statement, balanceSheet: statement }).strict(),
  channelBreakdowns: z.array(channel), activities: z.array(prose),
  appendices: z.array(z.object({ title: short, content: prose, source: prose }).strict()), aiNotes: prose,
}).strict().superRefine((content, ctx) => {
  const ids = new Set<number>();
  for (const [i, m] of content.metrics.entries()) {
    if (ids.has(m.kpiId)) ctx.addIssue({ code: "custom", path: ["metrics", i, "kpiId"], message: "Duplicate KPI" });
    ids.add(m.kpiId);
  }
});
