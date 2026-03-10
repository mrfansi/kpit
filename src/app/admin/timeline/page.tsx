import { getAllTimelineProjects } from "@/lib/queries/timeline";
import { getAllStatuses } from "@/lib/queries/timeline-statuses";
import { requireAdmin } from "@/lib/auth-utils";
import { deleteProject } from "@/lib/actions/timeline";
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
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { DeleteStatusButton } from "./statuses/delete-button";

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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Kelola Timeline</h1>
        <Link href="/timeline">
          <Button variant="outline" size="sm">
            Lihat Gantt Chart
          </Button>
        </Link>
      </div>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Projects ({projects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada project. Tambahkan melalui halaman Timeline.
            </p>
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
                      <form action={deleteProject.bind(null, p.id)}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          type="submit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </form>
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
            <p className="text-sm text-muted-foreground">
              Belum ada status. Tambahkan menggunakan form di atas.
            </p>
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
                      <DeleteStatusButton id={s.id} />
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
