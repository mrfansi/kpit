import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getAllDomains } from "@/lib/queries";
import { defaultReportingPeriod, formatPeriodDate, listLastNMonths } from "@/lib/period";

export default async function MonthlyReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const selectedPeriod = period && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(period) ? period : defaultReportingPeriod();
  const domains = await getAllDomains();
  const periods = listLastNMonths(24);
  if (!periods.some((item) => item.value === selectedPeriod)) periods.push({ value: selectedPeriod, label: formatPeriodDate(selectedPeriod, "MMMM yyyy") });
  return <div className="max-w-5xl space-y-6">
    <PageHeader title="Laporan Bulanan" description="Pilih domain dan bulan untuk menyusun laporan divisi. Setiap domain memerlukan pemetaan divisi eksplisit." />
    <form action="/admin/reports/monthly" className="flex flex-wrap items-end gap-3"><label className="text-sm font-medium space-y-1">Periode laporan<select name="period" defaultValue={selectedPeriod} className="block rounded-md border border-input bg-background px-3 py-2 text-sm">{periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><Button type="submit" variant="outline">Tampilkan</Button></form>
    {domains.length ? <div className="divide-y rounded-md border">{domains.map((domain) => <div id={`domain-${domain.id}`} key={domain.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><h2 className="font-semibold">{domain.name}</h2><p className="text-xs text-muted-foreground">{formatPeriodDate(selectedPeriod, "MMMM yyyy")}</p></div><div className="flex gap-2"><Button size="sm" asChild><Link href={`/admin/reports/monthly/${encodeURIComponent(domain.slug)}?period=${selectedPeriod}`}>Sunting laporan</Link></Button><Button size="sm" variant="outline" asChild><Link href={`/report/${encodeURIComponent(domain.slug)}?period=${selectedPeriod}`}>Lihat laporan</Link></Button></div></div>)}</div> : <p className="text-sm text-muted-foreground">Belum ada domain. Buat domain dan KPI terlebih dahulu.</p>}
  </div>;
}
