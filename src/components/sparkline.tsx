"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { KPIEntry } from "@/lib/db/schema";
import type { KPIStatus } from "@/lib/kpi-status";

interface SparklineProps {
  entries: KPIEntry[];
  status: KPIStatus;
}

const statusColor: Record<KPIStatus, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  "no-data": "#94a3b8",
};

export function Sparkline({ entries, status }: SparklineProps) {
  if (entries.length < 2) return null;

  const data = entries.map((e) => ({ v: e.value }));
  const color = statusColor[status];

  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
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
