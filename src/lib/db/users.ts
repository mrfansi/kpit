import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getUserByEmail(email: string) {
  return db.select().from(users).where(eq(users.email, email)).get();
}

export async function getAllUsers() {
  return db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    createdAt: users.createdAt,
  }).from(users).all();
}

export async function createUser(data: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role?: "admin" | "viewer";
}) {
  return db.insert(users).values({
    ...data,
    role: data.role ?? "admin",
    createdAt: new Date(),
  }).run();
}

export async function deleteUser(id: string) {
  return db.delete(users).where(eq(users.id, id)).run();
}

export async function updateUserPassword(id: string, passwordHash: string) {
  return db.update(users).set({ passwordHash }).where(eq(users.id, id)).run();
}
