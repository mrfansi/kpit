import { formatValue } from "@/lib/period";
import { trendColor } from "@/lib/kpi-status";
import type { KPIEntry } from "@/lib/db/schema";

interface ReportDeltaProps {
  currentValue: number | null;
  compareEntry: KPIEntry | null;
  unit: string;
  lowerBetter?: boolean;
  /** Show previous value alongside delta: "+3.2% (dari 94%)" */
  showPrevValue?: boolean;
}

export function ReportDelta({ currentValue, compareEntry, unit, lowerBetter, showPrevValue }: ReportDeltaProps) {
  if (currentValue === null || !compareEntry) {
    return <span className="text-muted-foreground">-</span>;
  }

  const diff = currentValue - compareEntry.value;

  if (diff === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const pct = compareEntry.value !== 0
    ? Math.abs((diff / compareEntry.value) * 100).toFixed(1)
    : null;
  const isUp = diff > 0;
  const color = trendColor(isUp ? "up" : "down", lowerBetter ? "lower_better" : "higher_better");
  // Tanda (+ / minus tipografis) membawa arah, juga di cetakan hitam-putih.
  const sign = isUp ? "+" : "\u2212";

  return (
    <span className="whitespace-nowrap">
      <span className={`num font-semibold ${color}`}>
        {sign}{pct !== null ? `${pct}%` : Math.abs(diff)}
      </span>
      {showPrevValue && (
        <span className="num text-muted-foreground"> (dari {formatValue(compareEntry.value, unit)})</span>
      )}
    </span>
  );
}
