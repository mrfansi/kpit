import type { Config } from "drizzle-kit";

// Only used by `db:generate`; migrations are applied to D1 with `d1:migrate:*`.
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
} satisfies Config;
