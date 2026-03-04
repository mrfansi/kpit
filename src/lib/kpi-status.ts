export type KPIStatus = "green" | "yellow" | "red" | "no-data";

export type KPIDirection = "higher_better" | "lower_better";

export function getKPIStatus(
  value: number | null | undefined,
  kpi: { target: number; thresholdGreen: number; thresholdYellow: number; direction?: KPIDirection }
): KPIStatus {
  if (value === null || value === undefined) return "no-data";

  const lowerBetter = kpi.direction === "lower_better";

  if (lowerBetter) {
    if (value <= kpi.thresholdGreen) return "green";
    if (value <= kpi.thresholdYellow) return "yellow";
    return "red";
  } else {
    if (value >= kpi.thresholdGreen) return "green";
    if (value >= kpi.thresholdYellow) return "yellow";
    return "red";
  }
}

export function getAchievementPct(
  value: number | null | undefined,
  target: number,
  direction?: KPIDirection
): number | null {
  if (value === null || value === undefined || target === 0) return null;

  if (direction === "lower_better") {
    // Lower is better: target 2%, actual 1% = 200% achievement (good)
    // target 2%, actual 4% = 50% achievement (bad)
    return Math.round((target / value) * 100);
  }

  return Math.round((value / target) * 100);
}

export const statusConfig: Record<KPIStatus, { label: string; color: string; bg: string }> = {
  green: { label: "On Track", color: "text-green-700", bg: "bg-green-100" },
  yellow: { label: "At Risk", color: "text-yellow-700", bg: "bg-yellow-100" },
  red: { label: "Off Track", color: "text-red-700", bg: "bg-red-100" },
  "no-data": { label: "No Data", color: "text-gray-500", bg: "bg-gray-100" },
};
