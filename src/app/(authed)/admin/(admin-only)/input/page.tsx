import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kpiEntries, kpiTargets } from "@/lib/db/schema";
import { getAllDomains, getAllKPIs, getEntriesForPeriod } from "@/lib/queries";
import { BulkTableInput } from "@/components/bulk-table-input";
import { PageHeader } from "@/components/page-header";
import { defaultReportingPeriod } from "@/lib/period";

/** Period "YYYY-MM-01" one month earlier, by string math (no timezone drift). */
function previousPeriod(period: string) {
  const [y, m] = period.split("-").map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
}

interface Props {
  searchParams: Promise<{ period?: string }>;
}

export default async function AdminInputPage({ searchParams }: Props) {
  const { period } = await searchParams;
  const selectedPeriod = period ?? defaultReportingPeriod();

  const prevPeriod = previousPeriod(selectedPeriod);
  const [kpis, domains, existingEntries, overrideRows, prevRows] = await Promise.all([
    getAllKPIs(),
    getAllDomains(),
    getEntriesForPeriod(selectedPeriod),
    db.select().from(kpiTargets).where(eq(kpiTargets.periodDate, selectedPeriod)),
    db.select({ kpiId: kpiEntries.kpiId, value: kpiEntries.value }).from(kpiEntries).where(eq(kpiEntries.periodDate, prevPeriod)),
  ]);

  const overrides = Object.fromEntries(
    overrideRows.map((r) => [r.kpiId, { target: r.target, thresholdGreen: r.thresholdGreen, thresholdYellow: r.thresholdYellow }]),
  );
  const previousValues = Object.fromEntries(prevRows.map((r) => [r.kpiId, r.value]));

  return (
    <div className="space-y-6">
      <PageHeader title="Input Data KPI" description="Isi nilai aktual semua KPI untuk satu periode sekaligus" />
      <BulkTableInput
        key={selectedPeriod}
        kpis={kpis}
        domains={domains}
        initialPeriod={selectedPeriod}
        existingEntries={existingEntries}
        overrides={overrides}
        previousValues={previousValues}
      />
    </div>
  );
}
