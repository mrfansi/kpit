import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Defense in depth: the proxy already gates these routes, this keeps them private if it is bypassed or misconfigured.
export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return children;
}
