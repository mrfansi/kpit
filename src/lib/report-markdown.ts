export type MarkdownExportFormat = "full" | "brief" | "presentation";

export interface UnifiedMarkdownKPI {
  name: string;
  description: string | null;
  actual: string;
  target: string;
  achievement: string;
  status: string;
  momDelta: string;
  direction: string;
}

export interface UnifiedMarkdownDomain {
  name: string;
  description: string | null;
  kpis: UnifiedMarkdownKPI[];
}

export interface UnifiedMarkdownActionPlan {
  title: string;
  description: string | null;
  kpiName: string;
  domainName: string;
  owner: string;
  dueDate: string;
  status: string;
  overdue: boolean;
}

export interface UnifiedMarkdownAttentionItem {
  name: string;
  domainName: string;
  actual: string;
  target: string;
  status: string;
  reason: string;
}

export interface UnifiedMarkdownProject {
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  launchDate: string;
  launchDateType: "Manual" | "Calculated";
  progress: number;
  status: string;
}

export interface UnifiedMarkdownHistoricalEntry {
  period: string;
  actual: string;
  target: string;
  achievement: string;
  status: string;
  note: string | null;
}

export interface UnifiedMarkdownHistoricalKPI {
  name: string;
  description: string | null;
  unit: string;
  direction: string;
  entries: UnifiedMarkdownHistoricalEntry[];
}

export interface UnifiedMarkdownHistoricalDomain {
  name: string;
  description: string | null;
  kpis: UnifiedMarkdownHistoricalKPI[];
}

export interface UnifiedMarkdownReportData {
  periodLabel: string;
  generatedDate: string;
  summary: {
    healthScore: number;
    totalKPIs: number;
    greenCount: number;
    yellowCount: number;
    redCount: number;
    noDataCount: number;
    improved: number;
    declined: number;
    stable: number;
    avgAchievement: number | null;
    achievementDelta: number | null;
  };
  domains: UnifiedMarkdownDomain[];
  actionPlans: UnifiedMarkdownActionPlan[];
  attentionItems: UnifiedMarkdownAttentionItem[];
  projects: UnifiedMarkdownProject[];
  historicalDomains?: UnifiedMarkdownHistoricalDomain[];
}

export function generateMarkdownExport(data: UnifiedMarkdownReportData, format: MarkdownExportFormat) {
  if (format === "presentation") return buildPresentationPrompt(data);
  if (format === "brief") return generateExecutiveBrief(data);
  return generateUnifiedMarkdownReport(data);
}

