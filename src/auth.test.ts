import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getAuth, getSessionFromHeaders } from "@/auth";
import { db } from "@/lib/db";
import { account, session as sessions, users } from "@/lib/db/schema";
import { createUser, deleteUser, updateUserPassword } from "@/lib/db/users";
import { assertAdmin } from "@/lib/auth-utils";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createTestD1 } from "@/lib/test-d1";

process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-0123";
process.env.AUTH_URL = "http://localhost:3000";

/** Statements of migration 0017 that rewrite data (everything after the DDL). */
const backfill = readFileSync("drizzle/0017_better_auth.sql", "utf8")
  .split("--> statement-breakpoint")
  .map((statement) => statement.replace(/^--.*$/gm, "").trim())
  .filter((statement) => /^(UPDATE|INSERT)/i.test(statement));

async function signIn(email: string, password: string) {
  const response = await getAuth().api.signInEmail({ body: { email, password }, asResponse: true });
  if (!response.ok) throw new Error(`sign-in rejected: ${response.status}`);
  const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  return new Headers({ cookie });
}

/** A real HTTP request, so the rate limiter (which only runs in the handler) sees a client IP. */
function signInRequest(email: string, password: string, ip: string) {
  return getAuth().handler(new Request("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify({ email, password }),
  }));
}

async function pair(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  const [credential] = await db.select().from(account).where(eq(account.userId, id));
  return { hash: user.passwordHash, password: credential?.password };
}

test("better-auth logs in users created before the migration and guards roles", { timeout: 120_000 }, async (t) => {
  const environment = await createTestD1();
  t.after(() => environment.dispose());

  // Pre-migration state: rows written by the old code (no account rows), then the 0017 backfill.
  const adminHash = bcrypt.hashSync("Admin-password-1", 12);
  const viewerHash = bcrypt.hashSync("Viewer-password-1", 12);
  const now = Math.floor(Date.now() / 1000);
  await environment.env.DB.batch([
    environment.env.DB.prepare("INSERT INTO users (id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)").bind("legacy-admin", "Legacy.Admin@example.com", "Legacy Admin", adminHash, "admin", now),
    environment.env.DB.prepare("INSERT INTO users (id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)").bind("legacy-viewer", "legacy.viewer@example.com", "Legacy Viewer", viewerHash, "viewer", now),
  ]);
  await environment.env.DB.batch(backfill.map((statement) => environment.env.DB.prepare(statement)));

  await t.test("existing password works, session carries id and role", async () => {
    const cookies = await signIn("legacy.admin@example.com", "Admin-password-1");
    const session = await getSessionFromHeaders(cookies);
    assert.deepEqual(session?.user, { id: "legacy-admin", name: "Legacy Admin", email: "legacy.admin@example.com", role: "admin" });
    assert.equal(assertAdmin(session), session);
  });

  await t.test("a legacy bcrypt credential is rehashed to PBKDF2 in both columns after login", async () => {
    const { hash, password } = await pair("legacy-admin");
    assert.match(String(hash), /^pbkdf2-sha256\$100000\$/);
    assert.equal(password, hash);
    assert.ok(await verifyPassword({ hash: String(hash), password: "Admin-password-1" }));
    assert.equal((await getSessionFromHeaders(await signIn("legacy.admin@example.com", "Admin-password-1")))?.user.id, "legacy-admin");
  });

  await t.test("wrong password and unknown email fail without a session", async () => {
    await assert.rejects(signIn("legacy.admin@example.com", "Wrong-password-1"));
    await assert.rejects(signIn("nobody@example.com", "Admin-password-1"));
    assert.equal(await getSessionFromHeaders(new Headers()), null);
  });

  await t.test("a viewer logs in but cannot pass requireAdmin", async () => {
    const session = await getSessionFromHeaders(await signIn("legacy.viewer@example.com", "Viewer-password-1"));
    assert.equal(session?.user.role, "viewer");
    assert.throws(() => assertAdmin(session), /Akses ditolak/);
    assert.throws(() => assertAdmin(null), /Tidak terautentikasi/);
  });

  await t.test("sign-up is disabled and role cannot be chosen by the client", async () => {
    await assert.rejects(getAuth().api.signUpEmail({ body: { email: "new@example.com", password: "Whatever-12345", name: "New", role: "admin" } as never }));
    assert.equal((await db.select().from(users).where(eq(users.email, "new@example.com"))).length, 0);
  });

  await t.test("createUser writes account.password and users.password_hash together", async () => {
    const hash = await hashPassword("Fresh-password-1");
    await createUser({ id: "fresh", email: "Fresh@Example.com", name: "Fresh", passwordHash: hash, role: "viewer" });
    assert.match(hash, /^pbkdf2-sha256\$100000\$/);
    assert.deepEqual(await pair("fresh"), { hash, password: hash });
    assert.equal((await getSessionFromHeaders(await signIn("fresh@example.com", "Fresh-password-1")))?.user.id, "fresh");
  });

  await t.test("updateUserPassword keeps both columns in sync and replaces the old password", async () => {
    const hash = await hashPassword("Changed-password-1");
    await updateUserPassword("legacy-viewer", hash);
    assert.deepEqual(await pair("legacy-viewer"), { hash, password: hash });
    await assert.rejects(signIn("legacy.viewer@example.com", "Viewer-password-1"));
    assert.equal((await getSessionFromHeaders(await signIn("legacy.viewer@example.com", "Changed-password-1")))?.user.id, "legacy-viewer");
  });

  await t.test("updateUserPassword heals a user whose credential row is missing", async () => {
    await db.delete(account).where(eq(account.userId, "fresh"));
    const hash = await hashPassword("Healed-password-1");
    await updateUserPassword("fresh", hash);
    assert.deepEqual(await pair("fresh"), { hash, password: hash });
  });

  await t.test("deleting a user invalidates its session and removes the account", async () => {
    const cookies = await signIn("fresh@example.com", "Healed-password-1");
    assert.ok(await getSessionFromHeaders(cookies));
    await deleteUser("fresh");
    assert.equal((await db.select().from(account).where(eq(account.userId, "fresh"))).length, 0);
    // The cookie cache may serve the session for up to 5 minutes; the session row itself is gone.
    assert.equal((await db.select().from(sessions).where(eq(sessions.userId, "fresh"))).length, 0);
  });

  await t.test("the 6th sign-in attempt within a minute from one IP is rate limited", async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      assert.equal((await signInRequest("legacy.admin@example.com", "Wrong-password-1", "203.0.113.7")).status, 401, `attempt ${attempt}`);
    }
    assert.equal((await signInRequest("legacy.admin@example.com", "Wrong-password-1", "203.0.113.7")).status, 429);
    // Even the right password is refused until the window passes, but another IP is unaffected.
    assert.equal((await signInRequest("legacy.admin@example.com", "Admin-password-1", "203.0.113.7")).status, 429);
    assert.equal((await signInRequest("legacy.admin@example.com", "Admin-password-1", "203.0.113.8")).status, 200);
  });
});
