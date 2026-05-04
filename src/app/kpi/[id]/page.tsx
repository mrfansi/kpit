import { notFound } from "next/navigation";
import { getKPIById, getKPIEntries } from "@/lib/queries";
import { getAchievementPct, getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue, getPeriodRange } from "@/lib/period";
import { TrendChart } from "@/components/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Target, TrendingUp, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { DeleteEntryButton } from "@/components/delete-entry-button";
import { EditEntryDialog } from "@/components/edit-entry-dialog";
import { getKPITargets, getPeriodComparisonEntries, getKPIComments, getDomainById, getKPIsWithLatestEntry, getKPIActionPlans } from "@/lib/queries";
import { PeriodComparison } from "@/components/period-comparison";
import { KPIComments } from "@/components/kpi-comments";
import { KPIActionPlans } from "@/components/kpi-action-plans";
import { computeForecast } from "@/lib/forecast";
import { KPIAIAnalysis } from "@/components/kpi-ai-analysis";
import { KPITargetSuggestion } from "@/components/kpi-target-suggestion";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; forecast?: string; page?: string }>;
}

const RANGE_OPTIONS = [
  { label: "3 Bulan", value: "3" },
  { label: "6 Bulan", value: "6" },
  { label: "12 Bulan", value: "12" },
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
  // Fetch all entries once; derive range entries and latest from this
  const [allEntries, allTargetOverrides, comments, actionPlans] = await Promise.all([
    getKPIEntries(kpiId),
    getKPITargets(kpiId),
    getKPIComments(kpiId),
    getKPIActionPlans(kpiId),
  ]);

  // Fetch domain and sibling KPIs for AI analysis
  const [domain, siblingKPIs] = await Promise.all([
    getDomainById(kpi.domainId),
    getKPIsWithLatestEntry(kpi.domainId),
  ]);

  const entries = allEntries.filter((e) => e.periodDate >= from && e.periodDate <= to);
  const latestEntry = allEntries.length > 0 ? allEntries[allEntries.length - 1] : null;

  const comparison = latestEntry
    ? await getPeriodComparisonEntries(kpiId, latestEntry.periodDate)
    : { prevMonth: null, prevYear: null };

  // Build lookup map: periodDate → target override
  const targetOverrideMap = new Map(allTargetOverrides.map((t) => [t.periodDate, t]));

  const effectiveTarget = latestEntry
    ? (targetOverrideMap.get(latestEntry.periodDate) ?? { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow })
    : { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };

  const status = getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget });
  const achievementPct = getAchievementPct(latestEntry?.value, effectiveTarget.target, kpi.direction);
  const cfg = statusConfig[status];

  // Gunakan semua data historis untuk forecast agar konsisten di semua range
  const forecastPoints = showForecast ? computeForecast(allEntries) : [];

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

  return (
    <div className="space-y-6">
      <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Overview
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{kpi.name}</h1>
          {kpi.description && <p className="text-muted-foreground text-sm mt-1">{kpi.description}</p>}
        </div>
        <Badge className={`${cfg.bg} ${cfg.color} border-0 text-sm`}>{cfg.label}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Nilai Terkini" value={latestEntry ? formatValue(latestEntry.value, kpi.unit) : "—"} />
        <StatCard label="Target (periode ini)" value={formatValue(effectiveTarget.target, kpi.unit)} />
        <StatCard label="Pencapaian" value={achievementPct !== null ? `${achievementPct}%` : "—"} />
        <StatCard label="Tipe Refresh" value={kpi.refreshType === "realtime" ? "Real-time" : "Periodik"} />
      </div>

      {/* Anomaly alert */}
      {isAnomalous && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 text-orange-700 dark:text-orange-400 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>Anomali terdeteksi:</strong> Nilai terkini secara signifikan lebih{" "}
            {anomalyDir === "high" ? "tinggi" : "rendah"} dari rata-rata historis (&gt;2 standar deviasi).
            Pastikan data sudah benar.
          </span>
        </div>
      )}

      {/* Perbandingan periode */}
      <PeriodComparison
        kpi={kpi}
        current={latestEntry}
        prevMonth={comparison.prevMonth}
        prevYear={comparison.prevYear}
      />

      {/* Trend Chart dengan range selector */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Tren Historis</CardTitle>
          <div className="flex gap-1 print:hidden flex-wrap justify-end">
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={String(validRange) === opt.value ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 px-2.5"
                asChild
              >
                <Link href={`?range=${opt.value}${showForecast ? "&forecast=1" : ""}`}>{opt.label}</Link>
              </Button>
            ))}
            <Button
              variant={showForecast ? "default" : "outline"}
              size="sm"
              className="text-xs h-7 px-2.5 ml-1"
              asChild
            >
              <Link href={`?range=${validRange}${showForecast ? "" : "&forecast=1"}`}>
                <TrendingUp className="w-3 h-3 mr-1" />
                Forecast
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <TrendChart entries={entries} unit={kpi.unit} target={effectiveTarget.target} forecastPoints={forecastPoints} />
          {showForecast && forecastPoints.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              <span className="inline-block w-6 border-t-2 border-dashed border-[hsl(var(--chart-3))] mr-1.5 align-middle" />
              Proyeksi 3 bulan ke depan berdasarkan regresi linear historis
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI Root Cause Analysis */}
      <KPIAIAnalysis requestData={analysisRequestData} />

      {/* AI Target Suggestion */}
        <KPITargetSuggestion
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
        />

      <Card>
        <CardContent className="pt-5">
          <KPIActionPlans kpiId={kpi.id} initialActions={actionPlans} />
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            Riwayat Data
            {allEntriesSorted.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({allEntriesSorted.length} entri)
              </span>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" asChild className="print:hidden">
            <Link href={`/admin/kpi/${kpi.id}/targets`}>
              <Target className="w-3.5 h-3.5 mr-1.5" />
              Atur Target Periode
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periode</TableHead>
                <TableHead className="text-right">Nilai Aktual</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Pencapaian</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="print:hidden"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Belum ada data</TableCell>
                </TableRow>
              ) : (
                pagedEntries.map((entry) => {
                  const override = targetOverrideMap.get(entry.periodDate);
                  const entryTarget = override ?? { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };
                  const s = getKPIStatus(entry.value, { ...kpi, ...entryTarget });
                  const pct = getAchievementPct(entry.value, entryTarget.target, kpi.direction);
                  const c = statusConfig[s];
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>{formatPeriodDate(entry.periodDate, "MMMM yyyy")}</TableCell>
                      <TableCell className="text-right font-medium">{formatValue(entry.value, kpi.unit)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatValue(entryTarget.target, kpi.unit)}
                        {override && <span className="ml-1 text-xs text-primary">*</span>}
                      </TableCell>
                      <TableCell className="text-right">{pct !== null ? `${pct}%` : "—"}</TableCell>
                      <TableCell>
                        <Badge className={`${c.bg} ${c.color} border-0 text-xs`}>{c.label}</Badge>
                      </TableCell>
                      <TableCell className="print:hidden">
                        <div className="flex items-center justify-end gap-1">
                          <EditEntryDialog
                            id={entry.id}
                            currentValue={entry.value}
                            currentNote={entry.note}
                            unit={kpi.unit}
                            period={formatPeriodDate(entry.periodDate, "MMMM yyyy")}
                          />
                          <DeleteEntryButton id={entry.id} kpiId={kpi.id} period={formatPeriodDate(entry.periodDate, "MMMM yyyy")} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 text-sm">
              <span className="text-muted-foreground text-xs">
                Halaman {currentPage} dari {totalPages}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" asChild disabled={currentPage <= 1}>
                  <Link href={`?range=${validRange}&page=${currentPage - 1}${showForecast ? "&forecast=1" : ""}`}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Link>
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" asChild disabled={currentPage >= totalPages}>
                  <Link href={`?range=${validRange}&page=${currentPage + 1}${showForecast ? "&forecast=1" : ""}`}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
          {allTargetOverrides.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              <span className="text-primary font-medium">*</span> Target khusus periode ini (override dari default)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Komentar */}
      {latestEntry && (
        <Card>
          <CardContent className="pt-5">
            <KPIComments
              kpiId={kpi.id}
              periodDate={latestEntry.periodDate}
              periodLabel={formatPeriodDate(latestEntry.periodDate, "MMMM yyyy")}
              initialComments={comments}
              availablePeriods={[...allEntries].reverse().map((e) => ({
                value: e.periodDate,
                label: formatPeriodDate(e.periodDate, "MMMM yyyy"),
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
