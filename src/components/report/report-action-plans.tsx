import { AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { actionPlanStatusLabels, getActionPlanSummary, getReportActionPlans, isActionPlanOverdue, type ActionPlanStatus } from "@/lib/action-plan";

type ReportActionRow = {
  action: {
    id: number;
    title: string;
    description: string | null;
    owner: string;
    dueDate: string;
    status: ActionPlanStatus;
    updatedAt: Date;
  };
  kpi: {
    id: number;
    name: string;
  };
  domain: {
    id: number;
    name: string;
    slug: string;
  };
};

interface ReportActionPlansProps {
  rows: ReportActionRow[];
  periodDate: string;
  showDomain?: boolean;
}

const statusClass: Record<ActionPlanStatus, string> = {
  open: "bg-blue-100 text-blue-700 print:bg-white print:text-black",
  in_progress: "bg-amber-100 text-amber-700 print:bg-white print:text-black",
  done: "bg-green-100 text-green-700 print:bg-white print:text-black",
  cancelled: "bg-muted text-muted-foreground print:bg-white print:text-black",
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ReportActionPlans({ rows, periodDate, showDomain = true }: ReportActionPlansProps) {
  const reportRows = getReportActionPlans(rows.map((row) => row.action), periodDate);
  const reportIds = new Set(reportRows.map((action) => action.id));
  const visibleRows = rows.filter((row) => reportIds.has(row.action.id));
  const summary = getActionPlanSummary(visibleRows.map((row) => row.action));

  if (visibleRows.length === 0) return null;

  return (
    <section className="mb-8 break-inside-avoid-page rounded-lg border border-border p-4 print:rounded-none print:border-black">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <ClipboardCheck className="h-4 w-4" />
            Action Plan Summary
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Tindak lanjut aktif, overdue, dan selesai pada periode laporan.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs">
          <div>
            <p className="font-bold text-foreground">{summary.active}</p>
            <p className="text-muted-foreground">aktif</p>
          </div>
          <div>
            <p className="font-bold text-red-600">{summary.overdue}</p>
            <p className="text-muted-foreground">overdue</p>
          </div>
          <div>
            <p className="font-bold text-green-600">{summary.doneThisMonth}</p>
            <p className="text-muted-foreground">done</p>
          </div>
        </div>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground print:border-black">
            <th className="py-1.5 pr-3 text-left font-medium">Action</th>
            <th className="py-1.5 px-2 text-left font-medium">KPI</th>
            {showDomain && <th className="py-1.5 px-2 text-left font-medium">Domain</th>}
            <th className="py-1.5 px-2 text-left font-medium">PIC</th>
            <th className="py-1.5 px-2 text-left font-medium">Deadline</th>
            <th className="py-1.5 pl-2 text-center font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(({ action, kpi, domain }) => {
            const overdue = isActionPlanOverdue(action);
            return (
              <tr key={action.id} className="border-b border-border/60 align-top last:border-b-0 print:border-black/40">
                <td className="py-2 pr-3">
                  <div className="font-medium">{action.title}</div>
                  {action.description && <div className="mt-0.5 max-w-md text-muted-foreground">{action.description}</div>}
                </td>
                <td className="py-2 px-2">{kpi.name}</td>
                {showDomain && <td className="py-2 px-2 text-muted-foreground">{domain.name}</td>}
                <td className="py-2 px-2">{action.owner}</td>
                <td className="py-2 px-2">
                  <span>{formatDate(action.dueDate)}</span>
                  {overdue && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-red-600">
                      <AlertTriangle className="h-3 w-3" />
                      Overdue
                    </span>
                  )}
                </td>
                <td className="py-2 pl-2 text-center">
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${statusClass[action.status]}`}>
                    {action.status === "done" && <CheckCircle2 className="h-3 w-3" />}
                    {actionPlanStatusLabels[action.status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
