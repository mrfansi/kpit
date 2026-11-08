"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { getAuth } from "@/auth";
import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createUser, deleteUser, updateUserPassword } from "@/lib/db/users";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";
import { consumeRateLimit } from "@/lib/rate-limit-d1";

const AddUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["admin", "viewer"]),
});

const ChangePasswordSchema = z.object({
  userId: z.string(),
  currentPassword: z.string().min(1),
  password: z.string().min(8),
  confirm: z.string().min(8),
});

export type AddUserState = { error?: string; success?: boolean };
export type ChangePasswordState = { error?: string; success?: boolean };

export async function addUserAction(
  _prev: AddUserState,
  formData: FormData
): Promise<AddUserState> {
  const session = await requireAdmin();
  const parsed = AddUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role") ?? "viewer",
  });
  if (!parsed.success) return { error: "Data tidak valid. Pastikan semua field terisi dengan benar." };

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await createUser({ id: randomUUID(), ...parsed.data, passwordHash });
    await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "create", entity: "user", detail: parsed.data.email });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("addUserAction failed", error);
    return { error: String(error).includes("UNIQUE") ? "Email sudah digunakan oleh user lain." : "Gagal menambah user. Coba lagi." };
  }
}

export async function deleteUserAction(id: string) {
  const session = await requireAdmin();
  if (session.user.id === id) return { error: "Tidak bisa menghapus akun sendiri." };
  await deleteUser(id);
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "delete", entity: "user", entityId: id });
  revalidatePath("/admin/users");
}

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await requireAuth();

  const parsed = ChangePasswordSchema.safeParse({
    userId: session.user.id,
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: "Password minimal 8 karakter." };
  if (parsed.data.password !== parsed.data.confirm) return { error: "Konfirmasi password tidak cocok." };

  // Before verifyPassword: each guess costs ~80 ms of PBKDF2 CPU and a stolen session must not be able to brute-force the current password.
  const limit = await consumeRateLimit(`chpw:${parsed.data.userId}`, 15 * 60, 5);
  if (!limit.allowed) return { error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." };

  const [credential] = await db
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, parsed.data.userId), eq(account.providerId, "credential")));
  if (!credential?.password || !(await verifyPassword({ hash: credential.password, password: parsed.data.currentPassword }))) {
    return { error: "Password saat ini salah." };
  }

  const hash = await hashPassword(parsed.data.password);
  await updateUserPassword(parsed.data.userId, hash);
  // Other devices (a possible attacker) must log in again with the new password.
  await getAuth().api.revokeOtherSessions({ headers: await headers() });
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "user", entityId: session.user.id, detail: "password changed" });
  return { success: true };
}
