import assert from "node:assert/strict";
import test from "node:test";
import {
  kpiSchema,
  kpiFieldsSchema,
  checkBoundsOrder,
  checkTargetWithinBounds,
} from "./kpi";

const valid = {
  domainId: 1,
  name: "Uptime",
  unit: "%",
  target: 99,
  thresholdGreen: 99,
  thresholdYellow: 95,
  direction: "higher_better" as const,
  refreshType: "periodic" as const,
  period: "monthly" as const,
};

test("kpiFieldsSchema mendukung .partial() untuk update parsial", () => {
  // Zod menolak .partial() pada skema yang punya .refine(), dan itu galat
  // RUNTIME — tsc dan build tetap hijau. Update KPI pernah rusak karenanya.
  assert.doesNotThrow(() => kpiFieldsSchema.partial());

  const parsed = kpiFieldsSchema.partial().parse({ description: "hanya deskripsi" });
  assert.deepEqual(parsed, { description: "hanya deskripsi" });
});

test("kpiSchema tetap menegakkan aturan lintas-field pada pembuatan", () => {
  assert.equal(kpiSchema.safeParse({ ...valid, minValue: 0, maxValue: 100 }).success, true);
  assert.equal(kpiSchema.safeParse({ ...valid, minValue: 100, maxValue: 0 }).success, false);
  assert.equal(
    kpiSchema.safeParse({ ...valid, target: 150, maxValue: 100 }).success,
    false,
    "target di atas maksimum berarti target itu mustahil dicapai"
  );
});

test("batas tanpa pasangannya tidak menolak apa pun", () => {
  assert.equal(checkBoundsOrder({ minValue: 5, maxValue: null }), null);
  assert.equal(checkBoundsOrder({ minValue: null, maxValue: 5 }), null);
  assert.equal(checkBoundsOrder({}), null);
});

test("minimum sama dengan maksimum ditolak", () => {
  // Rentang selebar nol berarti hanya satu nilai yang sah — hampir pasti salah
  // isi, bukan maksud sebenarnya.
  assert.match(checkBoundsOrder({ minValue: 5, maxValue: 5 }) ?? "", /lebih kecil/);
});

test("target tepat di batas diterima", () => {
  assert.equal(checkTargetWithinBounds({ target: 100, maxValue: 100 }), null);
  assert.equal(checkTargetWithinBounds({ target: 0, minValue: 0 }), null);
});

test("batas nol tetap berlaku, tidak tertelan falsiness", () => {
  assert.match(
    checkTargetWithinBounds({ target: -5, minValue: 0 }) ?? "",
    /di bawah batas minimum/
  );
});
