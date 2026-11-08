"use client";

import Link from "next/link";
import { Clock, ListChecks, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { getAchievementPct, getKPIStatus, statusConfig, trendColor } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue } from "@/lib/period";
import { cn } from "@/lib/utils";
import { ReportSparkline } from "@/components/report/report-sparkline";
import { PinKPIButton } from "@/components/pin-kpi-button";
import type { KPI } from "@/lib/db/schema";

/**
 * Bentuk baris yang dikirim server ke klien: hanya field yang dipakai untuk
 * render, supaya payload RSC tidak memuat seluruh baris KPI/entry dan pohon elemen per sel.
 */
export interface KPIRow {
  id: number;
  name: string;
  description: string | null;
  unit: KPI["unit"];
  direction: KPI["direction"];
  isPinned: boolean;
  /** Target efektif untuk periode terpilih (sudah memperhitungkan override). */
  target: number;
  thresholdGreen: number;
  thresholdYellow: number;
  latest: { value: number; periodDate: string } | null;
  sparkline: { value: number }[];
  actionCount: number;
  /** Dihitung di server (bergantung pada tanggal hari ini). */
  isStale: boolean;
}

interface KPITableRowsProps {
  rows: KPIRow[];
  selectedPeriod?: string;
  canEdit: boolean;
}

export function KPITableRows({ rows, selectedPeriod, canEdit }: KPITableRowsProps) {
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
          {rows.map((row) => {
            const { id, name, description, unit, direction, latest, sparkline, actionCount, isStale } = row;
            const value = latest?.value ?? null;
            const status = getKPIStatus(value, row);
            const cfg = statusConfig[status];
            const pct = getAchievementPct(value, row.target, direction);

            // Angkanya bukan dari periode yang sedang dilihat — katakan terus terang.
            const isFromOtherPeriod = Boolean(latest && selectedPeriod && latest.periodDate !== selectedPeriod);

            const prev = sparkline.length >= 2 ? sparkline[sparkline.length - 2] : null;
            const trend =
              value !== null && prev
                ? value > prev.value
                  ? "up"
                  : value < prev.value
                    ? "down"
                    : "flat"
                : null;
            const delta = value !== null && prev ? value - prev.value : null;
            const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

            return (
              <tr
                key={id}
                className="group border-b transition-colors duration-[var(--dur-micro)] last:border-0 hover:bg-paper-2"
              >
                {/* Status dibawa readout-nya sendiri (isi gauge + persen berwarna),
                    bukan rail tebal di tepi baris. */}
                {/* w-full + max-w-0: kolom nama mengambil sisa lebar dan memotong deskripsi
                    di dalam selnya sendiri, tidak meluber ke bawah kolom nilai. */}
                <td className="w-full max-w-0 py-3 pr-4 pl-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/kpi/${id}`} className="font-semibold underline-offset-4 hover:underline">
                      {name}
                    </Link>
                    {isStale && (
                      <span title="Data sudah lama, belum diperbarui">
                        <Clock aria-label="Data sudah lama" className="size-3.5 text-muted-foreground" />
                      </span>
                    )}
                    {actionCount > 0 && (
                      <Link
                        href={`/kpi/${id}#actions`}
                        className="inline-flex items-center gap-1 rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground transition-colors duration-[var(--dur-micro)] hover:text-foreground"
                        title={`${actionCount} action plan aktif`}
                      >
                        <ListChecks aria-hidden className="size-3" />
                        <span className="num">{actionCount}</span>
                      </Link>
                    )}
                  </div>
                  {description && (
                    <p className="mt-1 max-w-md truncate text-sm text-muted-foreground" title={description}>
                      {description}
                    </p>
                  )}
                  {/* Di desktop kolom gauge hanya angka; nama status tetap ada untuk pembaca layar. */}
                  <span className={cn("mt-1 inline-block text-xs font-semibold sm:sr-only", cfg.color)}>{cfg.label}</span>
                </td>

                <td className="py-3 pr-4 text-right whitespace-nowrap">
                  <div className="num text-lg leading-tight font-semibold">
                    {value !== null ? formatValue(value, unit) : <Empty />}
                  </div>
                  {isFromOtherPeriod && (
                    <div className="num mt-0.5 text-xs text-muted-foreground">
                      per {formatPeriodDate(latest!.periodDate, "MMM yyyy")}
                    </div>
                  )}
                  {/* Di ponsel kolom gauge disembunyikan; persennya pindah ke bawah nilai. */}
                  {pct !== null && (
                    <div className={cn("num mt-0.5 text-xs font-semibold sm:hidden", cfg.color)}>{pct}%</div>
                  )}
                </td>

                <td className="num hidden py-3 pr-4 text-right whitespace-nowrap text-muted-foreground sm:table-cell">
                  {formatValue(row.target, unit)}
                </td>

                <td className="hidden py-3 pr-4 sm:table-cell">
                  {pct !== null ? <Gauge pct={pct} fill={cfg.solid} textColor={cfg.color} /> : <Empty />}
                </td>

                <td className="hidden py-3 pr-4 text-right md:table-cell">
                  {trend ? (
                    <span
                      className={cn("inline-flex items-center gap-1 text-sm font-semibold", trendColor(trend, direction))}
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
                    {sparkline.length >= 2 ? (
                      <ReportSparkline entries={sparkline} status={status} width={112} height={28} />
                    ) : null}
                  </div>
                </td>

                {canEdit && (
                  <td className="py-3 text-right">
                    <PinKPIButton id={id} isPinned={row.isPinned} />
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
        <div className={cn("h-2", fill)} style={{ width: `${Math.min((pct / GAUGE_MAX_PCT) * 100, 100)}%` }} />
        <span
          aria-hidden
          className="absolute -top-1 h-4 w-px bg-foreground"
          style={{ left: `${(100 / GAUGE_MAX_PCT) * 100}%` }}
        />
      </div>
      <span className={cn("num w-12 shrink-0 text-right text-sm font-semibold", textColor)}>{pct}%</span>
    </div>
  );
}
