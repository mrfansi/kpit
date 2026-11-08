import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  const directory = mkdtempSync(join(tmpdir(), "kpit-wrangler-"));
  path = join(directory, "wrangler.json");
  writeFileSync(path, JSON.stringify(config));
  process.on("exit", () => rmSync(directory, { recursive: true, force: true }));
  return path;
}

export type Row = Record<string, string | number | null>;
export interface Target { local: boolean; persistTo?: string }
const localState = ".cloudflare/state";

export function wrangler(args: string[]): string {
  return execFileSync(process.execPath, [resolve("node_modules/wrangler/bin/wrangler.js"), ...args, "--config", wranglerConfigPath()], { encoding: "utf8", env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" }, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}
export function targetArgs(target: Target): string[] {
  if (!target.local && target.persistTo) throw new Error("--persist-to is only valid with --local");
  // Without --persist-to, local commands use the state directory the vinext dev server reads.
  return target.local ? ["--local", "--persist-to", resolve(target.persistTo ?? localState)] : ["--remote"];
}
export function queryD1(command: string, target: Target): Row[] {
  const results = JSON.parse(wrangler(["d1", "execute", "DB", ...targetArgs(target), "--yes", "--json", "--command", command])) as { success: boolean; results: Row[] }[];
  if (!results.length || results.some((result) => !result.success)) throw new Error("D1 query failed");
  return results.flatMap((result) => result.results);
}
export function parseTarget(args: string[]): Target {
  if (args.includes("--local") === args.includes("--remote")) throw new Error("Specify exactly one of --local or --remote");
  const at = args.indexOf("--persist-to");
  if (at !== -1 && (!args[at + 1] || args[at + 1].startsWith("--"))) throw new Error("--persist-to requires a directory");
  const target = { local: args.includes("--local"), persistTo: at === -1 ? undefined : args[at + 1] };
  targetArgs(target);
  return target;
}
