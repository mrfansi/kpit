import { notFound } from "next/navigation";
import { getKPIById, getKPIEntries } from "@/lib/queries";
import { getAchievementPct, getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue, getPeriodRange, shiftMonth } from "@/lib/period";
import { TrendChart } from "@/components/trend-chart-lazy";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Target, TrendingUp, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { DeleteEntryButton } from "@/components/delete-entry-button";
import { EditEntryDialog } from "@/components/edit-entry-dialog";
import { EmptyState } from "@/components/empty-state";
import { getKPITargets, getKPIComments, getDomainById, getKPIsWithLatestEntry, getKPIActionPlans } from "@/lib/queries";
import { PeriodComparison } from "@/components/period-comparison";
import { KPIComments } from "@/components/kpi-comments";
import { KPIActionPlans } from "@/components/kpi-action-plans";
import { KPIEarlyWarning } from "@/components/kpi-early-warning";
import { computeForecast } from "@/lib/forecast";
import { KPIAIAnalysis } from "@/components/kpi-ai-analysis";
import { auth } from "@/auth";
import { canAccessAdminRoute } from "@/lib/admin-access";
import { KPITargetSuggestion } from "@/components/kpi-target-suggestion";
import { getKPIEarlyWarning } from "@/lib/kpi-warning";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; forecast?: string; page?: string }>;
}

const RANGE_OPTIONS = [
  { label: "3 bulan", value: "3" },
  { label: "6 bulan", value: "6" },
  { label: "12 bulan", value: "12" },
];

