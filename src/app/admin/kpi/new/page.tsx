import { getAllDomains } from "@/lib/queries";
import { KPIForm } from "@/components/kpi-form";
import { PageHeader } from "@/components/page-header";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewKPIPage() {
  const domains = await getAllDomains();

  return (
    <div className="space-y-6">
      <Link href="/admin/kpi" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Kelola KPI
      </Link>
      <PageHeader title="Tambah KPI Baru" description="Isi form di bawah untuk menambahkan KPI baru" />
      <KPIForm domains={domains} />
    </div>
  );
}
