"use client";

import type { KPIEntry } from "@/lib/db/schema";
import type { ForecastPoint } from "@/lib/forecast";
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
  forecastPoints?: ForecastPoint[];
}

const chartConfig = {
  value: { label: "Aktual", color: "hsl(var(--chart-1))" },
  forecast: { label: "Forecast", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

export function TrendChart({ entries, unit, target, color = "hsl(var(--chart-1))", forecastPoints = [] }: TrendChartProps) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        Belum ada data historis
      </div>
    );
  }

  const actualData = entries.map((e) => ({
    period: formatPeriodDate(e.periodDate),
    value: e.value,
    forecast: undefined as number | undefined,
  }));

  // Bridge: titik terakhir aktual juga punya nilai forecast agar garis menyambung
  if (forecastPoints.length > 0 && actualData.length > 0) {
    actualData[actualData.length - 1].forecast = actualData[actualData.length - 1].value;
  }

  const forecastData = forecastPoints.map((p) => ({
    period: formatPeriodDate(p.periodDate),
    value: undefined as number | undefined,
    forecast: p.value,
  }));

  const data = [...actualData, ...forecastData];

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
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
              formatter={(value, name) => [
                formatValue(Number(value), unit),
                name === "forecast" ? "Forecast" : "Aktual",
              ]}
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
          connectNulls={false}
        />
        {forecastPoints.length > 0 && (
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="hsl(var(--chart-3))"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 4, fill: "hsl(var(--chart-3))", strokeDasharray: "0" }}
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
        )}
      </LineChart>
    </ChartContainer>
  );
}
