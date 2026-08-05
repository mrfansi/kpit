import { formatValue } from "@/lib/period";

export interface ValueBounds {
  minValue?: number | null;
  maxValue?: number | null;
  unit?: string;
}

/**
 * Periksa satu nilai terhadap batas alami KPI-nya.
 *
 * Mengembalikan pesan kesalahan, atau null kalau nilainya sah. Batas yang tidak
 * dideklarasikan tidak pernah menolak apa pun — banyak metrik memang tidak
 * berbatas, dan menebak batas yang tidak ada akan menolak data yang benar.
 *
 * Ini penjagaan salah ketik, bukan penilaian baik/buruk: 1000 pada skala 0–100
 * hampir pasti maksudnya 100 atau 10,00 — dan sekali tersimpan, angka itu
 * merusak rata-rata, sparkline, dan forecast sampai ada yang menyadarinya.
 */
export function checkValueBounds(value: number, kpi: ValueBounds): string | null {
  const unit = kpi.unit ?? "";

  if (kpi.minValue != null && value < kpi.minValue) {
    return `Nilai ${formatValue(value, unit)} di bawah batas minimum ${formatValue(kpi.minValue, unit)}.`;
  }
  if (kpi.maxValue != null && value > kpi.maxValue) {
    return `Nilai ${formatValue(value, unit)} melebihi batas maksimum ${formatValue(kpi.maxValue, unit)}.`;
  }
  return null;
}
