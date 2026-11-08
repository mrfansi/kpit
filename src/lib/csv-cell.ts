export function csvCell(value: string | number) {
  // Numbers are never formula-injection vectors; keep negatives unquoted and unprefixed.
  if (typeof value === "number") return String(value);
  const raw = value;
  // Neutralize spreadsheet formula injection. Spreadsheets strip leading
  // whitespace and still evaluate tab/CR-prefixed cells, so test the cell with
  // leading whitespace removed AND the raw leading char (tab/CR/LF) too.
  const stripped = raw.replace(/^\s+/, "");
  const isFormula = /^[=+\-@]/.test(stripped) || /^[=+\-@\t\r\n]/.test(raw);
  const neutralized = isFormula ? `'${raw}` : raw;
  return `"${neutralized.replaceAll('"', '""')}"`;
}
