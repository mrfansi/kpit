import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/ai/api-helpers";
import { isValidCalendarDate } from "@/lib/date-utils";
import { format, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import { getAllDomains, getAllKPIEntriesBatch, getBatchPeriodComparison, getEffectiveTarget, getKPIsWithLatestEntry, getReportActionPlansWithKPI } from "@/lib/queries";
import { getAllTimelineProjects } from "@/lib/queries/timeline";
import { getAllStatuses } from "@/lib/queries/timeline-statuses";
import { getActionFocusItems, getReportActionPlans, isActionPlanOverdue } from "@/lib/action-plan";
import { getAchievementPct, getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { getEffectiveLaunchDate, isManualLaunchDate } from "@/lib/launch-date";
import { formatValue, listLastNMonths } from "@/lib/period";
import { actionPlanStatusLabels } from "@/lib/action-plan";
import { generateMarkdownExport, type MarkdownExportFormat, type UnifiedMarkdownReportData } from "@/lib/report-markdown";

const exportFormats = new Set<MarkdownExportFormat>(["full", "brief", "presentation"]);
const exportScopes = new Set(["selected", "all"]);

function cleanFilenamePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getMonthDelta(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined || previous === 0) {
    return "N/A";
  }
  const delta = ((current - previous) / previous) * 100;
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

function formatEnglishPeriod(period: string) {
  return format(parseISO(period), "MMMM yyyy", { locale: enUS });
}

async function buildUnifiedMarkdownReportData(period: string, scope: "selected" | "all"): Promise<UnifiedMarkdownReportData> {
  const [domains, allKPIsWithEntries, actionPlanRows, projects, statuses] = await Promise.all([
    getAllDomains(),
    getKPIsWithLatestEntry(undefined, period),
    getReportActionPlansWithKPI(),
    getAllTimelineProjects(),
    getAllStatuses(),
  ]);

  const kpiIds = allKPIsWithEntries.map(({ kpi }) => kpi.id);
  const comparisonMap = await getBatchPeriodComparison(kpiIds, period);

  let greenCount = 0;
  let yellowCount = 0;
  let redCount = 0;
  let noDataCount = 0;
  let improved = 0;
  let declined = 0;
  let stable = 0;
  let totalAchievement = 0;
  let achievementCount = 0;
  let previousAchievement = 0;
  let previousAchievementCount = 0;
  const statusOrder: Record<string, number> = { green: 3, yellow: 2, red: 1, "no-data": 0 };

  const kpiRows = allKPIsWithEntries.map(({ kpi, latestEntry, effectiveTarget }) => {
    const status = getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget });
    const comparison = comparisonMap.get(kpi.id);
    const prevEntry = comparison?.prevMonth ?? null;
    const achievement = getAchievementPct(latestEntry?.value, effectiveTarget.target, kpi.direction);

    if (status === "green") greenCount++;
    else if (status === "yellow") yellowCount++;
    else if (status === "red") redCount++;
    else noDataCount++;

    if (achievement !== null) {
      totalAchievement += achievement;
      achievementCount++;
    }

    if (prevEntry) {
      const prevStatus = getKPIStatus(prevEntry.value, kpi);
      const diff = statusOrder[status] - statusOrder[prevStatus];
      if (diff > 0) improved++;
      else if (diff < 0) declined++;
      else stable++;

      const prevAchievementPct = getAchievementPct(prevEntry.value, kpi.target, kpi.direction);
      if (prevAchievementPct !== null) {
        previousAchievement += prevAchievementPct;
        previousAchievementCount++;
      }
    }

    const domain = domains.find((d) => d.id === kpi.domainId);

    return {
      kpi,
      domainName: domain?.name ?? "Unknown",
      status,
      latestEntry,
      effectiveTarget,
      prevEntry,
      achievement,
    };
  });

  const avgAchievement = achievementCount > 0 ? Math.round(totalAchievement / achievementCount) : null;
  const prevAvgAchievement = previousAchievementCount > 0 ? Math.round(previousAchievement / previousAchievementCount) : null;
  const achievementDelta = avgAchievement !== null && prevAvgAchievement !== null ? avgAchievement - prevAvgAchievement : null;

  const reportActions = getReportActionPlans(actionPlanRows.map((row) => row.action), period);
  const reportActionIds = new Set(reportActions.map((action) => action.id));
  const relevantActionRows = actionPlanRows.filter((row) => reportActionIds.has(row.action.id));
  const focusActionIds = new Set(getActionFocusItems(relevantActionRows.map((row) => row.action), period).map((action) => action.id));
  const actionRowsForExport = scope === "all"
    ? actionPlanRows
    : relevantActionRows.filter((row) => focusActionIds.has(row.action.id));

  const attentionItems = kpiRows
    .filter(({ status, latestEntry, prevEntry }) => status === "red" || getMonthDelta(latestEntry?.value, prevEntry?.value).startsWith("-"))
    .map(({ kpi, domainName, latestEntry, effectiveTarget, status, prevEntry }) => ({
      name: kpi.name,
      domainName,
      actual: latestEntry ? formatValue(latestEntry.value, kpi.unit) : "N/A",
      target: formatValue(effectiveTarget.target, kpi.unit),
      status: statusConfig[status].label,
      reason: status === "red" ? "Below target" : `Month-over-month change is ${getMonthDelta(latestEntry?.value, prevEntry?.value)}`,
    }));

  const historicalDomains = scope === "all"
    ? await buildHistoricalDomains(domains, allKPIsWithEntries.map(({ kpi }) => kpi))
    : undefined;

  return {
    periodLabel: scope === "all" ? "All Periods" : formatEnglishPeriod(period),
    generatedDate: new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }),
    summary: {
      healthScore: allKPIsWithEntries.length > 0 ? Math.round((greenCount / allKPIsWithEntries.length) * 100) : 0,
      totalKPIs: allKPIsWithEntries.length,
      greenCount,
      yellowCount,
      redCount,
      noDataCount,
      improved,
      declined,
      stable,
      avgAchievement,
      achievementDelta,
    },
    domains: domains
      .map((domain) => ({
        name: domain.name,
        description: domain.description,
        kpis: kpiRows
          .filter(({ kpi }) => kpi.domainId === domain.id)
          .map(({ kpi, latestEntry, effectiveTarget, status, prevEntry, achievement }) => ({
            name: kpi.name,
            description: kpi.description,
            actual: latestEntry ? formatValue(latestEntry.value, kpi.unit) : "N/A",
            target: formatValue(effectiveTarget.target, kpi.unit),
            achievement: achievement !== null ? `${achievement}%` : "N/A",
            status: statusConfig[status].label,
            momDelta: getMonthDelta(latestEntry?.value, prevEntry?.value),
            direction: kpi.direction === "lower_better" ? "lower is better" : "higher is better",
          })),
      }))
      .filter((domain) => domain.kpis.length > 0),
    actionPlans: actionRowsForExport.map(({ action, kpi, domain }) => ({
      title: action.title,
      description: action.description,
      kpiName: kpi.name,
      domainName: domain.name,
      owner: action.owner,
      dueDate: action.dueDate,
      status: actionPlanStatusLabels[action.status],
      overdue: isActionPlanOverdue(action),
    })),
    attentionItems,
    projects: projects.map((project) => {
      const status = statuses.find((s) => s.id === project.statusId);
      return {
        name: project.name,
        description: project.description,
        startDate: project.startDate,
        endDate: project.endDate,
        launchDate: getEffectiveLaunchDate(project),
        launchDateType: isManualLaunchDate(project) ? "Manual" : "Calculated",
        progress: project.progress,
        status: status?.name ?? "No Status",
      };
    }),
    historicalDomains,
  };
}

