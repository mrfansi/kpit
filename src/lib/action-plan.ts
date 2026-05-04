export const ACTION_PLAN_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;

export type ActionPlanStatus = (typeof ACTION_PLAN_STATUSES)[number];

export const actionPlanStatusLabels: Record<ActionPlanStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const activeActionPlanStatuses: ActionPlanStatus[] = ["open", "in_progress"];

interface ActionPlanLike {
  status: ActionPlanStatus;
  dueDate: string;
  updatedAt?: Date;
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function isActionPlanOverdue(action: Pick<ActionPlanLike, "status" | "dueDate">, today = new Date()) {
  return activeActionPlanStatuses.includes(action.status) && action.dueDate < toDateOnly(today);
}

export function getActionPlanSummary(actions: ActionPlanLike[], today = new Date()) {
  const currentMonth = toDateOnly(today).slice(0, 7);

  return actions.reduce(
    (summary, action) => {
      summary.total += 1;
      if (activeActionPlanStatuses.includes(action.status)) summary.active += 1;
      if (isActionPlanOverdue(action, today)) summary.overdue += 1;
      if (action.status === "done" && action.updatedAt && toDateOnly(action.updatedAt).slice(0, 7) === currentMonth) {
        summary.doneThisMonth += 1;
      }
      return summary;
    },
    { total: 0, active: 0, overdue: 0, doneThisMonth: 0 }
  );
}

export function getReportActionPlans<T extends ActionPlanLike & { id?: number }>(
  actions: T[],
  periodDate: string,
  today = new Date()
) {
  const periodMonth = periodDate.slice(0, 7);

  return actions.filter((action) => {
    if (activeActionPlanStatuses.includes(action.status)) return true;
    if (isActionPlanOverdue(action, today)) return true;
    return action.status === "done" && action.updatedAt && toDateOnly(action.updatedAt).slice(0, 7) === periodMonth;
  });
}

export function getActionFocusItems<T extends ActionPlanLike & { id?: number }>(
  actions: T[],
  periodDate: string,
  today = new Date(),
  limit = 7
) {
  const reportActions = getReportActionPlans(actions, periodDate, today);
  const activeActions = reportActions.filter((action) => activeActionPlanStatuses.includes(action.status));
  const focusPool = activeActions.length > 0 ? activeActions : reportActions;

  return [...focusPool]
    .sort((a, b) => {
      const overdueDiff = Number(isActionPlanOverdue(b, today)) - Number(isActionPlanOverdue(a, today));
      if (overdueDiff !== 0) return overdueDiff;
      const activeDiff = Number(activeActionPlanStatuses.includes(b.status)) - Number(activeActionPlanStatuses.includes(a.status));
      if (activeDiff !== 0) return activeDiff;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, limit);
}
