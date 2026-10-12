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
import {
  drawingPackageModelSchema,
  parseDrawingModelJson,
  stringifyDrawingModel,
  type DrawingModel
} from "../src/features/drawing_canvas/data/schema";
import type { ApprovedDrawingSymbol } from "../src/features/drawing_canvas/types";
import { buildDrawingPanelWiringSource } from "../src/features/drawing_canvas/logic/services/drawing-panel-wiring-source";
import { buildRenderableDrawingSymbols } from "../src/features/drawing_canvas/logic/services/drawing-generated-symbols";
import { collectDrawingSymbolVersionIds } from "../src/features/drawing_canvas/logic/services/drawing-symbol-version-references";
import { normalizeConnectionRoute } from "../src/features/drawing_canvas/logic/services/connection-route-geometry";
import {
  replaceSheetFromCanvasModel,
  toSheetCanvasModel
} from "../src/features/drawing_canvas/logic/commands/drawing-sheet-commands";
import {
  buildPackageConnectivityGraph,
  buildPackageTerminalOccupancyIndex,
  connectionEndpointSourceKey,
  resolveConnectionEndpointAvailability
} from "../src/features/drawing_panel_wiring/api/public";
import {
  parseMetadataJson,
  symbolTechnicalKindSchema
} from "../src/features/symbol_registry/api/public";
import {
  findCanonicalMainWorktree,
  parseGitWorktreeList,
  toPrismaMaintenanceSqliteFileUrl
} from "./development-runtime";

export const NORTH_DRAWING_ID = "cmrp7wbpx000buoqojvnguwqk";
const ARCHIVE_DIRECTORY_NAME = "north-terminal-side-repair";
const TERMINAL_NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13] as const;
const REPAIR_TARGETS = [
  { sheetId: "sheet_39", terminalTag: "TB-101", cableTag: "C-101" },
  { sheetId: "sheet_40", terminalTag: "TB-102", cableTag: "C-102" }
] as const;

type SqlExecutor = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};

type DrawingRow = {
  id: string;
  drawingKey: string;
  title: string;
  description: string | null;
  projectId: string | null;
  status: string;
  modelJson: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type SymbolRow = {
  id: string;
  symbolId: string;
  versionNumber: bigint | number;
  svg: string;
  metadataJson: string;
  symbolKey: string;
  displayName: string;
  manufacturer: string | null;
  model: string | null;
  category: string;
};

export type NorthTerminalSideRepairMapping = {
  sheetId: string;
  sheetNumber: number;
  connectionId: string;
  terminalTag: string;
  fromAnchor: string;
  toAnchor: string;
  wireId?: string;
};

export type NorthTerminalSideRepairPreview = {
  model: DrawingModel;
  mappings: NorthTerminalSideRepairMapping[];
  alreadyCurrent: boolean;
};

export type NorthTerminalSideRepairResult = {
  status: "current" | "dry-run" | "repaired";
  mappingCount: number;
  mappings: NorthTerminalSideRepairMapping[];
  archivePath?: string;
};

type TableFingerprint = { count: number; sha256: string };

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

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

function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function parseNorthTerminalSideRepairArguments(args: readonly string[]) {
  const unsupported = args.filter((argument) => argument !== "--apply");
  if (unsupported.length > 0) {
    throw new Error(`Unsupported argument: ${unsupported.join(", ")}`);
  }
  return { apply: args.includes("--apply") };
}

function symbolRowsToApproved(rows: SymbolRow[]): ApprovedDrawingSymbol[] {
  return rows.map((row) => ({
    symbolId: row.symbolId,
    symbolKey: row.symbolKey,
    displayName: row.displayName,
    manufacturer: row.manufacturer,
    model: row.model,
    category: symbolTechnicalKindSchema.parse(row.category),
    technicalKind: symbolTechnicalKindSchema.parse(row.category),
    versionId: row.id,
    versionNumber: Number(row.versionNumber),
    svg: row.svg,
    metadata: parseMetadataJson(row.metadataJson),
    selectable: false
  }));
}

function findTerminalPlacement(
  model: DrawingModel,
  sheetId: string,
  terminalTag: string
) {
  const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) throw new Error(`Expected North sheet ${sheetId} is missing.`);
  const matches = sheet.placements.filter(
    (placement) => placement.tag === terminalTag
  );
  if (matches.length !== 1) {
    throw new Error(
      `${sheetId} must contain exactly one ${terminalTag} occurrence; found ${matches.length}.`
    );
  }
  return { sheet, placement: matches[0] };
}

