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
    // Guard value === 0: target / 0 = Infinity would bypass every downstream
    // `!== null` check and corrupt report-wide achievement averages.
    if (value === 0) return null;
    return Math.round((target / value) * 100);
  }

  return Math.round((value / target) * 100);
}

/**
 * Satu-satunya sumber warna status KPI. Semua kelas di sini memakai token
 * semantik (--success/--warning/--danger di globals.css), bukan palet Tailwind
 * mentah, supaya hijau/kuning/merah punya arti yang sama di seluruh aplikasi
 * dan ikut berubah saat dark mode.
 *
 * `color` = teks, `bg` = latar chip, `solid` = isi bar (mis. progress),
 * `rail` = pseudo-element rail di tepi kartu, `border` = garis tepi.
 * `cssVar` untuk konteks yang tidak menerima kelas Tailwind (mis. atribut
 * `stroke`/`fill` pada SVG Recharts) — tetap ikut berubah saat dark mode.
 *
 * Setiap kelas ditulis literal (bukan disusun dari string) karena Tailwind
 * hanya meng-generate kelas yang muncul apa adanya di source.
 */
export const statusConfig: Record<
  KPIStatus,
  {
    label: string;
    color: string;
    bg: string;
    solid: string;
    rail: string;
    border: string;
    cssVar: string;
  }
> = {
  green: {
    label: "On Track",
    color: "text-success",
    bg: "bg-success-soft",
    solid: "bg-success-fill",
    rail: "before:bg-success-fill",
    border: "border-success",
    cssVar: "var(--success-fill)",
  },
  yellow: {
    label: "At Risk",
    color: "text-warning",
    bg: "bg-warning-soft",
    solid: "bg-warning-fill",
    rail: "before:bg-warning-fill",
    border: "border-warning",
    cssVar: "var(--warning-fill)",
  },
  red: {
    label: "Off Track",
    color: "text-danger",
    bg: "bg-danger-soft",
    solid: "bg-danger-fill",
    rail: "before:bg-danger-fill",
    border: "border-danger",
    cssVar: "var(--danger-fill)",
  },
  "no-data": {
    label: "No Data",
    color: "text-muted-foreground",
    bg: "bg-muted",
    solid: "bg-muted-foreground/40",
    rail: "before:bg-border",
    border: "border-border",
    cssVar: "var(--muted-foreground)",
  },
};

/** Warna tren: naik/turun dinilai relatif terhadap arah KPI, bukan tanda angka. */
export function trendColor(
  trend: "up" | "down" | "flat",
  direction?: KPIDirection
): string {
  if (trend === "flat") return "text-muted-foreground";
  const isGood = (trend === "up") !== (direction === "lower_better");
  return isGood ? "text-success" : "text-danger";
}
