import { getAllDomains, getAllKPIs } from "@/lib/queries";
import { ManualInputForm } from "@/components/manual-input-form";

export default async function AdminInputPage() {
  const [kpis, domains] = await Promise.all([getAllKPIs(), getAllDomains()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Input Data KPI</h1>
        <p className="text-muted-foreground text-sm mt-1">Masukkan data aktual KPI secara manual per periode</p>
      </div>
      <ManualInputForm kpis={kpis} domains={domains} />
    </div>
  );
}
