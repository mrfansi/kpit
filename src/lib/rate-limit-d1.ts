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
// Keys must not contain `|` (better-auth stores `ip|path` rows in the same table).
const UPSERT = `INSERT INTO rate_limit (id, key, count, last_request) VALUES (?1, ?2, ?3, ?4)
  ON CONFLICT(key) DO UPDATE SET
    count = CASE WHEN last_request <= ?4 - ?5 THEN ?3 ELSE count + ?3 END,
    last_request = CASE WHEN last_request <= ?4 - ?5 THEN ?4 ELSE last_request END
  RETURNING count, last_request`;

/** Consume several counters in one D1 batch; `now` is injectable for tests. */
export async function consumeRateLimits(rules: RateLimitRule[], now = Date.now()): Promise<RateLimitOutcome[]> {
  const results = await env.DB.batch<{ count: number; last_request: number }>(
    rules.map((rule) =>
      env.DB.prepare(UPSERT).bind(crypto.randomUUID(), rule.key, rule.cost ?? 1, now, rule.windowSeconds * 1000),
    ),
  );
  return results.map((result, index) => {
    const { count, last_request } = result.results[0];
    const { max, windowSeconds } = rules[index];
    return {
      allowed: count <= max,
      count,
      retryAfterSec: Math.max(1, Math.ceil((last_request + windowSeconds * 1000 - now) / 1000)),
    };
  });
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
