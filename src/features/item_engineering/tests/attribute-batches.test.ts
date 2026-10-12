import { mkdirSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { ensureItemEngineeringStorage } from "../data/storage";
import { loadSpecificationWorkspace, previewItemAttributeBatch, saveItemAttributeBatch } from "../data/attribute-batches";
import { loadAttributeEvidence } from "../data/attribute-evidence";
import { createItemEngineeringRevision } from "../data/mutations";
import { updateItemEngineeringClassificationInTransaction } from "../data/attributes";
import { itemEngineeringActionResult } from "../logic/services/item-engineering-action-result";
import { saveItemEngineerNote, archiveItemEngineerNote } from "../data/guidance";

const clients: PrismaClient[] = [];
async function fixture() {
  const root = realpathSync(process.cwd());
  if (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).name !== "ei-designer") throw new Error("Wrong package");
  const base = path.join(root, "artifacts/drawing-performance/engineering-attributes/batch-tests"); mkdirSync(base,{ recursive: true });
  if (realpathSync(base) !== base) throw new Error("Redirected fixture");
  const db = new PrismaClient({ datasourceUrl: "file:" + path.join(mkdtempSync(path.join(base,"run-")),"fixture.db").replaceAll("\\","/") }); clients.push(db);
  await db.$executeRawUnsafe("PRAGMA foreign_keys=ON");
  await db.$executeRawUnsafe("CREATE TABLE BomItem(id TEXT PRIMARY KEY,itemKey TEXT NOT NULL,displayName TEXT NOT NULL,manufacturer TEXT,model TEXT,partNumber TEXT,status TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'io_module',updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await db.$executeRawUnsafe("CREATE TABLE SymbolVersion(id TEXT PRIMARY KEY)");
  await db.$executeRawUnsafe("CREATE TABLE BomItemDocument(id TEXT PRIMARY KEY,itemId TEXT,title TEXT,fileName TEXT,mimeType TEXT,sizeBytes INTEGER,dataUrl TEXT,createdAt DATETIME,updatedAt DATETIME)");
  await db.$executeRawUnsafe("INSERT INTO BomItem(id,itemKey,displayName,status) VALUES('item','SYNTHETIC-IO','Synthetic I/O module','active')");
  await ensureItemEngineeringStorage(db); return db;
}
afterEach(async () => { await Promise.all(clients.splice(0).map(db => db.$disconnect())); });
const row = (id: string, changes: Record<string, unknown> = {}) => ({ id, groupKey: "device", title: "Operating temperature", description: "",
  typeRevisionId: "attribute_type_operating_temperature_range_v1", payload: { kind: "range", minimum: -20, maximum: 70, unit: "°C" },
  scope: { kind: "device" }, modes: [], condition: "", evidence: [], source: { kind: "manufacturer" }, ratingBasis: "continuous", ...changes });
const batch = (changes: Record<string, unknown> = {}) => ({ itemId: "item", expectedLatestRevisionId: null, additions: [row("temperature")], updates: [], removals: [],
  profile: { deviceType: "io_module", groups: [{ key: "device", label: "Device", context: "device" }], modes: [], channels: [], terminals: [] }, ...changes });
describe("Atomic specification batches", () => {
  it("keeps cited content attached when a note is replaced or archived",async()=>{
    const db=await fixture();const first=await saveItemAttributeBatch(batch(),db);
    const note=await saveItemEngineerNote({itemId:"item",expectedLatestRevisionId:first.revisionId,notes:"Synthetic source",image:null},db);
    const source=(await loadAttributeEvidence({itemId:"item",kind:"note",id:note.note.id},db)).sources[0];
    const saved=await saveItemAttributeBatch(batch({expectedLatestRevisionId:note.revision!.id,additions:[],updates:[row("temperature",{evidence:[{kind:"note",id:note.note.id,contentHash:source.contentHash}]})]}),db);
    const replacement=await saveItemEngineerNote({itemId:"item",expectedLatestRevisionId:saved.revisionId,replaceNoteId:note.note.id,notes:"Replacement source",image:null},db);
    expect(replacement.revision!.noteIds).toContain(note.note.id);
    const archived=await archiveItemEngineerNote({itemId:"item",noteId:replacement.note.id,expectedLatestRevisionId:replacement.revision!.id},db);
    expect(archived.revision!.noteIds).toEqual([note.note.id]);
    const workspace=await loadSpecificationWorkspace("item",db);
    expect(workspace.profile.entries[0].evidence).toEqual([{kind:"note",id:note.note.id,contentHash:source.contentHash}]);
  });
  it("previews without writes, commits once, rejects stale revisions and avoids no-op revisions", async () => {
    const db = await fixture(); const preview = await previewItemAttributeBatch(batch(), db);
    expect(preview.valid).toBe(true); expect(await db.bomItemEngineeringRevision.count()).toBe(0);
    const saved = await saveItemAttributeBatch(batch(), db);
    expect(saved.profile.version).toBe(3); expect(saved.profile.deviceType).toBe("io_module");
    expect(saved.profile.entries[0].payload).toEqual({ kind: "range", minimum: -20, maximum: 70, unit: "°C" });
    await expect(saveItemAttributeBatch(batch(), db)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect((await saveItemAttributeBatch(batch({ expectedLatestRevisionId: saved.revisionId, additions: [] }), db)).created).toBe(false);
    expect(await db.bomItemEngineeringRevision.count()).toBe(1);
    const reclassified = await db.$transaction(tx => updateItemEngineeringClassificationInTransaction({ itemId: "item", expectedLatestRevisionId: saved.revisionId, deviceType: "controller" },tx));
    expect(reclassified.profile.version).toBe(3);
    if (reclassified.profile.version !== 1) expect(reclassified.profile.entries).toHaveLength(1);
  });
  it("rejects the entire batch with stable row errors and never coerces blanks to zero", async () => {
    const db = await fixture();
    const invalid = batch({ additions: [row("good"), row("bad", { condition: "other", payload: { kind: "range", minimum: 80, maximum: 20, unit: "°C" } })] });
    const result = await itemEngineeringActionResult(() => saveItemAttributeBatch(invalid, db));
    expect(result.ok).toBe(false); if (!result.ok) expect(result.fieldErrors).toHaveProperty("rows.bad.payload");
    expect(await db.bomItemEngineeringRevision.count()).toBe(0);
    await expect(saveItemAttributeBatch(batch({ additions: [row("blank",{ payload: { kind: "quantity", value: "", unit: "°C" } })] }),db)).rejects.toThrow();
    expect(await db.bomItemEngineeringRevision.count()).toBe(0);
  });
  it("retains alternative power modes and blocks forged analysis snapshots through direct writes", async () => {
    const db = await fixture();
    const input = batch({ additions: [1.8,4.5].map((value,i) => row(`power${i}`,{ typeRevisionId: "attribute_type_active_power_consumption_v1", title: "Power consumption",
      payload: { kind: "quantity", value, unit: "W" }, modes: [{ setId: "loop", choiceId: i ? "chassis" : "external" }] })),
      profile: { ...batch().profile, modes: [{ id: "loop", label: "Loop power", choices: [{ id: "external",label: "External" },{ id: "chassis",label: "Chassis" }] }] } });
    const saved = await saveItemAttributeBatch(input,db); expect(saved.profile.entries).toHaveLength(2);
    const forged = structuredClone(saved.profile); forged.entries[0].type.analysisKey = "supply_output_capacity_w";
    await expect(createItemEngineeringRevision({ itemId: "item", expectedLatestRevisionId: saved.revisionId, profile: forged, noteIds: [], documentIds: [] },db)).rejects.toMatchObject({ code: "INTEGRITY" });
    expect(await db.bomItemEngineeringRevision.count()).toBe(1);
  });
  it("retains selected document content, rejects foreign evidence and permits historical archived evidence", async () => {
    const db = await fixture();
    await db.$executeRawUnsafe("INSERT INTO BomItemDocument(id,itemId,title,fileName,mimeType,sizeBytes,dataUrl,createdAt,updatedAt) VALUES('doc','item','Synthetic datasheet','test.pdf','application/pdf',1,'data:application/pdf;base64,AA==',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
    const metadata = await loadAttributeEvidence({ itemId: "item" },db); expect(metadata.sources[0]).not.toHaveProperty("dataUrl");
    const selected = (await loadAttributeEvidence({ itemId: "item", kind: "document",id: "doc" },db)).sources[0];
    const evidence = [{ kind: "document", id: "doc", contentHash: selected.contentHash, page: 3 }];
    const saved = await saveItemAttributeBatch(batch({ additions: [row("t",{ evidence })] }),db);
    await db.$executeRawUnsafe("UPDATE BomItemDocument SET archivedAt=CURRENT_TIMESTAMP WHERE id='doc'");
    expect((await loadAttributeEvidence({ itemId: "item",revisionId: saved.revisionId },db)).sources[0].archived).toBe(true);
    await expect(saveItemAttributeBatch(batch({ expectedLatestRevisionId: saved.revisionId, additions: [row("foreign",{ condition: "other", evidence: [{ ...evidence[0],id: "someone-elses-doc" }] })] }),db)).rejects.toMatchObject({ code: "INVALID_GUIDANCE" });
    expect((await loadSpecificationWorkspace("item",db)).revisionId).toBe(saved.revisionId);
    await db.$executeRawUnsafe("UPDATE BomItem SET status='archived' WHERE id='item'");
    await expect(saveItemAttributeBatch(batch({ expectedLatestRevisionId: saved.revisionId, additions: [] }),db)).rejects.toMatchObject({ code: "ARCHIVED" });
  });
});
