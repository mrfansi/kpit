import { auth } from "@/auth";
import { canAccessAdminRoute } from "@/lib/admin-access";

/**
 * Baca peran tanpa melempar. Dipakai untuk memutuskan APA YANG DIRENDER, bukan
 * untuk menjaga aksi — penjagaan tetap requireAdmin() di server action.
 *
 * Predikatnya sengaja bukan "sudah login": viewer terautentikasi tapi tidak
 * boleh mengubah apa pun, jadi menampilkan tombol mutasi kepadanya hanya
 * menghasilkan aksi yang dijamin gagal.
 */
export async function isAdminUser(): Promise<boolean> {
  const session = await auth();
  return canAccessAdminRoute(session?.user?.role);
}

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
