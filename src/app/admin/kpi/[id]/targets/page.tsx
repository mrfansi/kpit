import { notFound } from "next/navigation";
import { getKPIById, getKPITargets } from "@/lib/queries";
import { TargetForm } from "@/components/target-form";
import { DeleteTargetButton } from "@/components/delete-target-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatValue, formatPeriodDate } from "@/lib/period";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
    <div className="space-y-6">
      <Link href={`/admin/kpi`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Kelola KPI
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Target per Periode</h1>
        <p className="text-muted-foreground text-sm mt-1">
          KPI: <span className="font-medium text-foreground">{kpi.name}</span>
          &nbsp;·&nbsp; Target default: <span className="font-medium text-foreground">{formatValue(kpi.target, kpi.unit)}</span>
        </p>
      </div>

      {/* Form tambah / ubah target */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah / Ubah Target Override</CardTitle>
        </CardHeader>
        <CardContent>
          <TargetForm kpi={kpi} />
        </CardContent>
      </Card>

      {/* Daftar override yang sudah ada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Target Override Tersimpan
            <Badge variant="secondary" className="ml-2">{targets.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent><div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periode</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Threshold Hijau</TableHead>
                <TableHead className="text-right">Threshold Kuning</TableHead>
                <TableHead className="text-right print:hidden">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Belum ada target override. Semua periode menggunakan target default.
                  </TableCell>
                </TableRow>
              ) : (
                targets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{formatPeriodDate(t.periodDate, "MMMM yyyy")}</TableCell>
                    <TableCell className="text-right">{formatValue(t.target, kpi.unit)}</TableCell>
                    <TableCell className="text-right">{formatValue(t.thresholdGreen, kpi.unit)}</TableCell>
                    <TableCell className="text-right">{formatValue(t.thresholdYellow, kpi.unit)}</TableCell>
                    <TableCell className="text-right print:hidden">
                      <DeleteTargetButton id={t.id} kpiId={kpi.id} period={formatPeriodDate(t.periodDate, "MMMM yyyy")} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
