import Papa from "papaparse";

/** Parse CSV text, return raw rows (pure utility, no server deps) */
export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  // Strip UTF-8 BOM if present
  const cleaned = text.replace(/^\uFEFF/, "");

  const result = Papa.parse<string[]>(cleaned, {
    skipEmptyLines: true,
    header: false,
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headerRow, ...dataRows] = result.data as string[][];
  if (!headerRow) return { headers: [], rows: [] };

  const headers = headerRow.map((h) => String(h).trim().toLowerCase().replace(/\s+/g, "_"));
  const rows = dataRows.map((row) => row.map((c) => String(c).trim()));

  return { headers, rows };
}
