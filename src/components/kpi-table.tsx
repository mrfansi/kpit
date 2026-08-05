import Link from "next/link";
import { differenceInMonths, parseISO } from "date-fns";
import { Clock, ListChecks, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { getAchievementPct, getKPIStatus, statusConfig, trendColor } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue } from "@/lib/period";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/sparkline";
import { PinKPIButton } from "@/components/pin-kpi-button";
import type { KPI, KPIEntry } from "@/lib/db/schema";

export interface KPIRowData {
  kpi: KPI;
  latestEntry: KPIEntry | null;
  sparklineEntries?: KPIEntry[];
  effectiveTarget?: { target: number; thresholdGreen: number; thresholdYellow: number };
}

interface KPITableProps {
  rows: KPIRowData[];
  actionCounts: Map<number, number>;
  emptyMessage: string;
  /**
   * Periode yang sedang dilihat. Nilai KPI diambil dari entry terakhir
   * pada-atau-sebelum periode ini, jadi angkanya bisa berasal dari periode lain —
   * kalau itu terjadi, periode asalnya harus ditulis, bukan disembunyikan.
   */
  selectedPeriod?: string;
}

const STALE_THRESHOLD_MONTHS = 2;

/**
 * Satu KPI per baris. Menggantikan grid kartu: pada layar yang sama muat jauh
 * lebih banyak KPI, dan yang lebih penting — angkanya berbaris dalam kolom,
 * jadi bisa dibandingkan dengan menyapu mata ke bawah, bukan melompat antar kartu.
 */
export function KPITable({ rows, actionCounts, emptyMessage, selectedPeriod }: KPITableProps) {
  if (rows.length === 0) {
    return <p className="px-3 py-6 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <Th className="pl-3 text-left">KPI</Th>
            <Th className="text-right">Nilai</Th>
            <Th className="hidden text-right sm:table-cell">Target</Th>
            <Th className="w-36 text-left">Pencapaian</Th>
            <Th className="hidden w-24 text-right md:table-cell">Tren</Th>
            <Th className="hidden w-28 lg:table-cell">12 bulan</Th>
            <Th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ kpi, latestEntry, sparklineEntries = [], effectiveTarget }) => {
            const value = latestEntry?.value ?? null;
            const targetData = effectiveTarget ?? {
              target: kpi.target,
              thresholdGreen: kpi.thresholdGreen,
              thresholdYellow: kpi.thresholdYellow,
            };
            const status = getKPIStatus(value, { ...kpi, ...targetData });
            const cfg = statusConfig[status];
            const pct = getAchievementPct(value, targetData.target, kpi.direction);
            const activeActions = actionCounts.get(kpi.id) ?? 0;

            const isStale = latestEntry
              ? differenceInMonths(new Date(), parseISO(latestEntry.periodDate)) >=
                STALE_THRESHOLD_MONTHS
              : false;

            // Angkanya bukan dari periode yang sedang dilihat — katakan terus terang.
            const isFromOtherPeriod = Boolean(
              latestEntry && selectedPeriod && latestEntry.periodDate !== selectedPeriod
            );

            const prev =
              sparklineEntries.length >= 2 ? sparklineEntries[sparklineEntries.length - 2] : null;
            const trend =
              value !== null && prev
                ? value > prev.value
                  ? "up"
                  : value < prev.value
                    ? "down"
                    : "flat"
                : null;
            const delta = value !== null && prev ? value - prev.value : null;
            const TrendIcon =
              trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

            return (
              <tr
                key={kpi.id}
                className="group border-b transition-colors last:border-0 hover:bg-accent/50"
              >
                {/* Rail status menempel di sel pertama, BUKAN di <tr>: memberi
                    position:relative pada <tr> bersama border-collapse merusak
                    perhitungan lebar kolom di Chrome (sel pertama tergeser dan
                    kolom lain ikut runtuh). */}
                <td
                  className={cn(
                    "relative py-2.5 pl-3",
                    "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
                    cfg.rail
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/kpi/${kpi.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {kpi.name}
                    </Link>
                    {isStale && (
                      <span title="Data sudah lama, belum diperbarui">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                    )}
                    {activeActions > 0 && (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground"
                        title={`${activeActions} action plan aktif`}
                      >
                        <ListChecks className="h-3 w-3" />
                        <span className="num">{activeActions}</span>
                      </span>
                    )}
                  </div>
                  <span className={cn("text-xs sm:hidden", cfg.color)}>{cfg.label}</span>
                </td>

                <td className="py-2.5 text-right whitespace-nowrap">
                  <div className="num font-semibold">
                    {value !== null ? formatValue(value, kpi.unit) : "—"}
                  </div>
                  {isFromOtherPeriod && (
                    <div className="num text-xs text-muted-foreground">
                      per {formatPeriodDate(latestEntry!.periodDate, "MMM yyyy")}
                    </div>
                  )}
                </td>

                <td className="num hidden py-2.5 text-right whitespace-nowrap text-muted-foreground sm:table-cell">
                  {formatValue(targetData.target, kpi.unit)}
                </td>

                <td className="py-2.5 pr-2 pl-2">
                  {pct !== null ? (
                    <Gauge pct={pct} fill={cfg.solid} textColor={cfg.color} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>

                <td className="hidden py-2.5 text-right md:table-cell">
                  {trend ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-xs font-medium",
                        trendColor(trend, kpi.direction)
                      )}
                    >
                      <TrendIcon className="h-3.5 w-3.5" />
                      {delta !== null && delta !== 0 && (
                        <span className="num">
                          {delta > 0 ? "+" : "−"}
                          {formatDelta(Math.abs(delta))}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>

                <td className="hidden py-1.5 pr-2 lg:table-cell">
                  {/* Lebar eksplisit: ResponsiveContainer tidak punya lebar
                      intrinsik, jadi di kolom tabel auto-width ia runtuh. */}
                  <div className="w-24">
                    {sparklineEntries.length >= 2 ? (
                      <Sparkline entries={sparklineEntries} status={status} height={28} />
                    ) : null}
                  </div>
                </td>

                <td className="py-2.5 pr-2">
                  <PinKPIButton id={kpi.id} isPinned={kpi.isPinned} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <th scope="col" className={cn("px-2 py-2 font-medium", className)}>
      {children}
    </th>
  );
}

function formatDelta(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

/** Skala 0–125% dengan takik di 100%, supaya melampaui target terlihat. */
const GAUGE_MAX_PCT = 125;

function Gauge({ pct, fill, textColor }: { pct: number; fill: string; textColor: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-full min-w-12 rounded-full bg-secondary">
        <div
          className={cn("h-1.5 rounded-full", fill)}
          style={{ width: `${Math.min((pct / GAUGE_MAX_PCT) * 100, 100)}%` }}
        />
        <span
          aria-hidden
          className="absolute -top-0.5 h-2.5 w-px bg-foreground/40"
          style={{ left: `${(100 / GAUGE_MAX_PCT) * 100}%` }}
        />
      </div>
      <span className={cn("num w-10 shrink-0 text-right text-xs font-medium", textColor)}>
        {pct}%
      </span>
    </div>
  );
}
