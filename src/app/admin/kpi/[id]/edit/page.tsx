import { notFound } from "next/navigation";
import { getAllDomains, getKPIById } from "@/lib/queries";
import { KPIForm } from "@/components/kpi-form";
import { PageHeader } from "@/components/page-header";

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
      <PageHeader
        title="Edit KPI"
        description={<>Ubah konfigurasi KPI: <span className="font-medium">{kpi.name}</span></>}
      />
      <KPIForm domains={domains} defaultValues={kpi} />
    </div>
  );
}
