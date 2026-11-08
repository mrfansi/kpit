import { DomainForm } from "@/components/domain-form";
import { PageHeader } from "@/components/page-header";

export default function NewDomainPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Tambah Domain Baru" description="Domain digunakan untuk mengelompokkan KPI" />
      <DomainForm />
    </div>
  );
}
