import { getAllDomains, getAllKPIs, getEntriesForPeriod } from "@/lib/queries";
import { BulkTableInput } from "@/components/bulk-table-input";
import { PageHeader } from "@/components/page-header";
import { listLastNMonths } from "@/lib/period";

interface Props {
  searchParams: Promise<{ period?: string }>;
}

export default async function AdminInputPage({ searchParams }: Props) {
  const { period } = await searchParams;
  const months = listLastNMonths(12);
  const selectedPeriod = period ?? months[0]?.value ?? "";

  const [kpis, domains, existingEntries] = await Promise.all([
    getAllKPIs(),
    getAllDomains(),
    getEntriesForPeriod(selectedPeriod),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Input Data KPI" description="Isi nilai aktual semua KPI untuk satu periode sekaligus" />
      <BulkTableInput
        key={selectedPeriod}
        kpis={kpis}
        domains={domains}
        initialPeriod={selectedPeriod}
        existingEntries={existingEntries}
      />
    </div>
  );
}
