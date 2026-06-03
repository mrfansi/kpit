import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_URL ?? "./kpit.db";
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
// Enforce declared foreign keys (off by default in SQLite). All FKs use
// ON DELETE CASCADE, so enabling this prevents orphan/dangling rows without
// breaking deletes.
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
