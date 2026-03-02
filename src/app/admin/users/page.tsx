import { getAllUsers } from "@/lib/db/users";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteUserButton } from "@/components/delete-user-button";
import { addUserAction } from "@/lib/actions/user-actions";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Users } from "lucide-react";

export default async function AdminUsersPage() {
  const [userList, session] = await Promise.all([getAllUsers(), auth()]);
  const currentUserId = session?.user?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" /> Manajemen User
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{userList.length} user terdaftar</p>
        </div>
      </div>

      {/* Daftar User */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar User</CardTitle>
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
                      Belum ada user.
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah User Baru</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={async (fd: FormData) => { await addUserAction(fd); }} className="space-y-4 max-w-md">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="name">Nama</Label>
                <Input id="name" name="name" placeholder="John Doe" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="john@example.com" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Min. 8 karakter"
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="role">Role</Label>
                <select
                  name="role"
                  defaultValue="admin"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <Button type="submit">Tambah User</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
