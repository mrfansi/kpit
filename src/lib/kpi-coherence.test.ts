import { test } from "node:test";
import assert from "node:assert/strict";
import { checkThresholdCoherence } from "./kpi-coherence";

test("menandai KPI yang bisa hijau padahal jauh dari target", () => {
  // Kasus nyata: Security Issues — target 1 Unit, tapi 10 Unit masih dianggap hijau.
  const issues = checkThresholdCoherence({
    direction: "lower_better",
    target: 1,
    thresholdGreen: 10,
    thresholdYellow: 14,
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].level, "warning");
  assert.match(issues[0].message, /10%/);
});

test("membiarkan toleransi yang wajar", () => {
  // Bug Completion Rate: hijau di 70 dari target 90 = 78% — konfigurasi normal.
  assert.deepEqual(
    checkThresholdCoherence({
      direction: "higher_better",
      target: 90,
      thresholdGreen: 70,
      thresholdYellow: 40,
    }),
    []
  );

  // Platform Rating: hijau 4.5 dari target 5 = 90%.
  assert.deepEqual(
    checkThresholdCoherence({
      direction: "higher_better",
      target: 5,
      thresholdGreen: 4.5,
      thresholdYellow: 4,
    }),
    []
  );
});

test("menolak urutan zona yang terbalik", () => {
  // higher_better: hijau harus DI ATAS kuning.
  const higher = checkThresholdCoherence({
    direction: "higher_better",
    target: 100,
    thresholdGreen: 40,
    thresholdYellow: 70,
  });
  assert.equal(higher[0]?.level, "error");

  // lower_better: hijau harus DI BAWAH kuning.
  const lower = checkThresholdCoherence({
    direction: "lower_better",
    target: 1,
    thresholdGreen: 10,
    thresholdYellow: 5,
  });
  assert.equal(lower[0]?.level, "error");
});

test("urutan terbalik dilaporkan sendirian, bukan ditumpuk peringatan lain", () => {
  // Kalau urutannya sudah rusak, peringatan jarak-target cuma menambah bising.
  const issues = checkThresholdCoherence({
    direction: "lower_better",
    target: 1,
    thresholdGreen: 10,
    thresholdYellow: 5,
  });
  assert.equal(issues.length, 1);
});

test("tidak pecah pada nilai nol atau bukan angka", () => {
  assert.deepEqual(
    checkThresholdCoherence({
      direction: "higher_better",
      target: 0,
      thresholdGreen: 0,
      thresholdYellow: 0,
    }),
    []
  );
  assert.deepEqual(
    checkThresholdCoherence({
      direction: "higher_better",
      target: NaN,
      thresholdGreen: 1,
      thresholdYellow: 1,
    }),
    []
  );
});
