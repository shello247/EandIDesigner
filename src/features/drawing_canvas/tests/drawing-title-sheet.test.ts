import { describe, expect, it } from "vitest";
import { createDefaultDrawingModel, createDefaultDrawingSheet, createTitleSheet, drawingModelSchema, parseDrawingModelJson, stringifyDrawingModel, titleSheetDraftSchema } from "../data/schema";
import { canConvertFirstSheetToTitleSheet, convertFirstSheetToTitleSheet } from "../logic/commands/drawing-title-sheet-commands";
import { addDrawingSheet, addSectionTitlePage, moveSheet, moveSheetToEnd, toSheetCanvasModel, updatePackageTitleBlock } from "../logic/commands/drawing-sheet-commands";
import { moveDrawingSection, moveSheetWithinSection, moveSheetToSectionEnd, moveSheetToDrawingSection } from "../logic/commands/drawing-section-commands";
import { buildDrawingSectionIndex } from "../logic/services/drawing-sections";
import { getDrawingSheetPresentation } from "../logic/services/drawing-sheet-presentation";
import { buildSheetLoaderRows } from "../logic/services/sheet-loader-rows";
import { getSymbolLibraryContextForSheetKind } from "../logic/services/symbol-library-context";
import { renderDrawingToSvg } from "../logic/services/drawing-svg-renderer";
import { createPanelWiringSource } from "../api/panel-wiring-contracts";
import { panelWiringSourcePackageSchema } from "@/features/drawing_panel_wiring/api/public";
import { pasteClipboardToSheet } from "../logic/services/drawing-clipboard-commands";

