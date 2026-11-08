import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashPassword } from "../lib/password";
import { parseTarget, queryD1, targetArgs, wrangler } from "./wrangler-config";

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

try {
  const target = parseTarget(process.argv.slice(2));
  if (!email || !password) throw new Error("SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi.");
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) throw new Error("SEED_ADMIN_PASSWORD minimal 12 karakter dan harus mengandung huruf dan angka.");
  // Hex text literals preserve quotes, Unicode and embedded NUL without SQL interpolation.
  // better-auth looks users up by lower-cased email.
  const emailSql = `CAST(X'${Buffer.from(email.toLowerCase()).toString("hex")}' AS TEXT)`;
  if (queryD1(`SELECT id FROM users WHERE email = ${emailSql} LIMIT 1`, target).length) {
    console.log(`User ${email} sudah ada, skip.`);
  } else {
    const hash = await hashPassword(password);
    const folder = mkdtempSync(join(tmpdir(), "kpit-admin-"));
    try {
      const file = join(folder, "seed.sql");
      const now = Math.floor(Date.now() / 1000);
      const userId = randomUUID();
      // The user, its better-auth credential account and users.password_hash (read by the old worker) in one file.
      writeFileSync(file, [
        `INSERT INTO users (id,email,name,password_hash,role,created_at,updated_at) VALUES ('${userId}',${emailSql},'Administrator','${hash}','admin',${now},${now}) ON CONFLICT(email) DO NOTHING;`,
        `INSERT OR IGNORE INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) SELECT '${randomUUID()}',id,'credential',id,password_hash,${now},${now} FROM users WHERE id = '${userId}';`,
      ].join("\n"), { mode: 0o600 });
      wrangler(["d1", "execute", "DB", ...targetArgs(target), "--yes", "--file", file]);
      console.log(`Admin user tersedia: ${email}`);
    } finally { rmSync(folder, { recursive: true, force: true }); }
  }
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
