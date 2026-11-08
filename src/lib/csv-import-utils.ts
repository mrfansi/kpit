/** Hard cap on rows accepted from a single CSV import (DoS guard). */
export const MAX_IMPORT_ROWS = 5000;

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * Angka polos saja ("75", "-3", "75.5"); selain itu NaN. parseFloat memotong
 * diam-diam "75,5" jadi 75 dan "1.500.000" jadi 1.5 — CSV Excel Indonesia
 * memakai koma desimal dan titik ribuan, jadi tolak daripada menyimpan salah.
 */
export function parsePlainNumber(raw: string | undefined): number {
  const text = (raw ?? "").trim();
  return PLAIN_NUMBER.test(text) ? Number(text) : NaN;
}

/**
 * Pencarian KPI berdasarkan nama (tanpa beda huruf besar/kecil). Nama KPI tidak
 * unik antar domain, jadi nama yang cocok dengan lebih dari satu KPI ditolak
 * (pakai kpi_id). KPI arsip hanya dipakai kalau tidak ada KPI aktif sebernama.
 */
export function kpiNameLookup<T extends { name: string; isActive: boolean }>(all: T[]) {
  const byName = new Map<string, T[]>();
  for (const k of all) {
    const key = k.name.toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), k]);
  }
  return (name: string): { kpi: T } | { error: string } => {
    const matches = byName.get(name.toLowerCase()) ?? [];
    const active = matches.filter((k) => k.isActive);
    const candidates = active.length > 0 ? active : matches;
    if (candidates.length === 0) return { error: `KPI "${name}" tidak ditemukan` };
    if (candidates.length > 1) {
      return { error: `Nama KPI "${name}" ambigu (ada ${candidates.length} KPI bernama sama), pakai kolom kpi_id` };
    }
    return { kpi: candidates[0] };
  };
}
