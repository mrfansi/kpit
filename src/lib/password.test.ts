import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./password";

test("a freshly hashed password verifies, a wrong one does not", async () => {
  const hash = await hashPassword("rahasia-123");
  assert.match(hash, /^pbkdf2-sha256\$100000\$[^$]+\$[^$]+$/);
  assert.equal(await verifyPassword({ hash, password: "rahasia-123" }), true);
  assert.equal(await verifyPassword({ hash, password: "salah" }), false);
});

test("malformed hashes are rejected without throwing", async () => {
  const [, , salt, key] = (await hashPassword("x")).split("$");
  const bad = [
    "",
    "plain-text",
    `md5$100000$${salt}$${key}`, // wrong prefix
    `pbkdf2-sha256$100000$${salt}`, // missing key
    `pbkdf2-sha256$100000$${salt}$${key}$extra`, // extra segment
    `pbkdf2-sha256$abc$${salt}$${key}`, // non-numeric iterations
    `pbkdf2-sha256$0$${salt}$${key}`, // iterations below 1
    `pbkdf2-sha256$1.5$${salt}$${key}`, // non-integer iterations
    "pbkdf2-sha256$100000$!!!$!!!", // malformed base64
    `pbkdf2-sha256$100000$${salt}$AAAA`, // key length mismatch
  ];
  for (const hash of bad) assert.equal(await verifyPassword({ hash, password: "x" }), false, hash);
});

test("an iteration count above the cap is rejected even with a matching key", async () => {
  const [, , salt, key] = (await hashPassword("x")).split("$");
  assert.equal(await verifyPassword({ hash: `pbkdf2-sha256$100001$${salt}$${key}`, password: "x" }), false);
  assert.equal(await verifyPassword({ hash: `pbkdf2-sha256$100000$${salt}$${key}`, password: "x" }), true);
});
