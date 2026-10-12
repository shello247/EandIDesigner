import { mkdirSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { ensureItemEngineeringStorage } from "../data/storage";
import { saveItemAttribute, removeItemAttribute, updateItemEngineeringClassification, loadItemAttributeWorkspace } from "../data/attributes";
import { createItemEngineeringRevision, saveItemWorkspaceProfile } from "../data/mutations";
import { getItemEngineeringRevision } from "../data/queries";
import { saveItemEngineerNote } from "../data/guidance";
import { projectItemAttributeProfile } from "../logic/services/item-attribute-profile";
import { resolveItemEngineeringProfile } from "../logic/services/item-engineering-profile";
import { saveAttributeType, getAttributeTypeRevision, listAttributeTypes, setAttributeTypeStatus } from "@/features/engineering_attributes/api/server";
import { ATTRIBUTE_TYPE_SEEDS } from "@/features/engineering_attributes/api/public";
import { buildPayload } from "../ui/components/item-attribute-value-fields";
import { itemEngineeringProfileV1Schema } from "../data/schema";
const clients: PrismaClient[] = [];
async function fixture() {
  const root = realpathSync(process.cwd());
  if (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).name !== "ei-designer") throw new Error("Wrong package");
  const base = path.join(root, "artifacts/drawing-performance/item-engineering/attribute-tests");
  mkdirSync(base, { recursive: true });
  if (realpathSync(base) !== base) throw new Error("Redirected fixture");
  const file = path.join(mkdtempSync(path.join(base, "run-")), "fixture.db");
  const db = new PrismaClient({ datasourceUrl: "file:" + file.replaceAll("\\", "/") }); clients.push(db);
  await db.$executeRawUnsafe("PRAGMA foreign_keys=ON");
  await db.$executeRawUnsafe("CREATE TABLE BomItem(id TEXT PRIMARY KEY,itemKey TEXT NOT NULL,displayName TEXT NOT NULL,manufacturer TEXT,model TEXT,partNumber TEXT,status TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'accessory',updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await db.$executeRawUnsafe("CREATE TABLE SymbolVersion(id TEXT PRIMARY KEY)");
  await db.$executeRawUnsafe("CREATE TABLE BomItemDocument(id TEXT PRIMARY KEY,itemId TEXT,title TEXT,fileName TEXT,mimeType TEXT,sizeBytes INTEGER,dataUrl TEXT,createdAt DATETIME,updatedAt DATETIME)");
  await db.$executeRawUnsafe("INSERT INTO BomItem(id,itemKey,displayName,status) VALUES('test-item','ITEM-TEST','Synthetic breaker','active')");
  await ensureItemEngineeringStorage(db);
  return db;
}
const input = (patch: Record<string, unknown> = {}) => ({ itemId: "test-item", expectedLatestRevisionId: null,
  typeRevisionId: "attribute_type_length_v1", title: "Body length", description: "", newGroup: { label: "Device", context: "device" },
  payload: { kind: "quantity", value: 52.5, unit: "mm" }, source: { kind: "manufacturer", reference: "Synthetic source" }, ...patch });
const classify = (db: PrismaClient) => updateItemEngineeringClassification({ itemId: "test-item", expectedLatestRevisionId: null, deviceType: "breaker" }, db);
afterEach(async () => { await Promise.all(clients.splice(0).map(db => db.$disconnect())); });
describe("Individual Item attributes", () => {
  it("requires an explicit Device Type before the first attribute and preserves the unclassified Item", async () => {
    const db = await fixture();
    const before = await db.bomItem.findUniqueOrThrow({ where: { id: "test-item" }, select: { category: true, updatedAt: true } });
    await expect(saveItemAttribute(input(), db)).rejects.toMatchObject({ code: "VALIDATION", message: "Choose Device Type in Edit details before adding attributes." });
    expect(await db.bomItemEngineeringRevision.count()).toBe(0);
    expect(await db.bomItem.findUniqueOrThrow({ where: { id: "test-item" }, select: { category: true, updatedAt: true } })).toEqual(before);
  });
  it("projects the maximum legacy groups and long structured conditions without losing data", () => {
    const conditions = "x".repeat(2000);
    const terminalKeys = Array.from({ length: 256 }, (_, i) => "terminal-" + i + "-".repeat(145));
    const legacy = itemEngineeringProfileV1Schema.parse({ version: 1, deviceType: "breaker",
      groups: Array.from({ length: 32 }, (_, i) => ({ key: "group-" + i, label: "Group " + i, context: "device", attributes: { version: 1, values: [] } })),
      shortCircuitRatings: [{ key: "rating", groupKey: "group-0", ratingType: "sccr", designation: "Rating", currentKa: 6, voltageV: 400, supplyNature: "ac", conditions, source: { kind: "manufacturer", reference: "Sheet 2" } }],
      terminalConductorRanges: [{ key: "terminals", terminalKeys, conductorClass: "solid", termination: "bare", minimumMm2: 1, maximumMm2: 6, maximumConductors: 1, source: { kind: "manufacturer" } }]
    });
    const original = JSON.stringify(legacy);
    const projected = projectItemAttributeProfile(legacy);
    expect(projected.groups).toHaveLength(33);
    expect(projected.entries[0].payload).toMatchObject({ conditions });
    expect(projected.entries[1].payload).toMatchObject({ terminalKeys });
    expect(JSON.stringify(legacy)).toBe(original);
  });
  it("seeds idempotently, versions edits, enforces unique names and retains immutable definitions", async () => {
    const db = await fixture();
    const count = await db.engineeringAttributeType.count();
    const initial = await getAttributeTypeRevision("attribute_type_length_v1", db);
    const updated = await saveAttributeType({ typeId: initial.typeId, expectedRevision: 1, definition: { ...initial.definition, label: "Overall length" } }, db);
    await ensureItemEngineeringStorage(db);
    expect(await db.engineeringAttributeType.count()).toBe(count);
    expect((await getAttributeTypeRevision(initial.revisionId, db)).definition.label).toBe("Length");
    expect(updated.revisionNumber).toBe(2);
    await expect(saveAttributeType({ definition: { ...initial.definition, label: " overall LENGTH " } }, db)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(db.engineeringAttributeTypeRevision.update({ where: { id: initial.revisionId }, data: { definitionJson: "{}" } })).rejects.toThrow();
    await expect(saveAttributeType({ typeId: initial.typeId, expectedRevision: 2, definition: { ...updated.definition, valueKind: "text", engineeringDimension: undefined, allowedUnits: undefined, canonicalUnit: undefined } }, db)).rejects.toThrow("Create a new type");
  });
  it("saves only one row, preserves guidance, rejects stale saves and keeps history on removal", async () => {
    const db = await fixture();
    const classified = await classify(db);
    const first = await saveItemAttribute(input({ expectedLatestRevisionId: classified.revisionId }), db);
    const note = await saveItemEngineerNote({ itemId: "test-item", expectedLatestRevisionId: first.revisionId, notes: "Preserve this note", image: null }, db);
    const second = await saveItemAttribute(input({ expectedLatestRevisionId: note.revision!.id, entryId: first.profile.entries[0].id,
      newGroup: undefined, groupKey: first.profile.groups[0].key, payload: { kind: "quantity", value: 55, unit: "mm" } }), db);
    expect((await getItemEngineeringRevision(second.revisionId!, db))!.noteIds).toEqual([note.note.id]);
    expect((await getItemEngineeringRevision(first.revisionId!, db))!.profile).toEqual(first.profile);
    await expect(saveItemAttribute(input({ expectedLatestRevisionId: first.revisionId }), db)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    const removed = await removeItemAttribute({ itemId: "test-item", expectedLatestRevisionId: second.revisionId, entryId: second.profile.entries[0].id }, db);
    expect(removed.profile.entries).toEqual([]);
    expect((await getItemEngineeringRevision(second.revisionId!, db))!.profile).toEqual(second.profile);
  });
  it("retains retired pinned types but blocks new assignments and incompatible classification changes", async () => {
    const db = await fixture();
    const classified = await classify(db);
    const first = await saveItemAttribute(input({ expectedLatestRevisionId: classified.revisionId }), db);
    await setAttributeTypeStatus({ typeId: "attribute_type_length", expectedRevision: 1, expectedStatus: "active", status: "retired" }, db);
    const edited = await saveItemAttribute(input({ expectedLatestRevisionId: first.revisionId, entryId: first.profile.entries[0].id, newGroup: undefined,
      groupKey: first.profile.groups[0].key, title: "Retained type" }), db);
    await expect(saveItemAttribute(input({ expectedLatestRevisionId: edited.revisionId }), db)).rejects.toThrow("retired");
    expect((await listAttributeTypes({ search: "Length" }, db)).items.some(type => type.typeId === "attribute_type_length")).toBe(false);
    await db.$executeRawUnsafe("UPDATE BomItem SET status='archived' WHERE id='test-item'");
    await expect(updateItemEngineeringClassification({ itemId: "test-item", expectedLatestRevisionId: edited.revisionId, deviceType: "breaker" }, db)).rejects.toMatchObject({ code: "ARCHIVED" });
  });
  it.each([
    { kind: "quantity", value: 2, unit: "V" }, { kind: "quantity", value: -1, unit: "mm" },
    { kind: "quantity", value: "", unit: "mm" }
  ])("rejects invalid values without creating a revision: %j", async payload => {
    const db = await fixture();
    const classified = await classify(db);
    await expect(saveItemAttribute(input({ expectedLatestRevisionId: classified.revisionId, payload }), db)).rejects.toThrow();
    expect(await db.bomItemEngineeringRevision.count()).toBe(1);
  });
  it("converts a legacy profile only on edit without rewriting the original hash or conditions", async () => {
    const db = await fixture();
    const original = (await createItemEngineeringRevision({ itemId: "test-item", expectedLatestRevisionId: null, noteIds: [], documentIds: [],
      profile: { version: 1, deviceType: "breaker", groups: [{ key: "device", label: "Device", context: "device", attributes: { version: 1, values: [
        { definitionKey: "rated_current", definitionVersion: 1, kind: "quantity", value: 20, unit: "A", source: { kind: "manufacturer" } }
      ] } }], terminalConductorRanges: [{ key: "range", terminalKeys: ["L1", "T1"], conductorClass: "solid", termination: "bare",
        minimumMm2: 1, maximumMm2: 6, maximumConductors: 1, source: { kind: "manufacturer" } }],
      shortCircuitRatings: [{ key: "rating", groupKey: "device", ratingType: "breaking_capacity", designation: "Test rating", currentKa: 6,
        voltageV: 400, supplyNature: "ac", conditions: "Synthetic condition", source: { kind: "manufacturer", reference: "Sheet 2" } }]
    } }, db)).revision;
    const bytes = await db.bomItemEngineeringRevision.findUniqueOrThrow({ where: { id: original.id } });
    const view = await loadItemAttributeWorkspace("test-item", db);
    expect(view.profile.entries).toHaveLength(3);
    expect(projectItemAttributeProfile(original.profile)).toEqual(view.profile);
    const saved = await saveItemAttribute(input({ expectedLatestRevisionId: original.id, newGroup: undefined, groupKey: "device" }), db);
    expect(saved.profile.entries).toHaveLength(4);
    expect(await db.bomItemEngineeringRevision.findUniqueOrThrow({ where: { id: original.id } })).toEqual(bytes);
    expect(saved.profile.entries.slice(0, 3)).toEqual(view.profile.entries);
  });
  it("custom types do not fabricate facts and forged snapshots cannot be saved", async () => {
    const db = await fixture();
    const type = await saveAttributeType({ definition: { ...ATTRIBUTE_TYPE_SEEDS.find(seed => seed.analysisKey === "length")!.definition, label: "Custom reach" } }, db);
    const classified = await classify(db);
    const saved = await saveItemAttribute(input({ expectedLatestRevisionId: classified.revisionId, typeRevisionId: type.revisionId }), db);
    const facts = resolveItemEngineeringProfile(saved.profile);
    expect(facts.ok && facts.groups.flatMap(group => group.facts)).toEqual([]);
    const forged = structuredClone(saved.profile); forged.entries[0].type.analysisKey = "nominal_voltage";
    await expect(saveItemWorkspaceProfile({ itemId: "test-item", expectedLatestRevisionId: saved.revisionId, profile: forged }, db)).rejects.toMatchObject({ code: "INTEGRITY" });
  });
  it("never converts a blank popup number into zero", () => {
    const definition = ATTRIBUTE_TYPE_SEEDS.find(type => type.analysisKey === "length")!.definition;
    expect(() => buildPayload(definition, { value: "", unit: "mm" })).toThrow("valid");
  });
  it("normalizes numeric limits and rejects duplicate attributes in the same context", async () => {
    const db = await fixture();
    const definition = ATTRIBUTE_TYPE_SEEDS.find(seed => seed.analysisKey === "length")!.definition;
    const type = await saveAttributeType({ definition: { ...definition, label: "Minimum length", minimum: 10 } }, db);
    const classified = await classify(db);
    await expect(saveItemAttribute(input({ expectedLatestRevisionId: classified.revisionId, typeRevisionId: type.revisionId, payload: { kind: "quantity", value: .5, unit: "cm" } }), db)).rejects.toThrow();
    const first = await saveItemAttribute(input({ expectedLatestRevisionId: classified.revisionId, typeRevisionId: type.revisionId, payload: { kind: "quantity", value: 2, unit: "cm" } }), db);
    await expect(saveItemAttribute(input({ expectedLatestRevisionId: first.revisionId, typeRevisionId: type.revisionId,
      newGroup: undefined, groupKey: first.profile.groups[0].key }), db)).rejects.toThrow("already assigned");
    const second = await saveItemAttribute(input({ expectedLatestRevisionId: first.revisionId, typeRevisionId: type.revisionId,
      newGroup: { label: "Output", context: "supply_output" } }), db);
    expect(second.profile.entries).toHaveLength(2);
  });
  it("blocks incompatible classification changes without removing existing entries", async () => {
    const db = await fixture();
    const classified = await updateItemEngineeringClassification({ itemId: "test-item", expectedLatestRevisionId: null, deviceType: "breaker" }, db);
    const saved = await saveItemAttribute(input({ expectedLatestRevisionId: classified.revisionId, typeRevisionId: "attribute_type_pole_count_v1",
      payload: { kind: "number", value: 3 } }), db);
    await expect(updateItemEngineeringClassification({ itemId: "test-item", expectedLatestRevisionId: saved.revisionId, deviceType: "instrument" }, db)).rejects.toThrow("incompatible");
    expect((await loadItemAttributeWorkspace("test-item", db)).profile).toEqual(saved.profile);
  });
});
