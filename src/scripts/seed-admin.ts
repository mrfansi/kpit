import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";

const db = new Database("./kpit.db");

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@kpit.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
const name = "Administrator";

const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
if (existing) {
  console.log(`User ${email} sudah ada, skip.`);
  db.close();
  process.exit(0);
}

const hash = bcrypt.hashSync(password, 12);
const id = randomUUID();

db.prepare(
  "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
).run(id, email, name, hash, "admin", Date.now());

console.log(`✅ Admin user dibuat: ${email}`);
db.close();
