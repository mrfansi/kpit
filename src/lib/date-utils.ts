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

const jakartaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });

/**
 * Calendar day (YYYY-MM-DD) in Asia/Jakarta, independent of the runtime clock
 * (Workers run in UTC, so 00:00-07:00 WIB would otherwise still be "yesterday").
 */
export function toJakartaDateOnly(value: Date = new Date()): string {
  return jakartaDay.format(value);
}

// Module-level formatters: building an Intl formatter per call is costly on the 10 ms Workers budget.
const dueDateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dayShortJakartaFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const dayLongJakartaFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const dateTimeJakartaFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
const numberFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

/** YYYY-MM-DD date-only value (due dates) as "5 Nov 2026"; UTC on both sides so the client timezone cannot shift the day. */
export const formatDueDate = (dateOnly: string): string => dueDateFmt.format(new Date(`${dateOnly}T00:00:00Z`));
/** Timestamp as "5 Nov 2026" in Asia/Jakarta. */
export const formatDayShort = (value: Date): string => dayShortJakartaFmt.format(value);
/** Timestamp as "5 November 2026" in Asia/Jakarta. */
export const formatDayLong = (value: Date = new Date()): string => dayLongJakartaFmt.format(value);
/** Timestamp as "5 Nov 2026 14.30" in Asia/Jakarta. */
export const formatDateTimeJakarta = (value: Date | string): string => dateTimeJakartaFmt.format(new Date(value));
/** id-ID number, at most 2 fraction digits. */
export const formatNumber2 = (value: number): string => numberFmt.format(value);
