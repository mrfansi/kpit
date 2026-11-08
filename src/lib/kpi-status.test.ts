import assert from "node:assert/strict";
import test from "node:test";
import { getAchievementPct, getKPIStatus } from "./kpi-status";

const higher = { target: 100, thresholdGreen: 90, thresholdYellow: 70 };
const lower = { target: 10, thresholdGreen: 12, thresholdYellow: 20, direction: "lower_better" as const };

test("getKPIStatus: null/undefined is no-data, 0 is a real value", () => {
  assert.equal(getKPIStatus(null, higher), "no-data");
  assert.equal(getKPIStatus(undefined, higher), "no-data");
  assert.equal(getKPIStatus(0, higher), "red");
});

test("getKPIStatus higher_better: thresholds are inclusive", () => {
  assert.equal(getKPIStatus(90, higher), "green");
  assert.equal(getKPIStatus(89.99, higher), "yellow");
  assert.equal(getKPIStatus(70, higher), "yellow");
  assert.equal(getKPIStatus(69.99, higher), "red");
});

test("getKPIStatus lower_better: thresholds are inclusive", () => {
  assert.equal(getKPIStatus(12, lower), "green");
  assert.equal(getKPIStatus(12.01, lower), "yellow");
  assert.equal(getKPIStatus(20, lower), "yellow");
  assert.equal(getKPIStatus(20.01, lower), "red");
});

test("getAchievementPct: no-data and zero target", () => {
  assert.equal(getAchievementPct(null, 100), null);
  assert.equal(getAchievementPct(undefined, 100), null);
  assert.equal(getAchievementPct(50, 0), null);
  assert.equal(getAchievementPct(50, 0, "lower_better"), null);
});

test("getAchievementPct higher_better: value / target", () => {
  assert.equal(getAchievementPct(90, 100), 90);
  assert.equal(getAchievementPct(150, 100, "higher_better"), 150);
  assert.equal(getAchievementPct(0, 100), 0);
});

test("getAchievementPct lower_better: target / value, zero value guarded", () => {
  assert.equal(getAchievementPct(1, 2, "lower_better"), 200);
  assert.equal(getAchievementPct(4, 2, "lower_better"), 50);
  assert.equal(getAchievementPct(2, 2, "lower_better"), 100);
  assert.equal(getAchievementPct(0, 2, "lower_better"), null);
});
