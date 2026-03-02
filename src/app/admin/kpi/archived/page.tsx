import { getAllDomains, getArchivedKPIs } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RestoreKPIButton } from "@/components/restore-kpi-button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ArchivedKPIPage() {
  const [kpis, domains] = await Promise.all([getArchivedKPIs(), getAllDomains()]);
  const domainMap = Object.fromEntries(domains.map((d) => [d.id, d]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/kpi"><ArrowLeft className="w-4 h-4 mr-1" /> Kembali</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">KPI Diarsipkan</h1>
        <p className="text-muted-foreground text-sm mt-1">{kpis.length} KPI tidak aktif — data historis tetap tersimpan</p>
      </div>

      {kpis.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada KPI yang diarsipkan.</p>
      ) : (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama KPI</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kpis.map((kpi) => (
              <TableRow key={kpi.id} className="opacity-60">
                <TableCell className="font-medium">{kpi.name}</TableCell>
                <TableCell>{domainMap[kpi.domainId]?.name ?? "—"}</TableCell>
                <TableCell>{kpi.unit}</TableCell>
                <TableCell className="text-right">{kpi.target}</TableCell>
                <TableCell className="text-right">
                  <RestoreKPIButton id={kpi.id} name={kpi.name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
    </div>
  );
}
