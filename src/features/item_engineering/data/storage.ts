import type { Prisma } from "@prisma/client";
import { ATTRIBUTE_TYPE_STORAGE_SQL, seedAttributeTypes } from "@/features/engineering_attributes/api/server";

export type ItemStorageClient = Pick<Prisma.TransactionClient, "$executeRawUnsafe" | "$queryRawUnsafe">;

// Generated from the reviewed Prisma models; shared by bootstrap and the guarded upgrade.
export const ITEM_ENGINEERING_STORAGE_SQL: readonly string[] = [
  "CREATE TABLE IF NOT EXISTS \"BomItemEngineeringRevision\" (\n    \"id\" TEXT NOT NULL PRIMARY KEY,\n    \"itemId\" TEXT NOT NULL,\n    \"revisionNumber\" INTEGER NOT NULL,\n    \"identityJson\" TEXT NOT NULL,\n    \"profileJson\" TEXT NOT NULL,\n    \"contentHash\" TEXT NOT NULL,\n    \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    CONSTRAINT \"BomItemEngineeringRevision_itemId_fkey\" FOREIGN KEY (\"itemId\") REFERENCES \"BomItem\" (\"id\") ON DELETE RESTRICT ON UPDATE CASCADE\n);",
  "CREATE TABLE IF NOT EXISTS \"BomItemEngineerNote\" (\n    \"id\" TEXT NOT NULL PRIMARY KEY,\n    \"itemId\" TEXT NOT NULL,\n    \"notes\" TEXT NOT NULL,\n    \"imageFileName\" TEXT,\n    \"imageMimeType\" TEXT,\n    \"imageSizeBytes\" INTEGER,\n    \"imageDataUrl\" TEXT,\n    \"contentHash\" TEXT NOT NULL,\n    \"supersedesId\" TEXT,\n    \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"archivedAt\" DATETIME,\n    CONSTRAINT \"BomItemEngineerNote_itemId_fkey\" FOREIGN KEY (\"itemId\") REFERENCES \"BomItem\" (\"id\") ON DELETE RESTRICT ON UPDATE CASCADE\n);",
  "CREATE TABLE IF NOT EXISTS \"BomItemRevisionNote\" (\n    \"revisionId\" TEXT NOT NULL,\n    \"itemId\" TEXT NOT NULL,\n    \"noteId\" TEXT NOT NULL,\n\n    PRIMARY KEY (\"revisionId\", \"noteId\"),\n    CONSTRAINT \"BomItemRevisionNote_revisionId_itemId_fkey\" FOREIGN KEY (\"revisionId\", \"itemId\") REFERENCES \"BomItemEngineeringRevision\" (\"id\", \"itemId\") ON DELETE RESTRICT ON UPDATE RESTRICT,\n    CONSTRAINT \"BomItemRevisionNote_noteId_itemId_fkey\" FOREIGN KEY (\"noteId\", \"itemId\") REFERENCES \"BomItemEngineerNote\" (\"id\", \"itemId\") ON DELETE RESTRICT ON UPDATE RESTRICT\n);",
  "CREATE TABLE IF NOT EXISTS \"BomItemRevisionDocument\" (\n    \"revisionId\" TEXT NOT NULL,\n    \"itemId\" TEXT NOT NULL,\n    \"documentId\" TEXT NOT NULL,\n\n    PRIMARY KEY (\"revisionId\", \"documentId\"),\n    CONSTRAINT \"BomItemRevisionDocument_revisionId_itemId_fkey\" FOREIGN KEY (\"revisionId\", \"itemId\") REFERENCES \"BomItemEngineeringRevision\" (\"id\", \"itemId\") ON DELETE RESTRICT ON UPDATE RESTRICT,\n    CONSTRAINT \"BomItemRevisionDocument_documentId_itemId_fkey\" FOREIGN KEY (\"documentId\", \"itemId\") REFERENCES \"BomItemDocument\" (\"id\", \"itemId\") ON DELETE RESTRICT ON UPDATE RESTRICT\n);",
  "CREATE TABLE IF NOT EXISTS \"SymbolItemConfiguration\" (\n    \"id\" TEXT NOT NULL PRIMARY KEY,\n    \"symbolVersionId\" TEXT NOT NULL,\n    \"revisionNumber\" INTEGER NOT NULL,\n    \"symbolContractHash\" TEXT NOT NULL,\n    \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    CONSTRAINT \"SymbolItemConfiguration_symbolVersionId_fkey\" FOREIGN KEY (\"symbolVersionId\") REFERENCES \"SymbolVersion\" (\"id\") ON DELETE RESTRICT ON UPDATE CASCADE\n);",
  "CREATE TABLE IF NOT EXISTS \"SymbolItemConfigurationOption\" (\n    \"id\" TEXT NOT NULL PRIMARY KEY,\n    \"configurationId\" TEXT NOT NULL,\n    \"itemEngineeringRevisionId\" TEXT NOT NULL,\n    \"usage\" TEXT NOT NULL,\n    \"evidence\" TEXT NOT NULL,\n    CONSTRAINT \"SymbolItemConfigurationOption_configurationId_fkey\" FOREIGN KEY (\"configurationId\") REFERENCES \"SymbolItemConfiguration\" (\"id\") ON DELETE RESTRICT ON UPDATE CASCADE,\n    CONSTRAINT \"SymbolItemConfigurationOption_itemEngineeringRevisionId_fkey\" FOREIGN KEY (\"itemEngineeringRevisionId\") REFERENCES \"BomItemEngineeringRevision\" (\"id\") ON DELETE RESTRICT ON UPDATE CASCADE\n);",
  "CREATE TABLE IF NOT EXISTS \"SymbolItemConfigurationPart\" (\n    \"id\" TEXT NOT NULL PRIMARY KEY,\n    \"configurationId\" TEXT NOT NULL,\n    \"optionId\" TEXT,\n    \"itemEngineeringRevisionId\" TEXT NOT NULL,\n    \"lineKey\" TEXT NOT NULL,\n    \"quantityRule\" TEXT NOT NULL,\n    \"quantity\" REAL NOT NULL DEFAULT 1,\n    CONSTRAINT \"SymbolItemConfigurationPart_configurationId_fkey\" FOREIGN KEY (\"configurationId\") REFERENCES \"SymbolItemConfiguration\" (\"id\") ON DELETE RESTRICT ON UPDATE CASCADE,\n    CONSTRAINT \"SymbolItemConfigurationPart_optionId_configurationId_fkey\" FOREIGN KEY (\"optionId\", \"configurationId\") REFERENCES \"SymbolItemConfigurationOption\" (\"id\", \"configurationId\") ON DELETE RESTRICT ON UPDATE RESTRICT,\n    CONSTRAINT \"SymbolItemConfigurationPart_itemEngineeringRevisionId_fkey\" FOREIGN KEY (\"itemEngineeringRevisionId\") REFERENCES \"BomItemEngineeringRevision\" (\"id\") ON DELETE RESTRICT ON UPDATE CASCADE\n);",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"BomItemDocument_id_itemId_key\" ON \"BomItemDocument\"(\"id\", \"itemId\");",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"BomItemEngineeringRevision_itemId_revisionNumber_key\" ON \"BomItemEngineeringRevision\"(\"itemId\", \"revisionNumber\");",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"BomItemEngineeringRevision_id_itemId_key\" ON \"BomItemEngineeringRevision\"(\"id\", \"itemId\");",
  "CREATE INDEX IF NOT EXISTS \"BomItemEngineerNote_itemId_createdAt_idx\" ON \"BomItemEngineerNote\"(\"itemId\", \"createdAt\");",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"BomItemEngineerNote_id_itemId_key\" ON \"BomItemEngineerNote\"(\"id\", \"itemId\");",
  "CREATE INDEX IF NOT EXISTS \"BomItemRevisionNote_noteId_itemId_idx\" ON \"BomItemRevisionNote\"(\"noteId\", \"itemId\");",
  "CREATE INDEX IF NOT EXISTS \"BomItemRevisionDocument_documentId_itemId_idx\" ON \"BomItemRevisionDocument\"(\"documentId\", \"itemId\");",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"SymbolItemConfiguration_symbolVersionId_revisionNumber_key\" ON \"SymbolItemConfiguration\"(\"symbolVersionId\", \"revisionNumber\");",
  "CREATE INDEX IF NOT EXISTS \"SymbolItemConfigurationOption_itemEngineeringRevisionId_idx\" ON \"SymbolItemConfigurationOption\"(\"itemEngineeringRevisionId\");",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"SymbolItemConfigurationOption_configurationId_itemEngineeringRevisionId_key\" ON \"SymbolItemConfigurationOption\"(\"configurationId\", \"itemEngineeringRevisionId\");",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"SymbolItemConfigurationOption_id_configurationId_key\" ON \"SymbolItemConfigurationOption\"(\"id\", \"configurationId\");",
  "CREATE INDEX IF NOT EXISTS \"SymbolItemConfigurationPart_optionId_configurationId_idx\" ON \"SymbolItemConfigurationPart\"(\"optionId\", \"configurationId\");",
  "CREATE INDEX IF NOT EXISTS \"SymbolItemConfigurationPart_itemEngineeringRevisionId_idx\" ON \"SymbolItemConfigurationPart\"(\"itemEngineeringRevisionId\");",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"SymbolItemConfigurationPart_configurationId_lineKey_key\" ON \"SymbolItemConfigurationPart\"(\"configurationId\", \"lineKey\");",
];