export default async function KPIDetailPage({ params, searchParams }: Props) {
  const [{ id }, { range, forecast: forecastParam, page }] = await Promise.all([params, searchParams]);
  const kpiId = Number(id);
  if (isNaN(kpiId)) notFound();

  const kpi = await getKPIById(kpiId);
  if (!kpi) notFound();

  const rangeMonths = Number(range ?? "6");
  const validRange = [3, 6, 12].includes(rangeMonths) ? rangeMonths : 6;
  const showForecast = forecastParam === "1";
  const PAGE_SIZE = 12;
  const currentPage = Math.max(1, Number(page ?? "1"));

  const { from, to } = getPeriodRange(validRange);
  // Everything below depends only on kpiId / kpi.domainId, so it runs in one round trip.
  const [allEntries, allTargetOverrides, comments, actionPlans, session, domain, siblingKPIs] = await Promise.all([
    getKPIEntries(kpiId),
    getKPITargets(kpiId),
    getKPIComments(kpiId),
    getKPIActionPlans(kpiId),
    auth(),
    getDomainById(kpi.domainId),
    getKPIsWithLatestEntry(kpi.domainId),
  ]);
  const canEdit = canAccessAdminRoute(session?.user?.role);

  const entries = allEntries.filter((e) => e.periodDate >= from && e.periodDate <= to);
  const latestEntry = allEntries.length > 0 ? allEntries[allEntries.length - 1] : null;

  // MoM / YoY: tepat bulan sebelumnya dan tahun sebelumnya, dari entry yang sudah dimuat.
  const entryAt = (periodDate: string) => allEntries.find((e) => e.periodDate === periodDate) ?? null;
  const comparison = latestEntry
    ? { prevMonth: entryAt(shiftMonth(latestEntry.periodDate, -1)), prevYear: entryAt(shiftMonth(latestEntry.periodDate, -12)) }
    : { prevMonth: null, prevYear: null };
  const previousEntryForWarning = allEntries.length >= 2 ? allEntries[allEntries.length - 2] : null;

  // Build lookup map: periodDate → target override
  const targetOverrideMap = new Map(allTargetOverrides.map((t) => [t.periodDate, t]));

  const effectiveTarget = latestEntry
    ? (targetOverrideMap.get(latestEntry.periodDate) ?? { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow })
    : { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };

  const status = getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget });
  const achievementPct = getAchievementPct(latestEntry?.value, effectiveTarget.target, kpi.direction);
  const cfg = statusConfig[status];
  const earlyWarning = getKPIEarlyWarning({
    kpi: { ...kpi, ...effectiveTarget },
    latestEntry,
    previousEntry: previousEntryForWarning,
  });

  // Gunakan semua data historis untuk forecast agar konsisten di semua range
  const forecastPoints = showForecast
    ? computeForecast(allEntries, 3, {
        min: kpi.minValue,
        max: kpi.maxValue,
        allowNegative: kpi.direction === "lower_better",
      })
    : [];

  // Anomaly detection: flag if latest value deviates > 2 stddev from historical mean
  const historicalValues = allEntries.slice(0, -1).map((e) => e.value); // exclude latest
  let isAnomalous = false;
  let anomalyDir: "high" | "low" = "high";
  if (historicalValues.length >= 4 && latestEntry) {
    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const stdDev = Math.sqrt(historicalValues.map((v) => (v - mean) ** 2).reduce((a, b) => a + b, 0) / historicalValues.length);
    if (stdDev > 0 && Math.abs(latestEntry.value - mean) > 2 * stdDev) {
      isAnomalous = true;
      anomalyDir = latestEntry.value > mean ? "high" : "low";
    }
  }

  // Build AI analysis request data
  const analysisRequestData = {
    name: kpi.name,
    description: kpi.description || "",
    domain: domain?.name || "Umum",
    unit: kpi.unit,
    direction: kpi.direction,
    history: allEntries.map((e) => {
      const override = targetOverrideMap.get(e.periodDate);
      const entryTarget = override ?? { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };
      const pct = getAchievementPct(e.value, entryTarget.target, kpi.direction);
      return {
        periodDate: e.periodDate,
        value: e.value,
        target: entryTarget.target,
        achievement: pct !== null ? `${pct}%` : "N/A",
      };
    }),
    siblings: siblingKPIs
      .filter(({ kpi: s }) => s.id !== kpi.id)
      .map(({ kpi: s, latestEntry: sLatest, effectiveTarget: sTarget }) => {
        const sStatus = getKPIStatus(sLatest?.value, { ...s, ...sTarget });
        const pct = sLatest
          ? getAchievementPct(sLatest.value, sTarget.target, s.direction)
          : null;
        return {
          name: s.name,
          status: statusConfig[sStatus].label,
          achievement: pct !== null ? `${pct}%` : "N/A",
          trend: "stabil",
        };
      }),
  };

  // Pagination for history table (all entries, newest first)
  const allEntriesSorted = [...allEntries].reverse();
  const totalPages = Math.ceil(allEntriesSorted.length / PAGE_SIZE);
  const pagedEntries = allEntriesSorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Readout: angka besar, satuan dipisah dan diredam (kecuali % dan Rp yang menempel pada angka).
  const readout = latestEntry ? formatValue(latestEntry.value, kpi.unit) : null;
  const unitSuffix = readout && kpi.unit && readout.endsWith(` ${kpi.unit}`) ? kpi.unit : null;
  const readoutFigure = readout && unitSuffix ? readout.slice(0, -(unitSuffix.length + 1)) : readout;

  return (
    <div className="space-y-10">
      {/* Kepala layar + readout: satu objek, angka terbesar di layar. */}
      <div className="space-y-8">
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-[var(--dur-micro)] hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Kembali ke Overview
          </Link>
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">{kpi.name}</h1>
            {kpi.description && <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{kpi.description}</p>}
            <p className="mt-1 text-sm text-muted-foreground">
              Tipe refresh: {kpi.refreshType === "realtime" ? "Real-time" : "Periodik"}
            </p>
          </header>
        </div>

        <section aria-label="Nilai terkini" className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6 border-b pb-8">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Nilai terkini</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-2">
              {readoutFigure ? (
                <span className="num text-readout leading-none font-semibold">{readoutFigure}</span>
              ) : (
                <span className="num text-readout leading-none font-semibold text-muted-foreground" aria-label="Tidak ada data">
                  -
                </span>
              )}
              {unitSuffix && <span className="text-lg text-muted-foreground">{unitSuffix}</span>}
              <span className="ml-4 text-sm text-muted-foreground">
                Target (periode ini) <span className="num">{formatValue(effectiveTarget.target, kpi.unit)}</span>
              </span>
            </div>
            <p className={cn("mt-3 text-sm font-semibold", cfg.color)}>{cfg.label}</p>
          </div>
          <div className="w-full max-w-sm">
            <p className="mb-2.5 text-sm text-muted-foreground">Pencapaian</p>
            {achievementPct !== null ? (
              <Gauge pct={achievementPct} fill={cfg.solid} textColor={cfg.color} />
            ) : (
              <Empty />
            )}
          </div>
        </section>

        {isAnomalous && (
          <div className="flex items-start gap-3 rounded-card bg-warning-soft px-4 py-3 text-sm text-warning">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong className="font-semibold">Anomali terdeteksi:</strong> Nilai terkini secara signifikan lebih{" "}
              {anomalyDir === "high" ? "tinggi" : "rendah"} dari rata-rata historis (&gt;2 standar deviasi).
              Pastikan data sudah benar.
            </span>
          </div>
        )}
      </div>

      {/* Tren + perbandingan periode */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Tren historis</h2>
          <div className="flex flex-wrap items-center gap-1 print:hidden">
            {RANGE_OPTIONS.map((opt) => {
              const active = String(validRange) === opt.value;
              return (
                <Button key={opt.value} variant={active ? "secondary" : "ghost"} size="sm" asChild>
                  <Link
                    href={`?range=${opt.value}${showForecast ? "&forecast=1" : ""}`}
                    aria-current={active ? "true" : undefined}
                    className="num"
                  >
                    {opt.label}
                  </Link>
                </Button>
              );
            })}
            <Button variant={showForecast ? "secondary" : "outline"} size="sm" className="ml-2" asChild>
              <Link
                href={`?range=${validRange}${showForecast ? "" : "&forecast=1"}`}
                aria-current={showForecast ? "true" : undefined}
              >
                <TrendingUp aria-hidden />
                Forecast
              </Link>
            </Button>
          </div>
        </div>
        <TrendChart
          entries={entries}
          unit={kpi.unit}
          target={effectiveTarget.target}
          forecastPoints={forecastPoints}
        />
        {showForecast && forecastPoints.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <span aria-hidden className="mr-1.5 inline-block w-6 border-t-2 border-dashed border-[var(--chart-3)] align-middle" />
            Proyeksi 3 bulan ke depan berdasarkan regresi linear historis
          </p>
        )}
        <PeriodComparison
          kpi={kpi}
          current={latestEntry}
          prevMonth={comparison.prevMonth}
          prevYear={comparison.prevYear}
        />
      </section>

      {/* Riwayat data */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Riwayat data
            {allEntriesSorted.length > 0 && (
              <span className="num ml-2 text-sm font-normal text-muted-foreground">
                ({allEntriesSorted.length} entri)
              </span>
            )}
          </h2>
          {canEdit && (
            <Button variant="outline" size="sm" asChild className="print:hidden">
              <Link href={`/admin/kpi/${kpi.id}/targets`}>
                <Target aria-hidden />
                Atur target periode
              </Link>
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <Th className="text-left">Periode</Th>
                <Th className="text-right">Nilai aktual</Th>
                <Th className="hidden text-right sm:table-cell">Target</Th>
                <Th className="text-right">Pencapaian</Th>
                <Th className="hidden text-left sm:table-cell">Status</Th>
                <Th className="hidden text-left md:table-cell">Catatan</Th>
                {canEdit && (
                  <Th className="relative w-20 print:hidden">
                    <span className="sr-only">Aksi</span>
                  </Th>
                )}
              </tr>
            </thead>
            <tbody>
              {pagedEntries.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState compact title="Belum ada data" />
                  </td>
                </tr>
              ) : (
                pagedEntries.map((entry) => {
                  const override = targetOverrideMap.get(entry.periodDate);
                  const entryTarget = override ?? { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };
                  const s = getKPIStatus(entry.value, { ...kpi, ...entryTarget });
                  const pct = getAchievementPct(entry.value, entryTarget.target, kpi.direction);
                  const c = statusConfig[s];
                  return (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="num py-2.5 pr-4 whitespace-nowrap">{formatPeriodDate(entry.periodDate, "MMMM yyyy")}</td>
                      <td className="num py-2.5 pr-4 text-right font-semibold whitespace-nowrap">
                        {formatValue(entry.value, kpi.unit)}
                        {/* Di ponsel kolom Target disembunyikan; targetnya (dan tanda *) pindah ke bawah nilai. */}
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground sm:hidden">
                          target {formatValue(entryTarget.target, kpi.unit)}
                          {override && <span className="ml-0.5 text-foreground">*</span>}
                        </span>
                      </td>
                      <td className="num hidden py-2.5 pr-4 text-right whitespace-nowrap text-muted-foreground sm:table-cell">
                        {formatValue(entryTarget.target, kpi.unit)}
                        {override && <span className="ml-1 text-xs text-foreground">*</span>}
                      </td>
                      <td className={cn("num py-2.5 pr-4 text-right font-semibold whitespace-nowrap", c.color)}>
                        {pct !== null ? `${pct}%` : <Empty />}
                      </td>
                      <td className="hidden py-2.5 pr-4 sm:table-cell">
                        <span className={cn("inline-flex rounded-sm px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap", c.bg, c.color)}>
                          {c.label}
                        </span>
                      </td>
                      <td className="hidden max-w-64 py-2.5 pr-4 md:table-cell">
                        {entry.note ? (
                          <span className="block truncate text-muted-foreground" title={entry.note}>{entry.note}</span>
                        ) : (
                          <Empty />
                        )}
                      </td>
                      {canEdit && (
                        <td className="py-1.5 print:hidden">
                          <div className="flex items-center justify-end gap-0.5">
                            <EditEntryDialog
                              id={entry.id}
                              currentValue={entry.value}
                              currentNote={entry.note}
                              unit={kpi.unit}
                              period={formatPeriodDate(entry.periodDate, "MMMM yyyy")}
                            />
                            <DeleteEntryButton id={entry.id} kpiId={kpi.id} period={formatPeriodDate(entry.periodDate, "MMMM yyyy")} />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Halaman <span className="num">{currentPage}</span> dari <span className="num">{totalPages}</span>
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" asChild disabled={currentPage <= 1}>
                <Link
                  href={`?range=${validRange}&page=${currentPage - 1}${showForecast ? "&forecast=1" : ""}`}
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft aria-hidden />
                </Link>
              </Button>
              <Button variant="outline" size="icon-sm" asChild disabled={currentPage >= totalPages}>
                <Link
                  href={`?range=${validRange}&page=${currentPage + 1}${showForecast ? "&forecast=1" : ""}`}
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        )}
        {allTargetOverrides.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">*</span> Target khusus periode ini (override dari default)
          </p>
        )}
      </section>

      {/* Early warning berdiri tepat di atas action plan: sarannya adalah draf untuk form di bawahnya. */}
      <KPIEarlyWarning warning={earlyWarning} />

      <KPIActionPlans kpiId={kpi.id} initialActions={actionPlans} suggestion={earlyWarning?.suggestedAction ?? null} canEdit={canEdit} />

      {/* Analisis AI + saran target AI */}
      <section className="space-y-4">
        {session?.user && <KPIAIAnalysis requestData={analysisRequestData} />}
        {canEdit && <KPITargetSuggestion
          kpiName={kpi.name}
          unit={kpi.unit}
          direction={kpi.direction}
          currentTarget={effectiveTarget.target}
          thresholdGreen={effectiveTarget.thresholdGreen}
          thresholdYellow={effectiveTarget.thresholdYellow}
          history={allEntries.map((e) => {
            const override = targetOverrideMap.get(e.periodDate);
            const entryTarget = override ?? { target: kpi.target };
            const pct = getAchievementPct(e.value, entryTarget.target, kpi.direction);
            return {
              periodDate: e.periodDate,
              value: e.value,
              target: entryTarget.target,
              achievementPct: pct ?? 0,
            };
          })}
        />}
      </section>

      {/* Komentar */}
      {latestEntry && (
        <KPIComments
          kpiId={kpi.id}
          periodDate={latestEntry.periodDate}
          periodLabel={formatPeriodDate(latestEntry.periodDate, "MMMM yyyy")}
          initialComments={comments}
          canEdit={canEdit}
          availablePeriods={[...allEntries].reverse().map((e) => ({
            value: e.periodDate,
            label: formatPeriodDate(e.periodDate, "MMMM yyyy"),
          }))}
        />
      )}
    </div>
  );
}

function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <th scope="col" className={cn("px-0 pr-4 pb-2.5 font-normal whitespace-nowrap", className)}>
      {children}
    </th>
  );
}

/** Tanpa bacaan. Tanda hubung biasa, bukan em dash; teks alternatif untuk pembaca layar. */
function Empty() {
  return (
    <span className="text-muted-foreground" aria-label="Tidak ada data">
      -
    </span>
  );
}

/** Skala 0–125% dengan takik di 100%, sama dengan gauge di tabel KPI Overview. */
const GAUGE_MAX_PCT = 125;

function Gauge({ pct, fill, textColor }: { pct: number; fill: string; textColor: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 w-full min-w-16 bg-secondary">
        <div
          className={cn("h-2", fill)}
          style={{ width: `${Math.min((pct / GAUGE_MAX_PCT) * 100, 100)}%` }}
        />
        <span
          aria-hidden
          className="absolute -top-1 h-4 w-px bg-foreground"
          style={{ left: `${(100 / GAUGE_MAX_PCT) * 100}%` }}
        />
      </div>
      <span className={cn("num w-12 shrink-0 text-right text-sm font-semibold", textColor)}>
        {pct}%
      </span>
    </div>
  );
}
