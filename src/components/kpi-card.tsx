import { getAchievementPct, getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { formatValue } from "@/lib/period";
import type { KPI, KPIEntry } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/sparkline";
import Link from "next/link";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface KPICardProps {
  kpi: KPI;
  latestEntry: KPIEntry | null;
  sparklineEntries?: KPIEntry[];
  previousEntry?: KPIEntry | null;
}

export function KPICard({ kpi, latestEntry, sparklineEntries = [], previousEntry }: KPICardProps) {
  const value = latestEntry?.value ?? null;
  const status = getKPIStatus(value, kpi);
  const achievementPct = getAchievementPct(value, kpi.target);
  const cfg = statusConfig[status];

  // Gunakan entry kedua dari belakang di sparkline sebagai previousEntry jika tidak disediakan
  const prevEntry = previousEntry ?? (sparklineEntries.length >= 2 ? sparklineEntries[sparklineEntries.length - 2] : null);

  const trend =
    value !== null && prevEntry
      ? value > prevEntry.value ? "up" : value < prevEntry.value ? "down" : "flat"
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
            <Badge className={`${cfg.bg} ${cfg.color} border-0 shrink-0 text-xs`}>{cfg.label}</Badge>
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
                <TrendIcon
                  className={`w-4 h-4 mb-1 ${trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-gray-400"}`}
                />
              )}
            </div>

            {/* Target */}
            <div className="text-xs text-muted-foreground">
              Target: {formatValue(kpi.target, kpi.unit)}
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