function connectionEndpointAt(
  connection: DrawingModel["sheets"][number]["connections"][number],
  placementId: string,
  anchorKey: string
): "from" | "to" | undefined {
  if (
    connection.from.placementId === placementId &&
    connection.from.anchorKey === anchorKey
  ) return "from";
  if (
    connection.to.placementId === placementId &&
    connection.to.anchorKey === anchorKey
  ) return "to";
  return undefined;
}

function isInstrumentPlacement(
  model: DrawingModel,
  sheetId: string,
  placementId: string
): boolean {
  const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
  const placement = sheet?.placements.find((candidate) => candidate.id === placementId);
  const asset = model.assets.find((candidate) => candidate.id === placement?.assetId);
  return asset?.type === "instrument";
}

function oppositePlacementId(
  connection: DrawingModel["sheets"][number]["connections"][number],
  endpointRole: "from" | "to"
): string {
  return connection[endpointRole === "from" ? "to" : "from"].placementId;
}

export function buildNorthTerminalSideRepair(
  inputModel: DrawingModel,
  symbols: readonly ApprovedDrawingSymbol[]
): NorthTerminalSideRepairPreview {
  const original = drawingPackageModelSchema.parse(inputModel);
  const graph = buildPackageConnectivityGraph(
    buildDrawingPanelWiringSource(original, [...symbols])
  );
  const occupancy = buildPackageTerminalOccupancyIndex(graph);
  const proposed: Array<{
    sheetId: string;
    connectionId: string;
    endpointRole: "from" | "to";
    placementId: string;
    fromAnchor: string;
    toAnchor: string;
    mapping: NorthTerminalSideRepairMapping;
  }> = [];
  let alreadyCurrentCount = 0;

  for (const target of REPAIR_TARGETS) {
    const { sheet, placement } = findTerminalPlacement(
      original,
      target.sheetId,
      target.terminalTag
    );
    for (const terminalNumber of TERMINAL_NUMBERS) {
      const token = `M${String(terminalNumber).padStart(2, "0")}`;
      const externalAnchor = `${token}.2`;
      const internalAnchor = `${token}.1`;
      const externalConnections = sheet.connections.flatMap((connection) => {
        const endpointRole = connectionEndpointAt(
          connection,
          placement.id,
          externalAnchor
        );
        return endpointRole &&
          isInstrumentPlacement(
            original,
            sheet.id,
            oppositePlacementId(connection, endpointRole)
          )
          ? [{ connection, endpointRole }]
          : [];
      });
      const internalConnections = sheet.connections.flatMap((connection) => {
        const endpointRole = connectionEndpointAt(
          connection,
          placement.id,
          internalAnchor
        );
        return endpointRole &&
          isInstrumentPlacement(
            original,
            sheet.id,
            oppositePlacementId(connection, endpointRole)
          )
          ? [{ connection, endpointRole }]
          : [];
      });

      if (externalConnections.length === 0 && internalConnections.length === 1) {
        alreadyCurrentCount += 1;
        continue;
      }
      if (externalConnections.length !== 1 || internalConnections.length !== 0) {
        throw new Error(
          `${target.terminalTag} ${token} has an unexpected instrument landing state (${externalConnections.length} on .2, ${internalConnections.length} on .1).`
        );
      }

      const { connection, endpointRole } = externalConnections[0];
      const sourceKey = connectionEndpointSourceKey({
        sheetId: sheet.id,
        connectionId: connection.id,
        endpointRole,
        placementId: placement.id,
        anchorKey: externalAnchor
      });
      const externalState = resolveConnectionEndpointAvailability({
        index: occupancy,
        sheetId: sheet.id,
        placementId: placement.id,
        anchorKey: externalAnchor,
        excludeSourceKey: sourceKey
      });
      const counterpart = externalState.occupants.find(
        (occupant) => occupant.cableTag === target.cableTag
      );
      if (!counterpart || externalState.occupants.length !== 1) {
        throw new Error(
          `${target.terminalTag} ${externalAnchor} must retain exactly one ${target.cableTag} counterpart.`
        );
      }
      const internalState = resolveConnectionEndpointAvailability({
        index: occupancy,
        sheetId: sheet.id,
        placementId: placement.id,
        anchorKey: internalAnchor
      });
      if (internalState.status !== "available") {
        throw new Error(
          `${target.terminalTag} ${internalAnchor} is not free (${internalState.status}).`
        );
      }
      proposed.push({
        sheetId: sheet.id,
        connectionId: connection.id,
        endpointRole,
        placementId: placement.id,
        fromAnchor: externalAnchor,
        toAnchor: internalAnchor,
        mapping: {
          sheetId: sheet.id,
          sheetNumber: original.sheets.findIndex((item) => item.id === sheet.id) + 1,
          connectionId: connection.id,
          terminalTag: target.terminalTag,
          fromAnchor: externalAnchor,
          toAnchor: internalAnchor,
          wireId: connection.wireId
        }
      });
    }
  }

  const expectedCount = REPAIR_TARGETS.length * TERMINAL_NUMBERS.length;
  if (proposed.length === 0 && alreadyCurrentCount === expectedCount) {
    return { model: original, mappings: [], alreadyCurrent: true };
  }
  if (proposed.length !== expectedCount || alreadyCurrentCount !== 0) {
    throw new Error(
      `North terminal repair is partial: ${proposed.length} proposed and ${alreadyCurrentCount} already moved; expected ${expectedCount} in one state.`
    );
  }

  let nextModel = structuredClone(original);
  for (const item of proposed) {
    const canvas = toSheetCanvasModel(nextModel, item.sheetId);
    const connection = canvas.connections.find(
      (candidate) => candidate.id === item.connectionId
    );
    if (!connection) throw new Error(`Connection ${item.connectionId} disappeared.`);
    const updatedConnection = {
      ...connection,
      [item.endpointRole]: {
        placementId: item.placementId,
        anchorKey: item.toAnchor
      }
    };
    const updatedCanvas = {
      ...canvas,
      connections: canvas.connections.map((candidate) =>
        candidate.id === item.connectionId ? updatedConnection : candidate
      )
    };
    const renderableSymbols = buildRenderableDrawingSymbols({
      placements: updatedCanvas.placements,
      approvedSymbols: [...symbols],
      assets: nextModel.assets
    });
    const route = normalizeConnectionRoute({
      model: updatedCanvas,
      symbols: renderableSymbols,
      connection: updatedConnection
    });
    nextModel = replaceSheetFromCanvasModel(nextModel, item.sheetId, {
      ...updatedCanvas,
      connections: updatedCanvas.connections.map((candidate) =>
        candidate.id === item.connectionId && route
          ? { ...candidate, route }
          : candidate
      )
    });
  }

  const verifiedModel = drawingPackageModelSchema.parse(nextModel);
  const verifiedOccupancy = buildPackageTerminalOccupancyIndex(
    buildPackageConnectivityGraph(
      buildDrawingPanelWiringSource(verifiedModel, [...symbols])
    )
  );
  for (const item of proposed) {
    const newState = resolveConnectionEndpointAvailability({
      index: verifiedOccupancy,
      sheetId: item.sheetId,
      placementId: item.placementId,
      anchorKey: item.toAnchor
    });
    if (newState.status !== "occupied" || newState.occupants.length !== 1) {
      throw new Error(
        `${item.mapping.terminalTag} ${item.toAnchor} did not resolve to one repaired conductor.`
      );
    }
  }
  return {
    model: verifiedModel,
    mappings: proposed.map((item) => item.mapping),
    alreadyCurrent: false
  };
}

