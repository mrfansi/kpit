import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import cloudflare from "../../cloudflare.config";

let path: string | undefined;

/**
 * Wrangler CLI / getPlatformProxy still power the D1 and R2 scripts (cf has no `d1 execute --file`
 * or `r2 object get/put`) but no longer have a config file of their own. Derive one from
 * cloudflare.config.ts so the bindings stay defined in a single place.
 */
export function wranglerConfigPath(): string {
  if (path) return path;
  const worker = cloudflare.worker as { name: string; compatibilityDate: string; env: Record<string, { type: string; name?: string; id?: string }> };
  const bindings = Object.entries(worker.env);
  const config = {
    name: worker.name,
    account_id: cloudflare.accountId,
    compatibility_date: worker.compatibilityDate,
    d1_databases: bindings.filter(([, b]) => b.type === "d1").map(([binding, b]) => ({ binding, database_name: b.name, database_id: b.id, migrations_dir: resolve("drizzle") })),
    r2_buckets: bindings.filter(([, b]) => b.type === "r2").map(([binding, b]) => ({ binding, bucket_name: b.name })),
  };
  path = join(mkdtempSync(join(tmpdir(), "kpit-wrangler-")), "wrangler.json");
  writeFileSync(path, JSON.stringify(config));
  return path;
}
