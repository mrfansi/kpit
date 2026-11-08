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
 * Readout utama layar: persen on-track sebagai angka terbesar, distribusi status
 * sebagai satu bar yang sekaligus legenda (proporsi = jumlah), total KPI di ujung.
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
    <div className="grid gap-x-8 gap-y-5 border-y py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      {onTrackPct !== null && (
        <div className="flex items-baseline gap-2.5 sm:block">
          <div className="num text-readout leading-none font-semibold tracking-tight">{onTrackPct}%</div>
          <div className="text-sm text-muted-foreground sm:mt-1.5">on track</div>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-3 sm:border-l sm:pl-8">
        <div className="flex h-3 gap-0.5 overflow-hidden bg-secondary">
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
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {ORDER.map((s) =>
            counts[s] > 0 ? (
              <li key={s} className="flex items-center gap-1.5 text-sm">
                {/* Kunci legenda untuk segmen bar di atas, bukan titik dekoratif. */}
                <span aria-hidden className={cn("size-2.5 shrink-0", statusConfig[s].solid)} />
                <span className={cn("num font-semibold", statusConfig[s].color)}>{counts[s]}</span>
                <span className="text-muted-foreground">{statusConfig[s].label}</span>
              </li>
            ) : null
          )}
        </ul>
      </div>

      <div className="flex items-baseline gap-2 sm:border-l sm:pl-8">
        <span className="num text-3xl leading-none font-semibold tracking-tight">{total}</span>
        <span className="text-sm text-muted-foreground">KPI</span>
      </div>
    </div>
  );
}
