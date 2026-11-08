"use client";

import dynamic from "next/dynamic";

// Recharts stays out of the server render and the initial JS; the placeholder matches the chart height (h-60).
export const TrendChart = dynamic(() => import("@/components/trend-chart").then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <div className="h-60 w-full" aria-hidden />,
});
