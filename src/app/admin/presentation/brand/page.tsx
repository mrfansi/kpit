import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessAdminRoute } from "@/lib/admin-access";
import { BrandEditor } from "@/components/presentation/brand-editor";

export default async function PresentationBrandPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccessAdminRoute(session.user.role)) redirect("/");
  return <BrandEditor />;
}
