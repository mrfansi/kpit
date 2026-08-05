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
    <div className="space-y-6">
      <PageHeader
        title="Kelola KPI"
        description={`${kpis.length} KPI aktif`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/kpi/archived">
                <Archive className="w-4 h-4 mr-1" /> Arsip
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/kpi/new">
                <Plus className="w-4 h-4 mr-1" /> Tambah KPI
              </Link>
            </Button>
          </>
        }
      />

      <div className="overflow-x-auto">
        <SortableKPITable kpis={pagedKpis} domainMap={domainMap} />
        {totalPages > 1 && (
          <nav aria-label="Navigasi halaman" className="flex items-center justify-between pt-3 border-t text-sm text-muted-foreground">
            <span className="num">{kpis.length} KPI total</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" asChild disabled={currentPage <= 1}>
                <Link href={`?page=${currentPage - 1}`} aria-label="Halaman sebelumnya">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Link>
              </Button>
              <span className="num px-2" aria-current="page">Hal {currentPage}/{totalPages}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" asChild disabled={currentPage >= totalPages}>
                <Link href={`?page=${currentPage + 1}`} aria-label="Halaman berikutnya">
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