async function assertExpectedSchema(prisma: SqlExecutor): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Drawing'"
  );
  if (rows.length !== 1) throw new Error("Drawing table is missing.");
  const columns = new Set(
    (
      await prisma.$queryRawUnsafe<Array<{ name: string }>>(
        'PRAGMA table_info("Drawing")'
      )
    ).map((column) => column.name)
  );
  for (const required of [
    "id",
    "drawingKey",
    "title",
    "description",
    "projectId",
    "status",
    "modelJson",
    "createdAt",
    "updatedAt"
  ]) {
    if (!columns.has(required)) {
      throw new Error(`Unexpected Drawing schema: missing ${required}.`);
    }
  }
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
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string; pk: number }>>(
    `PRAGMA table_info(${table})`
  );
  const order = columns
    .filter((column) => Number(column.pk) > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk))
    .map((column) => quoteIdentifier(column.name));
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM ${table}${order.length ? ` ORDER BY ${order.join(", ")}` : ""}`
  );
  return { count: rows.length, sha256: sha256(serialize(rows)) };
}

async function fingerprintDatabase(
  prisma: SqlExecutor
): Promise<Record<string, TableFingerprint>> {
  const output: Record<string, TableFingerprint> = {};
  for (const table of await listUserTables(prisma)) {
    output[table] = await fingerprintTable(prisma, table);
  }
  return output;
}

async function drawingInvariant(prisma: SqlExecutor): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT "id", "drawingKey", "title", "description", "projectId", "status", "createdAt",
           CASE WHEN "id" = '${NORTH_DRAWING_ID}' THEN NULL ELSE "modelJson" END AS "modelJson",
           CASE WHEN "id" = '${NORTH_DRAWING_ID}' THEN NULL ELSE "updatedAt" END AS "updatedAt"
    FROM "Drawing" ORDER BY "id"
  `);
  return sha256(serialize(rows));
}

