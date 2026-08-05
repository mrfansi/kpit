import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordForm } from "@/components/change-password-form";
import { PageHeader } from "@/components/page-header";
import { User } from "lucide-react";

export default async function AdminAccountPage() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader
        title={<><User className="w-6 h-6" /> Akun Saya</>}
        description="Kelola informasi akun Anda"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informasi Akun</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">Nama</span>
            <span className="text-sm font-medium">{user?.name ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{user?.email ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant="default">{user?.role ?? "admin"}</Badge>
          </div>
        </CardContent>
      </Card>

      <ChangePasswordForm />
    </div>
  );
}
