import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { z } from "zod";

// Maintenance-only boundary. Never import this module into an application action.
export const retiredGuidanceTables = ["SymbolEngineerNote", "SymbolDocument", "LegacyDocumentTransfer"] as const;
const targetSet = new Set<string>(retiredGuidanceTables);
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const identifier = (value: string) => '"' + value.replaceAll('"', '""') + '"';
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const serialize = (value: unknown) => JSON.stringify(value, (_key, entry) =>
  typeof entry === "bigint" ? { integer: entry.toString() } : entry instanceof Uint8Array ? { bytes: Buffer.from(entry).toString("base64") } : entry);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const fingerprintSchema = z.object({ count: z.number().int().nonnegative(), sha256: digestSchema }).strict();
const schemaObject = z.object({ type: z.string(), name: z.string(), tbl_name: z.string(), sql: z.string().nullable() }).strict();
export const guidanceRetirementInventorySchema = z.object({
  version: z.literal(1), operation: z.literal("retire-symbol-guidance"),
  sourceDatabase: z.string().min(1), sourceCommit: z.string().regex(/^[a-f0-9]{40}$/), createdAt: z.iso.datetime(),
  schema: z.array(schemaObject), tables: z.record(z.string(), fingerprintSchema),
  retiredRecords: z.record(z.enum(retiredGuidanceTables), z.array(z.object({
    id: z.string().min(1), rowHash: digestSchema, attachmentHash: digestSchema.nullable()
  }).strict()))
}).strict();
export type GuidanceRetirementInventory = z.infer<typeof guidanceRetirementInventorySchema>;