export function itemEngineeringStorageStatements(): readonly string[] {
  const statements = [...ITEM_ENGINEERING_STORAGE_SQL, ...ATTRIBUTE_TYPE_STORAGE_SQL];
  for (const table of [
    "BomItemRevisionNote", "BomItemRevisionDocument", "SymbolItemConfiguration",
    "SymbolItemConfigurationOption", "SymbolItemConfigurationPart"
  ]) {
    for (const operation of ["UPDATE", "DELETE"]) {
      statements.push(`CREATE TRIGGER IF NOT EXISTS "${table}_immutable_${operation.toLowerCase()}"
        BEFORE ${operation} ON "${table}" BEGIN
        SELECT RAISE(ABORT, 'Create a new engineering configuration instead of rewriting a snapshot'); END`);
    }
  }
  statements.push(`CREATE TRIGGER IF NOT EXISTS "BomItemEngineeringRevision_immutable_update"
    BEFORE UPDATE ON "BomItemEngineeringRevision" BEGIN
    SELECT RAISE(ABORT, 'Item engineering revisions are immutable'); END`);
  statements.push(`CREATE TRIGGER IF NOT EXISTS "BomItemEngineeringRevision_immutable_delete"
    BEFORE DELETE ON "BomItemEngineeringRevision" BEGIN
    SELECT RAISE(ABORT, 'Item engineering revisions must be retained'); END`);
  statements.push(`CREATE TRIGGER IF NOT EXISTS "BomItemEngineerNote_immutable_content"
    BEFORE UPDATE OF id, itemId, notes, imageFileName, imageMimeType, imageSizeBytes, imageDataUrl, contentHash, supersedesId, createdAt
    ON "BomItemEngineerNote" BEGIN
    SELECT RAISE(ABORT, 'Replace an Item note instead of changing its content'); END`);
  statements.push(`CREATE TRIGGER IF NOT EXISTS "BomItemDocument_pinned_content"
    BEFORE UPDATE OF id, itemId, title, fileName, mimeType, sizeBytes, dataUrl, contentHash, createdAt ON "BomItemDocument"
    WHEN EXISTS (SELECT 1 FROM "BomItemRevisionDocument" WHERE documentId = OLD.id) BEGIN
    SELECT RAISE(ABORT, 'Pinned Item documents are immutable'); END`);
  return statements;
}

