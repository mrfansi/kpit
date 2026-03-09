import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { users } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import path from "path";

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

if (!email || !password) {
  console.error("ERROR: SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi.");
  console.error("Set environment variables sebelum menjalankan seed:admin.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("ERROR: SEED_ADMIN_PASSWORD minimal 8 karakter.");
  process.exit(1);
}

const sqlite = new Database(path.join(process.cwd(), "kpit.db"));
const db = drizzle(sqlite);

const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
if (existing.length > 0) {
  console.log(`User ${email} sudah ada, skip.`);
  sqlite.close();
  process.exit(0);
}

const hash = bcrypt.hashSync(password, 12);
const id = randomUUID();

await db.insert(users).values({
  id,
  email,
  name: "Administrator",
  passwordHash: hash,
  role: "admin",
  createdAt: new Date(),
});

console.log(`Admin user dibuat: ${email}`);
sqlite.close();
