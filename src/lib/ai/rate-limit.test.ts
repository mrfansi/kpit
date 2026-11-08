import assert from "node:assert/strict";
import test from "node:test";
import { createTestD1 } from "../test-d1";
import { consumeRateLimit } from "../rate-limit-d1";
import { checkAIRateLimit } from "./rate-limit";

test("D1 rate limiter", async (t) => {
  const environment = await createTestD1();
  t.after(() => environment.dispose());

  await t.test("counts, rejects over max, and resets after the window", async () => {
    const t0 = 1_000_000;
    assert.deepEqual((await consumeRateLimit("k1", 60, 2, 1, t0)).allowed, true);
    assert.equal((await consumeRateLimit("k1", 60, 2, 1, t0 + 1000)).count, 2);
    const over = await consumeRateLimit("k1", 60, 2, 1, t0 + 2000);
    assert.equal(over.allowed, false);
    assert.equal(over.retryAfterSec, 58);
    const reset = await consumeRateLimit("k1", 60, 2, 1, t0 + 60_000);
    assert.deepEqual([reset.allowed, reset.count], [true, 1]);
  });

  await t.test("cost accounting: batch grants only what remains", async () => {
    const t0 = 5_000_000;
    assert.equal((await checkAIRateLimit("u1", "draft-comment", 10, t0)).granted, 10);
    const second = await checkAIRateLimit("u1", "draft-comment", 10, t0 + 1000);
    assert.deepEqual([second.allowed, second.granted], [true, 5]);
    const third = await checkAIRateLimit("u1", "draft-comment", 1, t0 + 2000);
    assert.deepEqual([third.allowed, third.granted], [false, 0]);
    // Another route has its own burst window.
    assert.equal((await checkAIRateLimit("u1", "chat", 1, t0 + 3000)).allowed, true);
    // The window passed: allowed again.
    assert.equal((await checkAIRateLimit("u1", "draft-comment", 1, t0 + 61_000)).allowed, true);
  });

  await t.test("daily cap is shared across routes", async () => {
    const t0 = 9_000_000;
    for (let i = 0; i < 20; i++) await checkAIRateLimit("u2", `r${i}`, 15, t0);
    const blocked = await checkAIRateLimit("u2", "fresh", 1, t0 + 1000);
    assert.equal(blocked.allowed, false);
    assert.match(blocked.reason ?? "", /harian/);
    assert.equal((await checkAIRateLimit("u2", "fresh", 1, t0 + 86_400_000)).allowed, true);
  });
});
