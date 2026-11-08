import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";

function createAuth() {
  return betterAuth({
    // Same secrets as the old next-auth setup; no new production secret.
    secret: process.env.AUTH_SECRET,
    baseURL: process.env.AUTH_URL,
    // `db` resolves the D1 binding per access, so this can be built lazily outside a request.
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    user: {
      modelName: "users",
      // Never settable from client input; changed only by admins through our own code.
      additionalFields: { role: { type: "string", defaultValue: "viewer", input: false } },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true, // users are created by admins
      // PBKDF2 via WebCrypto fits the Workers free plan's 10 ms CPU.
      password: { hash: hashPassword, verify: verifyPassword },
    },
    // Counters live in D1 (isolates share no memory). Sign-in is hashed per attempt, so cap it hard.
    rateLimit: { enabled: true, storage: "database", customRules: { "/sign-in/email": { window: 60, max: 5 } } },
    // Only Cloudflare sets cf-connecting-ip; x-forwarded-for would be client-controlled.
    advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // next-auth's default JWT lifetime
      // Saves the D1 read while the cookie is fresh. After 5 minutes renders cannot re-issue it (only the proxy,
      // on /admin and /login, forwards the refreshed cookie), so later reads hit D1 until then. Writes always skip it.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/** Built on first use: env vars are not guaranteed to exist at module load on Workers. */
export function getAuth() {
  return (instance ??= createAuth());
}

export type AuthSession = { user: { id: string; name: string; email: string; role: "admin" | "viewer" } };

function toAuthSession(session: { user: { id: string; name: string; email: string; role?: unknown } }): AuthSession {
  const { id, name, email, role } = session.user;
  return { user: { id, name, email, role: role === "admin" ? "admin" : "viewer" } };
}

/** `fresh` reads D1 instead of the cookie cache: use it to authorise writes (role changes apply at once). */
export async function getSessionFromHeaders(requestHeaders: Headers, opts?: { fresh?: boolean }): Promise<AuthSession | null> {
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
    // disableRefresh: only the proxy (getSessionWithCookies) re-issues the cookie; renders cannot set cookies.
    query: opts?.fresh ? { disableCookieCache: true, disableRefresh: true } : { disableRefresh: true },
  });
  return session ? toAuthSession(session) : null;
}

/** Proxy variant: also returns the `Set-Cookie` values better-auth wants to issue (refreshed cookie cache). */
export async function getSessionWithCookies(requestHeaders: Headers): Promise<{ session: AuthSession | null; setCookies: string[] }> {
  const { headers: out, response } = await getAuth().api.getSession({ headers: requestHeaders, returnHeaders: true });
  return { session: response ? toAuthSession(response) : null, setCookies: out.getSetCookie() };
}

/** Current session for server components; one lookup per render however many callers. */
export const auth = cache(async (): Promise<AuthSession | null> => getSessionFromHeaders(await headers()));

/** Current session read from D1, for server actions and route handlers that write. */
export async function authFresh(): Promise<AuthSession | null> {
  return getSessionFromHeaders(await headers(), { fresh: true });
}
