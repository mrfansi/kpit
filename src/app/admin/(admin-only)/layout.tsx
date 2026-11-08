import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/auth-utils";

// Role check on the server for every admin page except /admin/account (viewers may change their password).
// The proxy also checks, but this layout does not depend on how the router normalises URLs.
export default async function AdminOnlyLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminUser())) redirect("/");
  return children;
}