export async function ensureItemEngineeringStorage(db: ItemStorageClient, options: {seedTypes?:boolean} = {}): Promise<void> {
  for (const table of ["BomItem", "BomItemDocument", "SymbolVersion"]) {
    const existing = await db.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?", table
    );
    if (existing.length !== 1) throw new Error("Missing Item engineering prerequisite: " + table);
  }
  const columns = await db.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("BomItemDocument")');
  for (const [name, type] of [["archivedAt", "DATETIME"], ["contentHash", "TEXT"]] as const) {
    if (!columns.some(column => column.name === name)) {
      await db.$executeRawUnsafe(`ALTER TABLE "BomItemDocument" ADD COLUMN "${name}" ${type}`);
    }
  }
  for (const sql of itemEngineeringStorageStatements()) await db.$executeRawUnsafe(sql);
  const optionColumns = await db.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("SymbolItemConfigurationOption")');
  if (!optionColumns.some(column => column.name === "interfaceJson")) {
    await db.$executeRawUnsafe('ALTER TABLE "SymbolItemConfigurationOption" ADD COLUMN "interfaceJson" TEXT NOT NULL DEFAULT \'{}\'');
  }
  const noteColumns = await db.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("BomItemEngineerNote")');
  if (!noteColumns.some(column => column.name === "libraryPosition")) {
    await db.$executeRawUnsafe('ALTER TABLE "BomItemEngineerNote" ADD COLUMN "libraryPosition" INTEGER');
  }
  if(options.seedTypes!==false) await seedAttributeTypes(db);
}
