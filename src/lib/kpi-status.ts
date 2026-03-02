export type KPIStatus = "green" | "yellow" | "red" | "no-data";

/**
 * KPI "lower is better" — berlaku untuk turnover, defect rate, dll
 * Deteksi: jika target < thresholdGreen (misal target 2%, threshold_green 2%)
 */
function isLowerBetter(target: number, thresholdGreen: number): boolean {
  return target <= thresholdGreen;
}

export function getKPIStatus(
  value: number | null | undefined,
  kpi: { target: number; thresholdGreen: number; thresholdYellow: number }
): KPIStatus {
  if (value === null || value === undefined) return "no-data";

  const lowerBetter = isLowerBetter(kpi.target, kpi.thresholdGreen);

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

export function getAchievementPct(value: number | null | undefined, target: number): number | null {
  if (value === null || value === undefined || target === 0) return null;
  return Math.round((value / target) * 100);
}

export const statusConfig: Record<KPIStatus, { label: string; color: string; bg: string }> = {
  green: { label: "On Track", color: "text-green-700", bg: "bg-green-100" },
  yellow: { label: "At Risk", color: "text-yellow-700", bg: "bg-yellow-100" },
  red: { label: "Off Track", color: "text-red-700", bg: "bg-red-100" },
  "no-data": { label: "No Data", color: "text-gray-500", bg: "bg-gray-100" },
};
