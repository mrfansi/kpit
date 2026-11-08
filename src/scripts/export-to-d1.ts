import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { migrateDatabase } from "./migrate-db";
import { wranglerConfigPath } from "./wrangler-config";

type Cell = [string, string | number | null];
type Row = Record<string, string | number | null>;
interface Column { name: string; pk: number }
interface Table { name: string; columns: string[]; order: string[]; count: number; sha256: string }
interface Upload { name: string; size: number; sha256: string }
interface Manifest { version: 1; migrations: string[]; sqlSha256: string; tables: Table[]; uploads: Upload[]; warnings: string[] }
export interface Target { local: boolean; persistTo?: string }
const migrationsDir = resolve("drizzle");
const localState = ".cloudflare/state";
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const appTable = (name: string) => !name.startsWith("sqlite_") && !name.startsWith("_cf_") && !["__drizzle_migrations", "d1_migrations"].includes(name);
const inside = (path: string, parent: string) => { const rel = relative(parent, path); return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`)); };
const migrationNames = () => readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
const tables = (db: Database.Database) => (db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]).map(({ name }) => name).filter(appTable);
const columns = (db: Database.Database, name: string) => db.prepare(`PRAGMA table_info(${quote(name)})`).all() as Column[];
const count = (db: Database.Database, name: string) => Number(db.prepare(`SELECT count(*) FROM ${quote(name)}`).pluck().get());

// Cast integers before JSON crosses Wrangler's boundary: D1 JSON numbers lose int64 precision.
function rowQuery(table: Pick<Table, "name" | "columns" | "order">, offset = 0, limit?: number) {
  const fields = table.columns.flatMap((column, i) => {
    const c = quote(column);
    return [`typeof(${c}) AS t${i}`, `CASE typeof(${c}) WHEN 'integer' THEN CAST(${c} AS TEXT) WHEN 'blob' THEN hex(${c}) ELSE ${c} END AS v${i}`];
  });
  return `SELECT ${fields.join(",")} FROM ${quote(table.name)} ORDER BY ${table.order.map(quote).join(",")} ${limit === undefined ? "" : `LIMIT ${limit} OFFSET ${offset}`}`;
}
function cells(row: Row, table: Table): Cell[] {
  return table.columns.map((_, i) => {
    const type = String(row[`t${i}`]);
    const value = row[`v${i}`];
    if (type === "real" && (typeof value !== "number" || !Number.isFinite(value))) throw new Error(`Non-finite REAL in ${table.name}; D1 cannot preserve it.`);
    return [type, value];
  });
}
function literal([type, value]: Cell): string {
  switch (type) {
    case "null": return "NULL";
    case "integer": return String(value);
    case "real": { const text = String(value); return /[.eE]/.test(text) ? text : `${text}.0`; }
    case "text": return String(value).includes("\0") ? `CAST(X'${Buffer.from(String(value)).toString("hex")}' AS TEXT)` : `'${String(value).replaceAll("'", "''")}'`;
    case "blob": return `X'${value}'`;
    default: throw new Error(`Unsupported SQLite type: ${type}`);
  }
}
function hashRows(rows: Row[], table: Table) {
  const hash = createHash("sha256");
  for (const row of rows) hash.update(`${JSON.stringify(cells(row, table))}\n`);
  return hash.digest("hex");
}
function orderedTables(db: Database.Database, names: string[]) {
  const result: string[] = [];
  const visiting = new Set<string>();
  const visit = (name: string) => {
    if (result.includes(name) || visiting.has(name)) return;
    visiting.add(name);
    for (const fk of db.prepare(`PRAGMA foreign_key_list(${quote(name)})`).all() as { table: string }[]) if (names.includes(fk.table)) visit(fk.table);
    result.push(name);
  };
  names.forEach(visit);
  return result;
}

