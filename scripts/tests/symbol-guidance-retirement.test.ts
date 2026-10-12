import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applySymbolGuidanceRetirement, assertRetirementPath, fingerprintGuidanceDatabase, inventorySymbolGuidance, verifyGuidanceRecoveryBackup } from "../../src/features/symbol_registry/data/guidance-retirement";
import { parseGuidanceRetirementArguments } from "../retire-symbol-guidance-storage";

const sourceCommit = "a".repeat(40);
const connections: DatabaseSync[] = [];
function connect(file: string) { const db = new DatabaseSync(file); connections.push(db); db.exec("PRAGMA foreign_keys=ON"); return db; }
function fixture() {
  const root = realpathSync(process.cwd());
  if (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).name !== "ei-designer") throw new Error("Wrong application");
  const base = path.join(root, "artifacts/symbol-guidance-retirement-tests");
  mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(path.join(base, "run-"));
  const file = assertRetirementPath(path.join(directory, "fixture.db"), root, false);
  const db = connect(file);
  db.exec(`
    CREATE TABLE Symbol(id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE SymbolVersion(id TEXT NOT NULL PRIMARY KEY, svg TEXT NOT NULL, metadataJson TEXT NOT NULL);
    CREATE TABLE SymbolSourceAsset(id TEXT NOT NULL PRIMARY KEY, dataUrl TEXT NOT NULL);
    CREATE TABLE BomItem(id TEXT NOT NULL PRIMARY KEY, notes TEXT NOT NULL);
    CREATE TABLE BomItemEngineerNote(id TEXT NOT NULL PRIMARY KEY, imageDataUrl TEXT NOT NULL);
    CREATE TABLE BomItemDocument(id TEXT NOT NULL PRIMARY KEY, dataUrl TEXT NOT NULL);
    CREATE TABLE BomItemEngineeringRevision(id TEXT NOT NULL PRIMARY KEY, profileJson TEXT NOT NULL);
    CREATE TABLE Drawing(id TEXT NOT NULL PRIMARY KEY, modelJson TEXT NOT NULL);
    INSERT INTO Symbol VALUES('symbol-a','Keep symbol');
    INSERT INTO SymbolVersion VALUES('version-a','<svg>Keep original bytes</svg>','{"terminals":[]}');
    INSERT INTO SymbolSourceAsset VALUES('source-a','data:image/png;base64,QUJD');
    INSERT INTO BomItem VALUES('item-a','Keep General notes');
    INSERT INTO BomItemEngineerNote VALUES('item-note','data:image/png;base64,REVG');
    INSERT INTO BomItemDocument VALUES('item-document','data:application/pdf;base64,R0hJ');
    INSERT INTO BomItemEngineeringRevision VALUES('revision-a','{"version":2,"entries":[]}');
    INSERT INTO Drawing VALUES('drawing-a','{"version":2,"assets":[]}');
    CREATE TABLE SymbolEngineerNote (
      id TEXT NOT NULL PRIMARY KEY, symbolId TEXT NOT NULL, versionId TEXT, notes TEXT NOT NULL,
      imageFileName TEXT, imageMimeType TEXT, imageSizeBytes INTEGER, imageDataUrl TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL,
      FOREIGN KEY(symbolId) REFERENCES Symbol(id) ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY(versionId) REFERENCES SymbolVersion(id) ON DELETE SET NULL ON UPDATE CASCADE);
    CREATE TABLE SymbolDocument (
      id TEXT NOT NULL PRIMARY KEY, symbolId TEXT NOT NULL, versionId TEXT, title TEXT NOT NULL,
      fileName TEXT NOT NULL, mimeType TEXT NOT NULL, sizeBytes INTEGER NOT NULL, dataUrl TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL,
      FOREIGN KEY(symbolId) REFERENCES Symbol(id) ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY(versionId) REFERENCES SymbolVersion(id) ON DELETE SET NULL ON UPDATE CASCADE);
    CREATE TABLE LegacyDocumentTransfer (
      id TEXT NOT NULL PRIMARY KEY, sourceDocumentId TEXT NOT NULL, sourceHash TEXT NOT NULL,
      destinationDocumentId TEXT NOT NULL, runId TEXT NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(destinationDocumentId) REFERENCES BomItemDocument(id) ON DELETE RESTRICT ON UPDATE CASCADE);
    CREATE INDEX SymbolEngineerNote_symbolId_idx ON SymbolEngineerNote(symbolId);
    CREATE UNIQUE INDEX LegacyDocumentTransfer_sourceDocumentId_key ON LegacyDocumentTransfer(sourceDocumentId);
    INSERT INTO SymbolEngineerNote VALUES('note-a','symbol-a','version-a','Remove this old note','snippet.png','image/png',3,'data:image/png;base64,QUJD',1,2);
    INSERT INTO SymbolDocument VALUES('document-a','symbol-a','version-a','Manual','manual.pdf','application/pdf',3,'data:application/pdf;base64,REVG',1,2);
  `);
  const inventory = inventorySymbolGuidance(db, file, sourceCommit);
  const input = { inventory, sourceDatabase: file, sourceCommit, backupPath: path.join(directory, "backup.db") };
  return { db, file, directory, inventory, input };
}
afterEach(() => { vi.restoreAllMocks(); for (const db of connections.splice(0)) db.close(); });

