import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminBreadcrumb } from "@/components/admin-breadcrumb";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div>
      <AdminBreadcrumb />
      {children}
    </div>
  );
}
