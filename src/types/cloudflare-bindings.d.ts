// Only the binding types are made global. Including the full Workers runtime types
// (wrangler's default) retypes DOM globals such as Response.json() for client code too.
type D1Database = import("@cloudflare/workers-types").D1Database;
type D1Result<T = unknown> = import("@cloudflare/workers-types").D1Result<T>;
type D1PreparedStatement = import("@cloudflare/workers-types").D1PreparedStatement;
type R2Bucket = import("@cloudflare/workers-types").R2Bucket;
type Fetcher = import("@cloudflare/workers-types").Fetcher;
