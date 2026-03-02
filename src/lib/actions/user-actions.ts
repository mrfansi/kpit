"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { createUser, deleteUser, updateUserPassword } from "@/lib/db/users";
import { z } from "zod";
import { auth } from "@/auth";

const AddUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["admin", "viewer"]),
});

const ChangePasswordSchema = z.object({
  userId: z.string(),
  password: z.string().min(8),
});

export async function addUserAction(formData: FormData) {
  const parsed = AddUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role") ?? "admin",
  });
  if (!parsed.success) return { error: "Data tidak valid." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    await createUser({ id: randomUUID(), ...parsed.data, passwordHash });
    revalidatePath("/admin/users");
    return { success: true };
  } catch {
    return { error: "Email sudah digunakan." };
  }
}

export async function deleteUserAction(id: string) {
  const session = await auth();
  if (session?.user?.id === id) return { error: "Tidak bisa menghapus akun sendiri." };
  await deleteUser(id);
  revalidatePath("/admin/users");
}

export async function changePasswordAction(formData: FormData) {
  const parsed = ChangePasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Password minimal 8 karakter." };

  const hash = await bcrypt.hash(parsed.data.password, 12);
  await updateUserPassword(parsed.data.userId, hash);
  revalidatePath("/admin/users");
  return { success: true };
}