function cell(value: string | number | null | undefined) {
  const text = value === null || value === undefined || value === "" ? "-" : String(value);
  return text.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

function listLine(label: string, value: string | number | null) {
  return `- ${label}: ${cell(value)}`;
}

function generateExecutiveBrief(data: UnifiedMarkdownReportData) {
  const offTrack = data.attentionItems.filter((item) => item.status === "Off Track");
  const lowProgressProjects = data.projects.filter((project) => project.progress < 50);

  return [
    "# KPIT Executive Brief",
    "",
    `Period: ${data.periodLabel}`,
    `Generated: ${data.generatedDate}`,
    "",
    "## KPI Snapshot",
    "",
    `Health score is ${data.summary.healthScore}% across ${data.summary.totalKPIs} KPIs. ${data.summary.greenCount} KPIs are on track, ${data.summary.yellowCount} are at risk, ${data.summary.redCount} are off track, and ${data.summary.noDataCount} have no data.`,
    "",
    "## Priority KPI Attention",
    "",
    offTrack.length === 0
      ? "No off-track KPIs were identified."
      : offTrack.map((item) => `- ${item.name} (${item.domainName}): ${item.actual} vs ${item.target}. ${item.reason}.`).join("\n"),
    "",
    "## Timeline Snapshot",
    "",
    `There are ${data.projects.length} timeline projects in the report. ${lowProgressProjects.length} projects are below 50% progress.`,
    "",
    "## Recommended Executive Focus",
    "",
    "- Review off-track KPIs and assign action owners.",
    "- Check low-progress projects against their end dates and launch readiness.",
    "- Use the action plan list to confirm near-term accountability.",
  ].join("\n").trim() + "\n";
}

export function generateUnifiedMarkdownReport(data: UnifiedMarkdownReportData) {
  const lines: string[] = [
    "# KPIT Unified Report",
    "",
    `Period: ${data.periodLabel}`,
    `Generated: ${data.generatedDate}`,
    "",
    "## Executive Summary",
    "",
    `The KPI portfolio health score is ${data.summary.healthScore}% for ${data.periodLabel}. ${data.summary.greenCount} KPIs are on track, ${data.summary.yellowCount} are at risk, ${data.summary.redCount} are off track, and ${data.summary.noDataCount} have no data.`,
    "",
    "## KPI Health Overview",
    "",
    listLine("Total KPIs", data.summary.totalKPIs),
    listLine("On Track", data.summary.greenCount),
    listLine("At Risk", data.summary.yellowCount),
    listLine("Off Track", data.summary.redCount),
    listLine("No Data", data.summary.noDataCount),
    listLine("Improved", data.summary.improved),
    listLine("Declined", data.summary.declined),
    listLine("Stable", data.summary.stable),
    listLine("Average Achievement", data.summary.avgAchievement !== null ? `${data.summary.avgAchievement}%` : null),
    listLine("Achievement Delta", data.summary.achievementDelta !== null ? `${data.summary.achievementDelta > 0 ? "+" : ""}${data.summary.achievementDelta}%` : null),
    "",
    "## Domain Performance",
    "",
  ];

  for (const domain of data.domains) {
    lines.push(`### ${domain.name}`, "");
    if (domain.description) lines.push(domain.description, "");
    lines.push("| KPI | Description | Actual | Target | Achievement | Status | MoM Delta |");
    lines.push("|---|---|---:|---:|---:|---|---:|");
    for (const kpi of domain.kpis) {
      lines.push(`| ${cell(kpi.name)} | ${cell(kpi.description)} | ${cell(kpi.actual)} | ${cell(kpi.target)} | ${cell(kpi.achievement)} | ${cell(kpi.status)} | ${cell(kpi.momDelta)} |`);
    }
    lines.push("");
  }

  if (data.historicalDomains && data.historicalDomains.length > 0) {
    lines.push("## KPI Historical Data", "");
    for (const domain of data.historicalDomains) {
      lines.push(`### ${domain.name}`, "");
      if (domain.description) lines.push(domain.description, "");
      for (const kpi of domain.kpis) {
        lines.push(`#### ${kpi.name}`, "");
        if (kpi.description) lines.push(kpi.description, "");
        lines.push(`- Unit: ${cell(kpi.unit)}`);
        lines.push(`- Direction: ${cell(kpi.direction)}`);
        lines.push("");
        if (kpi.entries.length === 0) {
          lines.push("No historical entries are available.", "");
          continue;
        }
        lines.push("| Period | Actual | Target | Achievement | Status | Note |");
        lines.push("|---|---:|---:|---:|---|---|");
        for (const entry of kpi.entries) {
          lines.push(`| ${cell(entry.period)} | ${cell(entry.actual)} | ${cell(entry.target)} | ${cell(entry.achievement)} | ${cell(entry.status)} | ${cell(entry.note)} |`);
        }
        lines.push("");
      }
    }
  }

  lines.push("## Action Plans", "");
  if (data.actionPlans.length === 0) {
    lines.push("No action plans are included for this report.", "");
  } else {
    lines.push("| Action | Domain | KPI | Owner | Due Date | Status | Overdue |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const action of data.actionPlans) {
      lines.push(`| ${cell(action.title)} | ${cell(action.domainName)} | ${cell(action.kpiName)} | ${cell(action.owner)} | ${cell(action.dueDate)} | ${cell(action.status)} | ${action.overdue ? "Yes" : "No"} |`);
    }
    lines.push("");
  }

  lines.push("## Attention Items", "");
  if (data.attentionItems.length === 0) {
    lines.push("No critical attention items were identified.", "");
  } else {
    lines.push("| KPI | Domain | Actual | Target | Status | Reason |");
    lines.push("|---|---|---:|---:|---|---|");
    for (const item of data.attentionItems) {
      lines.push(`| ${cell(item.name)} | ${cell(item.domainName)} | ${cell(item.actual)} | ${cell(item.target)} | ${cell(item.status)} | ${cell(item.reason)} |`);
    }
    lines.push("");
  }

  lines.push("## Timeline and Gantt Overview", "");
  const averageProgress = data.projects.length > 0
    ? Math.round(data.projects.reduce((sum, project) => sum + project.progress, 0) / data.projects.length)
    : 0;
  lines.push(listLine("Total Projects", data.projects.length));
  lines.push(listLine("Average Progress", `${averageProgress}%`));
  lines.push("");
  lines.push("## All Projects Timeline", "");
  if (data.projects.length === 0) {
    lines.push("No timeline projects are available.", "");
  } else {
    lines.push("| Project | Description | Start Date | End Date | Launch Date | Launch Date Type | Progress | Status |");
    lines.push("|---|---|---|---|---|---|---:|---|");
    for (const project of data.projects) {
      lines.push(`| ${cell(project.name)} | ${cell(project.description)} | ${cell(project.startDate)} | ${cell(project.endDate)} | ${cell(project.launchDate)} | ${cell(project.launchDateType)} | ${project.progress}% | ${cell(project.status)} |`);
    }
    lines.push("");
  }

  lines.push("## Project Launch Readiness", "");
  const readyProjects = data.projects.filter((project) => project.progress >= 80);
  const lowProgressProjects = data.projects.filter((project) => project.progress < 50);
  lines.push(listLine("Projects at or above 80% progress", readyProjects.length));
  lines.push(listLine("Projects below 50% progress", lowProgressProjects.length));
  lines.push("");
  lines.push("## Schedule Risks", "");
  if (lowProgressProjects.length === 0) {
    lines.push("No low-progress projects were identified from the timeline data.", "");
  } else {
    for (const project of lowProgressProjects) {
      lines.push(`- ${project.name}: ${project.progress}% progress, scheduled to end on ${project.endDate}.`);
    }
    lines.push("");
  }
  lines.push("## Suggested Presentation Brief", "");
  lines.push("Use this report to create a concise executive presentation covering KPI health, domain-level performance, action priorities, project timeline readiness, and schedule risks.");

  return lines.join("\n").trim() + "\n";
}

export function buildPresentationPrompt(data: UnifiedMarkdownReportData) {
  return [
    "Create an executive presentation from the KPI and timeline report below.",
    "",
    "Audience: executive leadership",
    "Tone: concise, strategic, action-oriented",
    "Output: 8-10 slides with clear titles, key insights, risks, and recommended next steps",
    "",
    generateUnifiedMarkdownReport(data),
  ].join("\n");
}
