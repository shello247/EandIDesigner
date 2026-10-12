import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { validateSymbol } from "../src/features/symbol_registry/logic/use_cases/validate-symbol";
import {
  findCanonicalMainWorktree,
  parseGitWorktreeList,
  toPrismaSqliteFileUrl
} from "./development-runtime";

const TABLE_NAME = "SymbolVersion";
const RETIRED_PROPERTY = "requiredForWiring";
const ARCHIVE_DIRECTORY_NAME = "symbol-required-for-wiring-retirement";

type SqlExecutor = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};

type SymbolVersionRow = {
  id: string;
  symbolId: string;
  symbolKey: string;
  displayName: string;
  versionNumber: bigint | number;
  status: string;
  svg: string;
  metadataJson: string;
  createdAt: Date | string;
};

type TableFingerprint = { count: number; sha256: string };

type VersionTransformation = {
  row: SymbolVersionRow;
  changedTerminalCount: number;
  transformedMetadataJson: string;
  beforeSha256: string;
  afterSha256: string;
};

export type RequiredForWiringRetirementResult = {
  status: "current" | "dry-run" | "retired";
  versionCount: number;
  terminalCount: number;
  archivePath?: string;
};

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteSqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function normalizeForJson(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map(normalizeForJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, child]) => [key, normalizeForJson(child)])
    );
  }
  return value;
}

function serialize(value: unknown): string {
  return JSON.stringify(normalizeForJson(value), null, 2);
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseMetadata(metadataJson: string, versionId: string): unknown {
  try {
    return JSON.parse(metadataJson);
  } catch {
    throw new Error(`Symbol version ${versionId} has invalid metadata JSON.`);
  }
}

function removeRetiredProperties(
  value: unknown,
  versionId: string,
  pathSegments: Array<string | number> = []
): number {
  if (Array.isArray(value)) {
    return value.reduce(
      (count, child, index) =>
        count + removeRetiredProperties(child, versionId, [...pathSegments, index]),
      0
    );
  }
  if (!value || typeof value !== "object") return 0;

  const record = value as Record<string, unknown>;
  let count = 0;
  if (Object.hasOwn(record, RETIRED_PROPERTY)) {
    const isTerminalProperty =
      pathSegments.length === 2 &&
      pathSegments[0] === "terminals" &&
      typeof pathSegments[1] === "number";
    if (!isTerminalProperty || typeof record[RETIRED_PROPERTY] !== "boolean") {
      throw new Error(
        `Symbol version ${versionId} contains an invalid ${RETIRED_PROPERTY} property at ${pathSegments.join(".") || "metadata"}.`
      );
    }
    delete record[RETIRED_PROPERTY];
    count += 1;
  }

  for (const [key, child] of Object.entries(record)) {
    count += removeRetiredProperties(child, versionId, [...pathSegments, key]);
  }
  return count;
}

function assertNoRetiredProperty(value: unknown, versionId: string): void {
  if (Array.isArray(value)) {
    value.forEach((child) => assertNoRetiredProperty(child, versionId));
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (Object.hasOwn(record, RETIRED_PROPERTY)) {
    throw new Error(
      `Symbol version ${versionId} still contains ${RETIRED_PROPERTY}.`
    );
  }
  Object.values(record).forEach((child) =>
    assertNoRetiredProperty(child, versionId)
  );
}

function validateMetadataAndSvg(
  row: SymbolVersionRow,
  metadata: unknown,
  phase: "original" | "transformed"
): void {
  const validation = validateSymbol(row.svg, metadata);
  if (validation.blockingIssueCount > 0 || !validation.metadata) {
    const details = validation.issues
      .filter((issue) => issue.severity === "blocking")
      .map((issue) => `${issue.code}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Symbol version ${row.id} has invalid ${phase} metadata or SVG${details ? `: ${details}` : "."}`
    );
  }
}

function buildTransformation(row: SymbolVersionRow): VersionTransformation | undefined {
  const original = parseMetadata(row.metadataJson, row.id);
  const transformed = structuredClone(original);
  const changedTerminalCount = removeRetiredProperties(transformed, row.id);
  if (changedTerminalCount === 0) return undefined;
  validateMetadataAndSvg(row, original, "original");
  assertNoRetiredProperty(transformed, row.id);
  validateMetadataAndSvg(row, transformed, "transformed");
  const transformedMetadataJson = `${JSON.stringify(transformed, null, 2)}\n`;
  return {
    row,
    changedTerminalCount,
    transformedMetadataJson,
    beforeSha256: sha256(row.metadataJson),
    afterSha256: sha256(transformedMetadataJson)
  };
}

async function assertExpectedSchema(prisma: SqlExecutor): Promise<void> {
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    TABLE_NAME
  );
  if (tables.length !== 1) {
    throw new Error(`${TABLE_NAME} is missing from the target database.`);
  }
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info(${quoteIdentifier(TABLE_NAME)})`
  );
  const names = new Set(columns.map((column) => column.name));
  for (const required of [
    "id",
    "symbolId",
    "versionNumber",
    "status",
    "svg",
    "metadataJson",
    "createdAt"
  ]) {
    if (!names.has(required)) {
      throw new Error(`Unexpected ${TABLE_NAME} schema: missing ${required}.`);
    }
  }
}

async function listSymbolVersions(prisma: SqlExecutor): Promise<SymbolVersionRow[]> {
  return prisma.$queryRawUnsafe<SymbolVersionRow[]>(`
    SELECT
      v."id",
      v."symbolId",
      s."symbolKey",
      s."displayName",
      v."versionNumber",
      v."status",
      v."svg",
      v."metadataJson",
      v."createdAt"
    FROM "SymbolVersion" v
    INNER JOIN "Symbol" s ON s."id" = v."symbolId"
    ORDER BY v."id"
  `);
}

async function listUserTables(prisma: SqlExecutor): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  return rows.map((row) => row.name);
}

async function fingerprintTable(
  prisma: SqlExecutor,
  tableName: string
): Promise<TableFingerprint> {
  const table = quoteIdentifier(tableName);
  const columns = await prisma.$queryRawUnsafe<
    Array<{ name: string; pk: bigint | number }>
  >(`PRAGMA table_info(${table})`);
  const primaryKeys = columns
    .filter((column) => Number(column.pk) > 0)
    .sort((first, second) => Number(first.pk) - Number(second.pk))
    .map((column) => quoteIdentifier(column.name));
  const orderBy = primaryKeys.length > 0 ? ` ORDER BY ${primaryKeys.join(", ")}` : "";
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM ${table}${orderBy}`
  );
  return { count: rows.length, sha256: sha256(serialize(rows)) };
}

