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

/** Jarak dalam bulan kalender dari `from` ke `to`. Negatif kalau `to` lebih awal. */
function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/**
 * Hitung 3 titik forecast berdasarkan regresi linear dari entri historis.
 * Membutuhkan minimal 2 entri.
 */
export function computeForecast(
  entries: KPIEntry[],
  months = 3,
  allowNegative = false
): ForecastPoint[] {
  if (entries.length < 2) return [];

  const sorted = [...entries].sort((a, b) => a.periodDate.localeCompare(b.periodDate));
  const firstDate = sorted[0].periodDate;
  const lastDate = sorted[sorted.length - 1].periodDate;

  // Sumbu-x adalah jarak BULAN dari entri pertama, bukan indeks array.
  //
  // Dengan indeks array, dua entri yang terpisah lima bulan diperlakukan sama
  // rapatnya dengan dua entri berurutan — kemiringannya jadi terlalu curam, dan
  // proyeksinya dievaluasi di titik yang salah karena addMonths() bergerak
  // dalam bulan nyata. Keduanya kebetulan sama HANYA kalau tidak ada periode
  // yang bolong; di aplikasi ini periode bolong justru lumrah.
  const points: [number, number][] = sorted.map((e) => [
    monthsBetween(firstDate, e.periodDate),
    e.value,
  ]);

  // Semua entri jatuh di bulan yang sama (mis. hanya satu periode, terisi
  // berulang): tidak ada rentang waktu untuk diregresi, kemiringannya akan
  // membagi nol.
  const distinctX = new Set(points.map(([x]) => x));
  if (distinctX.size < 2) return [];

  const { slope, intercept } = linearRegression(points);

  return Array.from({ length: months }, (_, i) => {
    const periodDate = addMonths(lastDate, i + 1);
    const projected = slope * monthsBetween(firstDate, periodDate) + intercept;
    // For metrics that can legitimately trend below zero (e.g. lower_better
    // KPIs heading toward 0), keep the real projection instead of flattening
    // the line at 0 and hiding the downward trajectory.
    return {
      periodDate,
      value: allowNegative ? projected : Math.max(0, projected),
      isForecast: true as const,
    };
  });
}
