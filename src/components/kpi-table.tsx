import Link from "next/link";
import { differenceInMonths, parseISO } from "date-fns";
import { Clock, ListChecks, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { getAchievementPct, getKPIStatus, statusConfig, trendColor } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue } from "@/lib/period";
import { cn } from "@/lib/utils";
import { ReportSparkline } from "@/components/report/report-sparkline";
import { PinKPIButton } from "@/components/pin-kpi-button";
import { EmptyState } from "@/components/empty-state";
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
  /** Tombol pin hanya untuk admin; bagi viewer aksinya dijamin ditolak server. */
  canEdit?: boolean;
}

const STALE_THRESHOLD_MONTHS = 2;

/**
 * Satu KPI per baris. Menggantikan grid kartu: pada layar yang sama muat jauh
 * lebih banyak KPI, dan yang lebih penting — angkanya berbaris dalam kolom,
 * jadi bisa dibandingkan dengan menyapu mata ke bawah, bukan melompat antar kartu.
 */
export function KPITable({
  rows,
  actionCounts,
  emptyMessage,
  selectedPeriod,
  canEdit = false,
}: KPITableProps) {
  if (rows.length === 0) {
    return <EmptyState compact title={emptyMessage} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <Th className="pl-0 text-left">KPI</Th>
            <Th className="text-right">Nilai</Th>
            <Th className="hidden text-right sm:table-cell">Target</Th>
            <Th className="hidden w-44 text-left sm:table-cell">Pencapaian</Th>
            <Th className="hidden w-24 text-right md:table-cell">Tren</Th>
            <Th className="hidden w-32 lg:table-cell">12 bulan</Th>
            {canEdit && <Th className="w-10" />}
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
                className="group border-b transition-colors duration-[var(--dur-micro)] last:border-0 hover:bg-paper-2"
              >
                {/* Status dibawa readout-nya sendiri (isi gauge + persen berwarna),
                    bukan rail tebal di tepi baris. */}
                {/* w-full + max-w-0: kolom nama mengambil sisa lebar dan memotong deskripsi
                    di dalam selnya sendiri, tidak meluber ke bawah kolom nilai. */}
                <td className="w-full max-w-0 py-3 pr-4 pl-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/kpi/${kpi.id}`}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {kpi.name}
                    </Link>
                    {isStale && (
                      <span title="Data sudah lama, belum diperbarui">
                        <Clock aria-label="Data sudah lama" className="size-3.5 text-muted-foreground" />
                      </span>
                    )}
                    {activeActions > 0 && (
                      <Link
                        href={`/kpi/${kpi.id}#actions`}
                        className="inline-flex items-center gap-1 rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground transition-colors duration-[var(--dur-micro)] hover:text-foreground"
                        title={`${activeActions} action plan aktif`}
                      >
                        <ListChecks aria-hidden className="size-3" />
                        <span className="num">{activeActions}</span>
                      </Link>
                    )}
                  </div>
                  {kpi.description && (
                    <p className="mt-1 max-w-md truncate text-sm text-muted-foreground" title={kpi.description}>
                      {kpi.description}
                    </p>
                  )}
                  <span className={cn("mt-1 inline-block text-xs font-semibold sm:hidden", cfg.color)}>{cfg.label}</span>
                </td>

                <td className="py-3 pr-4 text-right whitespace-nowrap">
                  <div className="num text-lg leading-tight font-semibold">
                    {value !== null ? formatValue(value, kpi.unit) : <Empty />}
                  </div>
                  {isFromOtherPeriod && (
                    <div className="num mt-0.5 text-xs text-muted-foreground">
                      per {formatPeriodDate(latestEntry!.periodDate, "MMM yyyy")}
                    </div>
                  )}
                  {/* Di ponsel kolom gauge disembunyikan; persennya pindah ke bawah nilai. */}
                  {pct !== null && (
                    <div className={cn("num mt-0.5 text-xs font-semibold sm:hidden", cfg.color)}>{pct}%</div>
                  )}
                </td>

                <td className="num hidden py-3 pr-4 text-right whitespace-nowrap text-muted-foreground sm:table-cell">
                  {formatValue(targetData.target, kpi.unit)}
                </td>

                <td className="hidden py-3 pr-4 sm:table-cell">
                  {pct !== null ? (
                    <Gauge pct={pct} fill={cfg.solid} textColor={cfg.color} />
                  ) : (
                    <Empty />
                  )}
                </td>

                <td className="hidden py-3 pr-4 text-right md:table-cell">
                  {trend ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-sm font-semibold",
                        trendColor(trend, kpi.direction)
                      )}
                    >
                      <TrendIcon aria-hidden className="size-3.5" />
                      {delta !== null && delta !== 0 && (
                        <span className="num">
                          {delta > 0 ? "+" : "−"}
                          {formatDelta(Math.abs(delta))}
                        </span>
                      )}
                    </span>
                  ) : (
                    <Empty />
                  )}
                </td>

                <td className="hidden py-2 pr-2 lg:table-cell">
                  {/* Dekoratif: angka yang dibandingkan sudah tertulis di sel sebelahnya. */}
                  <div className="w-28">
                    {sparklineEntries.length >= 2 ? (
                      <ReportSparkline entries={sparklineEntries} status={status} width={112} height={28} />
                    ) : null}
                  </div>
                </td>

                {canEdit && (
                  <td className="py-3 text-right">
                    <PinKPIButton id={kpi.id} isPinned={kpi.isPinned} />
                  </td>
                )}
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
    <th scope="col" className={cn("px-0 pr-4 pb-2.5 font-normal whitespace-nowrap", className)}>
      {children}
    </th>
  );
}

/** Sel tanpa bacaan. Tanda hubung biasa, bukan em dash; teks alternatif untuk pembaca layar. */
function Empty() {
  return (
    <span className="text-muted-foreground" aria-label="Tidak ada data">
      -
    </span>
  );
}

function formatDelta(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

/** Skala 0–125% dengan takik di 100%, supaya melampaui target terlihat. */
const GAUGE_MAX_PCT = 125;

/** Ujung persegi dan takik setinggi baris: dibaca seperti skala instrumen. */
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
