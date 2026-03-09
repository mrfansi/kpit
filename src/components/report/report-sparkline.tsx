import type { KPIEntry } from "@/lib/db/schema";
import type { KPIStatus } from "@/lib/kpi-status";

interface ReportSparklineProps {
  entries: KPIEntry[];
  status: KPIStatus;
  width?: number;
  height?: number;
}

const statusColor: Record<KPIStatus, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  "no-data": "#94a3b8",
};

export function ReportSparkline({ entries, status, width = 80, height = 24 }: ReportSparklineProps) {
  if (entries.length < 2) return <span className="text-gray-300 text-xs">—</span>;

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

  const color = statusColor[status];

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
