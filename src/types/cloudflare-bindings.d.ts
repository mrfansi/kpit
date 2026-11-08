// Only the binding types are made global. Including the full Workers runtime types
// (cf's default; vite.config.ts sets types.includeRuntime: false) retypes DOM globals such as Response.json() for client code too.
type D1Database = import("@cloudflare/workers-types").D1Database;
type D1Result<T = unknown> = import("@cloudflare/workers-types").D1Result<T>;
type D1PreparedStatement = import("@cloudflare/workers-types").D1PreparedStatement;
type R2Bucket = import("@cloudflare/workers-types").R2Bucket;
type Fetcher = import("@cloudflare/workers-types").Fetcher;

// Normally part of the runtime types, which are not included (see above). `Env` is generated into
// .cloudflare/types from cloudflare.config.ts.
declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}
