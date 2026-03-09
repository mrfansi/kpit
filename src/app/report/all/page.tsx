import { getAllDomains, getKPIsWithLatestEntry, getBatchPeriodComparison } from "@/lib/queries";
import { getAchievementPct, getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue, listLastNMonths } from "@/lib/period";
import { PrintButton } from "@/components/print-button";
import { ReportPeriodSelector } from "@/components/report-period-selector";
import { ReportSparkline } from "@/components/report/report-sparkline";
import { ReportDelta } from "@/components/report/report-delta";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Executive Report — Semua Domain" };

interface Props {
  searchParams: Promise<{ period?: string }>;
}

export default async function ExecutiveReportPage({ searchParams }: Props) {
  const { period } = await searchParams;
  const months = listLastNMonths(24);
  const selectedPeriod = period ?? months[0]?.value;
  const periodLabel = selectedPeriod ? formatPeriodDate(selectedPeriod, "MMMM yyyy") : "—";

  const domains = await getAllDomains();
  const allKPIsWithEntries = await getKPIsWithLatestEntry(undefined, selectedPeriod);

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

  const byDomain = domains.map((domain) => ({
    domain,
    kpis: allKPIsWithEntries.filter((k) => k.kpi.domainId === domain.id),
  })).filter(({ kpis }) => kpis.length > 0);

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-5xl mx-auto print:p-4 print:max-w-full text-sm">
      {/* Header */}
      <header className="border-b-2 border-black pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Executive KPI Report</h1>
            <p className="text-gray-500 text-sm mt-0.5">Laporan performa seluruh KPI organisasi</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Periode: <strong className="text-black">{periodLabel}</strong></p>
            <p>Dicetak: {printDate}</p>
          </div>
        </div>

        {/* Global summary */}
        <div className="mt-4 flex flex-wrap gap-6 items-center">
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />{totalGreen} On Track</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />{totalYellow} At Risk</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />{totalRed} Off Track</span>
            {totalNoData > 0 && <span className="flex items-center gap-1.5 text-gray-400"><span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />{totalNoData} No Data</span>}
            <span className="text-gray-400">{total} KPI total</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">Health Score</span>
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: `${healthPct}%` }} />
            </div>
            <span className={`text-sm font-bold ${healthPct >= 80 ? "text-green-600" : healthPct >= 50 ? "text-yellow-600" : "text-red-600"}`}>
              {healthPct}%
            </span>
          </div>
        </div>

        {/* Period comparison overview */}
        {(healthDelta !== null || prevTotal > 0) && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            {healthDelta !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Health Score:</span>
                <span className={healthDelta > 0 ? "text-green-600 font-semibold" : healthDelta < 0 ? "text-red-600 font-semibold" : "text-gray-500"}>
                  {healthDelta > 0 ? "\u2191" : healthDelta < 0 ? "\u2193" : "\u2014"} {healthDelta > 0 ? "+" : ""}{healthDelta}pp vs prev
                </span>
              </div>
            )}
            {prevTotal > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Movement:</span>
                {improved > 0 && <span className="text-green-600 font-semibold">{improved} improved</span>}
                {declined > 0 && <span className="text-red-600 font-semibold">{declined} declined</span>}
                {stable > 0 && <span className="text-gray-500">{stable} stable</span>}
              </div>
            )}
            {achievementDelta !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Avg Achievement:</span>
                <span className={achievementDelta > 0 ? "text-green-600 font-semibold" : achievementDelta < 0 ? "text-red-600 font-semibold" : "text-gray-500"}>
                  {avgAchievement}% ({achievementDelta > 0 ? "+" : ""}{achievementDelta}pp)
                </span>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Per-domain sections */}
      {byDomain.map(({ domain, kpis }) => {
        const dGreen = kpis.filter(({ kpi, latestEntry, effectiveTarget }) => getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget }) === "green").length;
        const dRed = kpis.filter(({ kpi, latestEntry, effectiveTarget }) => getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget }) === "red").length;

        return (
          <section key={domain.id} className="mb-8 break-inside-avoid-page">
            {/* Domain header */}
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-300">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: domain.color }} />
                <h2 className="font-bold text-base">{domain.name}</h2>
                {domain.description && <span className="text-gray-400 text-xs">— {domain.description}</span>}
              </div>
              <span className="text-xs text-gray-500">{kpis.length} KPI · {dGreen} on track{dRed > 0 ? ` · ${dRed} off track` : ""}</span>
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-left py-1.5 pr-3 font-medium">KPI</th>
                  <th className="text-right py-1.5 px-2 font-medium">Aktual</th>
                  <th className="text-right py-1.5 px-2 font-medium">Target</th>
                  <th className="text-right py-1.5 px-2 font-medium">%</th>
                  <th className="text-center py-1.5 pl-2 font-medium">Status</th>
                  <th className="text-center py-1.5 px-2 font-medium">MoM</th>
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
                  const dot = status === "green" ? "bg-green-500" : status === "yellow" ? "bg-yellow-400" : status === "red" ? "bg-red-500" : "bg-gray-300";

                  return (
                    <tr key={kpi.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-1.5 pr-3">
                        <span className="font-medium">{kpi.name}</span>
                      </td>
                      <td className="text-right py-1.5 px-2 font-semibold">
                        {latestEntry ? formatValue(latestEntry.value, kpi.unit) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="text-right py-1.5 px-2 text-gray-400">{formatValue(tgt.target, kpi.unit)}</td>
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
      <footer className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
        <span>Executive KPI Report</span>
        <span>Generated {printDate}</span>
      </footer>

      {/* Controls (screen only) */}
      <div className="mt-8 flex gap-3 items-center print:hidden">
        <PrintButton />
        <ReportPeriodSelector months={months} selectedPeriod={selectedPeriod ?? ""} />
        <a href="/" className="px-4 py-2 border text-sm rounded hover:bg-gray-50 transition-colors">← Overview</a>
      </div>
    </div>
  );
}
