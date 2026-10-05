import { notFound } from "next/navigation";
import { MonthlyReportEditor } from "@/components/report/monthly-report-editor";
import { getMonthlyReportBundle } from "@/lib/monthly-report-store";
import { defaultReportingPeriod } from "@/lib/period";

export default async function MonthlyDomainPage({ params, searchParams }: { params: Promise<{ domain: string }>; searchParams: Promise<{ period?: string }> }) {
  const [{ domain }, { period }] = await Promise.all([params, searchParams]);
  const selectedPeriod = period ?? defaultReportingPeriod();
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(selectedPeriod)) notFound();
  const bundle = await getMonthlyReportBundle(domain, selectedPeriod);
  if (!bundle) notFound();
  return <MonthlyReportEditor key={`${domain}:${selectedPeriod}`} initial={bundle} />;
}
