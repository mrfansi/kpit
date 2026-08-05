import assert from "node:assert/strict";
import test from "node:test";
import { checkValueBounds } from "./kpi-bounds";

test("batas yang tidak dideklarasikan tidak pernah menolak apa pun", () => {
  // Banyak metrik memang tidak berbatas (pendapatan, jumlah transaksi).
  // Menebak batas yang tidak ada akan menolak data yang benar.
  assert.equal(checkValueBounds(1_000_000, {}), null);
  assert.equal(checkValueBounds(-500, {}), null);
  assert.equal(checkValueBounds(0, { minValue: null, maxValue: null }), null);
});

test("menolak nilai di atas maksimum", () => {
  // Kasus nyata: skala PageSpeed berhenti di 100, tapi 1000 mudah terketik.
  const kpi = { maxValue: 100, unit: "Score" };
  assert.equal(checkValueBounds(100, kpi), null);
  assert.match(checkValueBounds(1000, kpi) ?? "", /melebihi batas maksimum/);
});

test("menolak nilai di bawah minimum", () => {
  const kpi = { minValue: 0, unit: "Unit" };
  assert.equal(checkValueBounds(0, kpi), null);
  assert.match(checkValueBounds(-1, kpi) ?? "", /di bawah batas minimum/);
});

test("nilai tepat di batas diterima, bukan ditolak", () => {
  // Rating 5 dari 5 dan skor 100 dari 100 adalah pencapaian yang sah.
  assert.equal(checkValueBounds(5, { minValue: 0, maxValue: 5 }), null);
  assert.equal(checkValueBounds(0, { minValue: 0, maxValue: 5 }), null);
});

test("minimum nol tetap aktif, tidak tertelan falsiness", () => {
  // minValue: 0 bernilai falsy. Kalau diperiksa dengan truthiness, batas bawah
  // yang paling umum di aplikasi ini justru diam-diam tidak pernah berlaku.
  assert.match(checkValueBounds(-0.5, { minValue: 0 }) ?? "", /di bawah batas minimum/);
});

test("pesan menyebut angkanya, bukan sekadar 'nilai tidak valid'", () => {
  const message = checkValueBounds(150, { maxValue: 100, unit: "%" }) ?? "";
  assert.ok(message.includes("150"), "nilai yang ditolak harus disebut");
  assert.ok(message.includes("100"), "batasnya harus disebut");
});
