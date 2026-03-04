import { getAllDomains, getAllKPIs } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { SortableKPITable } from "@/components/sortable-kpi-table";
import Link from "next/link";
import { Plus, Archive } from "lucide-react";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kelola KPI</h1>
          <p className="text-muted-foreground text-sm mt-1">{kpis.length} KPI aktif</p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      <div className="overflow-x-auto">
        <SortableKPITable kpis={pagedKpis} domainMap={domainMap} />
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t text-sm text-muted-foreground">
            <span>{kpis.length} KPI total</span>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <a href={`?page=${currentPage - 1}`} className="px-3 py-1 border rounded hover:bg-accent">← Sebelumnya</a>
              )}
              <span className="px-3 py-1">Hal {currentPage}/{totalPages}</span>
              {currentPage < totalPages && (
                <a href={`?page=${currentPage + 1}`} className="px-3 py-1 border rounded hover:bg-accent">Berikutnya →</a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
