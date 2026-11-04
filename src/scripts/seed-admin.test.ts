import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import bcrypt from "bcryptjs";
import { queryD1, wrangler } from "./export-to-d1";

test("D1 admin seed requires an explicit target and preserves existing accounts", { timeout: 180_000 }, () => {
  const root = mkdtempSync(join(tmpdir(), "kpit-admin-test-"));
  const env = { ...process.env, SEED_ADMIN_EMAIL: "o'brien@example.com", SEED_ADMIN_PASSWORD: "LongPassword123!" };
  const seed = (args: string[], overrides = {}) => spawnSync(process.execPath, ["--import", "tsx", "src/scripts/seed-admin.ts", ...args], { env: { ...env, ...overrides }, encoding: "utf8" });
  try {
    const absentTarget = seed([]);
    assert.equal(absentTarget.status, 1);
    assert.match(absentTarget.stderr, /exactly one of --local or --remote/);
    const target = { local: true, persistTo: root };
    const args = ["--local", "--persist-to", root];
    const weak = seed(args, { SEED_ADMIN_PASSWORD: "short" });
    assert.equal(weak.status, 1);
    assert.match(weak.stderr, /minimal 12 karakter/);
    wrangler(["d1", "migrations", "apply", "DB", ...args]);
    const created = seed(args);
    assert.equal(created.status, 0, created.stderr);
    const first = queryD1("SELECT email,password_hash FROM users", target);
    assert.equal(first.length, 1);
    assert.equal(first[0].email, env.SEED_ADMIN_EMAIL);
    assert.equal(bcrypt.getRounds(String(first[0].password_hash)), 12);
    assert.ok(bcrypt.compareSync(env.SEED_ADMIN_PASSWORD, String(first[0].password_hash)));
    const repeated = seed(args, { SEED_ADMIN_PASSWORD: "AnotherPassword456!" });
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.match(repeated.stdout, /sudah ada, skip/);
    assert.deepEqual(queryD1("SELECT email,password_hash FROM users", target), first);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
