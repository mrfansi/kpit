import assert from "node:assert/strict";
import test from "node:test";
import { computeForecast } from "./forecast";
import type { KPIEntry } from "@/lib/db/schema";

/** Entri minimal — computeForecast hanya membaca periodDate dan value. */
function entry(periodDate: string, value: number): KPIEntry {
  return { periodDate, value } as KPIEntry;
}

test("tren lurus diproyeksikan lurus", () => {
  const points = computeForecast(
    [entry("2026-01-01", 10), entry("2026-02-01", 20), entry("2026-03-01", 30)],
    3
  );

  assert.deepEqual(
    points.map((p) => [p.periodDate, p.value]),
    [
      ["2026-04-01", 40],
      ["2026-05-01", 50],
      ["2026-06-01", 60],
    ]
  );
});

test("periode bolong tidak membuat kemiringan terlalu curam", () => {
  // Nilai naik 10 per BULAN, tapi Feb dan Mar tidak terisi. Kalau sumbu-x
  // memakai indeks array, tiga entri ini terbaca sebagai kenaikan 30 per
  // langkah dan proyeksinya meledak.
  const points = computeForecast(
    [entry("2026-01-01", 10), entry("2026-04-01", 40), entry("2026-05-01", 50)],
    2
  );

  assert.deepEqual(
    points.map((p) => [p.periodDate, p.value]),
    [
      ["2026-06-01", 60],
      ["2026-07-01", 70],
    ]
  );
});

test("proyeksi dievaluasi pada bulan yang benar setelah entri terakhir", () => {
  // Regresi berbasis indeks dulu mengevaluasi titik pertama di x = jumlah
  // entri, yang tidak sama dengan jarak bulan sebenarnya saat ada yang bolong.
  const points = computeForecast(
    [entry("2026-01-01", 0), entry("2026-02-01", 10), entry("2026-08-01", 70)],
    1
  );

  assert.equal(points[0].periodDate, "2026-09-01");
  assert.equal(points[0].value, 80);
});

test("melintasi pergantian tahun", () => {
  const points = computeForecast(
    [entry("2026-11-01", 10), entry("2026-12-01", 20)],
    2
  );

  assert.deepEqual(
    points.map((p) => p.periodDate),
    ["2027-01-01", "2027-02-01"]
  );
});

test("tren menurun tidak menembus nol kecuali diizinkan", () => {
  const input = [entry("2026-01-01", 30), entry("2026-02-01", 20), entry("2026-03-01", 10)];

  assert.deepEqual(
    computeForecast(input, 3).map((p) => p.value),
    [0, 0, 0]
  );

  assert.deepEqual(
    computeForecast(input, 3, true).map((p) => p.value),
    [0, -10, -20]
  );
});

test("kurang dari dua entri tidak menghasilkan proyeksi", () => {
  assert.deepEqual(computeForecast([], 3), []);
  assert.deepEqual(computeForecast([entry("2026-01-01", 10)], 3), []);
});

test("semua entri di bulan yang sama tidak menghasilkan NaN", () => {
  // Tanpa penjagaan ini, penyebut regresi jadi nol dan seluruh titik forecast
  // berisi NaN — recharts menggambarnya sebagai grafik kosong tanpa penjelasan.
  const points = computeForecast(
    [entry("2026-03-01", 10), entry("2026-03-01", 20)],
    3
  );

  assert.deepEqual(points, []);
});
