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
import { normalizeDrawingClientName } from "../src/features/drawing_clients/api/public";
import {
  DRAWING_PROJECT_NUMBER_SCOPE,
  parseDrawingProjectNumberSequence
} from "../src/features/drawing_projects/api/public";
import {
  findCanonicalMainWorktree,
  parseGitWorktreeList,
  toPrismaSqliteFileUrl
} from "./development-runtime";

const ARCHIVE_DIRECTORY_NAME = "drawing-project-storage";

type SchemaState = {
  clientTable: boolean;
  projectNumberSequenceTable: boolean;
  projectTable: boolean;
  projectClientId: boolean;
  projectClientForeignKey: boolean;
  drawingDescription: boolean;
  drawingProjectId: boolean;
  drawingProjectForeignKey: boolean;
};

type DataState = {
  unlinkedLegacyClientCount: number;
  highestProjectNumberSequence: number;
  storedProjectNumberSequence: number | null;
};

type DrawingFingerprint = {
  id: string;
  drawingKey: string;
  modelJsonSha256: string;
};

type ProjectFingerprint = {
  id: string;
  preservedFieldsSha256: string;
};

export type DrawingProjectStorageUpgradeResult = {
  status: "current" | "dry-run" | "upgraded";
  drawingCount: number;
  archivePath?: string;
};

export function parseDrawingProjectUpgradeArguments(args: string[]): {
  apply: boolean;
} {
  const unsupported = args.filter((argument) => argument !== "--apply");
  if (unsupported.length > 0) {
    throw new Error(`Unsupported argument: ${unsupported.join(", ")}`);
  }
  return { apply: args.includes("--apply") };
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function quoteSqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function legacyClientId(normalizedName: string): string {
  return `client_${sha256(normalizedName).slice(0, 24)}`;
}

async function tableExists(prisma: PrismaClient, tableName: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    tableName
  );
  return rows.length === 1;
}

async function tableColumns(prisma: PrismaClient, tableName: string) {
  return prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("${tableName.replaceAll('"', '""')}")`
  );
}

async function foreignKeyExists(
  prisma: PrismaClient,
  tableName: string,
  from: string,
  targetTable: string,
  onDelete: string
) {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ from: string; table: string; to: string; on_delete: string }>
  >(`PRAGMA foreign_key_list("${tableName.replaceAll('"', '""')}")`);
  return rows.some(
    (foreignKey) =>
      foreignKey.from === from &&
      foreignKey.table === targetTable &&
      foreignKey.to === "id" &&
      foreignKey.on_delete.toUpperCase() === onDelete
  );
}

async function schemaState(prisma: PrismaClient): Promise<SchemaState> {
  if (!(await tableExists(prisma, "Drawing"))) {
    throw new Error('Required table "Drawing" is missing.');
  }
  const drawingColumns = await tableColumns(prisma, "Drawing");
  const drawingNames = new Set(drawingColumns.map((column) => column.name));
  for (const required of ["id", "drawingKey", "title", "modelJson"]) {
    if (!drawingNames.has(required)) {
      throw new Error(`Drawing schema is invalid: missing ${required}.`);
    }
  }

  const projectTable = await tableExists(prisma, "Project");
  const projectNames = projectTable
    ? new Set((await tableColumns(prisma, "Project")).map((column) => column.name))
    : new Set<string>();

  return {
    clientTable: await tableExists(prisma, "Client"),
    projectNumberSequenceTable: await tableExists(
      prisma,
      "ProjectNumberSequence"
    ),
    projectTable,
    projectClientId: projectNames.has("clientId"),
    projectClientForeignKey:
      projectTable && projectNames.has("clientId")
        ? await foreignKeyExists(
            prisma,
            "Project",
            "clientId",
            "Client",
            "SET NULL"
          )
        : false,
    drawingDescription: drawingNames.has("description"),
    drawingProjectId: drawingNames.has("projectId"),
    drawingProjectForeignKey: drawingNames.has("projectId")
      ? await foreignKeyExists(
          prisma,
          "Drawing",
          "projectId",
          "Project",
          "SET NULL"
        )
      : false
  };
}

function isSchemaCurrent(state: SchemaState) {
  return (
    state.clientTable &&
    state.projectNumberSequenceTable &&
    state.projectTable &&
    state.projectClientId &&
    state.projectClientForeignKey &&
    state.drawingDescription &&
    state.drawingProjectId &&
    state.drawingProjectForeignKey
  );
}

async function validateProjectTable(
  prisma: PrismaClient,
  exists: boolean,
  requireClientId: boolean
) {
  if (!exists) return;
  const columns = new Set(
    (await tableColumns(prisma, "Project")).map((column) => column.name)
  );
  const requiredColumns = [
    "id",
    "name",
    "projectNumber",
    "normalizedProjectNumber",
    "client",
    "description",
    "status",
    "createdAt",
    "updatedAt"
  ];
  if (requireClientId) requiredColumns.push("clientId");
  for (const required of requiredColumns) {
    if (!columns.has(required)) {
      throw new Error(`Project schema is invalid: missing ${required}.`);
    }
  }
}

