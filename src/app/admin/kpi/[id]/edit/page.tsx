import { notFound } from "next/navigation";
import { getAllDomains, getKPIById } from "@/lib/queries";
import { KPIForm } from "@/components/kpi-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditKPIPage({ params }: Props) {
  const { id } = await params;
  const kpiId = Number(id);
  if (isNaN(kpiId)) notFound();

  const [kpi, domains] = await Promise.all([getKPIById(kpiId), getAllDomains()]);
  if (!kpi) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/kpi" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Kelola KPI
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Edit KPI</h1>
        <p className="text-muted-foreground text-sm mt-1">Ubah konfigurasi KPI: <span className="font-medium">{kpi.name}</span></p>
      </div>
      <KPIForm domains={domains} defaultValues={kpi} />
    </div>
  );
}