describe("guarded Symbol guidance retirement", () => {
  it("fresh and repeated bootstrap do not recreate retired storage", () => {
    const f = fixture();
    const fresh = assertRetirementPath(path.join(f.directory, "fresh-bootstrap.db"), f.directory, false);
    for (let run = 0; run < 2; run++) {
      execFileSync(process.execPath, ["--import", "tsx", "scripts/bootstrap-sqlite.ts"], {
        cwd: process.cwd(), env: { ...process.env, DATABASE_URL: "file:" + fresh.replaceAll("\\", "/") }, stdio: "pipe"
      });
      const db = new DatabaseSync(fresh, { readOnly: true });
      try {
        expect(db.prepare("SELECT name FROM sqlite_master WHERE name IN ('SymbolEngineerNote','SymbolDocument','LegacyDocumentTransfer')").all()).toEqual([]);
        expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally { db.close(); }
    }
  }, 30000);
  it("rejects redirected archive and database paths", () => {
    const f = fixture(); const link = path.join(f.directory, "redirected");
    const target = path.join(f.directory, "target"); mkdirSync(target);
    symlinkSync(target, link, "junction");
    expect(() => assertRetirementPath(path.join(link, "new.db"), f.directory, false)).toThrow("Redirected");
  });
  it("inventories exact rows and attachment bytes without changing the database", () => {
    const f = fixture(); const before = fingerprintGuidanceDatabase(f.db);
    expect(f.inventory.retiredRecords.SymbolEngineerNote[0]).toMatchObject({ id: "note-a", attachmentHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(inventorySymbolGuidance(f.db, f.file, sourceCommit).tables).toEqual(before.tables);
    expect(fingerprintGuidanceDatabase(f.db)).toEqual(before);
  });
  it("removes only legacy storage, independently verifies backup and rehearses full restoration", () => {
    const f = fixture(); const before = fingerprintGuidanceDatabase(f.db);
    const result = applySymbolGuidanceRetirement(f.db, f.input);
    expect(result.status).toBe("retired");
    const after = fingerprintGuidanceDatabase(f.db);
    for (const table of ["SymbolEngineerNote", "SymbolDocument", "LegacyDocumentTransfer"]) expect(after.tables[table]).toBeUndefined();
    for (const [table, fingerprint] of Object.entries(after.tables)) expect(fingerprint).toEqual(before.tables[table]);
    expect(verifyGuidanceRecoveryBackup(f.input.backupPath, f.inventory)).toMatch(/^[a-f0-9]{64}$/);
    const restoredFile = path.join(f.directory, "restored.db"); copyFileSync(f.input.backupPath, restoredFile);
    const restored = connect(restoredFile);
    expect(fingerprintGuidanceDatabase(restored)).toEqual(before);
    expect(restored.prepare("SELECT dataUrl FROM SymbolDocument").get()?.dataUrl).toBe("data:application/pdf;base64,REVG");
    expect(applySymbolGuidanceRetirement(f.db, { ...f.input, backupPath: path.join(f.directory, "unused.db") })).toEqual({ status: "absent" });
  });
  it("rejects malformed arguments, wrong paths, checkpoint and connection targets", () => {
    const f = fixture(); const other = fixture();
    expect(parseGuidanceRetirementArguments([])).toEqual({ apply: false });
    expect(() => parseGuidanceRetirementArguments(["--apply"])).toThrow();
    expect(() => parseGuidanceRetirementArguments(["--apply", "file", "--inventory-sha256", "bad"])).toThrow();
    expect(() => assertRetirementPath(path.join(f.directory, "../outside"), f.directory, false)).toThrow();
    expect(() => applySymbolGuidanceRetirement(f.db, { ...f.input, sourceCommit: "b".repeat(40) })).toThrow("checkpoint");
    expect(() => applySymbolGuidanceRetirement(other.db, f.input)).toThrow("different database");
    expect(fingerprintGuidanceDatabase(f.db).tables).toEqual(f.inventory.tables);
  });
  it.each(["UPDATE SymbolEngineerNote SET notes='Changed elsewhere'", "UPDATE BomItem SET notes='New Item draft saved'"])("rejects source drift: %s", sql => {
    const f = fixture(); f.db.exec(sql); const before = fingerprintGuidanceDatabase(f.db);
    expect(() => applySymbolGuidanceRetirement(f.db, f.input)).toThrow("Source drift");
    expect(fingerprintGuidanceDatabase(f.db)).toEqual(before);
  });
  it("rejects nonempty transfer records, unexpected relationships, views and schema", () => {
    const f = fixture();
    f.db.exec("INSERT INTO LegacyDocumentTransfer VALUES('transfer','source','hash','item-document','run',1)");
    expect(() => inventorySymbolGuidance(f.db, f.file, sourceCommit)).toThrow("Nonempty");
    f.db.exec("DELETE FROM LegacyDocumentTransfer; CREATE TABLE Dependent(id TEXT PRIMARY KEY,noteId TEXT REFERENCES SymbolEngineerNote(id))");
    expect(() => inventorySymbolGuidance(f.db, f.file, sourceCommit)).toThrow("dependent table");
    f.db.exec("DROP TABLE Dependent; CREATE VIEW OldNotes AS SELECT * FROM SymbolEngineerNote");
    expect(() => inventorySymbolGuidance(f.db, f.file, sourceCommit)).toThrow("dependent schema");
    f.db.exec("DROP VIEW OldNotes; ALTER TABLE SymbolEngineerNote ADD COLUMN unexpected TEXT");
    expect(() => inventorySymbolGuidance(f.db, f.file, sourceCommit)).toThrow("table schema");
  });
  it("fails closed on a locked database", () => {
    const f = fixture(); const lock = connect(f.file); lock.exec("BEGIN IMMEDIATE");
    expect(() => applySymbolGuidanceRetirement(f.db, f.input)).toThrow(/locked/);
    lock.exec("ROLLBACK"); expect(fingerprintGuidanceDatabase(f.db).tables).toEqual(f.inventory.tables);
  });
  it("does not drop anything if backup creation fails or a backup already exists", () => {
    const f = fixture();
    expect(() => applySymbolGuidanceRetirement(f.db, { ...f.input, backupPath: path.join(f.directory, "missing", "backup.db") })).toThrow();
    writeFileSync(f.input.backupPath, "Do not overwrite");
    expect(() => applySymbolGuidanceRetirement(f.db, f.input)).toThrow("new file");
    expect(readFileSync(f.input.backupPath, "utf8")).toBe("Do not overwrite");
    expect(fingerprintGuidanceDatabase(f.db).tables).toEqual(f.inventory.tables);
  });
  it("rejects a mismatched backup before any drop", () => {
    const f = fixture(); const exec = f.db.exec.bind(f.db);
    vi.spyOn(f.db, "exec").mockImplementation(sql => {
      exec(sql);
      if (sql.startsWith("VACUUM INTO")) {
        const backup = new DatabaseSync(f.input.backupPath);
        try { backup.exec("UPDATE SymbolDocument SET dataUrl='data:application/pdf;base64,QUJD'"); } finally { backup.close(); }
      }
    });
    expect(() => applySymbolGuidanceRetirement(f.db, f.input)).toThrow("backup does not match");
    expect(fingerprintGuidanceDatabase(f.db).tables).toEqual(f.inventory.tables);
  });
  it("rolls back all drops on interruption or unexpected surviving-table changes", () => {
    const f = fixture(); const exec = f.db.exec.bind(f.db);
    vi.spyOn(f.db, "exec").mockImplementation(sql => {
      if (sql === 'DROP TABLE "SymbolDocument"') throw new Error("Injected failure");
      exec(sql);
    });
    expect(() => applySymbolGuidanceRetirement(f.db, f.input)).toThrow("Injected failure");
    expect(fingerprintGuidanceDatabase(f.db).tables).toEqual(f.inventory.tables);
    vi.restoreAllMocks();
    vi.spyOn(f.db, "exec").mockImplementation(sql => {
      exec(sql);
      if (sql === 'DROP TABLE "SymbolDocument"') exec("UPDATE BomItem SET notes='Unexpected change'");
    });
    expect(() => applySymbolGuidanceRetirement(f.db, { ...f.input, backupPath: path.join(f.directory, "second-backup.db") })).toThrow("Unrelated database content");
    expect(fingerprintGuidanceDatabase(f.db).tables).toEqual(f.inventory.tables);
  });
  it("rejects partial retirement and invalid attachment encoding", () => {
    const f = fixture(); f.db.exec("UPDATE SymbolDocument SET dataUrl='not a data URL'");
    expect(() => inventorySymbolGuidance(f.db, f.file, sourceCommit)).toThrow("attachment encoding");
    f.db.exec("DROP TABLE LegacyDocumentTransfer");
    expect(() => inventorySymbolGuidance(f.db, f.file, sourceCommit)).toThrow("partial retirement");
  });
});
