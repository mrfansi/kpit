import { notFound } from "next/navigation";
import { getKPIById, getKPITargets } from "@/lib/queries";
import { TargetForm } from "@/components/target-form";
import { DeleteTargetButton } from "@/components/delete-target-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { formatValue, formatPeriodDate } from "@/lib/period";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function KPITargetsPage({ params }: Props) {
  const { id } = await params;
  const kpiId = Number(id);
  if (isNaN(kpiId)) notFound();

  const kpi = await getKPIById(kpiId);
  if (!kpi) notFound();

  const targets = await getKPITargets(kpiId);

  return (
    <div className="max-w-2xl space-y-10">
      <PageHeader
        title="Target per Periode"
        description={
          <>
            KPI: <span className="font-semibold text-foreground">{kpi.name}</span>. Target default:{" "}
            <span className="num font-semibold text-foreground">{formatValue(kpi.target, kpi.unit)}</span>
          </>
        }
      />

      {/* Daftar override yang sudah ada: tabel telanjang, garis horizontal saja. */}
      <section aria-labelledby="targets-saved-heading" className="space-y-3">
        <div className="flex items-baseline gap-3">
          <h2 id="targets-saved-heading" className="text-lg font-semibold">Target override tersimpan</h2>
          <span className="num text-sm text-muted-foreground">{targets.length}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-0">Periode</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Threshold hijau</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Threshold kuning</TableHead>
              <TableHead className="pr-0 text-right print:hidden">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="px-0">
                  <EmptyState
                    compact
                    title="Belum ada target override."
                    description="Semua periode menggunakan target default."
                  />
                </TableCell>
              </TableRow>
            ) : (
              targets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="num pl-0 font-semibold">{formatPeriodDate(t.periodDate, "MMMM yyyy")}</TableCell>
                  <TableCell className="num text-right">{formatValue(t.target, kpi.unit)}</TableCell>
                  <TableCell className="num hidden text-right sm:table-cell">{formatValue(t.thresholdGreen, kpi.unit)}</TableCell>
                  <TableCell className="num hidden text-right sm:table-cell">{formatValue(t.thresholdYellow, kpi.unit)}</TableCell>
                  <TableCell className="pr-0 text-right print:hidden">
                    <DeleteTargetButton id={t.id} kpiId={kpi.id} period={formatPeriodDate(t.periodDate, "MMMM yyyy")} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {/* Form tambah / ubah target, di bawah daftar yang diubahnya. */}
      <section aria-labelledby="targets-form-heading" className="space-y-5">
        <h2 id="targets-form-heading" className="text-lg font-semibold">Tambah / ubah target override</h2>
        <TargetForm kpi={kpi} />
      </section>
    </div>
  );
}