async function validateClientTable(prisma: PrismaClient, exists: boolean) {
  if (!exists) return;
  const columns = new Set(
    (await tableColumns(prisma, "Client")).map((column) => column.name)
  );
  for (const required of [
    "id",
    "name",
    "normalizedName",
    "createdAt",
    "updatedAt"
  ]) {
    if (!columns.has(required)) {
      throw new Error(`Client schema is invalid: missing ${required}.`);
    }
  }
}

async function validateProjectNumberSequenceTable(
  prisma: PrismaClient,
  exists: boolean
) {
  if (!exists) return;
  const columns = new Set(
    (await tableColumns(prisma, "ProjectNumberSequence")).map(
      (column) => column.name
    )
  );
  for (const required of ["scope", "lastValue", "updatedAt"]) {
    if (!columns.has(required)) {
      throw new Error(
        `ProjectNumberSequence schema is invalid: missing ${required}.`
      );
    }
  }
}

async function drawingFingerprints(
  prisma: PrismaClient
): Promise<DrawingFingerprint[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; drawingKey: string; modelJson: string }>
  >('SELECT "id", "drawingKey", "modelJson" FROM "Drawing" ORDER BY "id"');
  return rows.map((row) => ({
    id: row.id,
    drawingKey: row.drawingKey,
    modelJsonSha256: sha256(row.modelJson)
  }));
}

async function projectFingerprints(
  prisma: PrismaClient,
  projectTable: boolean
): Promise<ProjectFingerprint[]> {
  if (!projectTable) return [];
  const rows = await prisma.$queryRawUnsafe<
    Array<Record<string, string | null>>
  >(`
    SELECT "id", "name", "projectNumber", "normalizedProjectNumber",
           "client", "description", "status", "createdAt", "updatedAt"
    FROM "Project" ORDER BY "id"
  `);
  return rows.map((row) => ({
    id: row.id ?? "",
    preservedFieldsSha256: sha256(JSON.stringify(row))
  }));
}

async function highestProjectNumberSequence(prisma: PrismaClient) {
  if (!(await tableExists(prisma, "Project"))) return 0;
  const rows = await prisma.$queryRawUnsafe<
    Array<{ projectNumber: string | null }>
  >('SELECT "projectNumber" FROM "Project" WHERE "projectNumber" IS NOT NULL');
  return rows.reduce((highest, row) => {
    const sequence = parseDrawingProjectNumberSequence(row.projectNumber);
    return sequence === null ? highest : Math.max(highest, sequence);
  }, 0);
}

async function dataState(
  prisma: PrismaClient,
  state: SchemaState
): Promise<DataState> {
  const highestSequence = await highestProjectNumberSequence(prisma);
  const unlinkedLegacyClientCount =
    state.projectTable && state.projectClientId
      ? Number(
          (
            await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
              SELECT COUNT(*) AS "count" FROM "Project"
              WHERE "client" IS NOT NULL AND TRIM("client") <> ''
                AND "clientId" IS NULL
            `)
          )[0]?.count ?? 0
        )
      : state.projectTable
        ? Number(
            (
              await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
                SELECT COUNT(*) AS "count" FROM "Project"
                WHERE "client" IS NOT NULL AND TRIM("client") <> ''
              `)
            )[0]?.count ?? 0
          )
        : 0;
  const storedProjectNumberSequence = state.projectNumberSequenceTable
    ? Number(
        (
          await prisma.$queryRawUnsafe<Array<{ lastValue: number }>>(
            'SELECT "lastValue" FROM "ProjectNumberSequence" WHERE "scope" = ?',
            DRAWING_PROJECT_NUMBER_SCOPE
          )
        )[0]?.lastValue ?? -1
      )
    : null;
  return {
    unlinkedLegacyClientCount,
    highestProjectNumberSequence: highestSequence,
    storedProjectNumberSequence:
      storedProjectNumberSequence === -1 ? null : storedProjectNumberSequence
  };
}

function isDataCurrent(state: DataState) {
  return (
    state.unlinkedLegacyClientCount === 0 &&
    state.storedProjectNumberSequence !== null &&
    state.storedProjectNumberSequence >= state.highestProjectNumberSequence
  );
}

