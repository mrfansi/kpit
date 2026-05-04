import { NextRequest, NextResponse } from "next/server";
import { getAllDomains, getKPIsWithLatestEntry, getBatchPeriodComparison, getReportActionPlansWithKPI } from "@/lib/queries";
import { getAchievementPct, getKPIStatus } from "@/lib/kpi-status";
import { getActionFocusItems, getActionPlanSummary, getReportActionPlans, isActionPlanOverdue } from "@/lib/action-plan";
import { formatPeriodDate, formatValue, listLastNMonths } from "@/lib/period";
import { requireAuth } from "@/lib/ai/api-helpers";
import { getAIService, cleanAIOutput } from "@/lib/ai";
import { getPresentationStyles } from "@/lib/presentation/styles";
import { getPresentationEngine } from "@/lib/presentation/engine";
import {
  slideTitleHtml,
  slideExecutiveSummaryHtml,
  slideDomainHtml,
  slideAttentionHtml,
  slideActionPlanHtml,
  slideClosingHtml,
  type PresentationData,
  type PresentationKPI,
} from "@/lib/presentation/slides";

async function generateDomainNarrative(
  domainName: string,
  kpis: PresentationKPI[],
  period: string
): Promise<string | null> {
  try {
    const ai = getAIService();
    const kpiSummary = kpis
      .map(
        (k) =>
          `- ${k.name}: aktual ${fmtVal(k.actualValue, k.unit)}, target ${fmtVal(k.targetValue, k.unit)}, pencapaian ${k.achievementPct ?? "N/A"}%, status ${k.status}`
      )
      .join("\n");

    const prompt = `Kamu adalah analis KPI. Tulis insight singkat (2-3 kalimat) untuk domain "${domainName}" periode ${period}.

Data KPI:
${kpiSummary}

Instruksi:
- Langsung tulis insight, tanpa kalimat pembuka
- Fokus pada temuan utama dan implikasi
- Bahasa Indonesia, mudah dipahami eksekutif
- Jangan gunakan markdown formatting`;

    const result = await ai.generateText(prompt);
    return cleanAIOutput(result.text);
  } catch {
    return null;
  }
}

async function generateExecutiveNarrative(
  data: { healthScore: number; healthDelta: number | null; improved: number; declined: number; stable: number; avgAchievement: number | null },
  kpis: PresentationKPI[],
  period: string
): Promise<string | null> {
  try {
    const ai = getAIService();
    const kpiSummary = kpis
      .map(
        (k) =>
          `- ${k.name} [${k.domainName}]: pencapaian ${k.achievementPct ?? "N/A"}%, status ${k.status}`
      )
      .join("\n");

    const prompt = `Kamu adalah analis KPI senior. Tulis narasi ringkasan eksekutif (3 paragraf pendek, masing-masing 2-3 kalimat) untuk laporan KPI periode ${period}.

Data:
- Health Score: ${data.healthScore}%${data.healthDelta !== null ? ` (${data.healthDelta > 0 ? "+" : ""}${data.healthDelta}% dari bulan lalu)` : ""}
- Pergerakan: ${data.improved} naik, ${data.declined} turun, ${data.stable} tetap
- Rata-rata pencapaian: ${data.avgAchievement ?? "N/A"}%

KPI:
${kpiSummary}

Instruksi:
- Langsung tulis, tanpa kalimat pembuka
- Paragraf 1: Gambaran umum
- Paragraf 2: KPI yang memburuk
- Paragraf 3: Rekomendasi prioritas
- Bahasa Indonesia, untuk eksekutif non-teknis
- Jangan gunakan markdown formatting`;

    const result = await ai.generateText(prompt);
    return cleanAIOutput(result.text);
  } catch {
    return null;
  }
}

