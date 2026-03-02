import { getAllDomains, getAllKPIs } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArchiveKPIButton } from "@/components/archive-kpi-button";
import { ReorderKPIButtons } from "@/components/reorder-kpi-buttons";
import Link from "next/link";
import { Plus, Pencil, Target, Archive } from "lucide-react";

export default async function AdminKPIPage() {
  const [kpis, domains] = await Promise.all([getAllKPIs(), getAllDomains()]);
  const domainMap = Object.fromEntries(domains.map((d) => [d.id, d]));

  // Group by domain for reorder first/last detection
  const kpisByDomain = new Map<number, typeof kpis>();
  for (const kpi of kpis) {
    const arr = kpisByDomain.get(kpi.domainId) ?? [];
    arr.push(kpi);
    kpisByDomain.set(kpi.domainId, arr);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kelola KPI</h1>
          <p className="text-muted-foreground text-sm mt-1">{kpis.length} KPI aktif</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/kpi/archived">
              <Archive className="w-4 h-4 mr-1" /> Arsip
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/kpi/new">
              <Plus className="w-4 h-4 mr-1" /> Tambah KPI
            </Link>
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
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
          {kpis.map((kpi) => {
            const domainKPIs = kpisByDomain.get(kpi.domainId) ?? [];
            const idx = domainKPIs.findIndex((k) => k.id === kpi.id);
            return (
              <TableRow key={kpi.id}>
                <TableCell>
                  <ReorderKPIButtons id={kpi.id} isFirst={idx === 0} isLast={idx === domainKPIs.length - 1} />
                </TableCell>
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
                  <div className="flex gap-1 justify-end">
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
                    <ArchiveKPIButton id={kpi.id} name={kpi.name} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
