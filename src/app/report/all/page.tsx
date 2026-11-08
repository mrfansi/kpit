import { getAllDomains, getKPIsWithLatestEntry, getBatchPeriodComparison, getReportActionPlansWithKPI, getTargetResolver } from "@/lib/queries";
import { getAchievementPct, getKPIStatus, statusConfig, trendColor } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue, listLastNMonths, defaultReportingPeriod, shiftMonth } from "@/lib/period";
import { formatDayLong } from "@/lib/date-utils";
import { PrintButton } from "@/components/print-button";
import { ReportPeriodSelector } from "@/components/report-period-selector";
import { ReportSparkline } from "@/components/report/report-sparkline";
import { ReportDelta } from "@/components/report/report-delta";
import { ReportAINarrative } from "@/components/report/report-ai-narrative";
import { ReportActionPlans } from "@/components/report/report-action-plans";
import { MarkdownExportDialog } from "@/components/report/markdown-export-dialog";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { auth } from "@/auth";

export const metadata: Metadata = { title: "Executive Report: Semua Domain" };

interface Props {
  searchParams: Promise<{ period?: string }>;
}

export default async function ExecutiveReportPage({ searchParams }: Props) {
  const { period } = await searchParams;
  const months = listLastNMonths(24);
  const selectedPeriod = period ?? defaultReportingPeriod();
  const periodLabel = selectedPeriod ? formatPeriodDate(selectedPeriod, "MMMM yyyy") : "-";

  // Previous month label for display
  const prevMonthLabel = selectedPeriod
    ? formatPeriodDate(shiftMonth(selectedPeriod, -1), "MMM yy")
    : null;

  const [domains, allKPIsWithEntries, actionPlanRows, session, prevTargetOf] = await Promise.all([
    getAllDomains(),
    getKPIsWithLatestEntry(undefined, selectedPeriod),
    getReportActionPlansWithKPI(),
    auth(),
    getTargetResolver(),
  ]);
  const isAdmin = session?.user.role === "admin";

  // Previous-month status must use that month's override, not the current one (one query, resolved in memory).
  const kpiIds = allKPIsWithEntries.map(({ kpi }) => kpi.id);
  const comparisonMap = selectedPeriod
    ? await getBatchPeriodComparison(kpiIds, selectedPeriod)
    : new Map();

  const printDate = formatDayLong();

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
      const prevStatus = getKPIStatus(prevEntry.value, { ...kpi, ...prevTargetOf(kpi, prevEntry.periodDate) });
      if (prevStatus === "green") prevGreen++;

      const prevTarget = prevTargetOf(kpi, prevEntry.periodDate);
      const prevAch = getAchievementPct(prevEntry.value, prevTarget.target, kpi.direction);
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
      const prevStatus = prevEntry ? getKPIStatus(prevEntry.value, { ...kpi, ...prevTargetOf(kpi, prevEntry.periodDate) }) : null;
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

  const counts = [
    { key: "green", n: totalGreen },
    { key: "yellow", n: totalYellow },
    { key: "red", n: totalRed },
  ] as const;
  const healthStatus = healthPct >= 80 ? "green" : healthPct >= 50 ? "yellow" : "red";
  const th = "py-2 pr-4 text-sm font-normal whitespace-nowrap text-muted-foreground";

  return (
    // Kolom dokumen: dibaca dan dicetak untuk rapat CEO. Cetak memakai lebar penuh, tanpa latar.
    <div className="mx-auto max-w-5xl space-y-10 print:max-w-full">
      {/* Kepala dokumen + readout utama */}
      <header className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Executive KPI Report</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Laporan performa seluruh KPI organisasi</p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Periode: <strong className="num font-semibold text-foreground">{periodLabel}</strong></span>
              <span>Dicetak: <span className="num">{printDate}</span></span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <ReportPeriodSelector months={months} selectedPeriod={selectedPeriod ?? ""} />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft aria-hidden />
                Overview
              </Link>
            </Button>
            <PrintButton />
            {selectedPeriod && <MarkdownExportDialog period={selectedPeriod} domains={domains.map((domain) => ({ slug: domain.slug, name: domain.name }))} />}
            {isAdmin && (
              <Button size="sm" asChild>
                <Link href={`/admin/reports/monthly?period=${selectedPeriod}`}>Susun laporan bulanan</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Readout: health score terbesar, sebaran status sebagai angka berwarna status, total di ujung. */}
        <div className="grid gap-x-8 gap-y-5 border-y py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
          <div className="space-y-2">
            <div className="flex items-baseline gap-2.5">
              <span className={cn("num text-readout leading-none font-semibold tracking-tight", statusConfig[healthStatus].color)}>
                {healthPct}%
              </span>
              <span className="text-sm text-muted-foreground">Health score</span>
            </div>
            {/* Gauge persegi: isi = porsi KPI on track. */}
            <div aria-hidden className="h-2 w-40 overflow-hidden bg-secondary">
              <div className={cn("h-full", statusConfig.green.solid)} style={{ width: `${healthPct}%` }} />
            </div>
          </div>

          <ul className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 text-sm sm:border-l sm:pl-8">
            {counts.map(({ key, n }) => (
              <li key={key} className="flex items-baseline gap-1.5">
                <span className={cn("num font-semibold", statusConfig[key].color)}>{n}</span>
                <span className="text-muted-foreground">{statusConfig[key].label}</span>
              </li>
            ))}
            {totalNoData > 0 && (
              <li className="flex items-baseline gap-1.5">
                <span className="num font-semibold text-muted-foreground">{totalNoData}</span>
                <span className="text-muted-foreground">No Data</span>
              </li>
            )}
          </ul>

          <div className="flex items-baseline gap-2 sm:border-l sm:pl-8">
            <span className="num text-3xl leading-none font-semibold tracking-tight">{total}</span>
            <span className="text-sm text-muted-foreground">KPI total</span>
          </div>
        </div>

        {/* Perbandingan periode: tiga angka berdampingan dipisah garis rambut, bukan kartu. */}
        {(healthDelta !== null || prevTotal > 0) && (
          <dl className="grid gap-y-4 sm:grid-cols-3 sm:divide-x">
            <div className="space-y-1 sm:pr-6">
              <dt className="text-sm text-muted-foreground">Dibanding <span className="num">{prevMonthLabel}</span></dt>
              <dd className="flex items-baseline gap-1.5">
                {healthDelta !== null ? (
                  <>
                    <span className={cn("num text-xl font-semibold", healthDelta > 0 ? trendColor("up") : healthDelta < 0 ? trendColor("down") : "text-muted-foreground")}>
                      {healthDelta > 0 ? "+" : healthDelta < 0 ? "\u2212" : ""}{Math.abs(healthDelta)}%
                    </span>
                    <span className="text-sm text-muted-foreground">health score</span>
                  </>
                ) : (
                  <Empty />
                )}
              </dd>
            </div>

            <div className="space-y-1 sm:px-6">
              <dt className="text-sm text-muted-foreground">Pergerakan status</dt>
              <dd className="flex flex-wrap items-baseline gap-x-3">
                {prevTotal > 0 ? (
                  <>
                    {improved > 0 && <span className="flex items-baseline gap-1"><span className={cn("num text-xl font-semibold", trendColor("up"))}>{improved}</span><span className="text-sm text-muted-foreground">naik</span></span>}
                    {declined > 0 && <span className="flex items-baseline gap-1"><span className={cn("num text-xl font-semibold", trendColor("down"))}>{declined}</span><span className="text-sm text-muted-foreground">turun</span></span>}
                    {improved === 0 && declined === 0 && <span className="flex items-baseline gap-1"><span className="num text-xl font-semibold text-muted-foreground">{stable}</span><span className="text-sm text-muted-foreground">tetap</span></span>}
                    {(improved > 0 || declined > 0) && stable > 0 && <span className="text-sm text-muted-foreground"><span className="num">{stable}</span> tetap</span>}
                  </>
                ) : (
                  <Empty />
                )}
              </dd>
            </div>

            <div className="space-y-1 sm:pl-6">
              <dt className="text-sm text-muted-foreground">Rata-rata pencapaian</dt>
              <dd className="flex items-baseline gap-1.5">
                {avgAchievement !== null ? (
                  <>
                    <span className="num text-xl font-semibold">{avgAchievement}%</span>
                    {achievementDelta !== null && achievementDelta !== 0 && (
                      <span className={cn("num text-sm font-semibold", achievementDelta > 0 ? trendColor("up") : trendColor("down"))}>
                        ({achievementDelta > 0 ? "+" : "\u2212"}{Math.abs(achievementDelta)}%)
                      </span>
                    )}
                  </>
                ) : (
                  <Empty />
                )}
              </dd>
            </div>
          </dl>
        )}
      </header>

      {/* Executive Summary: AI Narrative or static fallback */}
      {session ? (
        <ReportAINarrative staticSummary={executiveSummary} requestData={aiRequestData} />
      ) : (
        <section aria-labelledby="report-summary-heading" className="space-y-3 break-inside-avoid-page">
          <h2 id="report-summary-heading" className="text-lg font-semibold">Ringkasan</h2>
          <p className="max-w-[65ch] text-base text-foreground">{executiveSummary}</p>
        </section>
      )}

      {selectedPeriod && (
        <ReportActionPlans rows={actionPlanRows} periodDate={selectedPeriod} />
      )}

      {/* KPIs that need attention */}
      {attentionKpis.length > 0 && (
        <section aria-labelledby="report-attention-heading" className="space-y-3 break-inside-avoid-page">
          <h2 id="report-attention-heading" className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle aria-hidden className={cn("size-4", statusConfig.red.color)} />
            Perlu perhatian
          </h2>
          <ul className="divide-y border-y">
            {attentionKpis.map(({ kpi, latestEntry, prevEntry, status, effectiveTarget }) => {
              const tgt = effectiveTarget ?? { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };
              return (
                <li key={kpi.id} className="flex flex-col gap-x-4 gap-y-0.5 py-2.5 text-sm sm:flex-row sm:items-baseline">
                  <span className="flex items-baseline gap-2 sm:w-72 sm:shrink-0">
                    <span className="font-semibold">{kpi.name}</span>
                    <span className={cn("text-sm whitespace-nowrap", statusConfig[status].color)}>{statusConfig[status].label}</span>
                  </span>
                  <span className="num text-muted-foreground">
                    aktual {latestEntry ? formatValue(latestEntry.value, kpi.unit) : "-"}
                    {" "}dari target {formatValue(tgt.target, kpi.unit)}
                    {prevEntry && (
                      <span> (bulan lalu: {formatValue(prevEntry.value, kpi.unit)})</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3 print:hidden" aria-label="Laporan bulanan per domain">
        <div>
          <h2 className="text-lg font-semibold">Laporan bulanan per divisi</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pilih domain untuk melihat laporan tersimpan dan menetapkan divisinya secara eksplisit.</p>
        </div>
        <ul className="divide-y border-y">
          {domains.map((domain) => <li key={domain.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <span className="font-semibold">{domain.name}</span>
            <span className="flex gap-4">
              <Link className="underline underline-offset-4" href={`/report/${encodeURIComponent(domain.slug)}?period=${selectedPeriod}`}>Lihat</Link>
              {isAdmin && <Link className="underline underline-offset-4" href={`/admin/reports/monthly/${encodeURIComponent(domain.slug)}?period=${selectedPeriod}`}>Sunting</Link>}
            </span>
          </li>)}
        </ul>
      </section>

      {/* Per-domain sections */}
      {byDomain.map(({ domain, kpis }) => {
        const dGreen = kpis.filter(({ kpi, latestEntry, effectiveTarget }) => getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget }) === "green").length;
        const dRed = kpis.filter(({ kpi, latestEntry, effectiveTarget }) => getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget }) === "red").length;

        return (
          <section key={domain.id} aria-labelledby={`report-domain-${domain.id}`} className="space-y-3 break-inside-avoid-page">
            {/* Domain header */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {/* Warna identitas domain (bukan status), kunci persegi kecil. */}
                  <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: domain.color }} />
                  <h2 id={`report-domain-${domain.id}`} className="text-lg font-semibold">{domain.name}</h2>
                </div>
                {domain.description && <p className="mt-1 text-sm text-muted-foreground">{domain.description}</p>}
              </div>
              <span className="num text-sm text-muted-foreground">{kpis.length} KPI, {dGreen} on track{dRed > 0 ? `, ${dRed} off track` : ""}</span>
            </div>

            {/* Tanpa pembungkus ini tabel lebar menggeser seluruh halaman di ponsel. */}
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className={cn(th, "text-left")}>KPI</th>
                  <th className={cn(th, "text-right")}>Aktual</th>
                  <th className={cn(th, "hidden text-right sm:table-cell print:table-cell")}>Target</th>
                  <th className={cn(th, "hidden text-right sm:table-cell print:table-cell")}>%</th>
                  <th className={cn(th, "text-left")}>Status</th>
                  <th className={cn(th, "hidden text-right md:table-cell print:table-cell")}>vs <span className="num">{prevMonthLabel}</span></th>
                  {hasAnyYoY && <th className={cn(th, "hidden text-right md:table-cell print:table-cell")}>YoY</th>}
                  <th className={cn(th, "hidden pr-0 text-left lg:table-cell print:table-cell")}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {kpis.map(({ kpi, latestEntry, effectiveTarget, sparklineEntries }) => {
                  const tgt = effectiveTarget ?? { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };
                  const status = getKPIStatus(latestEntry?.value, { ...kpi, ...tgt });
                  const pct = getAchievementPct(latestEntry?.value, tgt.target, kpi.direction);
                  const cfg = statusConfig[status];

                  return (
                    <tr key={kpi.id} className="border-b transition-colors duration-[var(--dur-micro)] last:border-b-0 hover:bg-paper-2 print:hover:bg-transparent">
                      <td className="py-2.5 pr-4 font-semibold">{kpi.name}</td>
                      <td className="num py-2.5 pr-4 text-right font-semibold whitespace-nowrap">
                        {latestEntry ? formatValue(latestEntry.value, kpi.unit) : <Empty />}
                      </td>
                      <td className="num hidden py-2.5 pr-4 text-right whitespace-nowrap text-muted-foreground sm:table-cell print:table-cell">{formatValue(tgt.target, kpi.unit)}</td>
                      <td className="num hidden py-2.5 pr-4 text-right whitespace-nowrap sm:table-cell print:table-cell">{pct !== null ? `${pct}%` : <Empty />}</td>
                      <td className={cn("py-2.5 pr-4 whitespace-nowrap", cfg.color)}>{cfg.label}</td>
                      <td className="hidden py-2.5 pr-4 text-right md:table-cell print:table-cell">
                        <ReportDelta
                          currentValue={latestEntry?.value ?? null}
                          compareEntry={comparisonMap.get(kpi.id)?.prevMonth ?? null}
                          unit={kpi.unit}
                          lowerBetter={kpi.direction === "lower_better"}
                          showPrevValue
                        />
                      </td>
                      {hasAnyYoY && (
                        <td className="hidden py-2.5 pr-4 text-right md:table-cell print:table-cell">
                          <ReportDelta
                            currentValue={latestEntry?.value ?? null}
                            compareEntry={comparisonMap.get(kpi.id)?.prevYear ?? null}
                            unit={kpi.unit}
                            lowerBetter={kpi.direction === "lower_better"}
                          />
                        </td>
                      )}
                      <td className="hidden py-1.5 lg:table-cell print:table-cell">
                        <ReportSparkline entries={sparklineEntries} status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </section>
        );
      })}

      {/* Footer */}
      <footer className="flex flex-wrap justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
        <span>Executive KPI Report</span>
        <span>Generated <span className="num">{printDate}</span></span>
      </footer>
    </div>
  );
}

/** Nilai kosong: tanda hubung biasa, redup. */
function Empty() {
  return <span className="text-muted-foreground">-</span>;
}
