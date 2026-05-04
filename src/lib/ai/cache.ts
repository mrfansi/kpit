import { createHash } from "crypto";

const MAX_CACHE_ENTRIES = 100;
const cache = new Map<string, { value: string; expiresAt: number }>();

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function createAICacheKey(scope: string, payload: unknown): string {
  const hash = createHash("sha256").update(stableStringify(payload)).digest("hex");
  return `${scope}:${hash}`;
}

export function getCachedAIResponse(key: string, now = Date.now()): string | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

export function setCachedAIResponse(key: string, value: string, now = Date.now(), ttlMs = 10 * 60 * 1000) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }

  cache.set(key, { value, expiresAt: now + ttlMs });
}
