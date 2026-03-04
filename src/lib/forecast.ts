import type { KPIEntry } from "@/lib/db/schema";

export interface ForecastPoint {
  periodDate: string;
  value: number;
  isForecast: true;
}

/** Hitung regresi linear sederhana (least squares) dari array [x, y] */
function linearRegression(points: [number, number][]): { slope: number; intercept: number } {
  const n = points.length;
  const sumX = points.reduce((s, [x]) => s + x, 0);
  const sumY = points.reduce((s, [, y]) => s + y, 0);
  const sumXY = points.reduce((s, [x, y]) => s + x * y, 0);
  const sumX2 = points.reduce((s, [x]) => s + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function addMonths(isoDate: string, n: number): string {
  // Parse year/month dari string langsung untuk menghindari timezone issues
  const [y, m] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1 + n, 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

/**
 * Hitung 3 titik forecast berdasarkan regresi linear dari entri historis.
 * Membutuhkan minimal 2 entri.
 */
export function computeForecast(entries: KPIEntry[], months = 3): ForecastPoint[] {
  if (entries.length < 2) return [];

  const sorted = [...entries].sort((a, b) => a.periodDate.localeCompare(b.periodDate));
  const points: [number, number][] = sorted.map((e, i) => [i, e.value]);
  const { slope, intercept } = linearRegression(points);

  const lastDate = sorted[sorted.length - 1].periodDate;
  const baseIndex = sorted.length;

  return Array.from({ length: months }, (_, i) => ({
    periodDate: addMonths(lastDate, i + 1),
    value: Math.max(0, slope * (baseIndex + i) + intercept),
    isForecast: true as const,
  }));
}
