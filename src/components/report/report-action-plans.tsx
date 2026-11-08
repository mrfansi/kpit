import { AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { actionPlanStatusLabels, getActionPlanSummary, getReportActionPlans, isActionPlanOverdue, type ActionPlanStatus } from "@/lib/action-plan";
import { statusConfig } from "@/lib/kpi-status";
import { cn } from "@/lib/utils";
import { formatDueDate } from "@/lib/date-utils";

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

// Status action plan bukan status KPI: chip netral, tanpa hue. Cetak tanpa latar.
const statusClass: Record<ActionPlanStatus, string> = {
  open: "bg-secondary text-foreground",
  in_progress: "bg-secondary text-foreground",
  done: "bg-secondary text-foreground",
  cancelled: "bg-secondary text-muted-foreground",
};

const th = "py-2 pr-4 text-left text-sm font-normal whitespace-nowrap text-muted-foreground";

export function ReportActionPlans({ rows, periodDate, showDomain = true }: ReportActionPlansProps) {
  const reportRows = getReportActionPlans(rows.map((row) => row.action), periodDate);
  const reportIds = new Set(reportRows.map((action) => action.id));
  const visibleRows = rows.filter((row) => reportIds.has(row.action.id));
  const summary = getActionPlanSummary(visibleRows.map((row) => row.action));

  if (visibleRows.length === 0) return null;

  return (
    <section aria-labelledby="report-actions-heading" className="space-y-3 break-inside-avoid-page">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h2 id="report-actions-heading" className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardCheck aria-hidden className="size-4 text-muted-foreground" />
            Action plan summary
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Tindak lanjut aktif, overdue, dan selesai pada periode laporan.</p>
        </div>
        <dl className="flex gap-6 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="order-last text-muted-foreground">aktif</dt>
            <dd className="num text-xl leading-none font-semibold">{summary.active}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="order-last text-muted-foreground">overdue</dt>
            <dd className={cn("num text-xl leading-none font-semibold", summary.overdue > 0 && statusConfig.red.color)}>{summary.overdue}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="order-last text-muted-foreground">done</dt>
            <dd className="num text-xl leading-none font-semibold">{summary.doneThisMonth}</dd>
          </div>
        </dl>
      </div>

      {/* Tanpa pembungkus ini, tabel selebar ini membuat seluruh halaman
          bergeser horizontal di ponsel, bukan cuma tabelnya. */}
      <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className={th}>Action</th>
            <th className={cn(th, "hidden sm:table-cell print:table-cell")}>KPI</th>
            {showDomain && <th className={cn(th, "hidden md:table-cell print:table-cell")}>Domain</th>}
            <th className={cn(th, "hidden sm:table-cell print:table-cell")}>PIC</th>
            <th className={th}>Deadline</th>
            <th className={cn(th, "pr-0")}>Status</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(({ action, kpi, domain }) => {
            const overdue = isActionPlanOverdue(action);
            return (
              <tr key={action.id} className="border-b align-top last:border-b-0">
                <td className="py-2.5 pr-4">
                  <div className="font-semibold">{action.title}</div>
                  {action.description && <div className="mt-0.5 max-w-md text-muted-foreground">{action.description}</div>}
                </td>
                <td className="hidden py-2.5 pr-4 sm:table-cell print:table-cell">{kpi.name}</td>
                {showDomain && <td className="hidden py-2.5 pr-4 text-muted-foreground md:table-cell print:table-cell">{domain.name}</td>}
                <td className="hidden py-2.5 pr-4 sm:table-cell print:table-cell">{action.owner}</td>
                <td className="py-2.5 pr-4">
                  <span className="num whitespace-nowrap">{formatDueDate(action.dueDate)}</span>
                  {overdue && (
                    <span className={cn("mt-0.5 flex items-center gap-1 whitespace-nowrap", statusConfig.red.color)}>
                      <AlertTriangle aria-hidden className="size-3.5" />
                      Overdue
                    </span>
                  )}
                </td>
                <td className="py-2.5">
                  <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 whitespace-nowrap print:bg-transparent print:px-0", statusClass[action.status])}>
                    {action.status === "done" && <CheckCircle2 aria-hidden className="size-3.5" />}
                    {actionPlanStatusLabels[action.status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </section>
  );
}
