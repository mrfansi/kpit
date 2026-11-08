import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { wrangler } from "@/scripts/export-to-d1";
import { wranglerConfigPath } from "@/scripts/wrangler-config";
import { installTestEnv } from "@/testing/cloudflare-workers";

export type TestEnv = { DB: D1Database; UPLOADS: R2Bucket };

/**
 * Use a separate migrated local D1 database; never read the repository's dev state.
 * While it is active, `env` from "cloudflare:workers" (mapped to src/testing/cloudflare-workers.ts
 * by src/testing/register.ts) returns these bindings, so `db` from @/lib/db works.
 */
export async function createTestD1(): Promise<{ env: TestEnv; dispose(): Promise<void> }> {
  const directory = await mkdtemp(join(tmpdir(), "kpit-d1-"));
  let proxy: PlatformProxy<TestEnv> | undefined;
  let previous: Record<string, unknown> | undefined;
  try {
    wrangler(["d1", "migrations", "apply", "DB", "--local", "--persist-to", directory]);
    // Wrangler's --persist-to appends v3; getPlatformProxy uses the exact path.
    proxy = await getPlatformProxy<TestEnv>({
      configPath: wranglerConfigPath(),
      persist: { path: join(directory, "v3") },
      remoteBindings: false,
      envFiles: [],
    });
    previous = installTestEnv(proxy.env);
    return {
      env: proxy.env,
      async dispose() {
        installTestEnv(previous);
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
