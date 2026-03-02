export interface CSVValidationError {
  row: number;
  message: string;
}

export function validatePeriodDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateNumericValue(value: unknown): value is number {
  return typeof value === "number" && isFinite(value);
}

export function buildRowError(row: number, message: string): CSVValidationError {
  return { row, message };
}
