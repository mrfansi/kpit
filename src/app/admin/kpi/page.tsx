import { getAllDomains, getAllKPIs } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { SortableKPITable } from "@/components/sortable-kpi-table";
import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { Plus, Archive, ChevronLeft, ChevronRight } from "lucide-react";

export default async function AdminKPIPage({ searchParams }: { searchParams: Promise<{ page?: string; success?: string }> }) {
  const page = Number((await searchParams).page ?? 1);
  const [kpis, domains] = await Promise.all([getAllKPIs(), getAllDomains()]);
  const domainMap = Object.fromEntries(domains.map((d) => [d.id, d.name]));

  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(kpis.length / PAGE_SIZE);
  const currentPage = Math.max(1, Math.min(page, totalPages || 1));
  const pagedKpis = kpis.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Kelola KPI"
        description={<span className="num">{kpis.length} KPI aktif</span>}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/kpi/archived">
                <Archive aria-hidden /> Arsip
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/admin/kpi/new">
                <Plus aria-hidden /> Tambah KPI
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-3">
        <SortableKPITable kpis={pagedKpis} domainMap={domainMap} />
        {totalPages > 1 && (
          <nav aria-label="Navigasi halaman" className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
            <span className="num">{kpis.length} KPI total</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" asChild disabled={currentPage <= 1}>
                <Link href={`?page=${currentPage - 1}`} aria-label="Halaman sebelumnya">
                  <ChevronLeft aria-hidden />
                </Link>
              </Button>
              <span className="num px-2" aria-current="page">Hal {currentPage}/{totalPages}</span>
              <Button variant="outline" size="icon-sm" asChild disabled={currentPage >= totalPages}>
                <Link href={`?page=${currentPage + 1}`} aria-label="Halaman berikutnya">
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
