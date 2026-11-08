import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { getAuth, getSessionFromHeaders } from "@/auth";
import { db } from "@/lib/db";
import { account, session as sessions, users } from "@/lib/db/schema";
import { createUser, deleteUser, updateUserPassword } from "@/lib/db/users";
import { assertAdmin } from "@/lib/auth-utils";
import { hashPassword } from "@/lib/password";
import { createTestD1 } from "@/lib/test-d1";

process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-0123";
process.env.AUTH_URL = "http://localhost:3000";

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
  const [credential] = await db.select().from(account).where(eq(account.userId, id));
  return credential?.password;
}

test("better-auth logs in users and guards roles", { timeout: 120_000 }, async (t) => {
  const environment = await createTestD1();
  t.after(() => environment.dispose());

  const adminHash = await hashPassword("Admin-password-1");
  const viewerHash = await hashPassword("Viewer-password-1");
  await createUser({ id: "legacy-admin", email: "Legacy.Admin@example.com", name: "Legacy Admin", password: adminHash, role: "admin" });
  await createUser({ id: "legacy-viewer", email: "legacy.viewer@example.com", name: "Legacy Viewer", password: viewerHash, role: "viewer" });

  await t.test("existing password works, session carries id and role", async () => {
    const cookies = await signIn("legacy.admin@example.com", "Admin-password-1");
    const session = await getSessionFromHeaders(cookies);
    assert.deepEqual(session?.user, { id: "legacy-admin", name: "Legacy Admin", email: "legacy.admin@example.com", role: "admin" });
    assert.equal(assertAdmin(session), session);
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

  await t.test("createUser writes account.password", async () => {
    const hash = await hashPassword("Fresh-password-1");
    await createUser({ id: "fresh", email: "Fresh@Example.com", name: "Fresh", password: hash, role: "viewer" });
    assert.match(hash, /^pbkdf2-sha256\$100000\$/);
    assert.equal(await pair("fresh"), hash);
    assert.equal((await getSessionFromHeaders(await signIn("fresh@example.com", "Fresh-password-1")))?.user.id, "fresh");
  });

  await t.test("updateUserPassword replaces the old password", async () => {
    const hash = await hashPassword("Changed-password-1");
    await updateUserPassword("legacy-viewer", hash);
    assert.equal(await pair("legacy-viewer"), hash);
    await assert.rejects(signIn("legacy.viewer@example.com", "Viewer-password-1"));
    assert.equal((await getSessionFromHeaders(await signIn("legacy.viewer@example.com", "Changed-password-1")))?.user.id, "legacy-viewer");
  });

  await t.test("updateUserPassword heals a user whose credential row is missing", async () => {
    await db.delete(account).where(eq(account.userId, "fresh"));
    const hash = await hashPassword("Healed-password-1");
    await updateUserPassword("fresh", hash);
    assert.equal(await pair("fresh"), hash);
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