export async function exportDatabase(sourcePath: string, outPath: string, uploadsPath?: string): Promise<Manifest> {
  const source = realpathSync(sourcePath);
  const out = resolve(outPath);
  const parent = realpathSync(dirname(out));
  const actualOut = join(parent, basename(out));
  if (existsSync(out) || inside(source, actualOut) || inside(actualOut, source)) throw new Error("Export directory must not exist or overlap the source database.");
  if (uploadsPath && (inside(actualOut, realpathSync(uploadsPath)) || inside(realpathSync(uploadsPath), actualOut))) throw new Error("Export directory must not overlap uploads directory.");
  mkdirSync(out, { mode: 0o700 });
  const snapshotPath = join(out, "snapshot.sqlite");
  const referencePath = join(out, "reference.sqlite");
  let snapshot: Database.Database | undefined;
  let reference: Database.Database | undefined;
  try {
    const sourceDb = new Database(source, { readonly: true, fileMustExist: true });
    try { await sourceDb.backup(snapshotPath); } finally { sourceDb.close(); }
    chmodSync(snapshotPath, 0o600);
    const before = new Database(snapshotPath, { readonly: true });
    const originalCounts = new Map(tables(before).map((name) => [name, count(before, name)]));
    before.close();
    const upgraded = migrateDatabase(snapshotPath, migrationsDir);
    console.log(`Snapshot: applied ${upgraded.applied}, reconciled ${upgraded.reconciled} migration(s).`);
    migrateDatabase(referencePath, migrationsDir);
    chmodSync(referencePath, 0o600);
    snapshot = new Database(snapshotPath, { readonly: true });
    reference = new Database(referencePath);
    const sourceTables = tables(snapshot);
    const targetTables = tables(reference);
    const drift: string[] = [];
    for (const name of new Set([...sourceTables, ...targetTables])) {
      if (!sourceTables.includes(name)) { drift.push(`missing source table ${name}`); continue; }
      if (!targetTables.includes(name)) { drift.push(`extra source table ${name}`); continue; }
      const a = columns(snapshot, name).map((c) => c.name);
      const b = columns(reference, name).map((c) => c.name);
      for (const column of a) if (!b.includes(column)) drift.push(`extra source column ${name}.${column}`);
      for (const column of b) if (!a.includes(column)) drift.push(`missing source column ${name}.${column}`);
    }
    for (const [name, originalCount] of originalCounts) if (!sourceTables.includes(name) || count(snapshot, name) < originalCount) drift.push(`migration removed rows from ${name} (${originalCount} before)`);
    if (drift.length) throw new Error(`Schema/data drift; refusing export:\n${drift.join("\n")}`);
    const manifest: Manifest = { version: 1, migrations: migrationNames(), sqlSha256: "", tables: [], uploads: [], warnings: [] };
    const statements = ["PRAGMA defer_foreign_keys = true;", "DELETE FROM timeline_project_statuses WHERE NOT EXISTS (SELECT 1 FROM timeline_projects);"];
    const referencedUploads = new Set<string>();
    reference.pragma("foreign_keys = ON");
    reference.exec("BEGIN; PRAGMA defer_foreign_keys = true;");
    // Migrations seed default project statuses; replace them with the source's exact rows.
    for (const name of orderedTables(reference, targetTables).reverse()) reference.exec(`DELETE FROM ${quote(name)}`);
    for (const name of orderedTables(reference, targetTables)) {
      const info = columns(reference, name);
      const pk = info.filter((column) => column.pk).sort((a, b) => a.pk - b.pk).map((column) => column.name);
      const table: Table = { name, columns: info.map((column) => column.name), order: pk.length ? pk : ["rowid"], count: 0, sha256: "" };
      const rows = snapshot.prepare(rowQuery(table)).safeIntegers().all() as Row[];
      table.count = rows.length;
      table.sha256 = hashRows(rows, table);
      for (const row of rows) {
        const values = cells(row, table);
        const sql = `INSERT INTO ${quote(name)} (${table.columns.map(quote).join(",")}) VALUES (${values.map(literal).join(",")});`;
        if (Buffer.byteLength(sql) >= 100_000) throw new Error(`Row in ${name} exceeds D1's 100KB statement limit; refusing export.`);
        reference.exec(sql);
        statements.push(sql);
        for (const [type, value] of values) if (type === "text") for (const match of String(value).matchAll(/\/uploads\/comments\/([^\s"'<>?#)\\]+)/g)) referencedUploads.add(match[1]);
      }
      manifest.tables.push(table);
    }
    const orphans = reference.pragma("foreign_key_check") as { table: string; rowid: number; parent: string }[];
    if (orphans.length) throw new Error(`Foreign key violations:\n${orphans.map((row) => `table=${row.table} rowid=${row.rowid} parent=${row.parent}`).join("\n")}`);
    const integrity = reference.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") throw new Error(`Integrity check failed: ${integrity}`);
    reference.exec("COMMIT");
    for (const table of manifest.tables) if (hashRows(reference.prepare(rowQuery(table)).all() as Row[], table) !== table.sha256) throw new Error(`Reference copy changed values in ${table.name}`);
    if (uploadsPath) {
      mkdirSync(join(out, "uploads"), { mode: 0o700 });
      for (const entry of readdirSync(uploadsPath, { withFileTypes: true })) {
        if (!entry.isFile()) { manifest.warnings.push(`Skipped non-file upload: ${entry.name}`); continue; }
        if (!/^[\w-]+\.(jpe?g|png|gif|webp)$/i.test(entry.name)) manifest.warnings.push(`Upload filename is not served by the app: ${entry.name}`);
        const bytes = readFileSync(join(uploadsPath, entry.name));
        writeFileSync(join(out, "uploads", entry.name), bytes, { mode: 0o600 });
        manifest.uploads.push({ name: entry.name, size: bytes.length, sha256: sha256(bytes) });
      }
      for (const name of referencedUploads) if (!manifest.uploads.some((file) => file.name === name)) manifest.warnings.push(`Missing referenced upload: ${name}`);
    } else if (referencedUploads.size) manifest.warnings.push(`Uploads directory not supplied; ${referencedUploads.size} referenced image(s) not exported: ${[...referencedUploads].join(", ")}`);
    const sql = `${statements.join("\n")}\n`;
    manifest.sqlSha256 = sha256(sql);
    writeFileSync(join(out, "data.sql"), sql, { mode: 0o600 });
    writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    for (const warning of manifest.warnings) console.warn(`WARNING: ${warning}`);
    console.log(manifest.tables.map((table) => `${table.name}: ${table.count}`).join("\n"));
    return manifest;
  } catch (error) {
    // A failed export must never look like a usable migration bundle.
    rmSync(join(out, "manifest.json"), { force: true });
    throw error;
  } finally { snapshot?.close(); reference?.close(); }
}

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
function loadManifest(out: string): Manifest {
  const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")) as Manifest;
  if (manifest.version !== 1 || manifest.sqlSha256 !== sha256(readFileSync(join(out, "data.sql")))) throw new Error("Invalid manifest or data.sql checksum mismatch");
  if (JSON.stringify(manifest.migrations) !== JSON.stringify(migrationNames())) throw new Error("Export migrations differ from this checkout; export again using this version.");
  for (const upload of manifest.uploads) {
    if (basename(upload.name) !== upload.name) throw new Error("Invalid upload path");
    const bytes = readFileSync(join(out, "uploads", upload.name));
    if (bytes.length !== upload.size || sha256(bytes) !== upload.sha256) throw new Error(`Export upload checksum mismatch: ${upload.name}`);
  }
  return manifest;
}
export function verifyExport(out: string, target: Target) {
  const manifest = loadManifest(out);
  const mismatches: string[] = [];
  for (const table of manifest.tables) {
    const hash = createHash("sha256");
    let offset = 0;
    while (true) {
      const rows = queryD1(rowQuery(table, offset, 250), target);
      for (const row of rows) hash.update(`${JSON.stringify(cells(row, table))}\n`);
      offset += rows.length;
      if (rows.length < 250) break;
    }
    if (offset !== table.count || hash.digest("hex") !== table.sha256) mismatches.push(`${table.name}: expected ${table.count} rows and hash ${table.sha256}, found ${offset} rows or differing hash`);
  }
  const temp = mkdtempSync(join(tmpdir(), "kpit-r2-verify-"));
  try {
    for (const upload of manifest.uploads) {
      const path = join(temp, "object");
      try {
        wrangler(["r2", "object", "get", `kpit-uploads/comments/${upload.name}`, ...targetArgs(target), "--file", path]);
        const bytes = readFileSync(path);
        if (bytes.length !== upload.size || sha256(bytes) !== upload.sha256) mismatches.push(`R2 mismatch: ${upload.name}`);
      } catch { mismatches.push(`R2 missing/unreadable: ${upload.name}`); }
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
  if (mismatches.length) throw new Error(`Verification failed:\n${mismatches.join("\n")}`);
  console.log(`Verify OK: ${manifest.tables.length} tables, ${manifest.tables.reduce((n, table) => n + table.count, 0)} rows, ${manifest.uploads.length} R2 objects (size + SHA-256).`);
}
export function importExport(out: string, target: Target) {
  const manifest = loadManifest(out);
  const applied = new Set(queryD1("SELECT name FROM d1_migrations", target).map((row) => row.name));
  const missing = manifest.migrations.filter((name) => !applied.has(name));
  if (missing.length) throw new Error(`Apply D1 migrations first: ${missing.join(", ")}`);
  const actualTables = queryD1("SELECT name FROM sqlite_master WHERE type='table'", target).map((row) => String(row.name)).filter(appTable);
  if (JSON.stringify([...actualTables].sort()) !== JSON.stringify(manifest.tables.map((table) => table.name).sort())) throw new Error("D1 application tables differ from export");
  const counts = queryD1(actualTables.map((name) => `SELECT '${name.replaceAll("'", "''")}' AS name, count(*) AS n FROM ${quote(name)}`).join(";"), target);
  let defaultStatuses = false;
  const seeded = counts.find((row) => row.name === "timeline_project_statuses" && Number(row.n) !== 0);
  if (seeded) {
    const table = manifest.tables.find((item) => item.name === "timeline_project_statuses")!;
    const actual = queryD1(rowQuery(table), target);
    const createdAt = table.columns.indexOf("created_at");
    const timestamp = Number(actual[0]?.[`v${createdAt}`]);
    const baseline = new Database(":memory:");
    try {
      // unixepoch() in 0010 is nondeterministic; normalize only the shared seed creation time.
      baseline.function("unixepoch", () => timestamp);
      for (const name of migrationNames()) baseline.exec(readFileSync(join(migrationsDir, name), "utf8"));
      defaultStatuses = Number.isSafeInteger(timestamp) && timestamp > 0 &&
        actual.every((row) => Number(row[`v${createdAt}`]) === timestamp) &&
        hashRows(actual, table) === hashRows(baseline.prepare(rowQuery(table)).all() as Row[], table);
    } finally { baseline.close(); }
  }
  const occupied = counts.filter((row) => Number(row.n) !== 0 && !(defaultStatuses && row.name === "timeline_project_statuses"));
  if (occupied.length) throw new Error(`Target is not empty; refusing import: ${occupied.map((row) => `${row.name}=${row.n}`).join(", ")}`);
  wrangler(["d1", "execute", "DB", ...targetArgs(target), "--yes", "--file", resolve(out, "data.sql")]);
  for (const upload of manifest.uploads) {
    const mime = ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" } as Record<string, string>)[extname(upload.name).toLowerCase()] ?? "application/octet-stream";
    wrangler(["r2", "object", "put", `kpit-uploads/comments/${upload.name}`, ...targetArgs(target), "--file", resolve(out, "uploads", upload.name), "--content-type", mime, "--force"]);
  }
  verifyExport(out, target);
}
export function parseTarget(args: string[]): Target {
  if (args.includes("--local") === args.includes("--remote")) throw new Error("Specify exactly one of --local or --remote");
  const at = args.indexOf("--persist-to");
  if (at !== -1 && (!args[at + 1] || args[at + 1].startsWith("--"))) throw new Error("--persist-to requires a directory");
  const target = { local: args.includes("--local"), persistTo: at === -1 ? undefined : args[at + 1] };
  targetArgs(target);
  return target;
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  const value = (flag: string, required = true) => { const i = args.indexOf(flag); const val = i < 0 ? undefined : args[i + 1]; if (required && (!val || val.startsWith("--"))) throw new Error(`${flag} is required`); return val; };
  try {
    const out = value("--out")!;
    if (command === "export") await exportDatabase(value("--source")!, out, value("--uploads-dir", false));
    else if (command === "import") importExport(out, parseTarget(args));
    else if (command === "verify") verifyExport(out, parseTarget(args));
    else throw new Error("Usage: export --source <db> [--uploads-dir <dir>] --out <new-dir> | import/verify --out <dir> (--local [--persist-to <dir>] | --remote)");
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
