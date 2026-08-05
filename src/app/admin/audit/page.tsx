import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AuditFilters } from "./audit-filters";

const PAGE_SIZE = 50;
const AUDIT_ACTIONS = ["create", "update", "delete"] as const;
const AUDIT_ENTITIES = ["kpi", "entry", "domain", "user"] as const;

interface Props {
  searchParams: Promise<{ page?: string; action?: string; entity?: string }>;
}

export default async function AdminAuditPage({ searchParams }: Props) {
  const { page, action, entity } = await searchParams;
  const currentPage = Math.max(1, Number(page ?? "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const filterAction = AUDIT_ACTIONS.includes(action as (typeof AUDIT_ACTIONS)[number]) ? action : undefined;
  const filterEntity = AUDIT_ENTITIES.includes(entity as (typeof AUDIT_ENTITIES)[number]) ? entity : undefined;

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
    <div className="space-y-6">
      <PageHeader
        title={<><ClipboardList className="w-6 h-6" /> Audit Log</>}
        description={`${totalCount} total aktivitas`}
      />
      <AuditFilters actions={[...AUDIT_ACTIONS]} entities={[...AUDIT_ENTITIES]} />
      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Entitas</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <EmptyState
                        compact
                        title={unfilteredCount === 0 ? "Belum ada log." : "Tidak ada log yang cocok dengan filter."}
                        description={unfilteredCount === 0 ? undefined : "Coba ubah aksi atau entitas."}
                      />
                    </TableCell>
                  </TableRow>
                ) : logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(l.createdAt), { addSuffix: true, locale: idLocale })}
                    </TableCell>
                    <TableCell className="text-sm">{l.userEmail ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={l.action === "delete" ? "destructive" : l.action === "create" ? "default" : "secondary"} className="text-xs">
                        {l.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{l.entity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.detail ?? l.entityId ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 text-sm">
              <span className="text-muted-foreground text-xs">
                Halaman {currentPage} dari {totalPages}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" asChild disabled={currentPage <= 1}>
                  <Link href={`?page=${currentPage - 1}${filterAction ? `&action=${filterAction}` : ""}${filterEntity ? `&entity=${filterEntity}` : ""}`}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Link>
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" asChild disabled={currentPage >= totalPages}>
                  <Link href={`?page=${currentPage + 1}${filterAction ? `&action=${filterAction}` : ""}${filterEntity ? `&entity=${filterEntity}` : ""}`}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
          {isFiltered && logs.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Menampilkan hasil terfilter dari {unfilteredCount} total log.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
