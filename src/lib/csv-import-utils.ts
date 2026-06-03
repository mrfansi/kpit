export interface CSVValidationError {
  row: number;
  message: string;
}

/** Hard cap on rows accepted from a single CSV import (DoS guard). */
export const MAX_IMPORT_ROWS = 5000;

export function validatePeriodDate(value: string): boolean {
  // Strict shape + real calendar date: rejects 2026-13-45, 2026-02-30, etc.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

export function validateNumericValue(value: unknown): value is number {
  return typeof value === "number" && isFinite(value);
}

export function buildRowError(row: number, message: string): CSVValidationError {
  return { row, message };
}
