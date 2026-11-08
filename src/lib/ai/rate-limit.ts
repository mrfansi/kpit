import { NextResponse } from "next/server";
import { consumeRateLimits } from "@/lib/rate-limit-d1";

/**
 * Per-user rate limiter for AI endpoints, backed by D1 so the limits hold across Worker isolates.
 *
 * Guards against cost-explosion DoS: every AI call hits the paid DeepSeek API.
 * Two layers: a short per-route window (burst control) + a daily cap (cost ceiling).
 * shortcut: a call rejected by the burst window still counts against the daily cap (both counters are
 * charged in one batch); fine at 300/day, revisit if legitimate users trip it.
 */

const WINDOW_SECONDS = 60;
const MAX_PER_WINDOW = 15;
const DAY_SECONDS = 86_400;
const MAX_PER_DAY = 300;

export interface RateLimitResult {
  allowed: boolean;
  /** How many of the requested `cost` units may proceed (0..cost). */
  granted: number;
  retryAfterSec: number;
  reason?: string;
}

export async function checkAIRateLimit(
  userId: string,
  route: string,
  cost = 1,
  now = Date.now(),
): Promise<RateLimitResult> {
  const [burst, day] = await consumeRateLimits(
    [
      { key: `ai:${userId}:${route}`, windowSeconds: WINDOW_SECONDS, max: MAX_PER_WINDOW, cost },
      { key: `ai:${userId}:day`, windowSeconds: DAY_SECONDS, max: MAX_PER_DAY, cost },
    ],
    now,
  );
  const remainingBurst = Math.max(0, MAX_PER_WINDOW - (burst.count - cost));
  const remainingDay = Math.max(0, MAX_PER_DAY - (day.count - cost));
  const granted = Math.min(cost, remainingBurst, remainingDay);
  if (granted > 0) return { allowed: true, granted, retryAfterSec: 0 };
  return remainingBurst === 0
    ? { allowed: false, granted, retryAfterSec: burst.retryAfterSec, reason: "Terlalu banyak permintaan AI. Coba lagi sebentar." }
    : { allowed: false, granted, retryAfterSec: day.retryAfterSec, reason: "Kuota AI harian sudah tercapai. Coba lagi besok." };
}

/**
 * Enforce the AI rate limit for a user/route. Returns a 429 NextResponse when
 * the limit is exceeded, or null when the request may proceed.
 */
export async function enforceAIRateLimit(userId: string, route: string): Promise<NextResponse | null> {
  const result = await checkAIRateLimit(userId, route);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: result.reason ?? "Rate limit exceeded." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
  );
}
