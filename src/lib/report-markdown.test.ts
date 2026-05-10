import assert from "node:assert/strict";
import test from "node:test";
import { generateUnifiedMarkdownReport, buildPresentationPrompt, type UnifiedMarkdownReportData } from "./report-markdown";

const reportData = {
  periodLabel: "April 2026",
  generatedDate: "May 5, 2026",
  summary: {
    healthScore: 67,
    totalKPIs: 3,
    greenCount: 2,
    yellowCount: 0,
    redCount: 1,
    noDataCount: 0,
    improved: 1,
    declined: 1,
    stable: 1,
    avgAchievement: 91,
    achievementDelta: 4,
  },
  domains: [
    {
      name: "Growth",
      description: "Acquisition and revenue KPIs",
      kpis: [
        {
          name: "Monthly Revenue",
          description: "Recognized recurring revenue",
          actual: "$120,000",
          target: "$150,000",
          achievement: "80%",
          status: "Off Track",
          momDelta: "-12.0%",
          direction: "higher is better",
        },
      ],
    },
  ],
  actionPlans: [
    {
      title: "Improve enterprise pipeline",
      description: "Focus on late-stage deals",
      kpiName: "Monthly Revenue",
      domainName: "Growth",
      owner: "Sales Lead",
      dueDate: "2026-05-20",
      status: "In Progress",
      overdue: false,
    },
  ],
  attentionItems: [
    {
      name: "Monthly Revenue",
      domainName: "Growth",
      actual: "$120,000",
      target: "$150,000",
      status: "Off Track",
      reason: "Below target",
    },
  ],
  projects: [
    {
      name: "Mobile Launch",
      description: "Customer mobile app",
      startDate: "2026-04-01",
      endDate: "2026-05-15",
      launchDate: "2026-05-22",
      launchDateType: "Calculated",
      progress: 45,
      status: "In Progress",
    },
    {
      name: "Data Warehouse",
      description: null,
      startDate: "2026-03-01",
      endDate: "2026-06-30",
      launchDate: "2026-07-10",
      launchDateType: "Manual",
      progress: 20,
      status: "Planned",
    },
  ],
  historicalDomains: [
    {
      name: "Growth",
      description: "Acquisition and revenue KPIs",
      kpis: [
        {
          name: "Monthly Revenue",
          description: "Recognized recurring revenue",
          unit: "$",
          direction: "higher is better",
          entries: [
            {
              period: "March 2026",
              actual: "$140,000",
              target: "$150,000",
              achievement: "93%",
              status: "At Risk",
              note: "Pipeline delayed",
            },
            {
              period: "April 2026",
              actual: "$120,000",
              target: "$150,000",
              achievement: "80%",
              status: "Off Track",
              note: null,
            },
          ],
        },
      ],
    },
  ],
} satisfies UnifiedMarkdownReportData;

test("generates an English unified markdown report with KPI, action plan, and all project timeline data", () => {
  const markdown = generateUnifiedMarkdownReport(reportData);

  assert.match(markdown, /^# KPIT Unified Report/m);
  assert.match(markdown, /Period: April 2026/);
  assert.match(markdown, /## KPI Health Overview/);
  assert.match(markdown, /\| Monthly Revenue \| Recognized recurring revenue \| \$120,000 \| \$150,000 \| 80% \| Off Track \| -12\.0% \|/);
  assert.match(markdown, /## Action Plans/);
  assert.match(markdown, /\| Improve enterprise pipeline \| Growth \| Monthly Revenue \| Sales Lead \| 2026-05-20 \| In Progress \| No \|/);
  assert.match(markdown, /## All Projects Timeline/);
  assert.match(markdown, /\| Mobile Launch \| Customer mobile app \| 2026-04-01 \| 2026-05-15 \| 2026-05-22 \| Calculated \| 45% \| In Progress \|/);
  assert.match(markdown, /\| Data Warehouse \| - \| 2026-03-01 \| 2026-06-30 \| 2026-07-10 \| Manual \| 20% \| Planned \|/);
});

test("builds a presentation prompt that wraps the unified markdown report", () => {
  const prompt = buildPresentationPrompt(reportData);

  assert.match(prompt, /^Create an executive presentation from the KPI and timeline report below\./);
  assert.match(prompt, /Audience: executive leadership/);
  assert.match(prompt, /# KPIT Unified Report/);
  assert.match(prompt, /Mobile Launch/);
});

test("includes all-period KPI history when historical domains are provided", () => {
  const markdown = generateUnifiedMarkdownReport({
    ...reportData,
    periodLabel: "All Periods",
  });

  assert.match(markdown, /Period: All Periods/);
  assert.match(markdown, /## KPI Historical Data/);
  assert.match(markdown, /\| March 2026 \| \$140,000 \| \$150,000 \| 93% \| At Risk \| Pipeline delayed \|/);
  assert.match(markdown, /\| April 2026 \| \$120,000 \| \$150,000 \| 80% \| Off Track \| - \|/);
});
