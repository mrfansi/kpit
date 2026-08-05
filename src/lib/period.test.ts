import assert from "node:assert/strict";
import test from "node:test";
import { defaultReportingPeriod, listLastNMonths } from "./period";

/**
 * Kadens pelaporan: tiap awal bulan, melaporkan bulan sebelumnya. Jadi periode
 * default TIDAK BOLEH bulan berjalan — bulan berjalan belum tutup dan secara
 * struktural belum bisa punya data.
 */
test("default periode adalah bulan lalu, bukan bulan berjalan", () => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const actual = defaultReportingPeriod();

  assert.notEqual(
    actual,
    currentMonth,
    "default tidak boleh bulan berjalan — halaman akan terbuka pada periode yang belum bisa terisi"
  );

  const expected = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  assert.equal(
    actual,
    `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}-01`
  );
});

test("default selalu tanggal 1, supaya cocok dengan periodDate di kpi_entries", () => {
  assert.match(defaultReportingPeriod(), /^\d{4}-\d{2}-01$/);
});

test("bulan berjalan tetap ada di daftar pilihan", () => {
  // KPI harian dan mingguan (schema: period = daily|weekly|monthly) memang sah
  // diisi di bulan berjalan. Yang diperbaiki hanya default-nya, bukan daftarnya.
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const values = listLastNMonths(12).map((m) => m.value);

  assert.ok(values.includes(currentMonth), "bulan berjalan hilang dari dropdown");
  assert.ok(values.includes(defaultReportingPeriod()), "periode default harus bisa dipilih");
});
