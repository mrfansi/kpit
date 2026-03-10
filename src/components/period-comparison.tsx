import { formatValue } from "@/lib/period";
import type { KPI, KPIEntry } from "@/lib/db/schema";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PeriodComparisonProps {
  kpi: KPI;
  current: KPIEntry | null;
  prevMonth: KPIEntry | null;
  prevYear: KPIEntry | null;
}

function Delta({ current, compare, unit, lowerBetter }: { current: number | null; compare: KPIEntry | null; unit: string; lowerBetter?: boolean }) {
  if (current === null || compare === null) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  const rawAbs = current - compare.value;
  const abs = Math.round(rawAbs * 10000) / 10000;
  const pct = compare.value !== 0 ? ((abs / compare.value) * 100).toFixed(1) : null;
  const isUp = abs > 0;
  const isFlat = abs === 0;

  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  const isGood = isFlat ? false : lowerBetter ? !isUp : isUp;
  const color = isFlat ? "text-muted-foreground" : isGood ? "text-green-600" : "text-red-600";

  return (
    <span className={`flex items-center gap-1 text-sm font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {abs > 0 ? "+" : ""}{formatValue(abs, unit)}
      {pct !== null && <span className="font-normal text-xs">({abs > 0 ? "+" : ""}{pct}%)</span>}
    </span>
  );
}

export function PeriodComparison({ kpi, current, prevMonth, prevYear }: PeriodComparisonProps) {
  if (!current) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* MoM */}
      <div className="rounded-lg border bg-card p-3 space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Bulan Lalu (MoM)</p>
        <p className="text-sm text-muted-foreground">
          {prevMonth ? formatValue(prevMonth.value, kpi.unit) : "—"}
        </p>
        <Delta current={current.value} compare={prevMonth} unit={kpi.unit} lowerBetter={kpi.direction === "lower_better"} />
      </div>

      {/* YoY */}
      <div className="rounded-lg border bg-card p-3 space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tahun Lalu (YoY)</p>
        <p className="text-sm text-muted-foreground">
          {prevYear ? formatValue(prevYear.value, kpi.unit) : "—"}
        </p>
        <Delta current={current.value} compare={prevYear} unit={kpi.unit} lowerBetter={kpi.direction === "lower_better"} />
      </div>
    </div>
  );
}
