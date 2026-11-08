import { getAllUsers } from "@/lib/db/users";
import { auth } from "@/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DeleteUserButton } from "@/components/delete-user-button";
import { AddUserForm } from "@/components/add-user-form";
import { PageHeader } from "@/components/page-header";
import { TableSearch } from "@/components/table-search";
import { EmptyState } from "@/components/empty-state";
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
    <div className="max-w-5xl space-y-10">
      <PageHeader
        title={<><Users aria-hidden className="size-5 text-muted-foreground" /> Manajemen User</>}
        description={<><span className="num">{allUsers.length}</span> user terdaftar</>}
      />

      {/* Daftar User */}
      <section aria-labelledby="users-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="users-heading" className="text-lg font-semibold">Daftar user</h2>
          <TableSearch placeholder="Cari nama/email…" />
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-0">Nama</TableHead>
              <TableHead className="hidden sm:table-cell">Email</TableHead>
              <TableHead className="hidden md:table-cell">Role</TableHead>
              <TableHead className="hidden md:table-cell">Dibuat</TableHead>
              <TableHead className="pr-0 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userList.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="whitespace-normal">
                  <EmptyState
                    compact
                    title={allUsers.length === 0 ? "Belum ada user." : "Tidak ada user yang cocok dengan pencarian."}
                    description={allUsers.length === 0 ? undefined : "Coba kata kunci lain."}
                  />
                </TableCell>
              </TableRow>
            ) : (
              userList.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="py-3 pl-0 font-semibold">
                    {u.name}
                    {u.id === currentUserId && (
                      <Badge variant="outline" className="ml-2 font-normal">Anda</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden py-3 sm:table-cell">{u.email}</TableCell>
                  <TableCell className="hidden py-3 md:table-cell">
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="num hidden py-3 text-muted-foreground md:table-cell">
                    {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true, locale: idLocale })}
                  </TableCell>
                  <TableCell className="py-3 pr-0 text-right">
                    <DeleteUserButton id={u.id} name={u.name} isCurrentUser={u.id === currentUserId} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {/* Form Tambah User */}
      <AddUserForm />
    </div>
  );
}
