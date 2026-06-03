import { NextResponse } from "next/server";

/**
 * In-memory per-user rate limiter for AI endpoints.
 *
 * Guards against cost-explosion DoS: every AI call hits a paid Gemini API.
 * Single-process better-sqlite3 deployment, so a module-level Map is sufficient.
 * Two layers: a short sliding window (burst control) + a daily cap (cost ceiling).
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;
const MAX_PER_DAY = 300;

interface WindowState {
  count: number;
  resetAt: number;
}

interface DayState {
  count: number;
  day: string;
}

const windows = new Map<string, WindowState>();
const days = new Map<string, DayState>();

function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
  reason?: string;
}

export function checkAIRateLimit(
  userId: string,
  route: string,
  now = Date.now()
): RateLimitResult {
  const windowKey = `${userId}:${route}`;
  const window = windows.get(windowKey);
  if (!window || window.resetAt <= now) {
    windows.set(windowKey, { count: 1, resetAt: now + WINDOW_MS });
  } else if (window.count >= MAX_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((window.resetAt - now) / 1000),
      reason: "Terlalu banyak permintaan AI. Coba lagi sebentar.",
    };
  } else {
    window.count += 1;
  }

  const today = dayKey(now);
  const day = days.get(userId);
  if (!day || day.day !== today) {
    days.set(userId, { count: 1, day: today });
  } else if (day.count >= MAX_PER_DAY) {
    return {
      allowed: false,
      retryAfterSec: 3600,
      reason: "Kuota AI harian sudah tercapai. Coba lagi besok.",
    };
  } else {
    day.count += 1;
  }

  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Enforce the AI rate limit for a user/route. Returns a 429 NextResponse when
 * the limit is exceeded, or null when the request may proceed.
 */
export function enforceAIRateLimit(userId: string, route: string): NextResponse | null {
  const result = checkAIRateLimit(userId, route);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: result.reason ?? "Rate limit exceeded." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
  );
}
