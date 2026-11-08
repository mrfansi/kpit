import { bindings, defineConfig, defineWorker } from "cf/config";

// Secrets set outside this file. `cf deploy` replaces every binding the config does not declare
// (wrangler's `keep_vars` has no cf equivalent), so each secret is declared with
// `bindings.secret()`: the deploy then sends an `inherit` binding and keeps the value on the Worker.
// Keep in sync with the secrets actually on the Worker.
const SECRETS = ["AUTH_SECRET", "AUTH_URL", "AUTH_TRUST_HOST", "DEEPSEEK_API_KEY"];

export default defineConfig({
  // Mrfansi account; pins deploys/remote commands so they never hit another account.
  accountId: "9eff0ff52ac1e3b3c6d955c9fe3a8ad0",
  worker: defineWorker({
    name: "kpit",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-01",
    compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
    // Canonical origin; must match the auth base URL value.
    domains: ["kpit.mrfansi.dev"],
    observability: { enabled: true },
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      // Migrations are the Drizzle SQL files in ./drizzle (`npm run d1:migrate:*` passes --dir).
      DB: bindings.d1({ name: "kpit", id: "52360490-904e-4c4d-9fe0-a2536628f154" }),
      // Comment image uploads (previously public/uploads/comments on disk).
      UPLOADS: bindings.r2({ name: "kpit-uploads" }),
      // Was a dashboard-only plain var protected by keep_vars; now owned by the config.
      DEEPSEEK_MODEL: bindings.text("deepseek-flash"),
      ...Object.fromEntries(SECRETS.map((name) => [name, bindings.secret()])),
    },
  }),
});
