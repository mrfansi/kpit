import { DomainForm } from "@/components/domain-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export default function NewDomainPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Tambah Domain Baru" description="Domain digunakan untuk mengelompokkan KPI" />
      <Card>
        <CardHeader><CardTitle className="text-base">Informasi Domain</CardTitle></CardHeader>
        <CardContent>
          <DomainForm />
        </CardContent>
      </Card>
    </div>
  );
}
