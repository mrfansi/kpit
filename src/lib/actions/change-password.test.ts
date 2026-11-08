import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { eq } from "drizzle-orm";
import { getAuth } from "@/auth";
import { db } from "@/lib/db";
import { account, session as sessions, users } from "@/lib/db/schema";
import { createUser } from "@/lib/db/users";
import { hashPassword } from "@/lib/password";
import { createTestD1 } from "@/lib/test-d1";
import type * as UserActions from "./user-actions";

process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-0123";
process.env.AUTH_URL = "http://localhost:3000";

const load = createRequire(resolve("src/lib/actions/change-password.test.ts"));

async function signIn(email: string, password: string) {
  const response = await getAuth().api.signInEmail({ body: { email, password }, asResponse: true });
  if (!response.ok) throw new Error(`sign-in rejected: ${response.status}`);
  return new Headers({ cookie: response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });
}

/** Bypasses the 5-minute cookie cache, which would still accept a revoked session's cookie. */
async function isValid(headers: Headers) {
  return Boolean(await getAuth().api.getSession({ headers, query: { disableCookieCache: true } }));
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

test("changePasswordAction checks the current password and revokes other sessions", { timeout: 120_000 }, async (t) => {
  let requestHeaders = new Headers();
  const session = { user: { id: "cp-user", email: "cp@example.test", name: "CP", role: "viewer" } };
  const stubs: [string, object][] = [
    [load.resolve("../auth-utils"), { requireAuth: async () => session, requireAdmin: async () => session }],
    [load.resolve("next/cache"), { revalidatePath() {} }],
    [load.resolve("next/headers"), { headers: async () => requestHeaders }],
  ];
  const originals = stubs.map(([path]) => [path, load.cache[path]] as const);
  for (const [path, exports] of stubs) {
    load.cache[path] = Object.assign(new Module(path), { filename: path, exports, loaded: true });
  }
  const actionsPath = load.resolve("./user-actions");
  t.after(() => {
    delete load.cache[actionsPath];
    for (const [path, original] of originals) {
      if (original) load.cache[path] = original;
      else delete load.cache[path];
    }
  });
  const { changePasswordAction } = load("./user-actions") as typeof UserActions;

  const environment = await createTestD1();
  t.after(() => environment.dispose());
  await createUser({ id: "cp-user", email: "cp@example.test", name: "CP", passwordHash: await hashPassword("Old-password-1"), role: "viewer" });
  const current = await signIn("cp@example.test", "Old-password-1");
  const other = await signIn("cp@example.test", "Old-password-1");
  requestHeaders = current;

  await t.test("a wrong current password is rejected and nothing changes", async () => {
    const before = await db.select().from(account).where(eq(account.userId, "cp-user"));
    const result = await changePasswordAction({}, form({ currentPassword: "Wrong-password-1", password: "New-password-1", confirm: "New-password-1" }));
    assert.deepEqual(result, { error: "Password saat ini salah." });
    assert.deepEqual(await db.select().from(account).where(eq(account.userId, "cp-user")), before);
    assert.equal((await db.select().from(sessions).where(eq(sessions.userId, "cp-user"))).length, 2);
    assert.ok(await isValid(current));
    assert.ok(await isValid(other));
  });

  await t.test("a successful change keeps the current session and revokes the other one", async () => {
    const result = await changePasswordAction({}, form({ currentPassword: "Old-password-1", password: "New-password-1", confirm: "New-password-1" }));
    assert.deepEqual(result, { success: true });
    const [user] = await db.select().from(users).where(eq(users.id, "cp-user"));
    const [credential] = await db.select().from(account).where(eq(account.userId, "cp-user"));
    assert.equal(user.passwordHash, credential.password);
    assert.equal((await db.select().from(sessions).where(eq(sessions.userId, "cp-user"))).length, 1);
    assert.ok(await isValid(current));
    assert.equal(await isValid(other), false);
    await assert.rejects(signIn("cp@example.test", "Old-password-1"));
    assert.ok(await signIn("cp@example.test", "New-password-1"));
  });
});
