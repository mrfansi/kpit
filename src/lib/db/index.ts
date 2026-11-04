import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = DrizzleD1Database<typeof schema>;

// D1 enforces declared foreign keys (ON DELETE CASCADE) and has no interactive
// transactions: group writes that must commit together with `db.batch([...])`.
const instances = new WeakMap<D1Database, Database>();

function current(): Database {
  // The binding only exists inside a request (or a context installed by tests),
  // so it is resolved on every access instead of at module load.
  const binding = getCloudflareContext().env.DB;
  let instance = instances.get(binding);
  if (!instance) instances.set(binding, (instance = drizzle(binding, { schema })));
  return instance;
}

export const db = new Proxy({} as Database, {
  get(_target, key) {
    const instance = current();
    const value = Reflect.get(instance, key);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
