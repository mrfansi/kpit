import { formatValue } from "@/lib/period";
import type { KPIEntry } from "@/lib/db/schema";

interface ReportDeltaProps {
  currentValue: number | null;
  compareEntry: KPIEntry | null;
  unit: string;
  lowerBetter?: boolean;
}

export function ReportDelta({ currentValue, compareEntry, unit, lowerBetter }: ReportDeltaProps) {
  if (currentValue === null || !compareEntry) {
    return <span className="text-gray-300">—</span>;
  }

  const diff = currentValue - compareEntry.value;
  const pct = compareEntry.value !== 0 ? ((diff / compareEntry.value) * 100).toFixed(1) : null;
  const isUp = diff > 0;
  const isFlat = diff === 0;

  const arrow = isFlat ? "—" : isUp ? "\u2191" : "\u2193";
  const isGood = isFlat ? false : lowerBetter ? !isUp : isUp;
  const color = isFlat ? "text-gray-400" : isGood ? "text-green-600" : "text-red-600";

  return (
    <span className={`whitespace-nowrap ${color}`}>
      {arrow} {diff > 0 ? "+" : ""}{formatValue(diff, unit)}
      {pct !== null && <span className="text-gray-400 ml-0.5">({diff > 0 ? "+" : ""}{pct}%)</span>}
    </span>
  );
}
