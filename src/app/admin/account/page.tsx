import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordForm } from "@/components/change-password-form";
import { PageHeader } from "@/components/page-header";
import { User } from "lucide-react";

export default async function AdminAccountPage() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="max-w-md space-y-10">
      <PageHeader
        title={<><User aria-hidden className="size-5 text-muted-foreground" /> Akun Saya</>}
        description="Kelola informasi akun Anda"
      />

      <section aria-labelledby="account-info-heading" className="space-y-3">
        <h2 id="account-info-heading" className="text-lg font-semibold">Informasi akun</h2>
        <dl className="text-sm">
          <div className="flex items-center justify-between gap-4 border-b py-2.5">
            <dt className="text-muted-foreground">Nama</dt>
            <dd className="min-w-0 truncate font-semibold">{user?.name ?? <span className="font-normal text-muted-foreground">-</span>}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b py-2.5">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="min-w-0 truncate font-semibold">{user?.email ?? <span className="font-normal text-muted-foreground">-</span>}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-muted-foreground">Role</dt>
            <dd><Badge variant="default">{user?.role ?? "admin"}</Badge></dd>
          </div>
        </dl>
      </section>

      <ChangePasswordForm />
    </div>
  );
}
