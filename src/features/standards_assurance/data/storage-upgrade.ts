import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { ensureStandardsStorage, standardsStorageStatements } from "./storage";
const toPrismaSqliteFileUrl = (value: string) => "file:" + path.resolve(value).replaceAll("\\", "/");

const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const json = (value: unknown) => JSON.stringify(value, (_key, entry) =>
  typeof entry === "bigint" ? entry.toString() : entry);
const normalizedSql = (sql: string) => sql.replaceAll("IF NOT EXISTS ", "").replace(/\s+/g, " ").trim().replace(/;$/, "");
type Columns = Record<string, string[]>;

// This maintenance command spans an explicit exclusive lock, VACUUM backup and
// manual transactions. Every statement must use the same SQLite connection;
// the normal application pool cannot provide that guarantee.
export function standardsUpgradeDatabaseUrl(databasePath: string) {
  return toPrismaSqliteFileUrl(databasePath) + "?connection_limit=1";
}

export function parseStandardsUpgradeArguments(args: readonly string[]) {
  if (args.length > 1 || args.some(arg => arg !== "--apply")) throw new Error("Unsupported argument; only --apply is accepted.");
  return { apply: args.length === 1 };
}

function assertRealPath(target: string) {
  let ancestor = path.resolve(target);
  while (!existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new Error("Unresolvable storage path");
    ancestor = parent;
  }
  if (realpathSync(ancestor) !== ancestor) throw new Error("Redirected storage path");
}

async function checkSchema(db: PrismaClient) {
  const rows = await db.$queryRawUnsafe<Array<{ name: string; sql: string | null }>>(
    "SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'");
  const byName = new Map(rows.map(row => [row.name, row.sql]));
  for (const table of ["Drawing", "BomItem", "SymbolVersion"]) {
    if (!byName.has(table)) throw new Error("Invalid EI Designer schema: missing " + table);
  }
  let current = true;
  for (const sql of standardsStorageStatements()) {
    const name = /CREATE (?:UNIQUE )?(?:TABLE|INDEX|TRIGGER) IF NOT EXISTS "([^"]+)"/.exec(sql)?.[1];
    if (!name) throw new Error("Invalid expected schema statement");
    const actual = byName.get(name);
    if (actual && normalizedSql(actual) !== normalizedSql(sql)) throw new Error("Unexpected schema definition: " + name);
    if (!actual) current = false;
  }
  if ((await db.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check")).length > 0) throw new Error("Foreign-key violations must be resolved before upgrade.");
  return current;
}

async function tableColumns(db: PrismaClient): Promise<Columns> {
  const tables = await db.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const result: Columns = {};
  for (const table of tables) {
    const columns = await db.$queryRawUnsafe<Array<{ name: string }>>("PRAGMA table_info(" + quote(table.name) + ")");
    result[table.name] = columns.map(column => column.name);
  }
  return result;
}

async function fingerprint(db: PrismaClient, columns: Columns) {
  const result: Record<string, { count: number; sha256: string }> = {};
  for (const [table, names] of Object.entries(columns)) {
    const rows = await db.$queryRawUnsafe<unknown[]>(
      "SELECT " + names.map(quote).join(",") + " FROM " + quote(table));
    const serialized = rows.map(json).sort();
    result[table] = { count: rows.length, sha256: hash(json(serialized)) };
  }
  return result;
}

export async function upgradeStandardsStorage(input: {
  prisma: PrismaClient; databasePath: string; archiveBasePath: string;
  sourceCommit: string; apply: boolean; now?: Date;
}) {
  const { prisma: db, databasePath, archiveBasePath, sourceCommit, apply } = input;
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("Invalid source commit");
  assertRealPath(databasePath);
  if (!existsSync(databasePath) || !statSync(databasePath).isFile()) throw new Error("Database target is unavailable.");
  const connected = await db.$queryRawUnsafe<Array<{ name: string; file: string }>>("PRAGMA database_list");
  const main = connected.find(entry => entry.name === "main");
  if (!main || realpathSync(main.file) !== realpathSync(databasePath)) throw new Error("Substitute database connection refused.");
  await db.$queryRawUnsafe("PRAGMA busy_timeout = 0");
  await db.$queryRawUnsafe("PRAGMA locking_mode = EXCLUSIVE");
  await db.$executeRawUnsafe("BEGIN EXCLUSIVE");
  await db.$executeRawUnsafe("COMMIT");
  // EXCLUSIVE locking mode retains the lock across backup and application.
  const current = await checkSchema(db);
  if (current && !apply) return { status: "current" as const };
  const columns = await tableColumns(db);
  const before = await fingerprint(db, columns);
  if (!apply) return { status: "dry-run" as const, before };
  const runId = (input.now ?? new Date()).toISOString().replace(/[-:.]/g, "") + "-" + sourceCommit.slice(0, 12);
  const base = path.resolve(archiveBasePath);
  if (!base.startsWith(path.resolve(process.cwd(), "artifacts") + path.sep)) throw new Error("Backup must remain in this worktree artifacts directory.");
  const archivePath = path.join(base, runId);
  assertRealPath(base);
  if (existsSync(archivePath)) throw new Error("Archive destination already exists.");
  mkdirSync(base, { recursive: true });
  assertRealPath(base);
  mkdirSync(archivePath);
  const backupPath = path.join(archivePath, "pre-upgrade.db");
  await db.$executeRawUnsafe("VACUUM INTO '" + backupPath.replaceAll("\\", "/").replaceAll("'", "''") + "'");
  const backupHash = hash(readFileSync(backupPath));
  const backup = new PrismaClient({ datasourceUrl: standardsUpgradeDatabaseUrl(backupPath) });
  try {
    const integrity = await backup.$queryRawUnsafe<Array<{ integrity_check: string }>>("PRAGMA integrity_check");
    if (integrity.length !== 1 || integrity[0].integrity_check !== "ok" ||
        json(await fingerprint(backup, columns)) !== json(before)) throw new Error("Backup verification failed.");
  } finally { await backup.$disconnect(); }
  if (hash(readFileSync(backupPath)) !== backupHash) throw new Error("Backup bytes changed during verification.");
  const manifest = { version: 1, runId, sourceCommit, sourceDatabase: realpathSync(databasePath), backupHash, columns, before,
    schema: await db.$queryRawUnsafe("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name") };
  writeFileSync(path.join(archivePath, "manifest.pre-apply.json"), json(manifest), { flag: "wx" });
  await db.$executeRawUnsafe("BEGIN EXCLUSIVE");
  try {
    if (json(await fingerprint(db, columns)) !== json(before)) throw new Error("Source data drift.");
    await ensureStandardsStorage(db);
    if (!(await checkSchema(db))) throw new Error("Incomplete upgraded schema.");
    if (json(await fingerprint(db, columns)) !== json(before)) throw new Error("Unrelated database content changed.");
    await db.$executeRawUnsafe("COMMIT");
  } catch (error) {
    await db.$executeRawUnsafe("ROLLBACK");
    writeFileSync(path.join(archivePath, "manifest.failed.json"), json({ ...manifest, state: "rolled-back" }), { flag: "wx" });
    throw error;
  }
  writeFileSync(path.join(archivePath, "manifest.json"), json({ ...manifest, state: "upgraded-and-verified",
    after: await fingerprint(db, columns) }), { flag: "wx" });
  return { status: "upgraded" as const, archivePath, backupHash };
}

