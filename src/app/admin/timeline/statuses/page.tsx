import { getAllStatuses } from "@/lib/queries/timeline-statuses";
import { requireAdmin } from "@/lib/auth-utils";
import { createStatus, deleteStatus } from "@/lib/actions/timeline-statuses";
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
import { DeleteStatusButton } from "./delete-button";

export const metadata = {
  title: "Status Timeline - KPI Dashboard",
};

export default async function AdminStatusesPage() {
  await requireAdmin();

  const statuses = await getAllStatuses();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Status Timeline</h1>
        <Link href="/admin/timeline">
          <Button variant="outline" size="sm">
            Kelola Timeline
          </Button>
        </Link>
      </div>

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
