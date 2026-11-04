import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { getPlatformProxy, type PlatformProxy } from "wrangler";

const execute = promisify(execFile);
const contextSymbol = Symbol.for("__cloudflare-context__");

/** Use a separate migrated local D1 database; never read the repository's dev state. */
export async function createTestD1(): Promise<{ env: CloudflareEnv; dispose(): Promise<void> }> {
  const directory = await mkdtemp(join(tmpdir(), "kpit-d1-"));
  let proxy: PlatformProxy<CloudflareEnv> | undefined;
  const context = globalThis as unknown as Record<symbol, unknown>;
  const previous = context[contextSymbol];
  try {
    await execute("corepack", ["pnpm", "exec", "wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", directory], {
      cwd: resolve("."),
      env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" },
    });
    // Wrangler's --persist-to appends v3; getPlatformProxy uses the exact path.
    proxy = await getPlatformProxy<CloudflareEnv>({
      configPath: resolve("wrangler.jsonc"),
      persist: { path: join(directory, "v3") },
      remoteBindings: false,
      envFiles: [],
    });
    context[contextSymbol] = { env: proxy.env, cf: proxy.cf, ctx: proxy.ctx };
    return {
      env: proxy.env,
      async dispose() {
        if (previous === undefined) delete context[contextSymbol];
        else context[contextSymbol] = previous;
        try {
          await proxy!.dispose();
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    await proxy?.dispose();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
