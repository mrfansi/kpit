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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-6">
      <PageHeader
        title="Kelola Timeline"
        description="Kelola project dan status yang tampil di Gantt Chart"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/timeline">
              <Button variant="outline" size="sm">
                Lihat Gantt Chart
              </Button>
            </Link>
            <AddProjectButton statuses={statuses} />
          </div>
        }
      />

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Projects ({projects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <EmptyState title="Belum ada project" description="Klik Tambah Project di atas untuk membuat yang pertama." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Warna</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {p.color}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.startDate} — {p.endDate}
                    </TableCell>
                    <TableCell className="text-xs">{p.progress}%</TableCell>
                    <TableCell>
                      <DeleteProjectButton id={p.id} name={p.name} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Status Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tambah Status</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createStatus} className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="name" className="text-xs">
                Nama
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Contoh: On Track"
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="color" className="text-xs">
                Warna
              </Label>
              <Input
                id="color"
                name="color"
                type="color"
                defaultValue="#6366f1"
                className="h-9 w-16 p-1 cursor-pointer"
              />
            </div>
            <Button type="submit" size="sm" className="h-9">
              Tambah
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Statuses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Daftar Status ({statuses.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statuses.length === 0 ? (
            <EmptyState title="Belum ada status" description="Tambahkan menggunakan form di atas." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Warna</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: s.color }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.slug}
                    </TableCell>
                    <TableCell>
                      <DeleteStatusButton id={s.id} name={s.name} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