export function assertRetirementPath(target: string, root: string, mustExist = true) {
  const absolute = path.resolve(target);
  const boundary = path.resolve(root);
  const relative = path.relative(boundary, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Retirement path is outside its permitted directory.");
  let ancestor = absolute;
  while (!existsSync(ancestor)) {
    if (mustExist) throw new Error("Retirement path does not exist.");
    ancestor = path.dirname(ancestor);
  }
  if (realpathSync(ancestor) !== ancestor || realpathSync(boundary) !== boundary) throw new Error("Redirected retirement path is not allowed.");
  return absolute;
}

function rows(db: DatabaseSync, sql: string) {
  const statement = db.prepare(sql);
  statement.setReadBigInts(true);
  return statement.all();
}

export function fingerprintGuidanceDatabase(db: DatabaseSync) {
  const schema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all().map(row => schemaObject.parse(row));
  const tables: Record<string, z.infer<typeof fingerprintSchema>> = {};
  for (const table of schema.filter(row => row.type === "table")) {
    const records = rows(db, "SELECT * FROM " + identifier(table.name)).map(serialize).sort();
    tables[table.name] = { count: records.length, sha256: hash(serialize(records)) };
  }
  return { schema, tables };
}

export function checkGuidanceDatabaseIntegrity(db: DatabaseSync) {
  const integrity = db.prepare("PRAGMA integrity_check").all();
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") throw new Error("SQLite integrity check failed.");
  if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Foreign-key violations must be resolved before retirement.");
}

const expectedColumns: Record<string, readonly string[]> = {
  SymbolEngineerNote: ["id:TEXT:1:1", "symbolId:TEXT:1:0", "versionId:TEXT:0:0", "notes:TEXT:1:0", "imageFileName:TEXT:0:0", "imageMimeType:TEXT:0:0", "imageSizeBytes:INTEGER:0:0", "imageDataUrl:TEXT:0:0", "createdAt:DATETIME:1:0", "updatedAt:DATETIME:1:0"],
  SymbolDocument: ["id:TEXT:1:1", "symbolId:TEXT:1:0", "versionId:TEXT:0:0", "title:TEXT:1:0", "fileName:TEXT:1:0", "mimeType:TEXT:1:0", "sizeBytes:INTEGER:1:0", "dataUrl:TEXT:1:0", "createdAt:DATETIME:1:0", "updatedAt:DATETIME:1:0"],
  LegacyDocumentTransfer: ["id:TEXT:1:1", "sourceDocumentId:TEXT:1:0", "sourceHash:TEXT:1:0", "destinationDocumentId:TEXT:1:0", "runId:TEXT:1:0", "createdAt:DATETIME:1:0"]
};

function validateSchema(db: DatabaseSync, snapshot: ReturnType<typeof fingerprintGuidanceDatabase>) {
  for (const name of ["Symbol", "SymbolVersion", "SymbolSourceAsset", "BomItem", "BomItemEngineerNote", "BomItemDocument", "BomItemEngineeringRevision", "Drawing"]) {
    if (!snapshot.tables[name]) throw new Error("Wrong application schema: missing " + name);
  }
  const present = retiredGuidanceTables.filter(name => snapshot.tables[name]);
  if (!present.length) return "absent" as const;
  if (present.length !== retiredGuidanceTables.length) throw new Error("Unexpected partial retirement schema.");
  if (snapshot.tables.LegacyDocumentTransfer.count) throw new Error("Nonempty document-transfer records require separate review.");
  for (const name of retiredGuidanceTables) {
    const columns = db.prepare("PRAGMA table_info(" + identifier(name) + ")").all();
    const actual = columns.map(column => `${column.name}:${column.type}:${column.notnull}:${column.pk}`);
    if (serialize(actual) !== serialize(expectedColumns[name])) throw new Error("Unexpected retirement table schema: " + name);
    const fks = db.prepare("PRAGMA foreign_key_list(" + identifier(name) + ")").all();
    const expected = name === "LegacyDocumentTransfer"
      ? ["destinationDocumentId:BomItemDocument:id:RESTRICT:CASCADE"]
      : ["symbolId:Symbol:id:CASCADE:CASCADE", "versionId:SymbolVersion:id:SET NULL:CASCADE"];
    const signatures = fks.map(fk => `${fk.from}:${fk.table}:${fk.to}:${fk.on_delete}:${fk.on_update}`).sort();
    if (serialize(signatures) !== serialize(expected.sort())) throw new Error("Unexpected retirement relationships: " + name);
  }
  for (const object of snapshot.schema) {
    if (object.type === "table" && !targetSet.has(object.name)) {
      const fks = db.prepare("PRAGMA foreign_key_list(" + identifier(object.name) + ")").all();
      if (fks.some(fk => targetSet.has(String(fk.table)))) throw new Error("Unexpected dependent table: " + object.name);
    }
    if (object.type === "trigger" && targetSet.has(object.tbl_name) ||
        (object.type === "view" || object.type === "trigger") && retiredGuidanceTables.some(name => new RegExp("\\b" + name + "\\b", "i").test(object.sql ?? ""))) {
      throw new Error("Unexpected dependent schema object: " + object.name);
    }
  }
  return "present" as const;
}

function attachmentHash(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("Invalid legacy attachment payload.");
  const encoded = /^data:[^;,]+;base64,([A-Za-z0-9+/]*={0,2})$/.exec(value)?.[1];
  if (!encoded) throw new Error("Invalid legacy attachment encoding.");
  const body = Buffer.from(encoded, "base64");
  if (body.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) throw new Error("Invalid legacy attachment bytes.");
  return hash(body);
}

export function inventorySymbolGuidance(db: DatabaseSync, sourceDatabase: string, sourceCommit: string): GuidanceRetirementInventory {
  checkGuidanceDatabaseIntegrity(db);
  const snapshot = fingerprintGuidanceDatabase(db);
  const status = validateSchema(db, snapshot);
  const retiredRecords = Object.fromEntries(retiredGuidanceTables.map(name => [name, status === "absent" ? [] :
    rows(db, "SELECT * FROM " + identifier(name) + " ORDER BY id").map(row => ({
      id: row.id, rowHash: hash(serialize(row)), attachmentHash: attachmentHash(name === "SymbolEngineerNote" ? row.imageDataUrl : name === "SymbolDocument" ? row.dataUrl : null)
    }))]));
  return guidanceRetirementInventorySchema.parse({ version: 1, operation: "retire-symbol-guidance", sourceDatabase: path.resolve(sourceDatabase), sourceCommit,
    createdAt: new Date().toISOString(), ...snapshot, retiredRecords });
}

export function verifyGuidanceRecoveryBackup(backupPath: string, inventory: GuidanceRetirementInventory) {
  const backup = new DatabaseSync(backupPath, { readOnly: true });
  try {
    const restored = inventorySymbolGuidance(backup, inventory.sourceDatabase, inventory.sourceCommit);
    if (serialize(restored.tables) !== serialize(inventory.tables) || serialize(restored.schema) !== serialize(inventory.schema) ||
        serialize(restored.retiredRecords) !== serialize(inventory.retiredRecords)) throw new Error("Recovery backup does not match the reviewed inventory.");
    return hash(readFileSync(backupPath));
  } finally { backup.close(); }
}

export function applySymbolGuidanceRetirement(db: DatabaseSync, input: {
  inventory: GuidanceRetirementInventory; sourceDatabase: string; sourceCommit: string; backupPath: string;
}) {
  const expected = guidanceRetirementInventorySchema.parse(input.inventory);
  if (expected.sourceDatabase !== path.resolve(input.sourceDatabase) || expected.sourceCommit !== input.sourceCommit) throw new Error("Inventory target/source checkpoint does not match.");
  const actualFile = db.prepare("PRAGMA database_list").all().find(row => row.name === "main")?.file;
  if (!actualFile || realpathSync(String(actualFile)) !== realpathSync(input.sourceDatabase)) throw new Error("Connection targets a different database.");
  if (path.resolve(input.backupPath) === path.resolve(input.sourceDatabase) || existsSync(input.backupPath)) throw new Error("Recovery backup must use a new file.");
  db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=0; PRAGMA locking_mode=EXCLUSIVE;");
  db.exec("BEGIN EXCLUSIVE; COMMIT;"); // Keep exclusive ownership across VACUUM and the drop transaction.
  const current = inventorySymbolGuidance(db, input.sourceDatabase, input.sourceCommit);
  if (retiredGuidanceTables.every(name => !current.tables[name])) return { status: "absent" as const };
  if (serialize(current.tables) !== serialize(expected.tables) || serialize(current.schema) !== serialize(expected.schema) ||
      serialize(current.retiredRecords) !== serialize(expected.retiredRecords)) throw new Error("Source drift: run and review a fresh inventory before applying.");
  db.exec("VACUUM INTO " + literal(input.backupPath.replaceAll("\\", "/")));
  const backupSha256 = verifyGuidanceRecoveryBackup(input.backupPath, expected);
  // Leave verified recovery evidence even if the process fails after COMMIT.
  writeFileSync(input.backupPath + ".manifest.json", JSON.stringify({
    state: "backup-verified-before-retirement", backupSha256, inventory: expected
  }, null, 2) + "\n", { flag: "wx" });
  db.exec("BEGIN EXCLUSIVE");
  try {
    // The only outbound Item reference is removed first; no foreign keys are disabled.
    for (const name of [...retiredGuidanceTables].reverse()) db.exec("DROP TABLE " + identifier(name));
    checkGuidanceDatabaseIntegrity(db);
    const after = fingerprintGuidanceDatabase(db);
    const survivors = Object.fromEntries(Object.entries(expected.tables).filter(([name]) => !targetSet.has(name)));
    const survivingSchema = expected.schema.filter(object => !targetSet.has(object.tbl_name));
    if (serialize(after.tables) !== serialize(survivors) || serialize(after.schema) !== serialize(survivingSchema)) throw new Error("Unrelated database content changed; retirement rolled back.");
    db.exec("COMMIT");
    return { status: "retired" as const, backupSha256, backupPath: input.backupPath, after };
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
