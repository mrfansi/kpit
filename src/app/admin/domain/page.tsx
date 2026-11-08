import { getAllDomains } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { TableSearch } from "@/components/table-search";
import { EmptyState } from "@/components/empty-state";
import { PlusCircle, Pencil } from "lucide-react";
import Link from "next/link";
import { DeleteDomainButton } from "@/components/delete-domain-button";
import { domainIconMap } from "@/lib/domain-icons";
import { BarChart2 } from "lucide-react";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminDomainPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const allDomains = await getAllDomains();

  const query = q?.trim().toLowerCase() ?? "";
  const domains = query
    ? allDomains.filter((d) => d.name.toLowerCase().includes(query))
    : allDomains;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Kelola Domain"
        description="Tambah, edit, atau hapus domain KPI"
        actions={
          <Button size="sm" asChild>
            <Link href="/admin/domain/new">
              <PlusCircle aria-hidden />
              Tambah Domain
            </Link>
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="num text-sm text-muted-foreground">{domains.length} domain</p>
          <TableSearch placeholder="Cari nama domain…" />
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-0">Nama</TableHead>
              <TableHead className="hidden sm:table-cell">Slug</TableHead>
              <TableHead className="hidden md:table-cell">Icon</TableHead>
              <TableHead className="hidden md:table-cell">Warna</TableHead>
              <TableHead className="hidden lg:table-cell">Deskripsi</TableHead>
              <TableHead className="pr-0 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domains.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="px-0">
                  <EmptyState
                    compact
                    title={allDomains.length === 0 ? "Belum ada domain." : "Tidak ada domain yang cocok dengan pencarian."}
                    description={
                      allDomains.length === 0
                        ? "Buat domain pertama menggunakan tombol Tambah Domain di atas."
                        : "Coba kata kunci lain."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              domains.map((d) => {
                const Icon = domainIconMap[d.icon] ?? BarChart2;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="pl-0 font-semibold">{d.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {/* Slug dan kode warna adalah nilai kode, jadi boleh mono (lewat elemen code). */}
                      <code className="text-xs">{d.slug}</code>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Icon aria-label={d.icon} className="size-4" style={{ color: d.color }} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        {/* Warna identitas domain dari DB, sebagai kunci kecil persegi. */}
                        <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
                        <code className="text-xs text-muted-foreground">{d.color}</code>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-xs truncate text-muted-foreground lg:table-cell">
                      {d.description ?? "-"}
                    </TableCell>
                    <TableCell className="pr-0 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link href={`/admin/domain/${d.id}/edit`} aria-label="Edit domain" title="Edit domain">
                            <Pencil aria-hidden />
                          </Link>
                        </Button>
                        <DeleteDomainButton id={d.id} name={d.name} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
