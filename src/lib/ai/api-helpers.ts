import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { authFresh, type AuthSession } from "@/auth";
import { AIServiceError } from "./types";

/** Browsers send `Origin` on non-GET and cross-site requests; one that differs from our host is a CSRF attempt. */
function isCrossOrigin(requestHeaders: Headers): boolean {
  const origin = requestHeaders.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== requestHeaders.get("host");
  } catch {
    return true; // "null" (sandboxed frames) or garbage
  }
}

/**
 * Check auth and return session. Returns NextResponse error if unauthorized.
 * Rejects a cross-origin `Origin` (403) and reads the session from D1, since these routes write or spend AI budget.
 */
export async function requireAuth(): Promise<
  | { session: AuthSession; error: null }
  | { session: null; error: NextResponse }
> {
  const requestHeaders = await headers();
  if (isCrossOrigin(requestHeaders)) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const session = await authFresh();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null };
}

/**
 * Convert AIServiceError to appropriate NextResponse.
 */
export function handleAIError(error: unknown): NextResponse {
  if (error instanceof AIServiceError) {
    // Pesan ke klien sengaja generik; penyebab asli (mis. saldo habis) hanya di log.
    console.error("AI error:", error.code, error.cause);
    if (error.code === "no_api_key") {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.error("Unexpected AI error:", error);
  return NextResponse.json(
    { error: "Terjadi kesalahan pada layanan AI." },
    { status: 500 }
  );
}
