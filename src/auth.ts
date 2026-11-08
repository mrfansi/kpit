import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { updateUserPassword } from "@/lib/db/users";
import { hashPassword, isLegacyHash, verifyPassword } from "@/lib/password";

function createAuth() {
  return betterAuth({
    // Same secrets as the old next-auth setup; no new production secret.
    secret: process.env.AUTH_SECRET,
    baseURL: process.env.AUTH_URL,
    // AUTH_TRUST_HOST=true (as for next-auth) trusts the request's own origin; CSRF still rejects other origins.
    trustedOrigins: (request) => (process.env.AUTH_TRUST_HOST === "true" && request ? [new URL(request.url).origin] : []),
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
      // PBKDF2 via WebCrypto fits the Workers free plan's 10 ms CPU; legacy bcrypt hashes still verify and are upgraded after login (hooks.after).
      password: { hash: hashPassword, verify: verifyPassword },
    },
    // Counters live in D1 (isolates share no memory). Sign-in is hashed per attempt, so cap it hard.
    rateLimit: { enabled: true, storage: "database", customRules: { "/sign-in/email": { window: 60, max: 5 } } },
    // Only Cloudflare sets cf-connecting-ip; x-forwarded-for would be client-controlled.
    advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email") return;
        const userId = ctx.context.newSession?.user.id;
        const password = (ctx.body as { password?: unknown } | undefined)?.password;
        if (!userId || typeof password !== "string") return;
        try {
          const [credential] = await ctx.context.internalAdapter.findAccounts(userId);
          if (credential?.providerId === "credential" && credential.password && isLegacyHash(credential.password)) {
            await updateUserPassword(userId, await hashPassword(password));
          }
        } catch (error) {
          ctx.context.logger.error("Password rehash failed", error); // login still succeeds
        }
      }),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // next-auth's default JWT lifetime
      // Avoids a D1 read per request; a role change or deleted user takes effect within 5 minutes.
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

export async function getSessionFromHeaders(requestHeaders: Headers): Promise<AuthSession | null> {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { id, name, email, role } = session.user;
  return { user: { id, name, email, role: role === "admin" ? "admin" : "viewer" } };
}

/** Current session for server components, actions and route handlers. */
export async function auth(): Promise<AuthSession | null> {
  return getSessionFromHeaders(await headers());
}
