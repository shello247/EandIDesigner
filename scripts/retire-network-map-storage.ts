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
import { z } from "zod";
import {
  findCanonicalMainWorktree,
  parseGitWorktreeList,
  toPrismaSqliteFileUrl
} from "./development-runtime";

const TABLE_NAME = "NetworkMap";
const ARCHIVE_DIRECTORY_NAME = "networking-retirement";

// This is a retirement-only snapshot of the removed version-1 map contract.
// It intentionally remains beside the migration so old databases can still be
// validated and archived after the product feature has been removed.
const archivedNetworkMapNodeSchema = z.object({
  id: z.string().trim().min(1),
  symbolId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  tag: z.string().trim().min(1).max(120),
  label: z.string().trim().max(180).optional(),
  deviceType: z.enum([
    "switch",
    "router_firewall",
    "controller_plc",
    "hmi_workstation",
    "server",
    "wireless_radio",
    "field_device",
    "patch_point",
    "media_converter"
  ]),
  ipAddress: z.string().trim().max(80).optional(),
  vlanId: z.number().int().min(1).max(4094).optional(),
  zoneId: z.string().trim().min(1).optional(),
  x: z.number().finite(),
  y: z.number().finite(),
  rotation: z.number().finite(),
  scale: z.number().min(0.1).max(4)
});

const archivedNetworkMapEndpointSchema = z.object({
  nodeId: z.string().trim().min(1),
  portKey: z.string().trim().min(1)
});

const archivedNetworkMapModelSchema = z
  .object({
    version: z.literal(1),
    titleBlock: z.object({
      client: z.string().trim().max(160).optional(),
      project: z.string().trim().max(200).optional(),
      mapNumber: z.string().trim().max(120).optional(),
      revision: z.string().trim().max(40).optional(),
      preparedBy: z.string().trim().max(120).optional(),
      checkedBy: z.string().trim().max(120).optional(),
      date: z.string().trim().max(40).optional()
    }),
    sheets: z
      .array(
        z.object({
          id: z.string().trim().min(1),
          name: z.string().trim().min(1).max(120),
          description: z.string().trim().max(400).optional(),
          page: z.object({
            size: z.literal("A3_LANDSCAPE"),
            width: z.number().positive(),
            height: z.number().positive(),
            gridSize: z.number().positive()
          }),
          zones: z.array(
            z.object({
              id: z.string().trim().min(1),
              name: z.string().trim().min(1).max(120),
              x: z.number().finite(),
              y: z.number().finite(),
              width: z.number().positive(),
              height: z.number().positive(),
              color: z.string().trim().max(40).optional()
            })
          ),
          nodes: z.array(archivedNetworkMapNodeSchema),
          links: z.array(
            z.object({
              id: z.string().trim().min(1),
              from: archivedNetworkMapEndpointSchema,
              to: archivedNetworkMapEndpointSchema,
              label: z.string().trim().max(160).optional(),
              media: z.enum([
                "copper",
                "fiber",
                "wireless",
                "serial",
                "virtual",
                "other"
              ]),
              vlanId: z.number().int().min(1).max(4094).optional(),
              networkId: z.string().trim().max(120).optional(),
              protocol: z.string().trim().max(120).optional(),
              route: z
                .object({
                  mode: z.enum(["manual", "auto"]),
                  style: z.literal("orthogonal"),
                  points: z
                    .array(
                      z.object({
                        id: z.string().trim().min(1),
                        x: z.number().finite(),
                        y: z.number().finite(),
                        kind: z.enum(["endpoint", "elbow", "control"])
                      })
                    )
                    .min(2),
                  labelPosition: z
                    .object({ x: z.number().finite(), y: z.number().finite() })
                    .optional()
                })
                .optional()
            })
          ),
          annotations: z.array(
            z.object({
              id: z.string().trim().min(1),
              title: z.string().trim().max(120).optional(),
              text: z.string().trim().max(400),
              x: z.number().finite(),
              y: z.number().finite(),
              width: z.number().positive().optional(),
              height: z.number().positive().optional(),
              kind: z.enum(["note", "callout", "title"])
            })
          )
        })
      )
      .min(1)
  })
  .superRefine((model, context) => {
    const nodeIds = new Set<string>();
    const tags = new Set<string>();
    const ipAddresses = new Set<string>();

    model.sheets.forEach((sheet, sheetIndex) => {
      const sheetNodeIds = new Set(sheet.nodes.map((node) => node.id));
      const zoneIds = new Set(sheet.zones.map((zone) => zone.id));

      sheet.nodes.forEach((node, nodeIndex) => {
        const normalizedTag = node.tag.trim().toUpperCase();
        const normalizedIp = node.ipAddress?.trim().toLowerCase();
        if (nodeIds.has(node.id)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate network node ID ${node.id}.`,
            path: ["sheets", sheetIndex, "nodes", nodeIndex, "id"]
          });
        }
        nodeIds.add(node.id);
        if (tags.has(normalizedTag)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate network node tag ${node.tag}.`,
            path: ["sheets", sheetIndex, "nodes", nodeIndex, "tag"]
          });
        }
        tags.add(normalizedTag);
        if (node.zoneId && !zoneIds.has(node.zoneId)) {
          context.addIssue({
            code: "custom",
            message: `Network node ${node.tag} references a missing zone.`,
            path: ["sheets", sheetIndex, "nodes", nodeIndex, "zoneId"]
          });
        }
        if (normalizedIp) {
          if (ipAddresses.has(normalizedIp)) {
            context.addIssue({
              code: "custom",
              message: `Duplicate network node IP address ${node.ipAddress}.`,
              path: ["sheets", sheetIndex, "nodes", nodeIndex, "ipAddress"]
            });
          }
          ipAddresses.add(normalizedIp);
        }
      });

      sheet.links.forEach((link, linkIndex) => {
        for (const [endpointName, endpoint] of [
          ["from", link.from],
          ["to", link.to]
        ] as const) {
          if (!sheetNodeIds.has(endpoint.nodeId)) {
            context.addIssue({
              code: "custom",
              message: `Link ${endpointName} node is missing.`,
              path: [
                "sheets",
                sheetIndex,
                "links",
                linkIndex,
                endpointName,
                "nodeId"
              ]
            });
          }
        }
      });
    });
  });

