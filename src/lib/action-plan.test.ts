import assert from "node:assert/strict";
import test from "node:test";
import { getActionFocusItems, getActionPlanSummary, getReportActionPlans, isActionPlanOverdue } from "./action-plan";

const today = new Date("2026-05-05T12:00:00.000Z");

test("marks only active action plans past their due date as overdue", () => {
  assert.equal(isActionPlanOverdue({ status: "open", dueDate: "2026-05-04" }, today), true);
  assert.equal(isActionPlanOverdue({ status: "in_progress", dueDate: "2026-05-05" }, today), false);
  assert.equal(isActionPlanOverdue({ status: "done", dueDate: "2026-05-01" }, today), false);
  assert.equal(isActionPlanOverdue({ status: "cancelled", dueDate: "2026-05-01" }, today), false);
});

test("summarizes open, overdue, and done-this-month action plans", () => {
  const summary = getActionPlanSummary([
    { status: "open", dueDate: "2026-05-04", updatedAt: new Date("2026-05-04T08:00:00.000Z") },
    { status: "in_progress", dueDate: "2026-05-20", updatedAt: new Date("2026-05-03T08:00:00.000Z") },
    { status: "done", dueDate: "2026-04-30", updatedAt: new Date("2026-05-01T08:00:00.000Z") },
    { status: "done", dueDate: "2026-04-15", updatedAt: new Date("2026-04-30T08:00:00.000Z") },
    { status: "cancelled", dueDate: "2026-05-01", updatedAt: new Date("2026-05-01T08:00:00.000Z") },
  ], today);

  assert.deepEqual(summary, {
    total: 5,
    active: 2,
    overdue: 1,
    doneThisMonth: 1,
  });
});

test("selects active, overdue, and done-in-period action plans for reports", () => {
  const actions = [
    { id: 1, status: "open" as const, dueDate: "2026-05-20", updatedAt: new Date("2026-05-01T08:00:00.000Z") },
    { id: 2, status: "in_progress" as const, dueDate: "2026-05-04", updatedAt: new Date("2026-05-01T08:00:00.000Z") },
    { id: 3, status: "done" as const, dueDate: "2026-04-30", updatedAt: new Date("2026-05-03T08:00:00.000Z") },
    { id: 4, status: "done" as const, dueDate: "2026-04-30", updatedAt: new Date("2026-04-30T08:00:00.000Z") },
    { id: 5, status: "cancelled" as const, dueDate: "2026-05-01", updatedAt: new Date("2026-05-01T08:00:00.000Z") },
  ];

  assert.deepEqual(
    getReportActionPlans(actions, "2026-05-01", today).map((action) => action.id),
    [1, 2, 3]
  );
});

test("prioritizes action focus items by overdue, active status, then deadline", () => {
  const actions = [
    { id: 1, status: "open" as const, dueDate: "2026-05-20", updatedAt: new Date("2026-05-01T08:00:00.000Z") },
    { id: 2, status: "in_progress" as const, dueDate: "2026-05-04", updatedAt: new Date("2026-05-01T08:00:00.000Z") },
    { id: 3, status: "done" as const, dueDate: "2026-05-02", updatedAt: new Date("2026-05-03T08:00:00.000Z") },
    { id: 4, status: "open" as const, dueDate: "2026-05-10", updatedAt: new Date("2026-05-01T08:00:00.000Z") },
  ];

  assert.deepEqual(
    getActionFocusItems(actions, "2026-05-01", today, 3).map((action) => action.id),
    [2, 4, 1]
  );
});
