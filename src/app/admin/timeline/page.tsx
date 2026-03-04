import { getAllTimelineProjects } from "@/lib/queries/timeline";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { deleteProject } from "@/lib/actions/timeline";
import Link from "next/link";

export const metadata = {
  title: "Kelola Timeline - KPI Dashboard",
};

export default async function AdminTimelinePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const projects = await getAllTimelineProjects();

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
    </div>
  );
}