async function loadDrawing(prisma: SqlExecutor): Promise<DrawingRow> {
  const rows = await prisma.$queryRawUnsafe<DrawingRow[]>(
    'SELECT "id", "drawingKey", "title", "description", "projectId", "status", "modelJson", "createdAt", "updatedAt" FROM "Drawing" WHERE "id" = ?',
    NORTH_DRAWING_ID
  );
  if (rows.length !== 1) {
    throw new Error(`North Oropouche drawing ${NORTH_DRAWING_ID} was not found.`);
  }
  return rows[0];
}

async function loadSymbols(
  prisma: SqlExecutor,
  model: DrawingModel
): Promise<ApprovedDrawingSymbol[]> {
  const versionIds = collectDrawingSymbolVersionIds(model);
  if (versionIds.length === 0) return [];
  const placeholders = versionIds.map(() => "?").join(", ");
  const rows = await prisma.$queryRawUnsafe<SymbolRow[]>(
    `SELECT v."id", v."symbolId", v."versionNumber", v."svg", v."metadataJson",
            s."symbolKey", s."displayName", s."manufacturer", s."model", s."category"
     FROM "SymbolVersion" v INNER JOIN "Symbol" s ON s."id" = v."symbolId"
     WHERE v."id" IN (${placeholders})`,
    ...versionIds
  );
  if (rows.length !== versionIds.length) {
    const found = new Set(rows.map((row) => row.id));
    throw new Error(
      `Missing pinned symbol versions: ${versionIds.filter((id) => !found.has(id)).join(", ")}.`
    );
  }
  return symbolRowsToApproved(rows);
}

