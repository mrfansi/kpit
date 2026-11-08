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
