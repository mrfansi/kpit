import { getAchievementPct, getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { formatValue } from "@/lib/period";
import type { KPI, KPIEntry } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/sparkline";
import { PinKPIButton } from "@/components/pin-kpi-button";
import Link from "next/link";
import { TrendingDown, TrendingUp, Minus, Clock } from "lucide-react";
import { differenceInMonths, parseISO } from "date-fns";

interface KPICardProps {
  kpi: KPI;
  latestEntry: KPIEntry | null;
  sparklineEntries?: KPIEntry[];
  previousEntry?: KPIEntry | null;
  effectiveTarget?: { target: number; thresholdGreen: number; thresholdYellow: number };
}

export function KPICard({ kpi, latestEntry, sparklineEntries = [], previousEntry, effectiveTarget }: KPICardProps) {
  const value = latestEntry?.value ?? null;
  // Gunakan effectiveTarget (per-periode) jika tersedia, fallback ke nilai default KPI
  const targetData = effectiveTarget ?? { target: kpi.target, thresholdGreen: kpi.thresholdGreen, thresholdYellow: kpi.thresholdYellow };
  const kpiWithTarget = { ...kpi, ...targetData };
  const status = getKPIStatus(value, kpiWithTarget);
  const achievementPct = getAchievementPct(value, targetData.target, kpi.direction);
  const cfg = statusConfig[status];

  const STALE_THRESHOLD_MONTHS = 2;
  const isStale = latestEntry
    ? differenceInMonths(new Date(), parseISO(latestEntry.periodDate)) >= STALE_THRESHOLD_MONTHS
    : false;

  // Gunakan entry kedua dari belakang di sparkline sebagai previousEntry jika tidak disediakan
  const prevEntry = previousEntry ?? (sparklineEntries.length >= 2 ? sparklineEntries[sparklineEntries.length - 2] : null);

  const trend =
    value !== null && prevEntry
      ? value > prevEntry.value ? "up" : value < prevEntry.value ? "down" : "flat"
      : null;

  const delta = value !== null && prevEntry ? value - prevEntry.value : null;
  // Tidak tampilkan delta jika nilainya 0 (sudah ditunjukkan oleh icon "—")
  const deltaFormatted = delta !== null && delta !== 0
    ? `${delta >= 0 ? "+" : ""}${Math.abs(delta) >= 1000 ? (delta / 1000).toFixed(1) + "k" : delta % 1 === 0 ? delta : delta.toFixed(1)}`
    : null;

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <Link href={`/kpi/${kpi.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">
              {kpi.name}
            </CardTitle>
            <div className="flex items-center gap-1 shrink-0">
              <PinKPIButton id={kpi.id} isPinned={kpi.isPinned} />
              {isStale && (
                <span title="Data sudah lama, belum diperbarui">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                </span>
              )}
              <Badge className={`${cfg.bg} ${cfg.color} border-0 text-xs`}>{cfg.label}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Nilai Aktual */}
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold">
                {value !== null ? formatValue(value, kpi.unit) : "—"}
              </span>
              {trend && (
                <div className={`flex items-center gap-0.5 mb-1 text-xs font-medium ${
                  trend === "flat" ? "text-gray-400"
                    : (trend === "up") !== (kpi.direction === "lower_better") ? "text-green-500" : "text-red-500"
                }`}>
                  <TrendIcon className="w-3.5 h-3.5" />
                  {deltaFormatted && <span>{deltaFormatted}</span>}
                </div>
              )}
            </div>

            {/* Target */}
            <div className="text-xs text-muted-foreground">
              Target: {formatValue(targetData.target, kpi.unit)}
              {effectiveTarget && effectiveTarget.target !== kpi.target && (
                <span className="ml-1 text-primary">(periode ini)</span>
              )}
            </div>

            {/* Progress bar */}
            {achievementPct !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Pencapaian</span>
                  <span className={`font-medium ${cfg.color}`}>{achievementPct}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${status === "green" ? "bg-green-500" : status === "yellow" ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(achievementPct, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Sparkline */}
            {sparklineEntries.length >= 2 && (
              <div className="-mx-1 pt-1">
                <Sparkline entries={sparklineEntries} status={status} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
