"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import type { KPIEntry } from "@/lib/db/schema";
import { statusConfig, type KPIStatus } from "@/lib/kpi-status";

interface SparklineProps {
  entries: KPIEntry[];
  status: KPIStatus;
  /** Tinggi grafik; baris tabel butuh lebih pendek daripada kartu. */
  height?: number;
}

export function Sparkline({ entries, status, height = 40 }: SparklineProps) {
  if (entries.length < 2) return null;

  const data = entries.map((e) => ({ v: e.value }));
  const color = statusConfig[status].cssVar;

  // Pastikan Y-axis punya range minimal agar garis tidak terlalu flat
  const values = entries.map((e) => e.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const padding = range < 1 ? Math.max(min * 0.1, 1) : range * 0.15;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <YAxis hide domain={[min - padding, max + padding]} />
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