async function materializeLegacyClients(prisma: PrismaClient) {
  const projects = await prisma.$queryRawUnsafe<
    Array<{ id: string; client: string; clientId: string | null }>
  >(`
    SELECT "id", "client", "clientId" FROM "Project"
    WHERE "client" IS NOT NULL AND TRIM("client") <> ''
    ORDER BY "id"
  `);
  for (const project of projects) {
    if (project.clientId) continue;
    const name = project.client.trim();
    const normalizedName = normalizeDrawingClientName(name);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Client" ("id", "name", "normalizedName", "createdAt", "updatedAt")
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT("normalizedName") DO NOTHING`,
      legacyClientId(normalizedName),
      name,
      normalizedName
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "Project"
       SET "clientId" = (SELECT "id" FROM "Client" WHERE "normalizedName" = ?)
       WHERE "id" = ? AND "clientId" IS NULL`,
      normalizedName,
      project.id
    );
  }
}

async function initializeProjectNumberSequence(prisma: PrismaClient) {
  const highestSequence = await highestProjectNumberSequence(prisma);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProjectNumberSequence" ("scope", "lastValue", "updatedAt")
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT("scope") DO UPDATE SET
       "lastValue" = MAX("ProjectNumberSequence"."lastValue", excluded."lastValue"),
       "updatedAt" = CASE
         WHEN excluded."lastValue" > "ProjectNumberSequence"."lastValue"
           THEN CURRENT_TIMESTAMP
         ELSE "ProjectNumberSequence"."updatedAt"
       END`,
    DRAWING_PROJECT_NUMBER_SCOPE,
    highestSequence
  );
}

async function applySchema(prisma: PrismaClient, state: SchemaState) {
  await prisma.$executeRawUnsafe("BEGIN EXCLUSIVE");
  try {
    if (!state.clientTable) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "Client" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "normalizedName" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        )
      `);
    }
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "Client_normalizedName_key" ON "Client"("normalizedName")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "Client_name_idx" ON "Client"("name")'
    );
    if (!state.projectNumberSequenceTable) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "ProjectNumberSequence" (
          "scope" TEXT NOT NULL PRIMARY KEY,
          "lastValue" INTEGER NOT NULL DEFAULT 0,
          "updatedAt" DATETIME NOT NULL
        )
      `);
    }
    if (!state.projectTable) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "Project" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "projectNumber" TEXT,
          "normalizedProjectNumber" TEXT,
          "client" TEXT,
          "clientId" TEXT,
          "description" TEXT,
          "status" TEXT NOT NULL DEFAULT 'active',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "Project_clientId_fkey"
            FOREIGN KEY ("clientId") REFERENCES "Client"("id")
            ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);
    } else if (!state.projectClientId) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Project" ADD COLUMN "clientId" TEXT REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE'
      );
    }
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "Project_normalizedProjectNumber_key" ON "Project"("normalizedProjectNumber")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "Project_name_idx" ON "Project"("name")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "Project_status_updatedAt_idx" ON "Project"("status", "updatedAt")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "Project_clientId_idx" ON "Project"("clientId")'
    );
    if (!state.drawingDescription) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Drawing" ADD COLUMN "description" TEXT'
      );
    }
    if (!state.drawingProjectId) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Drawing" ADD COLUMN "projectId" TEXT REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE'
      );
    }
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "Drawing_projectId_idx" ON "Drawing"("projectId")'
    );
    await materializeLegacyClients(prisma);
    await initializeProjectNumberSequence(prisma);
    await prisma.$executeRawUnsafe("COMMIT");
  } catch (error) {
    await prisma.$executeRawUnsafe("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function upgradeDrawingProjectStorage({
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
}): Promise<DrawingProjectStorageUpgradeResult> {
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 0");
  const state = await schemaState(prisma);
  await validateProjectTable(prisma, state.projectTable, state.projectClientId);
  await validateClientTable(prisma, state.clientTable);
  await validateProjectNumberSequenceTable(
    prisma,
    state.projectNumberSequenceTable
  );
  if (state.projectClientId && !state.projectClientForeignKey) {
    throw new Error(
      "Project.clientId exists without the required Client foreign key."
    );
  }
  if (state.drawingProjectId && !state.drawingProjectForeignKey) {
    throw new Error(
      "Drawing.projectId exists without the required Project foreign key."
    );
  }

  const beforeDrawings = await drawingFingerprints(prisma);
  const beforeProjects = await projectFingerprints(prisma, state.projectTable);
  const beforeData = await dataState(prisma, state);
  if (isSchemaCurrent(state) && isDataCurrent(beforeData)) {
    return { status: "current", drawingCount: beforeDrawings.length };
  }
  if (!apply) {
    return { status: "dry-run", drawingCount: beforeDrawings.length };
  }

  await prisma.$executeRawUnsafe("BEGIN EXCLUSIVE");
  await prisma.$executeRawUnsafe("ROLLBACK");

  const runId = `${now
    .toISOString()
    .replace(/[-:.]/g, "")}-${sourceCommit.slice(0, 12)}`;
  const resolvedBase = path.resolve(archiveBasePath);
  const archivePath = path.resolve(resolvedBase, runId);
  if (
    !archivePath.startsWith(`${resolvedBase}${path.sep}`) ||
    existsSync(archivePath)
  ) {
    throw new Error(`Refusing unsafe or existing archive destination: ${archivePath}`);
  }
  mkdirSync(resolvedBase, { recursive: true });
  mkdirSync(archivePath);
  const backupPath = path.join(archivePath, "pre-upgrade-dev.db");
  await prisma.$executeRawUnsafe(
    `VACUUM INTO ${quoteSqlString(backupPath.replaceAll("\\", "/"))}`
  );
  const preliminaryManifest = {
    version: 2,
    operation: "upgrade-drawing-project-storage",
    state: "backup-complete",
    createdAt: now.toISOString(),
    sourceCommit,
    sourceDatabase: path.resolve(databasePath),
    drawingCount: beforeDrawings.length,
    projectCount: beforeProjects.length,
    drawingFingerprints: beforeDrawings,
    projectFingerprints: beforeProjects,
    databaseBackupSha256: sha256(readFileSync(backupPath)),
    beforeSchema: state,
    beforeData
  };
  writeFileSync(
    path.join(archivePath, "manifest.pre-upgrade.json"),
    `${JSON.stringify(preliminaryManifest, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" }
  );

  await applySchema(prisma, state);
  const afterState = await schemaState(prisma);
  await validateProjectTable(prisma, afterState.projectTable, true);
  await validateClientTable(prisma, afterState.clientTable);
  await validateProjectNumberSequenceTable(
    prisma,
    afterState.projectNumberSequenceTable
  );
  const afterData = await dataState(prisma, afterState);
  if (!isSchemaCurrent(afterState) || !isDataCurrent(afterData)) {
    throw new Error("Drawing Project storage is incomplete after upgrade.");
  }
  const afterDrawings = await drawingFingerprints(prisma);
  const afterProjects = await projectFingerprints(prisma, true);
  if (JSON.stringify(beforeDrawings) !== JSON.stringify(afterDrawings)) {
    throw new Error("Drawing identities or model JSON changed during storage upgrade.");
  }
  if (JSON.stringify(beforeProjects) !== JSON.stringify(afterProjects)) {
    throw new Error("Existing Project identity fields changed during storage upgrade.");
  }
  writeFileSync(
    path.join(archivePath, "manifest.json"),
    `${JSON.stringify(
      {
        ...preliminaryManifest,
        state: "upgraded-and-verified",
        completedAt: new Date().toISOString(),
        afterSchema: afterState,
        afterData,
        drawingFingerprints: afterDrawings,
        projectFingerprints: afterProjects
      },
      null,
      2
    )}\n`,
    { encoding: "utf8", flag: "wx" }
  );
  return {
    status: "upgraded",
    drawingCount: afterDrawings.length,
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
    throw new Error(`Refusing to upgrade storage for ${applicationRoot}.`);
  }
  const { apply } = parseDrawingProjectUpgradeArguments(process.argv.slice(2));
  const worktrees = parseGitWorktreeList(
    execFileSync(
      "git",
      ["-C", applicationRoot, "worktree", "list", "--porcelain"],
      { encoding: "utf8" }
    )
  );
  const canonicalWorktree = findCanonicalMainWorktree(worktrees);
  const databasePath = path.join(canonicalWorktree.path, "prisma", "dev.db");
  if (!existsSync(databasePath) || !statSync(databasePath).isFile()) {
    throw new Error(
      `Canonical database is unavailable at ${databasePath}. Refusing a substitute.`
    );
  }
  const sourceCommit = execFileSync(
    "git",
    ["-C", applicationRoot, "rev-parse", "HEAD"],
    { encoding: "utf8" }
  ).trim();
  const prisma = new PrismaClient({
    datasourceUrl: toPrismaSqliteFileUrl(databasePath)
  });
  try {
    const result = await upgradeDrawingProjectStorage({
      prisma,
      databasePath,
      archiveBasePath: path.join(
        canonicalWorktree.path,
        "artifacts",
        ARCHIVE_DIRECTORY_NAME
      ),
      sourceCommit,
      apply
    });
    console.log(`[drawing-project-storage] Database: ${databasePath}`);
    if (result.status === "current") {
      console.log("[drawing-project-storage] Schema is already current.");
    } else if (result.status === "dry-run") {
      console.log(
        `[drawing-project-storage] Validated ${result.drawingCount} drawing${result.drawingCount === 1 ? "" : "s"}. Dry run only; use --apply after review.`
      );
    } else {
      console.log(
        `[drawing-project-storage] Upgraded and verified ${result.drawingCount} drawing${result.drawingCount === 1 ? "" : "s"}.`
      );
      console.log(`[drawing-project-storage] Recovery archive: ${result.archivePath}`);
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