type SqlExecutor = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};

type NetworkMapRow = {
  id: string;
  mapKey: string;
  title: string;
  status: string;
  modelJson: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type TableFingerprint = { count: number; sha256: string };

export type NetworkMapRetirementResult = {
  status: "absent" | "dry-run" | "retired";
  recordCount: number;
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

async function tableExists(prisma: SqlExecutor): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    TABLE_NAME
  );
  return rows.length === 1;
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

function assertUnaffectedTablesUnchanged(
  before: Record<string, TableFingerprint>,
  after: Record<string, TableFingerprint>
) {
  const expected = Object.fromEntries(
    Object.entries(before).filter(([tableName]) => tableName !== TABLE_NAME)
  );
  if (serialize(expected) !== serialize(after)) {
    throw new Error("An unaffected SQLite table changed during NetworkMap retirement.");
  }
}

async function acquireExclusiveAccess(prisma: SqlExecutor) {
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

export async function retireNetworkMapStorage({
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
}): Promise<NetworkMapRetirementResult> {
  if (apply) {
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 0");
  }
  if (!(await tableExists(prisma))) {
    return { status: "absent", recordCount: 0 };
  }

  const rows = await prisma.$queryRawUnsafe<NetworkMapRow[]>(
    `SELECT "id", "mapKey", "title", "status", "modelJson", "createdAt", "updatedAt" FROM "${TABLE_NAME}" ORDER BY "id"`
  );
  const archivedRows = rows.map((row) => {
    archivedNetworkMapModelSchema.parse(JSON.parse(row.modelJson));
    return { ...row, modelJsonSha256: sha256(row.modelJson) };
  });
  if (!apply) {
    return { status: "dry-run", recordCount: rows.length };
  }

  await acquireExclusiveAccess(prisma);

  const runId = `${now.toISOString().replaceAll(/[-:.]/g, "")}-${sourceCommit.slice(0, 12)}`;
  const archivePath = path.resolve(archiveBasePath, runId);
  const resolvedBase = path.resolve(archiveBasePath);
  if (
    !archivePath.startsWith(resolvedBase + path.sep) ||
    existsSync(archivePath)
  ) {
    throw new Error(`Refusing unsafe or existing archive destination: ${archivePath}`);
  }
  mkdirSync(resolvedBase, { recursive: true });
  mkdirSync(archivePath);

  const before = await fingerprintDatabase(prisma);
  const exportText = `${serialize({ records: archivedRows })}\n`;
  const exportPath = path.join(archivePath, "network-maps.json");
  const databaseBackupPath = path.join(archivePath, "pre-retirement-dev.db");
  writeFileSync(exportPath, exportText, { encoding: "utf8", flag: "wx" });
  await prisma.$executeRawUnsafe(
    `VACUUM INTO ${quoteSqlString(databaseBackupPath.replaceAll("\\", "/"))}`
  );

  const preliminaryManifest = {
    version: 1,
    operation: "retire-network-map-storage",
    state: "archive-complete",
    createdAt: now.toISOString(),
    sourceCommit,
    sourceDatabase: path.resolve(databasePath),
    recordCount: rows.length,
    networkMapExportSha256: sha256(exportText),
    databaseBackupSha256: sha256(readFileSync(databaseBackupPath)),
    beforeTables: before
  };
  writeFileSync(
    path.join(archivePath, "manifest.pre-drop.json"),
    `${serialize(preliminaryManifest)}\n`,
    { encoding: "utf8", flag: "wx" }
  );

  let after: Record<string, TableFingerprint>;
  await prisma.$executeRawUnsafe("BEGIN EXCLUSIVE");
  try {
    await prisma.$executeRawUnsafe(`DROP TABLE "${TABLE_NAME}"`);
    if (await tableExists(prisma)) {
      throw new Error(`${TABLE_NAME} still exists after retirement.`);
    }
    after = await fingerprintDatabase(prisma);
    assertUnaffectedTablesUnchanged(before, after);
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
      afterTables: after
    })}\n`,
    { encoding: "utf8", flag: "wx" }
  );
  return { status: "retired", recordCount: rows.length, archivePath };
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
    console.log(`[network-map-retirement] Database: ${canonicalDatabasePath}`);
    const result = await retireNetworkMapStorage({
      prisma,
      databasePath: canonicalDatabasePath,
      archiveBasePath,
      sourceCommit,
      apply
    });
    if (result.status === "absent") {
      console.log(`[network-map-retirement] ${TABLE_NAME} is already absent.`);
    } else if (result.status === "dry-run") {
      console.log(
        `[network-map-retirement] Validated ${result.recordCount} record${result.recordCount === 1 ? "" : "s"}. Dry run only; use --apply to archive and retire the table.`
      );
    } else {
      console.log(
        `[network-map-retirement] Archived ${result.recordCount} record${result.recordCount === 1 ? "" : "s"} and removed ${TABLE_NAME}.`
      );
      console.log(`[network-map-retirement] Recovery archive: ${result.archivePath}`);
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
