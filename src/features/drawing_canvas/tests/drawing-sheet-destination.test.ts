import { describe, expect, it } from "vitest";
import { createDefaultDrawingModel } from "../data/schema";
import { addDrawingSheet, addSectionTitlePage } from "../logic/commands/drawing-sheet-commands";
import { buildDrawingSectionIndex } from "../logic/services/drawing-sections";
import { newDrawingSectionSchema, prepareWorkingSheetDestination, workingSheetDestinationSchema } from "../logic/services/drawing-sheet-destination";

describe("interactive working-sheet destinations", () => {
  it.each([undefined, { kind: "existing", sectionId: "" }, { kind: "new", title: " " }, { kind: "new", title: "x".repeat(161) }, { kind: "front_matter" }])("rejects missing or invalid destinations: %j", input => {
    const model = createDefaultDrawingModel();
    const before = structuredClone(model);
    expect(workingSheetDestinationSchema.safeParse(input).success).toBe(false);
    expect(() => prepareWorkingSheetDestination(model, input)).toThrow(/Choose/);
    expect(model).toEqual(before);
  });

  it("rejects a deleted section or a regular sheet ID against the current model", () => {
    const model = createDefaultDrawingModel();
    for (const sectionId of ["deleted-section", model.sheets[0].id, "front_matter"]) {
      expect(() => prepareWorkingSheetDestination(model, { kind: "existing", sectionId })).toThrow(/no longer available/);
    }
  });

  it("appends a named section without adopting or changing legacy engineering content", () => {
    const model = createDefaultDrawingModel({ withTitleSheet: true });
    const legacy = addDrawingSheet(model, "Existing Layout").model;
    legacy.sheets[1].annotations.push({ id: "note", kind: "note", x: 20, y: 30, text: "Keep this" });
    const before = structuredClone(legacy);
    const prepared = prepareWorkingSheetDestination(legacy, { kind: "new", title: "  Panel Layout  " });
    const result = addDrawingSheet(prepared.model, "Mounting Layout", { insertAt: prepared.insertAt });
    const index = buildDrawingSectionIndex(result.model);
    expect(legacy).toEqual(before);
    expect(result.model.sheets.slice(0, 2)).toEqual(before.sheets);
    expect(index.frontMatterSheetIds).toEqual(before.sheets.map(sheet => sheet.id));
    expect(index.sections).toHaveLength(1);
    expect(index.sections[0]).toMatchObject({ id: prepared.sectionId, number: 1, title: "Panel Layout", memberSheetIds: [result.sheetId] });
    expect(result.model.assets).toEqual(before.assets);
    expect(result.model.titleBlock).toEqual(before.titleBlock);
  });

  it("inserts at the chosen section end and preserves every other section and sheet", () => {
    const first = addSectionTitlePage(createDefaultDrawingModel({ withTitleSheet: true }), { title: "Layouts" });
    const member = addDrawingSheet(first.model, "Layout");
    const second = addSectionTitlePage(member.model, { title: "Wiring" });
    const before = structuredClone(second.model);
    const prepared = prepareWorkingSheetDestination(second.model, { kind: "existing", sectionId: first.sheetId });
    expect(prepared.model).toBe(second.model);
    const added = addDrawingSheet(prepared.model, "Extra Layout", { insertAt: prepared.insertAt });
    expect(second.model).toEqual(before);
    expect(added.model.sheets.map(sheet => sheet.id)).toEqual([...before.sheets.slice(0, 3).map(sheet => sheet.id), added.sheetId, second.sheetId]);
    expect(buildDrawingSectionIndex(added.model).sections.map(section => section.number)).toEqual([1, 2]);
  });

  it("requires a real section title but permits a generated page name and empty subtitle", () => {
    expect(newDrawingSectionSchema.parse({ title: " Field Wiring ", name: "", subtitle: "" })).toEqual({ title: "Field Wiring", name: "", subtitle: "" });
    expect(newDrawingSectionSchema.safeParse({ title: " " }).success).toBe(false);
    expect(newDrawingSectionSchema.safeParse({ title: "Valid", name: "x".repeat(121) }).success).toBe(false);
  });
});
