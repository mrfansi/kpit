"use client";

import type { KPIEntry } from "@/lib/db/schema";
import { formatPeriodDate, formatValue } from "@/lib/period";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, ReferenceLine } from "recharts";

interface TrendChartProps {
  entries: KPIEntry[];
  unit: string;
  target: number;
  color?: string;
}

const chartConfig = {
  value: { label: "Aktual", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

export function TrendChart({ entries, unit, target, color = "hsl(var(--chart-1))" }: TrendChartProps) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        Belum ada data historis
      </div>
    );
  }

  const data = entries.map((e) => ({
    period: formatPeriodDate(e.periodDate),
    value: e.value,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatValue(v, unit).split(" ")[0]}
          width={50}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [formatValue(Number(value), unit), "Aktual"]}
            />
          }
        />
        <ReferenceLine
          y={target}
          stroke="hsl(var(--chart-2))"
          strokeDasharray="4 2"
          label={{ value: "Target", position: "insideTopRight", fontSize: 11 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 4, fill: color }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
