import { formatValue } from "@/lib/period";
import { trendColor } from "@/lib/kpi-status";
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
    return (
      <span className="text-sm text-muted-foreground" aria-label="Tidak ada data">
        -
      </span>
    );
  }
  const rawAbs = current - compare.value;
  const abs = Math.round(rawAbs * 10000) / 10000;
  const pct = compare.value !== 0 ? ((abs / compare.value) * 100).toFixed(1) : null;
  const isUp = abs > 0;
  const isFlat = abs === 0;

  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  const trend = isFlat ? "flat" : isUp ? "up" : "down";
  const color = trendColor(trend, lowerBetter ? "lower_better" : "higher_better");

  return (
    <span className={`flex items-center gap-1 text-sm font-semibold ${color}`}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="num">
        {abs > 0 ? "+" : ""}{formatValue(abs, unit)}
        {pct !== null && <span className="text-xs font-normal"> ({abs > 0 ? "+" : ""}{pct}%)</span>}
      </span>
    </span>
  );
}

export function PeriodComparison({ kpi, current, prevMonth, prevYear }: PeriodComparisonProps) {
  if (!current) return null;

  const lowerBetter = kpi.direction === "lower_better";
  const rows = [
    { label: "Bulan lalu (MoM)", entry: prevMonth },
    { label: "Tahun lalu (YoY)", entry: prevYear },
  ];

  // Baris stat dipisah garis rambut vertikal, bukan kartu.
  return (
    <dl className="grid grid-cols-2 divide-x border-t pt-4">
      {rows.map(({ label, entry }) => (
        <div key={label} className="space-y-1 px-5 first:pl-0">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="num text-base">
            {entry ? formatValue(entry.value, kpi.unit) : <span className="text-muted-foreground" aria-label="Tidak ada data">-</span>}
          </dd>
          <dd>
            <Delta current={current.value} compare={entry} unit={kpi.unit} lowerBetter={lowerBetter} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
