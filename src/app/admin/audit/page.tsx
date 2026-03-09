import { getRecentAuditLogs, getAuditLogCount } from "@/lib/db/audit";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminAuditPage({ searchParams }: Props) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page ?? "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [logs, totalCount] = await Promise.all([
    getRecentAuditLogs(PAGE_SIZE, offset),
    getAuditLogCount(),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="w-6 h-6" /> Audit Log</h1>
        <p className="text-muted-foreground text-sm mt-1">{totalCount} total aktivitas</p>
      </div>
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
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Belum ada log.</TableCell></TableRow>
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
                  <Link href={`?page=${currentPage - 1}`}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Link>
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" asChild disabled={currentPage >= totalPages}>
                  <Link href={`?page=${currentPage + 1}`}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