async function acquireExclusiveAccess(prisma: SqlExecutor): Promise<void> {
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 0");
  await prisma.$queryRawUnsafe("PRAGMA locking_mode = EXCLUSIVE");
  await prisma.$executeRawUnsafe("BEGIN EXCLUSIVE");
  await prisma.$executeRawUnsafe("COMMIT");
}

export async function repairNorthTerminalSides({
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
}): Promise<NorthTerminalSideRepairResult> {
  if (apply) await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 0");
  await assertExpectedSchema(prisma);
  const row = await loadDrawing(prisma);
  const originalModel = parseDrawingModelJson(row.modelJson);
  const symbols = await loadSymbols(prisma, originalModel);
  const preview = buildNorthTerminalSideRepair(originalModel, symbols);
  if (preview.alreadyCurrent) {
    return { status: "current", mappingCount: 0, mappings: [] };
  }
  if (!apply) {
    return {
      status: "dry-run",
      mappingCount: preview.mappings.length,
      mappings: preview.mappings
    };
  }

  await acquireExclusiveAccess(prisma);
  const runId = `${now.toISOString().replaceAll(/[-:.]/g, "")}-${sourceCommit.slice(0, 12)}`;
  const resolvedBase = path.resolve(archiveBasePath);
  const archivePath = path.resolve(resolvedBase, runId);
  if (!archivePath.startsWith(`${resolvedBase}${path.sep}`) || existsSync(archivePath)) {
    throw new Error(`Refusing unsafe or existing archive destination: ${archivePath}`);
  }
  mkdirSync(resolvedBase, { recursive: true });
  mkdirSync(archivePath);

  const beforeTables = await fingerprintDatabase(prisma);
  const beforeInvariant = await drawingInvariant(prisma);
  const exportText = `${serialize({
    drawing: {
      ...row,
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt),
      modelJsonSha256: sha256(row.modelJson)
    },
    mappings: preview.mappings
  })}\n`;
  const exportPath = path.join(archivePath, "original-drawing.json");
  const backupPath = path.join(archivePath, "pre-repair-dev.db");
  writeFileSync(exportPath, exportText, { encoding: "utf8", flag: "wx" });
  await prisma.$executeRawUnsafe(
    `VACUUM INTO ${quoteSqlString(backupPath.replaceAll("\\", "/"))}`
  );
  const nextModelJson = stringifyDrawingModel(preview.model);
  const preliminaryManifest = {
    version: 1,
    operation: "repair-north-terminal-sides",
    state: "archive-complete",
    createdAt: now.toISOString(),
    sourceCommit,
    sourceDatabase: path.resolve(databasePath),
    drawingId: row.id,
    sourceRevision: isoDate(row.updatedAt),
    mappingCount: preview.mappings.length,
    mappings: preview.mappings,
    beforeModelJsonSha256: sha256(row.modelJson),
    proposedModelJsonSha256: sha256(nextModelJson),
    originalDrawingExportSha256: sha256(exportText),
    databaseBackupSha256: sha256(readFileSync(backupPath)),
    beforeTables,
    drawingInvariantBefore: beforeInvariant
  };
  writeFileSync(
    path.join(archivePath, "manifest.pre-apply.json"),
    `${serialize(preliminaryManifest)}\n`,
    { encoding: "utf8", flag: "wx" }
  );

  const nextUpdatedAt = now;
  let afterTables: Record<string, TableFingerprint>;
  await prisma.$executeRawUnsafe("BEGIN EXCLUSIVE");
  try {
    const changed = await prisma.$executeRawUnsafe(
      'UPDATE "Drawing" SET "modelJson" = ?, "updatedAt" = ? WHERE "id" = ? AND "modelJson" = ? AND "updatedAt" = ?',
      nextModelJson,
      nextUpdatedAt,
      row.id,
      row.modelJson,
      row.updatedAt
    );
    if (changed !== 1) {
      throw new Error("North Oropouche drawing changed during repair.");
    }
    const verifiedRow = await loadDrawing(prisma);
    if (verifiedRow.modelJson !== nextModelJson) {
      throw new Error("Stored repaired model does not match the verified candidate.");
    }
    const verifiedSymbols = await loadSymbols(
      prisma,
      parseDrawingModelJson(verifiedRow.modelJson)
    );
    const verified = buildNorthTerminalSideRepair(
      parseDrawingModelJson(verifiedRow.modelJson),
      verifiedSymbols
    );
    if (!verified.alreadyCurrent) {
      throw new Error("Stored drawing did not reach the expected repaired state.");
    }
    afterTables = await fingerprintDatabase(prisma);
    const beforeUnrelated = Object.fromEntries(
      Object.entries(beforeTables).filter(([name]) => name !== "Drawing")
    );
    const afterUnrelated = Object.fromEntries(
      Object.entries(afterTables).filter(([name]) => name !== "Drawing")
    );
    if (serialize(beforeUnrelated) !== serialize(afterUnrelated)) {
      throw new Error("An unrelated SQLite table changed during repair.");
    }
    if ((await drawingInvariant(prisma)) !== beforeInvariant) {
      throw new Error("Drawing data outside the target model and revision changed.");
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
      state: "repaired-and-verified",
      completedAt: new Date().toISOString(),
      storedUpdatedAt: nextUpdatedAt.toISOString(),
      afterTables,
      afterModelJsonSha256: sha256(nextModelJson),
      drawingInvariantAfter: await drawingInvariant(prisma)
    })}\n`,
    { encoding: "utf8", flag: "wx" }
  );
  return {
    status: "repaired",
    mappingCount: preview.mappings.length,
    mappings: preview.mappings,
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
    throw new Error(`Refusing to repair storage for ${applicationRoot}.`);
  }
  const { apply } = parseNorthTerminalSideRepairArguments(process.argv.slice(2));
  const worktreeOutput = execFileSync(
    "git",
    ["-C", applicationRoot, "worktree", "list", "--porcelain"],
    { encoding: "utf8" }
  );
  const canonicalWorktree = findCanonicalMainWorktree(
    parseGitWorktreeList(worktreeOutput)
  );
  const canonicalDatabasePath = path.join(canonicalWorktree.path, "prisma", "dev.db");
  if (!existsSync(canonicalDatabasePath) || !statSync(canonicalDatabasePath).isFile()) {
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
    applicationRoot,
    "artifacts",
    ARCHIVE_DIRECTORY_NAME
  );
  const prisma = new PrismaClient({
    datasourceUrl: toPrismaMaintenanceSqliteFileUrl(canonicalDatabasePath)
  });

  try {
    console.log(`[north-terminal-repair] Database: ${canonicalDatabasePath}`);
    const result = await repairNorthTerminalSides({
      prisma,
      databasePath: canonicalDatabasePath,
      archiveBasePath,
      sourceCommit,
      apply
    });
    for (const mapping of result.mappings) {
      console.log(
        `[north-terminal-repair] ${mapping.sheetId} ${mapping.connectionId}: ${mapping.terminalTag} ${mapping.fromAnchor} -> ${mapping.toAnchor}`
      );
    }
    if (result.status === "current") {
      console.log("[north-terminal-repair] North terminal sides are already current.");
    } else if (result.status === "dry-run") {
      console.log(
        `[north-terminal-repair] Validated ${result.mappingCount} mappings. Dry run only; stop port 3000 and use --apply after review.`
      );
    } else {
      console.log(`[north-terminal-repair] Applied and verified ${result.mappingCount} mappings.`);
      console.log(`[north-terminal-repair] Recovery archive: ${result.archivePath}`);
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
