import { getAllDomains } from "@/lib/queries";
import { KPIForm } from "@/components/kpi-form";
import { PageHeader } from "@/components/page-header";

export default async function NewKPIPage() {
  const domains = await getAllDomains();

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Tambah KPI Baru" description="Isi form di bawah untuk menambahkan KPI baru" />
      <KPIForm domains={domains} />
    </div>
  );
}
