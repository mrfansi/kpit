import { getAllUsers } from "@/lib/db/users";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DeleteUserButton } from "@/components/delete-user-button";
import { AddUserForm } from "@/components/add-user-form";
import { PageHeader } from "@/components/page-header";
import { TableSearch } from "@/components/table-search";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Users } from "lucide-react";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const [allUsers, session] = await Promise.all([getAllUsers(), auth()]);
  const currentUserId = session?.user?.id;

  const query = q?.trim().toLowerCase() ?? "";
  const userList = query
    ? allUsers.filter((u) => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
    : allUsers;

  return (
    <div className="space-y-6">
      <PageHeader
        title={<><Users className="w-6 h-6" /> Manajemen User</>}
        description={`${allUsers.length} user terdaftar`}
      />

      {/* Daftar User */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Daftar User</CardTitle>
          <TableSearch placeholder="Cari nama/email..." />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {allUsers.length === 0
                        ? "Belum ada user."
                        : "Tidak ada user yang cocok dengan pencarian. Coba kata kunci lain."}
                    </TableCell>
                  </TableRow>
                ) : (
                  userList.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.name}
                        {u.id === currentUserId && (
                          <Badge variant="outline" className="ml-2 text-xs">Anda</Badge>
                        )}
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true, locale: idLocale })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DeleteUserButton id={u.id} name={u.name} isCurrentUser={u.id === currentUserId} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Form Tambah User */}
      <AddUserForm />
    </div>
  );
}
