import { getAllDomains } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Pencil } from "lucide-react";
import Link from "next/link";
import { DeleteDomainButton } from "@/components/delete-domain-button";
import { domainIconMap } from "@/lib/domain-icons";
import { BarChart2 } from "lucide-react";

export default async function AdminDomainPage() {
  const domains = await getAllDomains();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kelola Domain</h1>
          <p className="text-muted-foreground text-sm mt-1">Tambah, edit, atau hapus domain KPI</p>
        </div>
        <Button asChild>
          <Link href="/admin/domain/new">
            <PlusCircle className="w-4 h-4 mr-2" />
            Tambah Domain
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{domains.length} Domain</CardTitle>
        </CardHeader>
        <CardContent><div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Icon</TableHead>
                <TableHead>Warna</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Belum ada domain. <Link href="/admin/domain/new" className="underline">Tambah sekarang</Link>.
                  </TableCell>
                </TableRow>
              ) : (
                domains.map((d) => {
                  const Icon = domainIconMap[d.icon] ?? BarChart2;
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-xs">{d.slug}</Badge>
                      </TableCell>
                      <TableCell>
                        <Icon className="w-4 h-4" style={{ color: d.color }} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-4 h-4 rounded-full border"
                            style={{ background: d.color }}
                          />
                          <span className="text-xs font-mono text-muted-foreground">{d.color}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                        {d.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/admin/domain/${d.id}/edit`}>
                              <Pencil className="w-4 h-4" />
                            </Link>
                          </Button>
                          <DeleteDomainButton id={d.id} name={d.name} />
                        </div>
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
