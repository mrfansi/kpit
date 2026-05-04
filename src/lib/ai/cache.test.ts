import assert from "node:assert/strict";
import test from "node:test";
import { createAICacheKey, getCachedAIResponse, setCachedAIResponse } from "./cache";

test("creates stable cache keys regardless of object key order", () => {
  const left = createAICacheKey("domain-summary", { b: 2, a: { d: 4, c: 3 } });
  const right = createAICacheKey("domain-summary", { a: { c: 3, d: 4 }, b: 2 });

  assert.equal(left, right);
});

test("expires cached AI responses after ttl", () => {
  const key = createAICacheKey("report-narrative", { period: "2026-05" });
  setCachedAIResponse(key, "cached", 1000, 10_000);

  assert.equal(getCachedAIResponse(key, 10_500), "cached");
  assert.equal(getCachedAIResponse(key, 11_001), null);
});