async function fingerprintDatabase(
  prisma: SqlExecutor
): Promise<Record<string, TableFingerprint>> {
  const output: Record<string, TableFingerprint> = {};
  for (const tableName of await listUserTables(prisma)) {
    output[tableName] = await fingerprintTable(prisma, tableName);
  }
  return output;
}

async function symbolVersionInvariantFingerprint(
  prisma: SqlExecutor
): Promise<TableFingerprint> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT "id", "symbolId", "versionNumber", "status", "svg",
           "sourceInputSummary", "aiResponseId", "createdAt"
    FROM "SymbolVersion"
    ORDER BY "id"
  `);
  return { count: rows.length, sha256: sha256(serialize(rows)) };
}

function assertUnrelatedTablesUnchanged(
  before: Record<string, TableFingerprint>,
  after: Record<string, TableFingerprint>
): void {
  const beforeUnrelated = Object.fromEntries(
    Object.entries(before).filter(([tableName]) => tableName !== TABLE_NAME)
  );
  const afterUnrelated = Object.fromEntries(
    Object.entries(after).filter(([tableName]) => tableName !== TABLE_NAME)
  );
  if (serialize(beforeUnrelated) !== serialize(afterUnrelated)) {
    throw new Error("An unrelated SQLite table changed during metadata retirement.");
  }
}

async function acquireExclusiveAccess(prisma: SqlExecutor): Promise<void> {
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 0");
  await prisma.$queryRawUnsafe("PRAGMA locking_mode = EXCLUSIVE");
  await prisma.$executeRawUnsafe("BEGIN EXCLUSIVE");
  await prisma.$executeRawUnsafe("COMMIT");
}

export function parseRetirementArguments(argumentsList: readonly string[]) {
  const unsupportedArguments = argumentsList.filter(
    (argument) => argument !== "--apply"
  );
  if (unsupportedArguments.length > 0) {
    throw new Error(`Unsupported argument: ${unsupportedArguments.join(", ")}`);
  }
  return { apply: argumentsList.includes("--apply") };
}

export async function retireRequiredForWiringStorage({
  prisma,
  databasePath,
  archiveBasePath,
  sourceCommit,
  apply,
  now = new Date()
}: {
  prisma: PrismaClient;
  databasePath: string;
  archiveBasePath: string;
  sourceCommit: string;
  apply: boolean;
  now?: Date;
}): Promise<RequiredForWiringRetirementResult> {
  if (apply) await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 0");
  await assertExpectedSchema(prisma);
  const rows = await listSymbolVersions(prisma);
  const transformations = rows
    .map(buildTransformation)
    .filter((value): value is VersionTransformation => Boolean(value));
  const terminalCount = transformations.reduce(
    (total, item) => total + item.changedTerminalCount,
    0
  );

  if (transformations.length === 0) {
    rows.forEach((row) =>
      assertNoRetiredProperty(parseMetadata(row.metadataJson, row.id), row.id)
    );
    return { status: "current", versionCount: 0, terminalCount: 0 };
  }
  if (!apply) {
    return {
      status: "dry-run",
      versionCount: transformations.length,
      terminalCount
    };
  }

  await acquireExclusiveAccess(prisma);
  const runId = `${now.toISOString().replaceAll(/[-:.]/g, "")}-${sourceCommit.slice(0, 12)}`;
  const archivePath = path.resolve(archiveBasePath, runId);
  const resolvedBase = path.resolve(archiveBasePath);
  if (!archivePath.startsWith(resolvedBase + path.sep) || existsSync(archivePath)) {
    throw new Error(`Refusing unsafe or existing archive destination: ${archivePath}`);
  }
  mkdirSync(resolvedBase, { recursive: true });
  mkdirSync(archivePath);

  const beforeTables = await fingerprintDatabase(prisma);
  const beforeInvariant = await symbolVersionInvariantFingerprint(prisma);
  const exportText = `${serialize({
    records: transformations.map((item) => ({
      symbolId: item.row.symbolId,
      symbolKey: item.row.symbolKey,
      displayName: item.row.displayName,
      versionId: item.row.id,
      versionNumber: Number(item.row.versionNumber),
      status: item.row.status,
      createdAt: item.row.createdAt,
      changedTerminalCount: item.changedTerminalCount,
      metadataJson: item.row.metadataJson,
      metadataJsonSha256: item.beforeSha256,
      transformedMetadataJsonSha256: item.afterSha256,
      svgSha256: sha256(item.row.svg)
    }))
  })}\n`;
  const exportPath = path.join(archivePath, "affected-symbol-versions.json");
  const databaseBackupPath = path.join(archivePath, "pre-retirement-dev.db");
  writeFileSync(exportPath, exportText, { encoding: "utf8", flag: "wx" });
  await prisma.$executeRawUnsafe(
    `VACUUM INTO ${quoteSqlString(databaseBackupPath.replaceAll("\\", "/"))}`
  );

  const preliminaryManifest = {
    version: 1,
    operation: "retire-required-for-wiring-storage",
    state: "archive-complete",
    createdAt: now.toISOString(),
    sourceCommit,
    sourceDatabase: path.resolve(databasePath),
    affectedVersionCount: transformations.length,
    changedTerminalCount: terminalCount,
    affectedSymbolExportSha256: sha256(exportText),
    databaseBackupSha256: sha256(readFileSync(databaseBackupPath)),
    beforeTables,
    symbolVersionInvariantBefore: beforeInvariant
  };
  writeFileSync(
    path.join(archivePath, "manifest.pre-apply.json"),
    `${serialize(preliminaryManifest)}\n`,
    { encoding: "utf8", flag: "wx" }
  );

  let afterTables: Record<string, TableFingerprint>;
  let afterInvariant: TableFingerprint;
  await prisma.$executeRawUnsafe("BEGIN EXCLUSIVE");
  try {
    for (const item of transformations) {
      const changed = await prisma.$executeRawUnsafe(
        'UPDATE "SymbolVersion" SET "metadataJson" = ? WHERE "id" = ? AND "metadataJson" = ?',
        item.transformedMetadataJson,
        item.row.id,
        item.row.metadataJson
      );
      if (changed !== 1) {
        throw new Error(`Symbol version ${item.row.id} changed during retirement.`);
      }
    }

    const verifiedRows = await listSymbolVersions(prisma);
    verifiedRows.forEach((row) => {
      const metadata = parseMetadata(row.metadataJson, row.id);
      assertNoRetiredProperty(metadata, row.id);
      validateMetadataAndSvg(row, metadata, "transformed");
    });
    afterTables = await fingerprintDatabase(prisma);
    afterInvariant = await symbolVersionInvariantFingerprint(prisma);
    assertUnrelatedTablesUnchanged(beforeTables, afterTables);
    if (serialize(beforeInvariant) !== serialize(afterInvariant)) {
      throw new Error("SymbolVersion fields other than metadataJson changed.");
    }
    await prisma.$executeRawUnsafe("COMMIT");
  } catch (error) {
    await prisma.$executeRawUnsafe("ROLLBACK").catch(() => undefined);
    throw error;
  }

  writeFileSync(
    path.join(archivePath, "manifest.json"),
    `${serialize({
      ...preliminaryManifest,
      state: "retired-and-verified",
      completedAt: new Date().toISOString(),
      afterTables,
      symbolVersionInvariantAfter: afterInvariant
    })}\n`,
    { encoding: "utf8", flag: "wx" }
  );
  return {
    status: "retired",
    versionCount: transformations.length,
    terminalCount,
    archivePath
  };
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const applicationRoot = path.resolve(scriptDirectory, "..");
  const packageJson = JSON.parse(
    readFileSync(path.join(applicationRoot, "package.json"), "utf8")
  ) as { name?: string };
  if (packageJson.name !== "ei-designer") {
    throw new Error(`Refusing to retire storage for ${applicationRoot}.`);
  }
  const { apply } = parseRetirementArguments(process.argv.slice(2));
  const worktreeOutput = execFileSync(
    "git",
    ["-C", applicationRoot, "worktree", "list", "--porcelain"],
    { encoding: "utf8" }
  );
  const canonicalWorktree = findCanonicalMainWorktree(
    parseGitWorktreeList(worktreeOutput)
  );
  const canonicalDatabasePath = path.join(
    canonicalWorktree.path,
    "prisma",
    "dev.db"
  );
  if (
    !existsSync(canonicalDatabasePath) ||
    !statSync(canonicalDatabasePath).isFile()
  ) {
    throw new Error(
      `Canonical database is unavailable at ${canonicalDatabasePath}. Refusing a substitute.`
    );
  }
  const sourceCommit = execFileSync(
    "git",
    ["-C", applicationRoot, "rev-parse", "HEAD"],
    { encoding: "utf8" }
  ).trim();
  const archiveBasePath = path.join(
    canonicalWorktree.path,
    "artifacts",
    ARCHIVE_DIRECTORY_NAME
  );
  const prisma = new PrismaClient({
    datasourceUrl: toPrismaSqliteFileUrl(canonicalDatabasePath)
  });

  try {
    console.log(`[required-for-wiring-retirement] Database: ${canonicalDatabasePath}`);
    const result = await retireRequiredForWiringStorage({
      prisma,
      databasePath: canonicalDatabasePath,
      archiveBasePath,
      sourceCommit,
      apply
    });
    if (result.status === "current") {
      console.log("[required-for-wiring-retirement] Stored metadata is already current.");
    } else if (result.status === "dry-run") {
      console.log(
        `[required-for-wiring-retirement] Validated ${result.versionCount} symbol version${result.versionCount === 1 ? "" : "s"} and ${result.terminalCount} terminal propert${result.terminalCount === 1 ? "y" : "ies"}. Dry run only; use --apply to archive and retire the metadata.`
      );
    } else {
      console.log(
        `[required-for-wiring-retirement] Archived and updated ${result.versionCount} symbol version${result.versionCount === 1 ? "" : "s"}; removed ${result.terminalCount} terminal propert${result.terminalCount === 1 ? "y" : "ies"}.`
      );
      console.log(`[required-for-wiring-retirement] Recovery archive: ${result.archivePath}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
