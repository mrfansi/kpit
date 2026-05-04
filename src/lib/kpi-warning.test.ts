import assert from "node:assert/strict";
import test from "node:test";
import { getKPIEarlyWarning } from "./kpi-warning";

const baseKpi = {
  name: "Revenue Growth",
  unit: "%",
  target: 90,
  thresholdGreen: 90,
  thresholdYellow: 75,
  direction: "higher_better" as const,
};

test("suggests an action plan for red KPI status", () => {
  const warning = getKPIEarlyWarning({
    kpi: baseKpi,
    latestEntry: { value: 60, periodDate: "2026-05-01" },
    previousEntry: { value: 70, periodDate: "2026-04-01" },
    today: new Date("2026-05-05T12:00:00.000Z"),
  });

  assert.equal(warning?.severity, "high");
  assert.ok(warning?.reasons.includes("KPI off track"));
  assert.equal(warning?.suggestedAction.title, "Investigasi KPI Revenue Growth yang off track");
});

test("detects worsening trend for lower-better KPIs", () => {
  const warning = getKPIEarlyWarning({
    kpi: { ...baseKpi, name: "Complaint Rate", target: 2, thresholdGreen: 2, thresholdYellow: 4, direction: "lower_better" },
    latestEntry: { value: 3, periodDate: "2026-05-01" },
    previousEntry: { value: 2, periodDate: "2026-04-01" },
    today: new Date("2026-05-05T12:00:00.000Z"),
  });

  assert.equal(warning?.severity, "medium");
  assert.ok(warning?.reasons.includes("Tren memburuk dari periode sebelumnya"));
});

test("detects stale data and returns low severity when status is not risky", () => {
  const warning = getKPIEarlyWarning({
    kpi: baseKpi,
    latestEntry: { value: 95, periodDate: "2026-02-01" },
    previousEntry: { value: 90, periodDate: "2026-01-01" },
    today: new Date("2026-05-05T12:00:00.000Z"),
  });

  assert.equal(warning?.severity, "low");
  assert.deepEqual(warning?.reasons, ["Data KPI sudah lama belum diperbarui"]);
});

test("returns null when KPI is healthy, improving, and fresh", () => {
  const warning = getKPIEarlyWarning({
    kpi: baseKpi,
    latestEntry: { value: 96, periodDate: "2026-05-01" },
    previousEntry: { value: 92, periodDate: "2026-04-01" },
    today: new Date("2026-05-05T12:00:00.000Z"),
  });

  assert.equal(warning, null);
});
