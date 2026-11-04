import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { presentationBrandStyles, users } from "../db/schema";
import { createTestD1 } from "../test-d1";
import { DEFAULT_BRAND_STYLE } from "./brand";
import { getActivePresentationBrand, PresentationBrandConflict, savePresentationBrand } from "./brand-store";

test("brand revisions persist append-only with optimistic concurrency in local D1", async (t) => {
  const environment = await createTestD1();
  t.after(() => environment.dispose());
  const userId = "brand-test-admin";
  await db.insert(users).values({ id: userId, email: "brand@example.test", name: "Brand Admin", passwordHash: "test-only", role: "admin" });
  assert.equal(await getActivePresentationBrand(), null);
  assert.deepEqual(await savePresentationBrand({ style: DEFAULT_BRAND_STYLE, description: "Awal", expectedRevision: 0 }, userId), { revision: 1 });
  const first = await getActivePresentationBrand();
  assert.equal(first?.description, "Awal");
  assert.equal(first?.updatedBy, userId);
  assert.ok(first?.updatedAt && !Number.isNaN(Date.parse(first.updatedAt)));
  await assert.rejects(savePresentationBrand({ style: DEFAULT_BRAND_STYLE, description: "Stale", expectedRevision: 0 }, userId), (error: unknown) => error instanceof PresentationBrandConflict && error.status === 409 && error.active?.revision === 1);
  await assert.rejects(savePresentationBrand({ style: DEFAULT_BRAND_STYLE, description: "Future", expectedRevision: 9 }, userId), PresentationBrandConflict);
  const secondStyle = { ...DEFAULT_BRAND_STYLE, name: "Revisi kedua", footerText: "Untuk internal" };
  const concurrent = await Promise.allSettled([
    savePresentationBrand({ style: secondStyle, description: "Kedua A", expectedRevision: 1 }, userId),
    savePresentationBrand({ style: secondStyle, description: "Kedua B", expectedRevision: 1 }, userId),
  ]);
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = concurrent.find((result) => result.status === "rejected");
  assert.ok(rejected?.status === "rejected" && rejected.reason instanceof PresentationBrandConflict);
  assert.equal((await db.select().from(presentationBrandStyles)).length, 2);
  assert.equal((await getActivePresentationBrand())?.revision, 2);
  assert.deepEqual((await getActivePresentationBrand())?.style, secondStyle);
  assert.deepEqual((await db.select().from(presentationBrandStyles).where(eq(presentationBrandStyles.revision, 1)))[0].style, DEFAULT_BRAND_STYLE);
  await savePresentationBrand({ style: DEFAULT_BRAND_STYLE, description: "Reset", expectedRevision: 2 }, userId);
  assert.equal((await getActivePresentationBrand())?.revision, 3);
  assert.deepEqual((await getActivePresentationBrand())?.style, DEFAULT_BRAND_STYLE);
  await db.delete(users).where(eq(users.id, userId));
  assert.equal((await getActivePresentationBrand())?.updatedBy, null);
  assert.equal((await db.select().from(presentationBrandStyles)).length, 3);
});
