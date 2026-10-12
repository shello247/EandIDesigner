import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { ensureDeviceClassificationStorage } from "../src/features/device_classification/data/storage";
import { findCanonicalMainWorktree, parseGitWorktreeList, toPrismaSqliteFileUrl } from "./development-runtime";

const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
const json = (value: unknown) => JSON.stringify(value, (_key, entry) => typeof entry === "bigint" ? entry.toString() : entry);
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const classificationUpgradeUrl = (file: string) => toPrismaSqliteFileUrl(file) + "?connection_limit=1";
type Columns = Record<string, string[]>;

function assertRealPath(target: string) {
  let ancestor = path.resolve(target);
  while (!existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new Error("Unresolvable path.");
    ancestor = parent;
  }
  if (realpathSync(ancestor) !== ancestor) throw new Error("Redirected storage path refused.");
}
async function columns(db: PrismaClient): Promise<Columns> {
  const tables = await db.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const result: Columns = {};
  for (const table of tables) result[table.name] = (await db.$queryRawUnsafe<Array<{ name: string }>>("PRAGMA table_info(" + quote(table.name) + ")")).map(column => column.name);
  return result;
}
async function fingerprint(db: PrismaClient, fields: Columns) {
  const result: Record<string, { count: number; hash: string }> = {};
  for (const [table, names] of Object.entries(fields)) {
    const rows = await db.$queryRawUnsafe<unknown[]>("SELECT " + names.map(quote).join(",") + " FROM " + quote(table));
    result[table] = { count: rows.length, hash: hash(json(rows.map(json).sort())) };
  }
  return result;
}
async function check(db: PrismaClient) {
  const cols = await db.$queryRawUnsafe<Array<{ name: string; type: string; notnull: bigint }>>('PRAGMA table_info("SymbolVersion")');
  if (!["id", "symbolId", "versionNumber", "svg", "metadataJson"].every(name => cols.some(column => column.name === name))) throw new Error("Unexpected SymbolVersion schema.");
  const field = cols.find(column => column.name === "deviceType");
  if (field && (field.type.toUpperCase() !== "TEXT" || Number(field.notnull) !== 0)) throw new Error("Unexpected Device Type column.");
  const index = await db.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA index_info("SymbolVersion_deviceType_idx")');
  if (index.length && (index.length !== 1 || index[0].name !== "deviceType")) throw new Error("Unexpected Device Type index.");
  if ((await db.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check")).length) throw new Error("Foreign-key violations prevent migration.");
  return Boolean(field) && index.length === 1;
}

export async function upgradeDeviceClassificationStorage(input: {
  db: PrismaClient; databasePath: string; archiveBasePath: string; sourceCommit: string; apply: boolean;
}) {
  const { db } = input;
  if (!/^[a-f0-9]{40}$/.test(input.sourceCommit)) throw new Error("Invalid source commit.");
  assertRealPath(input.databasePath);
  const connected = await db.$queryRawUnsafe<Array<{ name: string; file: string }>>("PRAGMA database_list");
  const main = connected.find(entry => entry.name === "main");
  if (!main || realpathSync(main.file) !== realpathSync(input.databasePath)) throw new Error("Substitute database refused.");
  await db.$queryRawUnsafe("PRAGMA busy_timeout = 0");
  await db.$queryRawUnsafe("PRAGMA locking_mode = EXCLUSIVE");
  await db.$executeRawUnsafe("BEGIN EXCLUSIVE");
  await db.$executeRawUnsafe("COMMIT");
  if (await check(db)) return { status: "current" as const };
  const fields = await columns(db);
  const before = await fingerprint(db, fields);
  if (!input.apply) return { status: "dry-run" as const, before };
  assertRealPath(input.archiveBasePath);
  const archivePath = path.resolve(input.archiveBasePath, new Date().toISOString().replace(/[-:.]/g, "") + "-" + input.sourceCommit.slice(0, 12));
  if (existsSync(archivePath)) throw new Error("Backup destination already exists.");
  mkdirSync(archivePath, { recursive: true });
  assertRealPath(archivePath);
  const backupPath = path.join(archivePath, "pre-upgrade.db");
  await db.$executeRawUnsafe("VACUUM INTO '" + backupPath.replaceAll("\\", "/").replaceAll("'", "''") + "'");
  const backupHash = hash(readFileSync(backupPath));
  const restored = new PrismaClient({ datasourceUrl: classificationUpgradeUrl(backupPath) });
  try {
    const integrity = await restored.$queryRawUnsafe<Array<{ integrity_check: string }>>("PRAGMA integrity_check");
    if (integrity.length !== 1 || integrity[0].integrity_check !== "ok" || json(await fingerprint(restored, fields)) !== json(before)) throw new Error("Backup verification failed; storage not changed.");
  } finally { await restored.$disconnect(); }
  if (hash(readFileSync(backupPath)) !== backupHash) throw new Error("Backup bytes changed during verification.");
  const receipt = { sourceCommit: input.sourceCommit, databasePath: realpathSync(input.databasePath), backupPath, backupHash, fields, before };
  writeFileSync(path.join(archivePath, "pre-apply.json"), json(receipt), { flag: "wx" });
  await db.$executeRawUnsafe("BEGIN EXCLUSIVE");
  try {
    await ensureDeviceClassificationStorage(db);
    if (!(await check(db)) || json(await fingerprint(db, fields)) !== json(before)) throw new Error("Migration changed unrelated data.");
    await db.$executeRawUnsafe("COMMIT");
  } catch (error) {
    await db.$executeRawUnsafe("ROLLBACK");
    writeFileSync(path.join(archivePath, "failed.json"), json({ ...receipt, status: "rolled-back" }), { flag: "wx" });
    throw error;
  }
  writeFileSync(path.join(archivePath, "verified.json"), json({ ...receipt, status: "upgraded", after: await fingerprint(db, fields) }), { flag: "wx" });
  return { status: "upgraded" as const, archivePath, backupPath, backupHash };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => arg !== "--apply")) throw new Error("Only --apply is accepted; omission is a dry run.");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const workspace = path.resolve(root, "../../..");
  if (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).name !== "ei-designer" || !existsSync(path.join(workspace, ".ei-workspace-root"))) throw new Error("Wrong application/workspace.");
  const git = (...arguments_: string[]) => execFileSync("git", ["-c", "safe.directory=" + root, "-C", root, ...arguments_], { encoding: "utf8" });
  const canonical = findCanonicalMainWorktree(parseGitWorktreeList(git("worktree", "list", "--porcelain")));
  if (path.resolve(canonical.path) !== path.join(workspace, "Application Folders/Main Application/EI_Designer")) throw new Error("Canonical-main mismatch.");
  await new Promise<void>((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error("Stop the owned port-3000 application before maintenance.")));
    probe.listen(3000, "127.0.0.1", () => probe.close(error => error ? reject(error) : resolve()));
  });
  const databasePath = path.join(canonical.path, "prisma/dev.db");
  if (!existsSync(databasePath)) throw new Error("Canonical storage unavailable.");
  const db = new PrismaClient({ datasourceUrl: classificationUpgradeUrl(databasePath) });
  try { console.log(json(await upgradeDeviceClassificationStorage({ db, databasePath,
    archiveBasePath: path.join(root, "artifacts/device-classification-storage"), sourceCommit: git("rev-parse", "HEAD").trim(), apply: args.length === 1 }))); }
  finally { await db.$disconnect(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch(error => { console.error(error); process.exitCode = 1; });
}
