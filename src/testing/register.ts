import { registerHooks } from "node:module";

// Production code imports `env` from "cloudflare:workers", a workerd-only module. Under Node tests
// it resolves to ./cloudflare-workers.ts, which reads what createTestD1() installs.
const stub = new URL("./cloudflare-workers.ts", import.meta.url).href;
registerHooks({
  resolve: (specifier, context, next) =>
    specifier === "cloudflare:workers" ? { url: stub, shortCircuit: true } : next(specifier, context),
});
