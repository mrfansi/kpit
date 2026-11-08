import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

const folder = join(process.cwd(), "drizzle");
const migrations = readdirSync(folder).filter((file) => file.endsWith(".sql")).sort();
const betterAuth = "0017_better_auth.sql";

type Db = InstanceType<typeof Database>;
const rows = (db: Db, sql: string) => db.prepare(sql).all() as Record<string, unknown>[];
const scalar = (db: Db, sql: string) => db.prepare(sql).pluck().get();

function apply(db: Db, file: string) {
  for (const statement of readFileSync(join(folder, file), "utf8").split("--> statement-breakpoint")) db.exec(statement);
}

test("0017 backfills one credential account per existing user and stays additive", () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const file of migrations) if (file < betterAuth) apply(db, file);

  const before = rows(db, "PRAGMA table_info(users)") as { name: string; notnull: number }[];
  const hash = bcrypt.hashSync("Correct-horse-1", 12);
  const insert = db.prepare("INSERT INTO users (id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)");
  insert.run("u1", "Admin@Example.com", "Admin", hash, "admin", 1700000000);
  insert.run("u2", "viewer@example.com", "Viewer", "legacy-hash", "viewer", 1700000100);

  apply(db, betterAuth);

  const accounts = rows(db, "SELECT user_id, account_id, provider_id, password FROM account ORDER BY user_id");
  assert.deepEqual(accounts, [
    { user_id: "u1", account_id: "u1", provider_id: "credential", password: hash },
    { user_id: "u2", account_id: "u2", provider_id: "credential", password: "legacy-hash" },
  ]);
  assert.ok(bcrypt.compareSync("Correct-horse-1", String((accounts[0] as { password: string }).password)));
  assert.deepEqual(rows(db, "SELECT id,email,password_hash,role,created_at,updated_at,email_verified FROM users ORDER BY id"), [
    { id: "u1", email: "admin@example.com", password_hash: hash, role: "admin", created_at: 1700000000, updated_at: 1700000000, email_verified: 0 },
    { id: "u2", email: "viewer@example.com", password_hash: "legacy-hash", role: "viewer", created_at: 1700000100, updated_at: 1700000100, email_verified: 0 },
  ]);

  // Additive: every old column survives unchanged and password_hash is still NOT NULL.
  const after = rows(db, "PRAGMA table_info(users)") as { name: string; notnull: number }[];
  for (const column of before) assert.deepEqual(after.find((c) => c.name === column.name), column);
  assert.equal(after.find((c) => c.name === "password_hash")?.notnull, 1);

  // The old next-auth code only knows the old columns and must keep working.
  db.prepare("INSERT INTO users (id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)").run("u3", "old@example.com", "Old", "h", "viewer", 1700000200);
  assert.equal(scalar(db, "SELECT password_hash FROM users WHERE id='u3'"), "h");

  // Deleting a user cascades to its credential account.
  db.exec("DELETE FROM users WHERE id='u1'");
  assert.equal(scalar(db, "SELECT count(*) FROM account WHERE user_id='u1'"), 0);
  db.close();
});

test("0017 leaves a colliding mixed-case email untouched instead of failing", () => {
  const db = new Database(":memory:");
  for (const file of migrations) if (file < betterAuth) apply(db, file);
  const insert = db.prepare("INSERT INTO users (id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)");
  insert.run("a", "dup@example.com", "A", "h", "admin", 1);
  insert.run("b", "DUP@example.com", "B", "h", "viewer", 2);
  apply(db, betterAuth);
  assert.deepEqual(rows(db, "SELECT email FROM users ORDER BY id").map((row) => row.email), ["dup@example.com", "DUP@example.com"]);
  assert.equal(scalar(db, "SELECT count(*) FROM account"), 2);
  db.close();
});
