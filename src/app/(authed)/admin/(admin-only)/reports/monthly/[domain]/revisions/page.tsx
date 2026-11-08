import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRevisionTime, listRevisions } from "@/lib/monthly-report-revisions";
import { defaultReportingPeriod, formatPeriodDate } from "@/lib/period";

export default async function MonthlyReportRevisionsPage({ params, searchParams }: { params: Promise<{ domain: string }>; searchParams: Promise<{ period?: string }> }) {
  const [{ domain: slug }, { period }] = await Promise.all([params, searchParams]);
  const selectedPeriod = period ?? defaultReportingPeriod();
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(selectedPeriod)) notFound();
  const result = await listRevisions(slug, selectedPeriod);
  if (!result) notFound();
  const { domain, revisions } = result;
  const query = `period=${selectedPeriod}`;
  return <div className="max-w-4xl space-y-6">
    <PageHeader
      title={`Riwayat revisi ${domain.name}`}
      description={<span className="num">{formatPeriodDate(selectedPeriod, "MMMM yyyy")}</span>}
      actions={<Button variant="outline" size="sm" asChild><Link href={`/admin/reports/monthly/${encodeURIComponent(domain.slug)}?${query}`}>Kembali ke editor</Link></Button>}
    />
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-0">Revisi</TableHead>
          <TableHead>Penulis</TableHead>
          <TableHead>Waktu</TableHead>
          <TableHead className="pr-0 text-right">Deck</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {revisions.length === 0 ? <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="whitespace-normal"><EmptyState compact title="Laporan ini belum pernah disimpan." /></TableCell>
        </TableRow> : revisions.map((row, index) => <TableRow key={row.revision}>
          <TableCell className="num py-3 pl-0 font-semibold">{row.revision}{index === 0 ? <span className="ml-2 font-normal text-muted-foreground">terbaru</span> : null}</TableCell>
          <TableCell className="py-3">{row.author}</TableCell>
          <TableCell className="num py-3 text-muted-foreground">{formatRevisionTime(row.createdAt)}</TableCell>
          <TableCell className="py-3 pr-0 text-right">
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/report/presentation?domain=${encodeURIComponent(domain.slug)}&${query}&revision=${row.revision}`} target="_blank" rel="noreferrer">Buka deck</a>
            </Button>
          </TableCell>
        </TableRow>)}
      </TableBody>
    </Table>
  </div>;
}
