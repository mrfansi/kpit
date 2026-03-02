import { getRecentAuditLogs } from "@/lib/db/audit";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ClipboardList } from "lucide-react";

export default async function AdminAuditPage() {
  const logs = await getRecentAuditLogs();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="w-6 h-6" /> Audit Log</h1>
        <p className="text-muted-foreground text-sm mt-1">50 aktivitas terakhir</p>
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
        </CardContent>
      </Card>
    </div>
  );
}
