import { getAllDomains, getArchivedKPIs } from "@/lib/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RestoreKPIButton } from "@/components/restore-kpi-button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default async function ArchivedKPIPage() {
  const [kpis, domains] = await Promise.all([getArchivedKPIs(), getAllDomains()]);
  const domainMap = Object.fromEntries(domains.map((d) => [d.id, d]));

  return (
    <div className="space-y-8">
      <PageHeader
        title="KPI Diarsipkan"
        description={
          <>
            <span className="num">{kpis.length}</span> KPI tidak aktif, data historis tetap tersimpan
          </>
        }
      />

      {kpis.length === 0 ? (
        <EmptyState compact title="Tidak ada KPI yang diarsipkan." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-0">Nama KPI</TableHead>
              <TableHead className="hidden sm:table-cell">Domain</TableHead>
              <TableHead className="hidden sm:table-cell">Unit</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Target</TableHead>
              <TableHead className="pr-0 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kpis.map((kpi) => (
              <TableRow key={kpi.id}>
                <TableCell className="pl-0 font-semibold">{kpi.name}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {domainMap[kpi.domainId]?.name ?? "-"}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{kpi.unit}</TableCell>
                <TableCell className="num hidden text-right sm:table-cell">{kpi.target}</TableCell>
                <TableCell className="pr-0 text-right">
                  <RestoreKPIButton id={kpi.id} name={kpi.name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
