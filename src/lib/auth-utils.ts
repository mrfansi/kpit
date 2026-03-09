import { auth } from "@/auth";

/**
 * Require authenticated user with admin role.
 * Throws "Unauthorized" if not logged in, "Forbidden" if not admin.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Tidak terautentikasi");
  if (session.user.role !== "admin") throw new Error("Akses ditolak");
  return session;
}

/**
 * Require authenticated user (any role).
 * Throws "Unauthorized" if not logged in.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Tidak terautentikasi");
  return session;
}
