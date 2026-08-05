import type { KPIEntry } from "@/lib/db/schema";
import { statusConfig, type KPIStatus } from "@/lib/kpi-status";

interface ReportSparklineProps {
  entries: KPIEntry[];
  status: KPIStatus;
  width?: number;
  height?: number;
}

export function ReportSparkline({ entries, status, width = 100, height = 28 }: ReportSparklineProps) {
  if (entries.length < 2) return <span className="text-muted-foreground text-xs">—</span>;

  const values = entries.map((e) => e.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - padding * 2) + padding;
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const color = statusConfig[status].cssVar;

  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
