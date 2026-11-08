import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AUDIT_ENTITIES, type AuditEntity } from "@/lib/db/audit";
import { AuditFilters } from "./audit-filters";

const PAGE_SIZE = 50;
const AUDIT_ACTIONS = ["create", "update", "delete"] as const;
const ENTITY_LABELS: Record<AuditEntity, string> = {
  kpi: "KPI",
  kpi_entry: "Entri KPI",
  kpi_target: "Target KPI",
  kpi_comment: "Komentar KPI",
  kpi_action_plan: "Rencana Aksi",
  domain: "Domain",
  user: "Pengguna",
  timeline_project: "Proyek Timeline",
  timeline_project_log: "Log Proyek Timeline",
  timeline_project_status: "Status Timeline",
  monthly_report: "Laporan Bulanan",
};

interface Props {
  searchParams: Promise<{ page?: string; action?: string; entity?: string }>;
}

export default async function AdminAuditPage({ searchParams }: Props) {
  const { page, action, entity } = await searchParams;
  const currentPage = Math.max(1, Number(page ?? "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const filterAction = AUDIT_ACTIONS.includes(action as (typeof AUDIT_ACTIONS)[number]) ? action : undefined;
  const filterEntity = AUDIT_ENTITIES.find((e) => e === entity);

  const conditions = [
    filterAction ? eq(auditLogs.action, filterAction) : undefined,
    filterEntity ? eq(auditLogs.entity, filterEntity) : undefined,
  ].filter((c) => c !== undefined);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, [{ count: totalCount }], [{ count: unfilteredCount }]] = await Promise.all([
    db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(PAGE_SIZE).offset(offset).all(),
    db.select({ count: sql<number>`COUNT(*)` }).from(auditLogs).where(where),
    db.select({ count: sql<number>`COUNT(*)` }).from(auditLogs),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const isFiltered = Boolean(filterAction || filterEntity);

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title={<><ClipboardList aria-hidden className="size-5 text-muted-foreground" /> Audit Log</>}
        description={<><span className="num">{totalCount}</span> total aktivitas</>}
      />
      <div className="space-y-3">
        <AuditFilters actions={[...AUDIT_ACTIONS]} entities={AUDIT_ENTITIES.map((value) => ({ value, label: ENTITY_LABELS[value] }))} />
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-0">Waktu</TableHead>
              <TableHead className="hidden sm:table-cell">User</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead className="hidden md:table-cell">Entitas</TableHead>
              <TableHead className="pr-0">Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="whitespace-normal">
                  <EmptyState
                    compact
                    title={unfilteredCount === 0 ? "Belum ada log." : "Tidak ada log yang cocok dengan filter."}
                    description={unfilteredCount === 0 ? undefined : "Coba ubah aksi atau entitas."}
                  />
                </TableCell>
              </TableRow>
            ) : logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="num py-3 pl-0 text-muted-foreground">
                  {formatDistanceToNow(new Date(l.createdAt), { addSuffix: true, locale: idLocale })}
                </TableCell>
                <TableCell className="hidden py-3 sm:table-cell">{l.userEmail ?? <span className="text-muted-foreground">-</span>}</TableCell>
                <TableCell className="py-3">
                  <Badge variant={l.action === "delete" ? "destructive" : l.action === "create" ? "default" : "secondary"}>
                    {l.action}
                  </Badge>
                </TableCell>
                <TableCell className="hidden py-3 md:table-cell">{ENTITY_LABELS[l.entity as AuditEntity] ?? l.entity}</TableCell>
                <TableCell className="py-3 pr-0 whitespace-normal text-muted-foreground">{l.detail ?? l.entityId ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
            <span className="text-muted-foreground">
              Halaman <span className="num">{currentPage}</span> dari <span className="num">{totalPages}</span>
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="icon-sm" asChild disabled={currentPage <= 1}>
                <Link aria-label="Halaman sebelumnya" href={`?page=${currentPage - 1}${filterAction ? `&action=${filterAction}` : ""}${filterEntity ? `&entity=${filterEntity}` : ""}`}>
                  <ChevronLeft aria-hidden />
                </Link>
              </Button>
              <Button variant="outline" size="icon-sm" asChild disabled={currentPage >= totalPages}>
                <Link aria-label="Halaman berikutnya" href={`?page=${currentPage + 1}${filterAction ? `&action=${filterAction}` : ""}${filterEntity ? `&entity=${filterEntity}` : ""}`}>
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        )}
        {isFiltered && logs.length > 0 && (
          <p className="text-sm text-muted-foreground">Menampilkan hasil terfilter dari <span className="num">{unfilteredCount}</span> total log.</p>
        )}
      </div>
    </div>
  );
}
