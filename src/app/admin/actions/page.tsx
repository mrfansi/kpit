import Link from "next/link";
import type { ElementType } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, ListChecks } from "lucide-react";
import { getActionPlanDashboardSummary, getAllActionPlansWithKPI } from "@/lib/queries";
import { actionPlanStatusLabels, isActionPlanOverdue, type ActionPlanStatus } from "@/lib/action-plan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  searchParams: Promise<{ status?: string }>;
}

const filterOptions: { label: string; value: "all" | ActionPlanStatus }[] = [
  { label: "Semua", value: "all" },
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Done", value: "done" },
  { label: "Cancelled", value: "cancelled" },
];

const statusClass: Record<ActionPlanStatus, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  done: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground",
};

export default async function AdminActionsPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const selectedStatus = filterOptions.some((option) => option.value === status) ? status : "all";

  const [summary, rows] = await Promise.all([
    getActionPlanDashboardSummary(),
    getAllActionPlansWithKPI(),
  ]);

  const filtered = selectedStatus === "all"
    ? rows
    : rows.filter(({ action }) => action.status === selectedStatus);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ClipboardCheck className="h-6 w-6" />
          Action Plan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Ringkasan tindak lanjut KPI dan deadline yang perlu dipantau.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Action" value={summary.total} icon={ListChecks} />
        <SummaryCard label="Masih Aktif" value={summary.active} icon={ClipboardCheck} />
        <SummaryCard label="Overdue" value={summary.overdue} icon={AlertTriangle} tone="danger" />
        <SummaryCard label="Done Bulan Ini" value={summary.doneThisMonth} icon={CheckCircle2} tone="success" />
      </div>

      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <Button key={option.value} variant={selectedStatus === option.value ? "default" : "outline"} size="sm" asChild>
            <Link href={option.value === "all" ? "/admin/actions" : `/admin/actions?status=${option.value}`}>
              {option.label}
            </Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>KPI</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>PIC</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Belum ada action plan.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(({ action, kpi, domain }) => {
                    const overdue = isActionPlanOverdue(action);
                    return (
                      <TableRow key={action.id}>
                        <TableCell>
                          <Link href={`/kpi/${kpi.id}`} className="font-medium hover:underline">
                            {action.title}
                          </Link>
                          {action.description && <p className="mt-1 max-w-md text-xs text-muted-foreground">{action.description}</p>}
                        </TableCell>
                        <TableCell className="text-sm">{kpi.name}</TableCell>
                        <TableCell>
                          <Link href={`/domain/${domain.slug}`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                            {domain.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{action.owner}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(`${action.dueDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          {overdue && <Badge variant="destructive" className="ml-2 text-xs">Overdue</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge className={`border-0 text-xs ${statusClass[action.status]}`}>{actionPlanStatusLabels[action.status]}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: ElementType;
  tone?: "default" | "danger" | "success";
}) {
  const toneClass = tone === "danger" ? "text-red-500" : tone === "success" ? "text-green-500" : "text-primary";

  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${toneClass}`} />
      </CardContent>
    </Card>
  );
}
