import { format } from "date-fns";

/**
 * True only for a real calendar date in strict YYYY-MM-DD form.
 * Rejects shape-valid but impossible dates like 2026-13-45, 2026-00-00, 2026-02-30.
 */
export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

/**
 * Calendar day (YYYY-MM-DD) in the server's local timezone.
 * Avoids the UTC off-by-one that `Date.toISOString().slice(0,10)` produces
 * for timezones ahead of UTC (e.g. Asia/Jakarta, UTC+7).
 */
export function toLocalDateOnly(value: Date = new Date()): string {
  return format(value, "yyyy-MM-dd");
}