async function buildHistoricalDomains(
  domains: Awaited<ReturnType<typeof getAllDomains>>,
  allKPIs: Awaited<ReturnType<typeof getKPIsWithLatestEntry>>[number]["kpi"][]
): Promise<UnifiedMarkdownReportData["historicalDomains"]> {
  const entries = await getAllKPIEntriesBatch(allKPIs.map((kpi) => kpi.id));
  const entriesByKpi = new Map<number, typeof entries>();

  for (const entry of entries) {
    const kpiEntries = entriesByKpi.get(entry.kpiId) ?? [];
    kpiEntries.push(entry);
    entriesByKpi.set(entry.kpiId, kpiEntries);
  }

  const kpisWithHistory = await Promise.all(allKPIs.map(async (kpi) => {
    const kpiEntries = entriesByKpi.get(kpi.id) ?? [];
    const historicalEntries = await Promise.all(kpiEntries.map(async (entry) => {
      const target = await getEffectiveTarget(kpi, entry.periodDate);
      const achievement = getAchievementPct(entry.value, target.target, kpi.direction);
      const status = getKPIStatus(entry.value, { ...kpi, ...target });
      return {
        period: formatEnglishPeriod(entry.periodDate),
        actual: formatValue(entry.value, kpi.unit),
        target: formatValue(target.target, kpi.unit),
        achievement: achievement !== null ? `${achievement}%` : "N/A",
        status: statusConfig[status].label,
        note: entry.note,
      };
    }));

    return {
      kpi,
      historicalKPI: {
        name: kpi.name,
        description: kpi.description,
        unit: kpi.unit,
        direction: kpi.direction === "lower_better" ? "lower is better" : "higher is better",
        entries: historicalEntries,
      },
    };
  }));

  return domains
    .map((domain) => ({
      name: domain.name,
      description: domain.description,
      kpis: kpisWithHistory
        .filter(({ kpi }) => kpi.domainId === domain.id)
        .map(({ historicalKPI }) => historicalKPI),
    }))
    .filter((domain) => domain.kpis.length > 0);
}

export async function GET(request: NextRequest) {
  // This route exposes the entire KPI/action-plan/timeline dataset — auth required.
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? listLastNMonths(1)[0]?.value;
  const requestedFormat = searchParams.get("format") ?? "full";
  const format = exportFormats.has(requestedFormat as MarkdownExportFormat)
    ? requestedFormat as MarkdownExportFormat
    : "full";
  const requestedScope = searchParams.get("scope") ?? "selected";
  const scope = exportScopes.has(requestedScope) ? requestedScope as "selected" | "all" : "selected";

  // Validate the period before it flows into parseISO/format (RangeError otherwise).
  if (!period || !isValidCalendarDate(period)) {
    return NextResponse.json(
      { error: "Parameter period tidak valid (format YYYY-MM-DD)." },
      { status: 400 }
    );
  }

  let data: UnifiedMarkdownReportData;
  try {
    data = await buildUnifiedMarkdownReportData(period, scope);
  } catch {
    return NextResponse.json(
      { error: "Gagal membuat laporan." },
      { status: 500 }
    );
  }
  const markdown = generateMarkdownExport(data, format);
  const filename = scope === "all"
    ? `kpit-${format}-report-all-periods.md`
    : `kpit-${format}-report-${cleanFilenamePart(data.periodLabel)}.md`;

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": searchParams.get("download") === "1"
        ? `attachment; filename="${filename}"`
        : `inline; filename="${filename}"`,
    },
  });
}
