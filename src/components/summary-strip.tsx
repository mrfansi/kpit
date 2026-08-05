import { getKPIStatus, statusConfig, type KPIStatus } from "@/lib/kpi-status";
import type { KPI, KPIEntry } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

interface SummaryStripProps {
  kpisWithEntries: {
    kpi: KPI;
    latestEntry: KPIEntry | null;
    effectiveTarget?: { target: number; thresholdGreen: number; thresholdYellow: number };
  }[];
}

const ORDER: KPIStatus[] = ["green", "yellow", "red", "no-data"];

/**
 * Satu baris pengganti empat blok lama (chip status + health bar terpisah).
 * Bar-nya sekaligus jadi legenda: proporsi = jumlah, jadi angka dan grafik
 * tidak lagi mengulang informasi yang sama di dua tempat.
 */
export function SummaryStrip({ kpisWithEntries }: SummaryStripProps) {
  const counts: Record<KPIStatus, number> = { green: 0, yellow: 0, red: 0, "no-data": 0 };

  for (const { kpi, latestEntry, effectiveTarget } of kpisWithEntries) {
    const withTarget = effectiveTarget ? { ...kpi, ...effectiveTarget } : kpi;
    counts[getKPIStatus(latestEntry?.value, withTarget)]++;
  }

  const total = kpisWithEntries.length;
  if (total === 0) return null;

  const tracked = total - counts["no-data"];
  const onTrackPct = tracked > 0 ? Math.round((counts.green / tracked) * 100) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y py-3">
      <div className="flex items-baseline gap-2">
        <span className="num text-2xl font-semibold tracking-tight">{total}</span>
        <span className="text-sm text-muted-foreground">KPI</span>
      </div>

      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <div className="flex h-1.5 overflow-hidden rounded-full bg-secondary">
          {ORDER.map((s) =>
            counts[s] > 0 ? (
              <div
                key={s}
                className={cn("h-full", statusConfig[s].solid)}
                style={{ width: `${(counts[s] / total) * 100}%` }}
              />
            ) : null
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {ORDER.map((s) =>
            counts[s] > 0 ? (
              <span key={s} className="flex items-center gap-1.5 text-xs">
                <span className={cn("h-2 w-2 rounded-full", statusConfig[s].solid)} />
                <span className={cn("num font-semibold", statusConfig[s].color)}>{counts[s]}</span>
                <span className="text-muted-foreground">{statusConfig[s].label}</span>
              </span>
            ) : null
          )}
        </div>
      </div>

      {onTrackPct !== null && (
        <div className="text-right">
          <div className="num text-2xl font-semibold tracking-tight">{onTrackPct}%</div>
          <div className="text-xs text-muted-foreground">on track</div>
        </div>
      )}
    </div>
  );
}
