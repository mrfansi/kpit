export const REPORT_DIVISIONS = {
  finance: "Finance",
  sales_marketing: "Sales & Marketing",
  operation: "Operation",
  product_tech: "Product & Tech",
  production: "Production",
  hr_partnership: "HR & Strategic Partnership",
} as const;

export type ReportDivision = keyof typeof REPORT_DIVISIONS;
export type ReportAggregation = "sum" | "average" | "latest" | "ratio";
export type ObservationState = "missing" | "provided" | "untracked";

export interface MonthlyObservation {
  month: string;
  actual: number | null;
  target: number | null;
  source: string;
  targetSource: string;
  state: ObservationState;
  numerator: number | null;
  denominator: number | null;
}

export interface MonthlyReportMetric {
  kpiId: number;
  name: string;
  definition: string;
  unit: string;
  direction: "higher_better" | "lower_better";
  definitionConfirmed: boolean;
  aggregation: ReportAggregation | null;
  aggregationNote: string;
  observations: MonthlyObservation[];
  sharedMetricKey: string;
  sharingReviewed: boolean;
  reconciliationNote: string;
  deviationCause: string;
  deviationEvidence: string;
}

export interface MonthlyReportRisk {
  issue: string;
  impact: string;
  escalationOwner: string;
}

export interface MonthlyReportAction {
  action: string;
  pic: string;
  deadline: string;
}

export interface MonthlyReportDecision {
  request: string;
  options: string;
  impact: string;
}

export interface FinancialStatementRow {
  label: string;
  value: number | null;
  source: string;
  state: ObservationState;
}

export interface FinancialStatement {
  unit: string;
  rows: FinancialStatementRow[];
}

export interface MonthlyReportContent {
  division: ReportDivision | null;
  summary: string[];
  worstOutcome: string;
  narrativeSource: string;
  kpiSetChangeNote: string;
  metrics: MonthlyReportMetric[];
  risksReviewed: boolean;
  risks: MonthlyReportRisk[];
  actions: MonthlyReportAction[];
  decisionsReviewed: boolean;
  decisions: MonthlyReportDecision[];
  finance: {
    incomeStatement: FinancialStatement;
    cashFlow: FinancialStatement;
    balanceSheet: FinancialStatement;
  };
  channelBreakdowns: { channel: string; metric: string; value: number | null; unit: string; source: string; state: ObservationState }[];
  activities: string[];
  appendices: { title: string; content: string; source: string }[];
  aiNotes: string;
}

export interface ReportQuestion {
  id: string;
  path: string;
  question: string;
}

export interface ComputedReportValue {
  value: number | null;
  target: number | null;
  state: ObservationState;
  source: string;
  targetSource: string;
  calculation: string;
}

export interface ComputedReportMetric {
  kpiId: number;
  current: ComputedReportValue;
  previous: ComputedReportValue;
  ytd: ComputedReportValue;
  momPercent: number | null;
  missedTarget: boolean;
}

export interface ReportReconciliation {
  metricKey: string;
  state: "matched" | "conflict" | "awaiting_peer";
  peers: { domainId: number; domainName: string; value: number | null; unit: string; source: string }[];
  detail: string;
}

export interface MonthlyReportBundle {
  domain: { id: number; name: string; slug: string };
  period: string;
  content: MonthlyReportContent;
  metrics: ComputedReportMetric[];
  questions: ReportQuestion[];
  reconciliations: ReportReconciliation[];
  ready: boolean;
  revision: number;
  updatedAt: string | null;
}
