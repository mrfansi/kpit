import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAllDomains } from "@/lib/queries";
import { formatRevisionTime, getKpiEntryCounts, getReportSummaries } from "@/lib/monthly-report-revisions";
import { defaultReportingPeriod, formatPeriodDate, listLastNMonths } from "@/lib/period";

export default async function MonthlyReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const selectedPeriod = period && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(period) ? period : defaultReportingPeriod();
  const domains = await getAllDomains();
  const [summaries, entryCounts] = await Promise.all([getReportSummaries(domains, selectedPeriod), getKpiEntryCounts(selectedPeriod)]);
  const periods = listLastNMonths(24);
  if (!periods.some((item) => item.value === selectedPeriod)) periods.push({ value: selectedPeriod, label: formatPeriodDate(selectedPeriod, "MMMM yyyy") });
  return <div className="max-w-5xl space-y-8">
    <PageHeader
      title="Laporan Bulanan"
      description="Pilih domain dan bulan untuk menyusun laporan divisi. Setiap domain memerlukan pemetaan divisi eksplisit."
      actions={<form action="/admin/reports/monthly" className="flex flex-wrap items-center gap-2">
        <label htmlFor="report-period" className="text-sm text-muted-foreground">Periode laporan</label>
        <select id="report-period" name="period" defaultValue={selectedPeriod} className="num h-8 rounded-md border border-input bg-card px-3 text-sm outline-2 outline-offset-[-3px] outline-transparent transition-colors duration-[var(--dur-micro)] hover:bg-accent focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55">{periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <Button type="submit" variant="outline" size="sm">Tampilkan</Button>
      </form>}
    />
    {domains.length ? <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="h-10 pr-4 text-left font-normal whitespace-nowrap">Domain</th>
            <th className="hidden h-10 px-4 text-left font-normal whitespace-nowrap sm:table-cell">Periode</th>
            <th className="h-10 px-4 text-left font-normal whitespace-nowrap">Status</th>
            <th className="h-10 pl-4 text-right font-normal whitespace-nowrap">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((domain) => {
            const summary = summaries.get(domain.id);
            const entries = entryCounts.get(domain.id) ?? { filled: 0, total: 0 };
            return <tr id={`domain-${domain.id}`} key={domain.id} className="border-b transition-colors duration-[var(--dur-micro)] last:border-0 hover:bg-paper-2">
            <td className="py-3 pr-4"><span className="font-semibold">{domain.name}</span><p className="num mt-1 text-xs text-muted-foreground">Entri KPI: {entries.filled} dari {entries.total}</p></td>
            <td className="num hidden px-4 py-3 text-muted-foreground sm:table-cell">{formatPeriodDate(selectedPeriod, "MMMM yyyy")}</td>
            <td className="px-4 py-3">
              {summary ? <>
                <Badge variant={summary.status.kind === "ready" ? "default" : summary.status.kind === "draft" ? "secondary" : "outline"}>{summary.status.label}</Badge>
                {summary.revision > 0 ? <p className="num mt-1 text-xs text-muted-foreground">Revisi {summary.revision}{summary.updatedAt ? `, ${formatRevisionTime(summary.updatedAt)}` : ""}{summary.updatedBy ? `, ${summary.updatedBy}` : ""}</p> : null}
              </> : <span className="text-muted-foreground">-</span>}
            </td>
            <td className="py-3 pl-4">
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="ghost" asChild><Link href={`/report/${encodeURIComponent(domain.slug)}?period=${selectedPeriod}`}>Lihat laporan</Link></Button>
                {summary && summary.revision > 0 ? <Button size="sm" variant="ghost" asChild><Link href={`/admin/reports/monthly/${encodeURIComponent(domain.slug)}/revisions?period=${selectedPeriod}`}>Riwayat revisi</Link></Button> : null}
                <Button size="sm" variant="outline" asChild><Link href={`/admin/reports/monthly/${encodeURIComponent(domain.slug)}?period=${selectedPeriod}`}>Sunting laporan</Link></Button>
              </div>
            </td>
          </tr>;
          })}
        </tbody>
      </table>
    </div> : <EmptyState compact title="Belum ada domain. Buat domain dan KPI terlebih dahulu." />}
  </div>;
}
