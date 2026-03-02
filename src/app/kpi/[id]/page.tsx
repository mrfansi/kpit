import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getKPIById, getKPIEntries, getLatestEntry } from "@/lib/queries";
import { getAchievementPct, getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue, getPeriodRange } from "@/lib/period";
import { TrendChart } from "@/components/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Target } from "lucide-react";
import Link from "next/link";
import { DeleteEntryButton } from "@/components/delete-entry-button";
import { getEffectiveTarget, getKPITargets } from "@/lib/queries";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}

const RANGE_OPTIONS = [
  { label: "3 Bulan", value: "3" },
  { label: "6 Bulan", value: "6" },
  { label: "12 Bulan", value: "12" },
];

export default async function KPIDetailPage({ params, searchParams }: Props) {
  const [{ id }, { range }] = await Promise.all([params, searchParams]);
  const kpiId = Number(id);
  if (isNaN(kpiId)) notFound();

  const kpi = await getKPIById(kpiId);
  if (!kpi) notFound();

  const rangeMonths = Number(range ?? "6");
  const validRange = [3, 6, 12].includes(rangeMonths) ? rangeMonths : 6;

  const { from, to } = getPeriodRange(validRange);
  const [latestEntry, entries, allTargetOverrides] = await Promise.all([
    getLatestEntry(kpiId),
    getKPIEntries(kpiId, from, to),
    getKPITargets(kpiId),
  ]);

  // Build lookup map: periodDate → target override
  const targetOverrideMap = new Map(allTargetOverrides.map((t) => [t.periodDate, t]));

  const effectiveTarget = latestEntry
    ? (targetOverrideMap.get(latestEntry.periodDate) ?? { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow })
    : { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };

  const status = getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget });
  const achievementPct = getAchievementPct(latestEntry?.value, effectiveTarget.target);
  const cfg = statusConfig[status];

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

      {/* Trend Chart dengan range selector */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Tren Historis</CardTitle>
          <div className="flex gap-1 print:hidden">
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={String(validRange) === opt.value ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 px-2.5"
                asChild
              >
                <Link href={`?range=${opt.value}`}>{opt.label}</Link>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <TrendChart entries={entries} unit={kpi.unit} target={kpi.target} />
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Riwayat Data</CardTitle>
          <Button variant="outline" size="sm" asChild className="print:hidden">
            <Link href={`/admin/kpi/${kpi.id}/targets`}>
              <Target className="w-3.5 h-3.5 mr-1.5" />
              Atur Target Periode
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
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
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Belum ada data</TableCell>
                </TableRow>
              ) : (
                [...entries].reverse().map((entry) => {
                  const override = targetOverrideMap.get(entry.periodDate);
                  const entryTarget = override ?? { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };
                  const s = getKPIStatus(entry.value, { ...kpi, ...entryTarget });
                  const pct = getAchievementPct(entry.value, entryTarget.target);
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
                      <TableCell className="print:hidden text-right">
                        <DeleteEntryButton id={entry.id} kpiId={kpi.id} period={formatPeriodDate(entry.periodDate, "MMMM yyyy")} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {allTargetOverrides.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              <span className="text-primary font-medium">*</span> Target khusus periode ini (override dari default)
            </p>
          )}
        </CardContent>
      </Card>
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