describe("package Title Sheet", () => {
  it("creates a cover only when requested by new-package creation, not legacy parsing", () => {
    const model = createDefaultDrawingModel({ withTitleSheet: true });
    expect(model.sheets).toHaveLength(1);
    expect(model.sheets[0]).toMatchObject({ id: "sheet_1", name: "Title Sheet", kind: "title_sheet", placements: [], connections: [], annotations: [] });
    expect(parseDrawingModelJson(stringifyDrawingModel(model))).toEqual(model);
    const legacy = createDefaultDrawingModel();
    const before = JSON.stringify(legacy);
    expect(parseDrawingModelJson(before)).toEqual(legacy);
    expect(JSON.stringify(legacy)).toBe(before);
    expect(legacy.sheets[0].kind).toBe("drawing");
  });

  it("preserves V1 drawing content and does not auto-convert it", () => {
    const old = { version: 1, ...toSheetCanvasModel(createDefaultDrawingModel(), "sheet_1") };
    const read = parseDrawingModelJson(JSON.stringify(old));
    expect(read.sheets[0].kind).toBe("drawing");
    expect(toSheetCanvasModel(read, "sheet_1")).toEqual({ sheet: old.sheet, placements: old.placements, connections: old.connections, annotations: old.annotations });
  });

  it("converts explicitly without changing sheet identity, shared metadata or other sheets", () => {
    const model = addSectionTitlePage(createDefaultDrawingModel(), { title: "Wiring" }).model;
    model.titleBlock.client = "Client";
    const before = structuredClone(model);
    const converted = convertFirstSheetToTitleSheet(model, "sheet_1");
    expect(model).toEqual(before);
    expect(converted.sheets[0]).toEqual(createTitleSheet());
    expect(converted.titleBlock).toBe(model.titleBlock);
    expect(converted.assets).toBe(model.assets);
    expect(converted.sheets[1]).toBe(model.sheets[1]);
    expect(canConvertFirstSheetToTitleSheet(converted, "sheet_1")).toBe(false);
  });

  it.each(["description", "annotations", "placements", "connections", "panelDrawingContext", "sectionTitlePage"] as const)("refuses conversion when first sheet has %s", key => {
    const model = createDefaultDrawingModel();
    Object.assign(model.sheets[0], { [key]: key === "description" ? "Keep this" : ["annotations", "placements", "connections"].includes(key) ? [{}] : {} });
    expect(canConvertFirstSheetToTitleSheet(model, "sheet_1")).toBe(false);
    expect(() => convertFirstSheetToTitleSheet(model, "sheet_1")).toThrow("blank first");
  });

  it("refuses non-first sheets and section dividers", () => {
    const model = addDrawingSheet(createDefaultDrawingModel()).model;
    expect(canConvertFirstSheetToTitleSheet(model, model.sheets[1].id)).toBe(false);
    model.sheets[0].kind = "section_title";
    expect(canConvertFirstSheetToTitleSheet(model, "sheet_1")).toBe(false);
  });

  it("validates unique first-position covers and rejects hidden drawing objects", () => {
    const model = createDefaultDrawingModel({ withTitleSheet: true });
    expect(drawingModelSchema.safeParse(model).success).toBe(true);
    expect(drawingModelSchema.safeParse({ ...model, sheets: [...model.sheets, createTitleSheet("second")] }).success).toBe(false);
    expect(drawingModelSchema.safeParse({ ...model, sheets: [createDefaultDrawingSheet(), createTitleSheet("second")] }).success).toBe(false);
    model.sheets[0].annotations = [{ id: "note", x: 20, y: 20, text: "Must not hide", kind: "note" }];
    expect(drawingModelSchema.safeParse(model).success).toBe(false);
  });

  it("pins the cover first across sheet and section commands without changing numbering", () => {
    let model = addDrawingSheet(createDefaultDrawingModel({ withTitleSheet: true }), "Index", { insertAt: 0 }).model;
    model = addSectionTitlePage(model, { title: "One" }, { insertAt: 0 }).model;
    model = addSectionTitlePage(model, { title: "Two" }).model;
    expect(model.sheets[0].kind).toBe("title_sheet");
    expect(moveSheet(model, "sheet_1", 1)).toBe(model);
    expect(moveSheet(model, model.sheets[1].id, -1)).toBe(model);
    expect(moveSheetToEnd(model, "sheet_1")).toBe(model);
    expect(moveSheetWithinSection(model, "sheet_1", 1)).toBe(model);
    expect(moveSheetToSectionEnd(model, "sheet_1")).toBe(model);
    expect(moveSheetToDrawingSection(model, "sheet_1", model.sheets[1].id)).toBe(model);
    const sections = buildDrawingSectionIndex(model).sections;
    const reordered = moveDrawingSection(model, sections[1].id, "first");
    expect(reordered.sheets[0]).toBe(model.sheets[0]);
    expect(buildDrawingSectionIndex(reordered).sections.map(section => section.number)).toEqual([1, 2]);
    const frontMatter = addDrawingSheet(createDefaultDrawingModel({ withTitleSheet: true })).model;
    expect(moveSheetWithinSection(frontMatter, frontMatter.sheets[1].id, -1)).toBe(frontMatter);
  });

  it("identifies the cover and excludes it from symbol placement while panel contracts still parse", () => {
    const model = createDefaultDrawingModel({ withTitleSheet: true });
    expect(getDrawingSheetPresentation(model.sheets[0]).heading).toBe("Title Sheet");
    expect(buildSheetLoaderRows(model)[0].typeLabel).toBe("Title Sheet");
    expect(getSymbolLibraryContextForSheetKind("title_sheet")).toBe("none");
    expect(panelWiringSourcePackageSchema.safeParse(createPanelWiringSource(model, [])).success).toBe(true);
  });

  it("renders all shared fields, escapes text and reflects edits without duplicate storage", () => {
    const model = updatePackageTitleBlock(createDefaultDrawingModel({ withTitleSheet: true }), {
      project: "Tank & pump", client: "Client <A>", drawingNumber: "DWG-01", revision: "B", date: "2026-09-10", preparedBy: "Designer", checkedBy: "Checker"
    });
    const render = (title: string) => renderDrawingToSvg({ model: toSheetCanvasModel(model, "sheet_1"), drawingTitle: title, sheetKind: "title_sheet", approvedSymbols: [] });
    const svg = render("Controls <script>");
    expect(svg).toContain('data-package-title-sheet="true"');
    expect(svg).not.toContain('data-section-title-page="true"');
    for (const value of ["Tank &amp; pump", "Client &lt;A&gt;", "DWG-01", "Designer", "Checker", "2026-09-10", "Controls &lt;script&gt;"]) expect(svg).toContain(value);
    expect(svg).not.toContain("<script>");
    model.titleBlock.client = "Updated client";
    expect(render("Revised title")).toContain("Updated client");
    expect(render("Revised title")).not.toContain("Client &lt;A&gt;");
    expect(model.sheets[0]).not.toHaveProperty("titleBlock");
  });

  it("shows unspecified fields and rejects invalid editor input", () => {
    const model = createDefaultDrawingModel({ withTitleSheet: true });
    expect(renderDrawingToSvg({ model: toSheetCanvasModel(model, "sheet_1"), sheetKind: "title_sheet", approvedSymbols: [] })).toContain("Unspecified");
    expect(titleSheetDraftSchema.safeParse({ title: " ", titleBlock: {} }).success).toBe(false);
    expect(titleSheetDraftSchema.safeParse({ title: "Drawing", titleBlock: { revision: "A".repeat(41) } }).success).toBe(false);
    expect(titleSheetDraftSchema.parse({ title: " Drawing ", titleBlock: { client: " Client " } })).toEqual({ title: "Drawing", titleBlock: { client: "Client" } });
  });

  it("rejects clipboard pastes into the cover without changing its model", () => {
    const model = createDefaultDrawingModel({ withTitleSheet: true });
    expect(() => pasteClipboardToSheet({ model, sheetId: "sheet_1", symbols: [], clipboard: { version: 1, sourceSheetId: "sheet_2", placements: [], annotations: [] } })).toThrow("Select a drawing sheet");
    expect(model.sheets[0]).toEqual(createTitleSheet());
  });
});
