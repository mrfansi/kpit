import Link from "next/link";
import { getActionPlanDashboardSummary, getAllActionPlansWithKPI } from "@/lib/queries";
import { actionPlanStatusLabels, isActionPlanOverdue, type ActionPlanStatus } from "@/lib/action-plan";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { TableSearch } from "@/components/table-search";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { formatDueDate } from "@/lib/date-utils";

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

const filterOptions: { label: string; value: "all" | ActionPlanStatus }[] = [
  { label: "Semua", value: "all" },
  { label: actionPlanStatusLabels.open, value: "open" },
  { label: actionPlanStatusLabels.in_progress, value: "in_progress" },
  { label: actionPlanStatusLabels.done, value: "done" },
  { label: actionPlanStatusLabels.cancelled, value: "cancelled" },
];

// Neutral/warna semantik: "open" tidak punya sinyal baik/buruk jadi netral
// (secondary), sisanya dipetakan ke token status yang sudah ada.
const statusClass: Record<ActionPlanStatus, string> = {
  open: "bg-secondary text-secondary-foreground",
  in_progress: "bg-warning-soft text-warning",
  done: "bg-success-soft text-success",
  cancelled: "bg-muted text-muted-foreground",
};

export default async function AdminActionsPage({ searchParams }: Props) {
  const { status, q } = await searchParams;
  const selectedStatus = filterOptions.some((option) => option.value === status) ? status : "all";

  const [summary, rows] = await Promise.all([
    getActionPlanDashboardSummary(),
    getAllActionPlansWithKPI(),
  ]);

  const byStatus = selectedStatus === "all"
    ? rows
    : rows.filter(({ action }) => action.status === selectedStatus);

  const query = q?.trim().toLowerCase() ?? "";
  const filtered = query
    ? byStatus.filter(({ action }) => action.title.toLowerCase().includes(query))
    : byStatus;

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <PageHeader
          title="Action Plan"
          description="Ringkasan tindak lanjut KPI dan deadline yang perlu dipantau."
        />

        {/* Readout layar: empat hitungan dalam satu pita, dipisah garis rambut. */}
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-y py-5 sm:grid-cols-4">
          <SummaryReadout label="Total action" value={summary.total} />
          <SummaryReadout label="Masih aktif" value={summary.active} />
          <SummaryReadout label="Terlambat" value={summary.overdue} tone={summary.overdue > 0 ? "text-danger" : undefined} />
          <SummaryReadout label="Selesai bulan ini" value={summary.doneThisMonth} />
        </dl>
      </div>

      <section aria-label="Daftar action plan" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Kontrol bersegmen: satu bingkai, pilihan aktif diangkat ke permukaan. */}
          <nav aria-label="Filter status" className="inline-flex w-fit max-w-full shrink-0 gap-0.5 overflow-x-auto rounded-md border bg-card p-0.5">
            {filterOptions.map((option) => {
              const active = selectedStatus === option.value;
              return (
                <Link
                  key={option.value}
                  href={option.value === "all" ? "/admin/actions" : `/admin/actions?status=${option.value}`}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "inline-flex h-8 shrink-0 items-center rounded-sm bg-secondary px-2.5 text-sm font-semibold whitespace-nowrap text-foreground"
                      : "inline-flex h-8 shrink-0 items-center rounded-sm px-2.5 text-sm whitespace-nowrap text-muted-foreground transition-colors duration-[var(--dur-micro)] hover:bg-accent hover:text-foreground"
                  }
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>
          <TableSearch placeholder="Cari judul action…" />
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-0">Action</TableHead>
              <TableHead className="hidden md:table-cell">KPI</TableHead>
              <TableHead className="hidden lg:table-cell">Domain</TableHead>
              <TableHead className="hidden sm:table-cell">PIC</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="pr-0">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="px-0">
                  <EmptyState
                    compact
                    title={rows.length === 0 ? "Belum ada action plan." : "Tidak ada action plan yang cocok dengan filter."}
                    description={rows.length === 0 ? undefined : "Coba ubah pencarian atau status."}
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(({ action, kpi, domain }) => {
                const overdue = isActionPlanOverdue(action);
                return (
                  <TableRow key={action.id}>
                    <TableCell className="min-w-56 py-3 pl-0 whitespace-normal">
                      <Link href={`/kpi/${kpi.id}`} className="font-semibold underline-offset-4 hover:underline">
                        {action.title}
                      </Link>
                      {action.description && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{action.description}</p>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{kpi.name}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Link href={`/domain/${domain.slug}`} className="text-muted-foreground underline-offset-4 transition-colors duration-[var(--dur-micro)] hover:text-foreground hover:underline">
                        {domain.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{action.owner}</TableCell>
                    <TableCell>
                      <span className="num">
                        {formatDueDate(action.dueDate)}
                      </span>
                      {overdue && <Badge variant="destructive" className="ml-2">Terlambat</Badge>}
                    </TableCell>
                    <TableCell className="pr-0">
                      <Badge className={statusClass[action.status]}>{actionPlanStatusLabels[action.status]}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function SummaryReadout({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="order-2 text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("num order-1 text-3xl leading-none font-semibold tracking-tight", tone)}>{value}</dd>
    </div>
  );
}
