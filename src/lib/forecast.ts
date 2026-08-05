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

export interface ForecastBounds {
  /**
   * Batas alami metrik, kalau KPI-nya mendeklarasikannya. Regresi linear tidak
   * tahu apa-apa soal langit-langit: metrik yang mendatar di 100 tetap
   * diproyeksikan menembusnya. Menjepit di sini membuat proyeksinya mungkin.
   */
  min?: number | null;
  max?: number | null;
  /**
   * Dipakai HANYA kalau `min` tidak dideklarasikan. Mempertahankan perilaku
   * lama: metrik tanpa batas eksplisit tetap dijepit di nol, kecuali memang
   * masuk akal menembusnya.
   */
  allowNegative?: boolean;
}

/**
 * Hitung 3 titik forecast berdasarkan regresi linear dari entri historis.
 * Membutuhkan minimal 2 entri pada bulan yang berbeda.
 */
export function computeForecast(
  entries: KPIEntry[],
  months = 3,
  bounds: ForecastBounds = {}
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

  // Batas yang dideklarasikan KPI menang. Kalau tidak ada, jatuh ke perilaku
  // lama: dijepit di nol kecuali metriknya memang boleh negatif.
  const lower = bounds.min ?? (bounds.allowNegative ? null : 0);
  const upper = bounds.max ?? null;

  return Array.from({ length: months }, (_, i) => {
    const periodDate = addMonths(lastDate, i + 1);
    let value = slope * monthsBetween(firstDate, periodDate) + intercept;
    if (lower !== null) value = Math.max(lower, value);
    if (upper !== null) value = Math.min(upper, value);
    return { periodDate, value, isForecast: true as const };
  });
}
