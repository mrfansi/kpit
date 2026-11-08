import { env } from "cloudflare:workers";

export interface RateLimitRule {
  key: string;
  windowSeconds: number;
  max: number;
  cost?: number;
}

export interface RateLimitOutcome {
  allowed: boolean;
  /** Counter after this call (includes `cost`, even when the call is over the limit). */
  count: number;
  retryAfterSec: number;
}

// Fixed window anchored at the first hit: when the stored window is older than `windowSeconds`
// the row restarts at `cost`. One statement per key, so concurrent isolates cannot lose updates.
// Own table: better-auth prunes its `rate_limit` rows, which would wipe these counters.
const UPSERT = `INSERT INTO app_rate_limit (key, count, last_request) VALUES (?1, ?2, ?3)
  ON CONFLICT(key) DO UPDATE SET
    count = CASE WHEN last_request <= ?3 - ?4 THEN ?2 ELSE count + ?2 END,
    last_request = CASE WHEN last_request <= ?3 - ?4 THEN ?3 ELSE last_request END
  RETURNING count, last_request`;

/** Consume several counters in one D1 batch; `now` is injectable for tests. */
export async function consumeRateLimits(rules: RateLimitRule[], now = Date.now()): Promise<RateLimitOutcome[]> {
  const results: D1Result<{ count: number; last_request: number }>[] = await env.DB.batch(
    rules.map((rule: RateLimitRule) =>
      env.DB.prepare(UPSERT).bind(rule.key, rule.cost ?? 1, now, rule.windowSeconds * 1000),
    ),
  );
  return results.map((result: D1Result<{ count: number; last_request: number }>, index: number) => {
    const { count, last_request } = result.results[0];
    const { max, windowSeconds } = rules[index];
    return {
      allowed: count <= max,
      count,
      retryAfterSec: Math.max(1, Math.ceil((last_request + windowSeconds * 1000 - now) / 1000)),
    };
  });
}

/** Give back units charged but not used (one D1 batch). */
export async function refundRateLimits(refunds: { key: string; amount: number }[]): Promise<void> {
  if (refunds.length === 0) return;
  await env.DB.batch(
    refunds.map(({ key, amount }) =>
      env.DB.prepare("UPDATE app_rate_limit SET count = MAX(0, count - ?1) WHERE key = ?2").bind(amount, key),
    ),
  );
}

export async function consumeRateLimit(
  key: string,
  windowSeconds: number,
  max: number,
  cost = 1,
  now = Date.now(),
): Promise<RateLimitOutcome> {
  const [outcome] = await consumeRateLimits([{ key, windowSeconds, max, cost }], now);
  return outcome;
}
