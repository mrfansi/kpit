import { db } from "@/lib/db";
import { account, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Passwords live in two places on purpose: `account.password` (read by
 * better-auth) and `users.password_hash` (read by the previous next-auth worker).
 * A rollback only keeps logins working for users who have not signed in since
 * PBKDF2 rehash-on-login (PR #16): the old worker cannot verify those hashes.
 * Every write goes through the two
 * helpers below, which update both in one D1 batch (atomic).
 */
function credentialRow(userId: string, password: string) {
  const now = new Date();
  return { id: crypto.randomUUID(), accountId: userId, providerId: "credential", userId, password, createdAt: now, updatedAt: now };
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
  const now = new Date();
  return db.batch([
    db.insert(users).values({
      ...data,
      email: data.email.toLowerCase(), // better-auth looks users up by lower-cased email
      role: data.role ?? "viewer",
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(account).values(credentialRow(data.id, data.passwordHash)),
  ]);
}

export async function deleteUser(id: string) {
  return db.delete(users).where(eq(users.id, id)).run();
}

export async function updateUserPassword(id: string, passwordHash: string) {
  const row = credentialRow(id, passwordHash);
  return db.batch([
    db.update(users).set({ passwordHash, updatedAt: row.updatedAt }).where(eq(users.id, id)),
    // Upsert so a user whose credential row is missing (e.g. created while rolled back) is healed.
    db.insert(account).values(row).onConflictDoUpdate({
      target: [account.providerId, account.accountId],
      set: { password: passwordHash, updatedAt: row.updatedAt },
    }),
  ]);
}
