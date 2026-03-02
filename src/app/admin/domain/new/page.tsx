import { DomainForm } from "@/components/domain-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewDomainPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tambah Domain Baru</h1>
        <p className="text-muted-foreground text-sm mt-1">Domain digunakan untuk mengelompokkan KPI</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Informasi Domain</CardTitle></CardHeader>
        <CardContent>
          <DomainForm />
        </CardContent>
      </Card>
    </div>
  );
}
