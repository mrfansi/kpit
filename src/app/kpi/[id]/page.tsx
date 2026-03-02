import { notFound } from "next/navigation";
import { getKPIById, getKPIEntries, getLatestEntry } from "@/lib/queries";
import { getAchievementPct, getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue, getPeriodRange } from "@/lib/period";
import { TrendChart } from "@/components/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function KPIDetailPage({ params }: Props) {
  const { id } = await params;
  const kpiId = Number(id);
  if (isNaN(kpiId)) notFound();

  const kpi = await getKPIById(kpiId);
  if (!kpi) notFound();

  const { from, to } = getPeriodRange(6);
  const [latestEntry, entries] = await Promise.all([
    getLatestEntry(kpiId),
    getKPIEntries(kpiId, from, to),
  ]);

  const status = getKPIStatus(latestEntry?.value, kpi);
  const achievementPct = getAchievementPct(latestEntry?.value, kpi.target);
  const cfg = statusConfig[status];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Overview
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{kpi.name}</h1>
          {kpi.description && <p className="text-muted-foreground text-sm mt-1">{kpi.description}</p>}
        </div>
        <Badge className={`${cfg.bg} ${cfg.color} border-0 text-sm`}>{cfg.label}</Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Nilai Terkini" value={latestEntry ? formatValue(latestEntry.value, kpi.unit) : "—"} />
        <StatCard label="Target" value={formatValue(kpi.target, kpi.unit)} />
        <StatCard label="Pencapaian" value={achievementPct !== null ? `${achievementPct}%` : "—"} />
        <StatCard label="Tipe Refresh" value={kpi.refreshType === "realtime" ? "Real-time" : "Periodik"} />
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tren 6 Bulan Terakhir</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart entries={entries} unit={kpi.unit} target={kpi.target} />
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Data</CardTitle>
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
                {/* note col only if any */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Belum ada data</TableCell>
                </TableRow>
              ) : (
                [...entries].reverse().map((entry) => {
                  const s = getKPIStatus(entry.value, kpi);
                  const pct = getAchievementPct(entry.value, kpi.target);
                  const c = statusConfig[s];
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>{formatPeriodDate(entry.periodDate, "MMMM yyyy")}</TableCell>
                      <TableCell className="text-right font-medium">{formatValue(entry.value, kpi.unit)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatValue(kpi.target, kpi.unit)}</TableCell>
                      <TableCell className="text-right">{pct !== null ? `${pct}%` : "—"}</TableCell>
                      <TableCell>
                        <Badge className={`${c.bg} ${c.color} border-0 text-xs`}>{c.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
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
