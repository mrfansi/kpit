import { getAllTimelineProjects } from "@/lib/queries/timeline";
import { getAllStatuses } from "@/lib/queries/timeline-statuses";
import { requireAdmin } from "@/lib/auth-utils";
import { createStatus } from "@/lib/actions/timeline-statuses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { DeleteStatusButton } from "./statuses/delete-button";
import { DeleteProjectButton } from "./delete-project-button";
import { AddProjectButton } from "./add-project-button";

export const metadata = {
  title: "Kelola Timeline - KPI Dashboard",
};

export default async function AdminTimelinePage() {
  await requireAdmin();

  const [projects, statuses] = await Promise.all([
    getAllTimelineProjects(),
    getAllStatuses(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <PageHeader
        title="Kelola Timeline"
        description="Kelola project dan status yang tampil di Gantt Chart"
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/timeline">Lihat Gantt Chart</Link>
            </Button>
            <AddProjectButton statuses={statuses} />
          </>
        }
      />

      {/* Projects Table */}
      <section aria-labelledby="projects-heading" className="space-y-3">
        <h2 id="projects-heading" className="text-lg font-semibold">
          Projects <span className="num font-normal text-muted-foreground">({projects.length})</span>
        </h2>
        {projects.length === 0 ? (
          <EmptyState title="Belum ada project" description="Klik Tambah Project di atas untuk membuat yang pertama." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="hidden sm:table-cell">Warna</TableHead>
                <TableHead className="hidden sm:table-cell">Periode</TableHead>
                <TableHead className="text-right">Progress</TableHead>
                <TableHead className="w-16"><span className="sr-only">Aksi</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-3 rounded-sm"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="font-outlier text-xs text-muted-foreground">
                        {p.color}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="num hidden sm:table-cell text-muted-foreground">
                    {p.startDate} - {p.endDate}
                  </TableCell>
                  <TableCell className="num text-right">{p.progress}%</TableCell>
                  <TableCell className="text-right">
                    <DeleteProjectButton id={p.id} name={p.name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Add Status Form */}
      <section aria-labelledby="add-status-heading" className="space-y-3">
        <h2 id="add-status-heading" className="text-lg font-semibold">Tambah status</h2>
        <form action={createStatus} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1 space-y-2">
            <Label htmlFor="name">Nama</Label>
            <Input
              id="name"
              name="name"
              placeholder="Contoh: On Track"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Warna</Label>
            <Input
              id="color"
              name="color"
              type="color"
              defaultValue="#6366f1"
              className="w-16 cursor-pointer p-1"
            />
          </div>
          {/* Outline: primary layar ini adalah Tambah project di kepala. */}
          <Button type="submit" variant="outline">
            Tambah
          </Button>
        </form>
      </section>

      {/* Statuses Table */}
      <section aria-labelledby="statuses-heading" className="space-y-3">
        <h2 id="statuses-heading" className="text-lg font-semibold">
          Daftar status <span className="num font-normal text-muted-foreground">({statuses.length})</span>
        </h2>
        {statuses.length === 0 ? (
          <EmptyState title="Belum ada status" description="Tambahkan menggunakan form di atas." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Warna</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead className="hidden sm:table-cell">Slug</TableHead>
                <TableHead className="w-16"><span className="sr-only">Aksi</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <span
                      aria-hidden
                      className="block size-3 rounded-sm"
                      style={{ backgroundColor: s.color }}
                    />
                  </TableCell>
                  <TableCell className="font-semibold">{s.name}</TableCell>
                  <TableCell className="font-outlier hidden sm:table-cell text-xs text-muted-foreground">
                    {s.slug}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteStatusButton id={s.id} name={s.name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
