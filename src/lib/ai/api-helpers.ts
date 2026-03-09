import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { AIServiceError } from "./types";

/**
 * Check auth and return session. Returns NextResponse error if unauthorized.
 */
export async function requireAuth(): Promise<
  | { session: Session; error: null }
  | { session: null; error: NextResponse }
> {
  const session = await auth();
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
