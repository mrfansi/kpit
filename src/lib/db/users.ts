import { db } from "@/lib/db";
import { account, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** The password hash lives only in `account.password` (read by better-auth). */
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
  password: string; // already hashed
  role?: "admin" | "viewer";
}) {
  const now = new Date();
  return db.batch([
    db.insert(users).values({
      id: data.id,
      email: data.email.toLowerCase(), // better-auth looks users up by lower-cased email
      name: data.name,
      role: data.role ?? "viewer",
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(account).values(credentialRow(data.id, data.password)),
  ]);
}

export async function deleteUser(id: string) {
  return db.delete(users).where(eq(users.id, id)).run();
}

export async function updateUserPassword(id: string, password: string) {
  const row = credentialRow(id, password);
  // Upsert so a user whose credential row is missing is healed.
  return db.insert(account).values(row).onConflictDoUpdate({
    target: [account.providerId, account.accountId],
    set: { password, updatedAt: row.updatedAt },
  });
}
