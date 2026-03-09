import { formatValue } from "@/lib/period";
import type { KPIEntry } from "@/lib/db/schema";

interface ReportDeltaProps {
  currentValue: number | null;
  compareEntry: KPIEntry | null;
  unit: string;
  lowerBetter?: boolean;
  /** Show previous value alongside delta: "66% (dari 94%)" */
  showPrevValue?: boolean;
}

export function ReportDelta({ currentValue, compareEntry, unit, lowerBetter, showPrevValue }: ReportDeltaProps) {
  if (currentValue === null || !compareEntry) {
    return <span className="text-gray-300">—</span>;
  }

  const diff = currentValue - compareEntry.value;

  if (diff === 0) {
    return <span className="text-gray-400">—</span>;
  }

  const pct = compareEntry.value !== 0
    ? ((diff / compareEntry.value) * 100).toFixed(1)
    : null;
  const isUp = diff > 0;
  const isGood = lowerBetter ? !isUp : isUp;
  const color = isGood ? "text-green-600" : "text-red-600";
  const arrow = isUp ? "\u2191" : "\u2193";

  return (
    <span className={`whitespace-nowrap ${color}`}>
      {arrow} {pct !== null ? `${isUp ? "+" : ""}${pct}%` : `${isUp ? "+" : ""}${diff}`}
      {showPrevValue && (
        <span className="text-gray-400 font-normal"> (dari {formatValue(compareEntry.value, unit)})</span>
      )}
    </span>
  );
}
