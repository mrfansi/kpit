import { getAllDomains, getKPIsWithLatestEntry, getBatchPeriodComparison, getReportActionPlansWithKPI } from "@/lib/queries";
import { getAchievementPct, getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue, listLastNMonths } from "@/lib/period";
import { PrintButton } from "@/components/print-button";
import { ReportPeriodSelector } from "@/components/report-period-selector";
import { ReportSparkline } from "@/components/report/report-sparkline";
import { ReportDelta } from "@/components/report/report-delta";
import { ReportAINarrative } from "@/components/report/report-ai-narrative";
import { ReportActionPlans } from "@/components/report/report-action-plans";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Executive Report — Semua Domain" };

interface Props {
  searchParams: Promise<{ period?: string }>;
}

export default async function ExecutiveReportPage({ searchParams }: Props) {
  const { period } = await searchParams;
  const months = listLastNMonths(24);
  const selectedPeriod = period ?? months[0]?.value;
  const periodLabel = selectedPeriod ? formatPeriodDate(selectedPeriod, "MMMM yyyy") : "—";

  // Previous month label for display
  const prevMonthLabel = selectedPeriod
    ? (() => {
        const [y, m] = selectedPeriod.split("-").map(Number);
        const d = new Date(y, m - 2, 1);
        return formatPeriodDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`, "MMM yy");
      })()
    : null;

  const [domains, allKPIsWithEntries, actionPlanRows] = await Promise.all([
    getAllDomains(),
    getKPIsWithLatestEntry(undefined, selectedPeriod),
    getReportActionPlansWithKPI(),
  ]);

  const kpiIds = allKPIsWithEntries.map(({ kpi }) => kpi.id);
  const comparisonMap = selectedPeriod
    ? await getBatchPeriodComparison(kpiIds, selectedPeriod)
    : new Map();

  const printDate = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  // Global summary
  let totalGreen = 0, totalYellow = 0, totalRed = 0, totalNoData = 0;
  for (const { kpi, latestEntry, effectiveTarget } of allKPIsWithEntries) {
    const s = getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget });
    if (s === "green") totalGreen++;
    else if (s === "yellow") totalYellow++;
    else if (s === "red") totalRed++;
    else totalNoData++;
  }
  const total = allKPIsWithEntries.length;
  const healthPct = total > 0 ? Math.round((totalGreen / total) * 100) : 0;

  // Previous period health score & status movement
  let prevGreen = 0, prevTotal = 0;
  let improved = 0, declined = 0, stable = 0;
  let totalAchievement = 0, totalAchievementCount = 0;
  let prevTotalAchievement = 0, prevAchievementCount = 0;

  for (const { kpi, latestEntry, effectiveTarget } of allKPIsWithEntries) {
    const currentStatus = getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget });
    const comparison = comparisonMap.get(kpi.id);
    const prevEntry = comparison?.prevMonth ?? null;

    const ach = getAchievementPct(latestEntry?.value, effectiveTarget.target, kpi.direction);
    if (ach !== null) { totalAchievement += ach; totalAchievementCount++; }

    if (prevEntry) {
      prevTotal++;
      const prevStatus = getKPIStatus(prevEntry.value, kpi);
      if (prevStatus === "green") prevGreen++;

      const prevAch = getAchievementPct(prevEntry.value, kpi.target, kpi.direction);
      if (prevAch !== null) { prevTotalAchievement += prevAch; prevAchievementCount++; }

      const statusOrder: Record<string, number> = { "green": 3, "yellow": 2, "red": 1, "no-data": 0 };
      const diff = statusOrder[currentStatus] - statusOrder[prevStatus];
      if (diff > 0) improved++;
      else if (diff < 0) declined++;
      else stable++;
    }
  }

  const prevHealthPct = prevTotal > 0 ? Math.round((prevGreen / prevTotal) * 100) : null;
  const healthDelta = prevHealthPct !== null ? healthPct - prevHealthPct : null;
  const avgAchievement = totalAchievementCount > 0 ? Math.round(totalAchievement / totalAchievementCount) : null;
  const prevAvgAchievement = prevAchievementCount > 0 ? Math.round(prevTotalAchievement / prevAchievementCount) : null;
  const achievementDelta = avgAchievement !== null && prevAvgAchievement !== null ? avgAchievement - prevAvgAchievement : null;

  // Check if any KPI has YoY data
  const hasAnyYoY = allKPIsWithEntries.some(({ kpi }) => comparisonMap.get(kpi.id)?.prevYear !== null);

  // Build list of KPIs that need attention (off track OR significantly declined)
  const attentionKpis = allKPIsWithEntries
    .map(({ kpi, latestEntry, effectiveTarget }) => {
      const status = getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget });
      const comparison = comparisonMap.get(kpi.id);
      const prevEntry = comparison?.prevMonth ?? null;
      const prevStatus = prevEntry ? getKPIStatus(prevEntry.value, kpi) : null;
      const statusOrder: Record<string, number> = { "green": 3, "yellow": 2, "red": 1, "no-data": 0 };
      const statusDeclined = prevStatus !== null && statusOrder[status] < statusOrder[prevStatus];
      return { kpi, latestEntry, prevEntry, status, statusDeclined, effectiveTarget };
    })
    .filter(({ status, statusDeclined }) => status === "red" || statusDeclined);

  // Auto-generate executive summary
  const summaryParts: string[] = [];
  if (totalRed > 0) summaryParts.push(`${totalRed} KPI berada di bawah target (Off Track)`);
  if (declined > 0) summaryParts.push(`${declined} KPI mengalami penurunan status dibanding bulan sebelumnya`);
  if (totalRed === 0 && declined === 0) summaryParts.push("Semua KPI stabil atau membaik bulan ini");
  if (improved > 0) summaryParts.push(`${improved} KPI mengalami peningkatan`);
  const executiveSummary = summaryParts.join(". ") + ".";

  // Build AI narrative request data
  const aiRequestData = {
    period: periodLabel,
    healthScore: healthPct,
    healthDelta,
    improved,
    declined,
    stable,
    avgAchievement,
    domains: domains.map((d) => ({ name: d.name, description: d.description ?? "" })),
    kpis: allKPIsWithEntries.map(({ kpi, latestEntry, effectiveTarget }) => {
      const comparison = comparisonMap.get(kpi.id);
      const prevEntry = comparison?.prevMonth ?? null;
      const tgt = effectiveTarget ?? { target: kpi.target };
      const pct = getAchievementPct(latestEntry?.value, tgt.target, kpi.direction);
      const status = getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget });
      const domain = domains.find((d) => d.id === kpi.domainId);
      return {
        name: kpi.name,
        description: kpi.description ?? "",
        domain: domain?.name ?? "",
        actual: latestEntry ? formatValue(latestEntry.value, kpi.unit) : "N/A",
        target: formatValue(tgt.target, kpi.unit),
        achievement: pct !== null ? `${pct}%` : "N/A",
        status: statusConfig[status].label,
        momDelta: prevEntry && latestEntry
          ? `${((latestEntry.value - prevEntry.value) / (prevEntry.value || 1) * 100).toFixed(1)}%`
          : "N/A",
        prevValue: prevEntry ? formatValue(prevEntry.value, kpi.unit) : "N/A",
        direction: kpi.direction === "lower_better" ? "semakin rendah semakin baik" : "semakin tinggi semakin baik",
      };
    }),
  };

  const byDomain = domains.map((domain) => ({
    domain,
    kpis: allKPIsWithEntries.filter((k) => k.kpi.domainId === domain.id),
  })).filter(({ kpis }) => kpis.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground p-8 max-w-5xl mx-auto print:p-4 print:max-w-full print:bg-white print:text-black text-sm">
      {/* Header */}
      <header className="border-b-2 border-foreground pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Executive KPI Report</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Laporan performa seluruh KPI organisasi</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Periode: <strong className="text-foreground">{periodLabel}</strong></p>
            <p>Dicetak: {printDate}</p>
          </div>
        </div>

        {/* Global summary */}
        <div className="mt-4 flex flex-wrap gap-6 items-center">
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />{totalGreen} On Track</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />{totalYellow} At Risk</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />{totalRed} Off Track</span>
            {totalNoData > 0 && <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-3 h-3 rounded-full bg-muted-foreground/30 inline-block" />{totalNoData} No Data</span>}
            <span className="text-muted-foreground">{total} KPI total</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">Health Score</span>
            <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: `${healthPct}%` }} />
            </div>
            <span className={`text-sm font-bold ${healthPct >= 80 ? "text-green-600 dark:text-green-400" : healthPct >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
              {healthPct}%
            </span>
          </div>
        </div>

        {/* Period comparison overview */}
        {(healthDelta !== null || prevTotal > 0) && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {/* Health Score Change */}
            <div className="border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Dibanding {prevMonthLabel}</p>
              {healthDelta !== null ? (
                <p className={`text-lg font-bold ${healthDelta > 0 ? "text-green-600 dark:text-green-400" : healthDelta < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                  {healthDelta > 0 ? "+" : ""}{healthDelta}%
                  <span className="text-xs font-normal text-muted-foreground ml-1">health score</span>
                </p>
              ) : (
                <p className="text-lg font-bold text-muted-foreground">—</p>
              )}
            </div>

            {/* Status Movement */}
            <div className="border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Pergerakan Status</p>
              {prevTotal > 0 ? (
                <div className="flex items-baseline gap-2">
                  {improved > 0 && <span className="text-lg font-bold text-green-600 dark:text-green-400">{improved} <span className="text-xs font-normal">naik</span></span>}
                  {declined > 0 && <span className="text-lg font-bold text-red-600 dark:text-red-400">{declined} <span className="text-xs font-normal">turun</span></span>}
                  {improved === 0 && declined === 0 && <span className="text-lg font-bold text-muted-foreground">{stable} <span className="text-xs font-normal">tetap</span></span>}
                  {(improved > 0 || declined > 0) && stable > 0 && <span className="text-xs text-muted-foreground">{stable} tetap</span>}
                </div>
              ) : (
                <p className="text-lg font-bold text-muted-foreground">—</p>
              )}
            </div>

            {/* Avg Achievement */}
            <div className="border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Rata-rata Pencapaian</p>
              {avgAchievement !== null ? (
                <p className="text-lg font-bold">
                  {avgAchievement}%
                  {achievementDelta !== null && achievementDelta !== 0 && (
                    <span className={`text-xs font-normal ml-1 ${achievementDelta > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      ({achievementDelta > 0 ? "+" : ""}{achievementDelta}%)
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-lg font-bold text-muted-foreground">—</p>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Executive Summary — AI Narrative or static fallback */}
      <ReportAINarrative staticSummary={executiveSummary} requestData={aiRequestData} />

      {selectedPeriod && (
        <ReportActionPlans rows={actionPlanRows} periodDate={selectedPeriod} />
      )}

      {/* KPIs that need attention */}
      {attentionKpis.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <h2 className="font-bold text-sm text-red-800 dark:text-red-300 mb-2">Perlu Perhatian</h2>
          <div className="space-y-2">
            {attentionKpis.map(({ kpi, latestEntry, prevEntry, status, effectiveTarget }) => {
              const tgt = effectiveTarget ?? { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };
              return (
                <div key={kpi.id} className="flex items-start gap-2 text-sm">
                  <span className={`inline-block w-2 h-2 rounded-full mt-1.5 shrink-0 ${status === "red" ? "bg-red-500" : "bg-yellow-400"}`} />
                  <div>
                    <span className="font-medium">{kpi.name}</span>
                    <span className="text-muted-foreground">
                      {" — "}aktual {latestEntry ? formatValue(latestEntry.value, kpi.unit) : "—"}
                      {" "}dari target {formatValue(tgt.target, kpi.unit)}
                      {prevEntry && (
                        <span> (bulan lalu: {formatValue(prevEntry.value, kpi.unit)})</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-domain sections */}
      {byDomain.map(({ domain, kpis }) => {
        const dGreen = kpis.filter(({ kpi, latestEntry, effectiveTarget }) => getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget }) === "green").length;
        const dRed = kpis.filter(({ kpi, latestEntry, effectiveTarget }) => getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget }) === "red").length;

        return (
          <section key={domain.id} className="mb-8 break-inside-avoid-page">
            {/* Domain header */}
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: domain.color }} />
                <h2 className="font-bold text-base">{domain.name}</h2>
                {domain.description && <span className="text-muted-foreground text-xs">— {domain.description}</span>}
              </div>
              <span className="text-xs text-muted-foreground">{kpis.length} KPI · {dGreen} on track{dRed > 0 ? ` · ${dRed} off track` : ""}</span>
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1.5 pr-3 font-medium">KPI</th>
                  <th className="text-right py-1.5 px-2 font-medium">Aktual</th>
                  <th className="text-right py-1.5 px-2 font-medium">Target</th>
                  <th className="text-right py-1.5 px-2 font-medium">%</th>
                  <th className="text-center py-1.5 pl-2 font-medium">Status</th>
                  <th className="text-center py-1.5 px-2 font-medium">vs {prevMonthLabel}</th>
                  {hasAnyYoY && <th className="text-center py-1.5 px-2 font-medium">YoY</th>}
                  <th className="text-center py-1.5 pl-2 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {kpis.map(({ kpi, latestEntry, effectiveTarget, sparklineEntries }) => {
                  const tgt = effectiveTarget ?? { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };
                  const status = getKPIStatus(latestEntry?.value, { ...kpi, ...tgt });
                  const pct = getAchievementPct(latestEntry?.value, tgt.target, kpi.direction);
                  const cfg = statusConfig[status];
                  const dot = status === "green" ? "bg-green-500" : status === "yellow" ? "bg-yellow-400" : status === "red" ? "bg-red-500" : "bg-muted-foreground/30";

                  return (
                    <tr key={kpi.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-1.5 pr-3">
                        <span className="font-medium">{kpi.name}</span>
                      </td>
                      <td className="text-right py-1.5 px-2 font-semibold">
                        {latestEntry ? formatValue(latestEntry.value, kpi.unit) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="text-right py-1.5 px-2 text-muted-foreground">{formatValue(tgt.target, kpi.unit)}</td>
                      <td className="text-right py-1.5 px-2">{pct !== null ? `${pct}%` : "—"}</td>
                      <td className="py-1.5 pl-2">
                        <span className="flex items-center justify-center gap-1">
                          <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                          <span className="text-xs">{cfg.label}</span>
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <ReportDelta
                          currentValue={latestEntry?.value ?? null}
                          compareEntry={comparisonMap.get(kpi.id)?.prevMonth ?? null}
                          unit={kpi.unit}
                          lowerBetter={kpi.direction === "lower_better"}
                          showPrevValue
                        />
                      </td>
                      {hasAnyYoY && (
                        <td className="py-1.5 px-2 text-center">
                          <ReportDelta
                            currentValue={latestEntry?.value ?? null}
                            compareEntry={comparisonMap.get(kpi.id)?.prevYear ?? null}
                            unit={kpi.unit}
                            lowerBetter={kpi.direction === "lower_better"}
                          />
                        </td>
                      )}
                      <td className="py-1.5 pl-2 text-center">
                        <ReportSparkline entries={sparklineEntries} status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-border text-xs text-muted-foreground flex justify-between">
        <span>Executive KPI Report</span>
        <span>Generated {printDate}</span>
      </footer>

      {/* Controls (screen only) */}
      <div className="mt-8 flex gap-3 items-center print:hidden">
        <PrintButton />
        <a
          href={`/api/report/presentation?period=${selectedPeriod ?? ""}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          Presentasi
        </a>
        <ReportPeriodSelector months={months} selectedPeriod={selectedPeriod ?? ""} />
        <Link href="/" className="px-4 py-2 border text-sm rounded hover:bg-muted transition-colors">&larr; Overview</Link>
      </div>
    </div>
  );
}
