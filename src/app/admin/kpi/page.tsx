import { getAllDomains, getAllKPIs } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DeleteKPIButton } from "@/components/delete-kpi-button";
import Link from "next/link";
import { Plus, Pencil, Target } from "lucide-react";

export default async function AdminKPIPage() {
  const [kpis, domains] = await Promise.all([getAllKPIs(), getAllDomains()]);
  const domainMap = Object.fromEntries(domains.map((d) => [d.id, d]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kelola KPI</h1>
          <p className="text-muted-foreground text-sm mt-1">{kpis.length} KPI aktif</p>
        </div>
        <Button asChild>
          <Link href="/admin/kpi/new">
            <Plus className="w-4 h-4 mr-1" /> Tambah KPI
          </Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama KPI</TableHead>
            <TableHead>Domain</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Target</TableHead>
            <TableHead>Periode</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {kpis.map((kpi) => (
            <TableRow key={kpi.id}>
              <TableCell className="font-medium">{kpi.name}</TableCell>
              <TableCell>
                <span className="text-sm">{domainMap[kpi.domainId]?.name ?? "—"}</span>
              </TableCell>
              <TableCell>{kpi.unit}</TableCell>
              <TableCell className="text-right">{kpi.target}</TableCell>
              <TableCell className="capitalize">{kpi.period}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs capitalize">{kpi.refreshType}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="icon" asChild title="Atur target per periode">
                    <Link href={`/admin/kpi/${kpi.id}/targets`}>
                      <Target className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/kpi/${kpi.id}/edit`}>
                      <Pencil className="w-4 h-4" />
                    </Link>
                  </Button>
                  <DeleteKPIButton id={kpi.id} name={kpi.name} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
