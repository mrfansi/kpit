"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { createUser, deleteUser, updateUserPassword } from "@/lib/db/users";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";

const AddUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["admin", "viewer"]),
});

const ChangePasswordSchema = z.object({
  userId: z.string(),
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
    role: formData.get("role") ?? "admin",
  });
  if (!parsed.success) return { error: "Data tidak valid. Pastikan semua field terisi dengan benar." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    await createUser({ id: randomUUID(), ...parsed.data, passwordHash });
    await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "create", entity: "user", detail: parsed.data.email });
    revalidatePath("/admin/users");
    return { success: true };
  } catch {
    return { error: "Email sudah digunakan oleh user lain." };
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
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: "Password minimal 8 karakter." };
  if (parsed.data.password !== parsed.data.confirm) return { error: "Konfirmasi password tidak cocok." };

  const hash = await bcrypt.hash(parsed.data.password, 12);
  await updateUserPassword(parsed.data.userId, hash);
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "user", entityId: session.user.id, detail: "password changed" });
  return { success: true };
}
