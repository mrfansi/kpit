import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

export type PeriodType = "monthly" | "quarterly" | "yearly";

export function getCurrentPeriod(): string {
  return format(startOfMonth(new Date()), "yyyy-MM-dd");
}

export function formatPeriodDate(dateStr: string, fmt = "MMM yyyy"): string {
  return format(parseISO(dateStr), fmt, { locale: localeId });
}

export function getPeriodRange(months: number): { from: string; to: string } {
  const now = new Date();
  return {
    from: format(startOfMonth(subMonths(now, months - 1)), "yyyy-MM-dd"),
    to: format(endOfMonth(now), "yyyy-MM-dd"),
  };
}

export function listLastNMonths(n: number): { label: string; value: string }[] {
  const now = new Date();
  return eachMonthOfInterval({
    start: subMonths(startOfMonth(now), n - 1),
    end: startOfMonth(now),
  })
    .reverse()
    .map((d) => ({
      label: format(d, "MMMM yyyy", { locale: localeId }),
      value: format(d, "yyyy-MM-dd"),
    }));
}

export function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(0)}jt`;
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export function formatValue(value: number, unit: string): string {
  if (unit === "Rp") return formatCurrency(value);
  // Round to remove floating point artifacts (e.g. 0.19999999 → 0.2)
  const rounded = Math.round(value * 10000) / 10000;
  if (unit === "%") return `${rounded}%`;
  return `${rounded.toLocaleString("id-ID")} ${unit}`;
}