function fmtVal(value: number | null, unit: string): string {
  if (value === null) return "\u2014";
  return formatValue(value, unit);
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sanitizeColor(color: string): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/.test(color)) return color;
  if (/^[a-zA-Z]+$/.test(color)) return color;
  return "#64748b";
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? listLastNMonths(1)[0]?.value;

  if (!period) {
    return NextResponse.json({ error: "Period is required" }, { status: 400 });
  }

  const periodLabel = formatPeriodDate(period, "MMMM yyyy");
  const generatedDate = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Fetch data
  const [domains, allKPIsWithEntries, actionPlanRows] = await Promise.all([
    getAllDomains(),
    getKPIsWithLatestEntry(undefined, period),
    getReportActionPlansWithKPI(),
  ]);
  const kpiIds = allKPIsWithEntries.map(({ kpi }) => kpi.id);
  const comparisonMap = await getBatchPeriodComparison(kpiIds, period);

  // Compute global stats
  let totalGreen = 0;
  let totalYellow = 0;
  let totalRed = 0;
  let totalNoData = 0;
  let improved = 0;
  let declined = 0;
  let stable = 0;
  let totalAchievement = 0;
  let totalAchievementCount = 0;
  let prevGreen = 0;
  let prevTotal = 0;
  let prevTotalAchievement = 0;
  let prevAchievementCount = 0;

  const statusOrder: Record<string, number> = { green: 3, yellow: 2, red: 1, "no-data": 0 };

  // Build presentation KPIs
  const allPresentationKpis: PresentationKPI[] = allKPIsWithEntries.map(
    ({ kpi, latestEntry, effectiveTarget, sparklineEntries }) => {
      const status = getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget });
      const ach = getAchievementPct(latestEntry?.value, effectiveTarget.target, kpi.direction);
      const comparison = comparisonMap.get(kpi.id);
      const prevEntry = comparison?.prevMonth ?? null;
      const domainName = domains.find((d) => d.id === kpi.domainId)?.name ?? "";

      if (status === "green") totalGreen++;
      else if (status === "yellow") totalYellow++;
      else if (status === "red") totalRed++;
      else totalNoData++;

      if (ach !== null) { totalAchievement += ach; totalAchievementCount++; }

      if (prevEntry) {
        prevTotal++;
        const prevStatus = getKPIStatus(prevEntry.value, kpi);
        if (prevStatus === "green") prevGreen++;
        const diff = statusOrder[status] - statusOrder[prevStatus];
        if (diff > 0) improved++;
        else if (diff < 0) declined++;
        else stable++;
        const prevAch = getAchievementPct(prevEntry.value, kpi.target, kpi.direction);
        if (prevAch !== null) { prevTotalAchievement += prevAch; prevAchievementCount++; }
      }

      const momDelta =
        latestEntry && prevEntry && prevEntry.value !== 0
          ? ((latestEntry.value - prevEntry.value) / prevEntry.value) * 100
          : null;

      return {
        name: kpi.name,
        unit: kpi.unit,
        direction: kpi.direction as "higher_better" | "lower_better",
        actualValue: latestEntry?.value ?? null,
        targetValue: effectiveTarget.target,
        achievementPct: ach,
        status,
        momDelta,
        sparklineValues: sparklineEntries.map((e) => e.value),
        domainName,
      };
    }
  );

  const total = allKPIsWithEntries.length;

  if (total === 0) {
    const emptyHtml = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Presentasi KPI</title>
    <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#f8fafc;text-align:center;}
    .msg{max-width:400px;} h1{font-size:1.5rem;margin-bottom:1rem;} p{color:#94a3b8;}</style></head>
    <body><div class="msg"><h1>Tidak Ada Data</h1><p>Tidak ada data KPI untuk periode ${escapeAttr(periodLabel)}. Silakan pilih periode lain atau tambahkan data terlebih dahulu.</p>
    <a href="javascript:history.back()" style="color:#3b82f6;margin-top:1rem;display:inline-block;">\u2190 Kembali</a></div></body></html>`;
    return new NextResponse(emptyHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const healthScore = total > 0 ? Math.round((totalGreen / total) * 100) : 0;
  const prevHealthPct = prevTotal > 0 ? Math.round((prevGreen / prevTotal) * 100) : null;
  const healthDelta = prevHealthPct !== null ? healthScore - prevHealthPct : null;
  const avgAchievement = totalAchievementCount > 0 ? Math.round(totalAchievement / totalAchievementCount) : null;
  const prevAvgAchievement = prevAchievementCount > 0 ? Math.round(prevTotalAchievement / prevAchievementCount) : null;
  const achievementDelta = avgAchievement !== null && prevAvgAchievement !== null ? avgAchievement - prevAvgAchievement : null;

  // Build domain groups
  const domainGroups = domains
    .map((domain) => ({
      domain: {
        name: domain.name,
        slug: domain.slug,
        icon: domain.icon,
        color: sanitizeColor(domain.color),
        description: domain.description,
      },
      kpis: allPresentationKpis.filter((k) => k.domainName === domain.name),
    }))
    .filter(({ kpis }) => kpis.length > 0);

  // Build attention KPIs
  const attentionKpis = allPresentationKpis
    .filter((k) => k.status === "red" || (k.momDelta !== null && k.momDelta < -10))
    .map((k) => ({
      ...k,
      reason:
        k.status === "red"
          ? "Di bawah target"
          : `Turun ${Math.abs(k.momDelta!).toFixed(1)}% dari bulan lalu`,
    }));

  const reportActions = getReportActionPlans(actionPlanRows.map((row) => row.action), period);
  const reportActionIds = new Set(reportActions.map((action) => action.id));
  const relevantActionRows = actionPlanRows.filter((row) => reportActionIds.has(row.action.id));
  const actionSummary = getActionPlanSummary(relevantActionRows.map((row) => row.action));
  const focusActionIds = new Set(getActionFocusItems(relevantActionRows.map((row) => row.action), period).map((action) => action.id));
  const focusRows = relevantActionRows.filter((row) => focusActionIds.has(row.action.id));

  // Generate AI narratives in parallel
  const [executiveNarrative, ...domainNarratives] = await Promise.all([
    generateExecutiveNarrative(
      { healthScore, healthDelta, improved, declined, stable, avgAchievement },
      allPresentationKpis,
      periodLabel
    ),
    ...domainGroups.map(({ domain, kpis }) =>
      generateDomainNarrative(domain.name, kpis, periodLabel)
    ),
  ]);

  // Assemble presentation data
  const presentationData: PresentationData = {
    period: periodLabel,
    generatedDate,
    healthScore,
    healthDelta,
    totalKPIs: total,
    greenCount: totalGreen,
    yellowCount: totalYellow,
    redCount: totalRed,
    noDataCount: totalNoData,
    improved,
    declined,
    stable,
    avgAchievement,
    achievementDelta,
    executiveNarrative,
    domains: domainGroups.map((dg, i) => ({
      ...dg,
      narrative: domainNarratives[i] ?? null,
    })),
    attentionKpis,
    actionPlans: {
      total: actionSummary.total,
      active: actionSummary.active,
      overdue: actionSummary.overdue,
      doneThisMonth: actionSummary.doneThisMonth,
      focusItems: focusRows.map(({ action, kpi, domain }) => ({
        title: action.title,
        kpiName: kpi.name,
        domainName: domain.name,
        owner: action.owner,
        dueDate: action.dueDate,
        status: action.status,
        overdue: isActionPlanOverdue(action),
      })),
    },
  };

  // Build slides
  const slidesHtml: string[] = [
    slideTitleHtml(presentationData),
    slideExecutiveSummaryHtml(presentationData),
    ...presentationData.domains.map((d) => slideDomainHtml(d)),
  ];

  const attentionHtml = slideAttentionHtml(presentationData);
  if (attentionHtml) slidesHtml.push(attentionHtml);

  const actionPlanHtml = slideActionPlanHtml(presentationData);
  if (actionPlanHtml) slidesHtml.push(actionPlanHtml);

  slidesHtml.push(slideClosingHtml(presentationData));

  const totalSlides = slidesHtml.length;

  // Assemble full HTML
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Presentasi KPI \u2014 ${escapeAttr(periodLabel)}</title>
  <style>${getPresentationStyles()}</style>
</head>
<body>
  <div class="slides-wrapper">
    ${slidesHtml.join("\n")}
  </div>
  <div class="progress-bar" id="progress-bar"></div>
  <div class="slide-counter" id="slide-counter">1 / ${totalSlides}</div>
  <div class="nav-hint">\u2190 \u2192 Navigate \u00b7 F Fullscreen</div>
  <script>${getPresentationEngine(totalSlides)}</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
