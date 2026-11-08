import assert from "node:assert/strict";
import test from "node:test";
import { defaultReportingPeriod, getPeriodRange, listLastNMonths, shiftMonth } from "./period";

// 2026-11-30T22:00Z = 1 Des 2026 05:00 WIB: runtime UTC masih November, Jakarta sudah Desember.
const JAKARTA_DEC_1 = new Date("2026-11-30T22:00:00Z");
// 30 Nov 23:59 WIB: masih November di Jakarta.
const JAKARTA_NOV_30 = new Date("2026-11-30T16:59:59Z");

/**
 * Kadens pelaporan: tiap awal bulan, melaporkan bulan sebelumnya. Jadi periode
 * default TIDAK BOLEH bulan berjalan — bulan berjalan belum tutup dan secara
 * struktural belum bisa punya data.
 */
test("default periode adalah bulan lalu menurut WIB, bukan bulan berjalan", () => {
  assert.equal(defaultReportingPeriod(JAKARTA_DEC_1), "2026-11-01");
  assert.equal(defaultReportingPeriod(JAKARTA_NOV_30), "2026-10-01");
});

test("default melewati batas tahun menurut WIB", () => {
  assert.equal(defaultReportingPeriod(new Date("2026-12-31T17:00:00Z")), "2026-12-01");
});

test("default selalu tanggal 1, supaya cocok dengan periodDate di kpi_entries", () => {
  assert.match(defaultReportingPeriod(), /^\d{4}-\d{2}-01$/);
});

test("bulan berjalan WIB tetap ada di daftar pilihan", () => {
  // KPI harian dan mingguan (schema: period = daily|weekly|monthly) memang sah
  // diisi di bulan berjalan. Yang diperbaiki hanya default-nya, bukan daftarnya.
  const values = listLastNMonths(12, JAKARTA_DEC_1).map((m) => m.value);

  assert.equal(values[0], "2026-12-01");
  assert.ok(values.includes(defaultReportingPeriod(JAKARTA_DEC_1)), "periode default harus bisa dipilih");
});

test("rentang periode mengikuti bulan WIB", () => {
  assert.deepEqual(getPeriodRange(3, JAKARTA_DEC_1), { from: "2026-10-01", to: "2026-12-31" });
});

test("shiftMonth melewati batas tahun dan selalu tanggal 1", () => {
  assert.equal(shiftMonth("2026-01-01", -1), "2025-12-01");
  assert.equal(shiftMonth("2026-12-15", 1), "2027-01-01");
  assert.equal(shiftMonth("2026-03-01", -12), "2025-03-01");
  assert.equal(shiftMonth("2026-03-01", 0), "2026-03-01");
});
