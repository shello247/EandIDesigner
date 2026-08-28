import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  type DrawingModel
} from "../data/schema";
import {
  addDrawingSheet,
  addSectionTitlePage,
  toSheetCanvasModel
} from "../logic/commands/drawing-sheet-commands";
import {
  moveDrawingSection,
  moveSheetToDrawingSection,
  moveSheetWithinSection,
  removeSectionDivider
} from "../logic/commands/drawing-section-commands";
import {
  buildDrawingSectionIndex,
  getSectionInsertionIndex
} from "../logic/services/drawing-sections";
import { renderDrawingToSvg } from "../logic/services/drawing-svg-renderer";

function sectionedModel(): DrawingModel {
  let model = createDefaultDrawingModel();
  model = addDrawingSheet(model, "Index").model;
  model = addSectionTitlePage(model, { title: "Field Wiring" }).model;
  model = addDrawingSheet(model, "Field 1").model;
  model = addDrawingSheet(model, "Field 2").model;
  model = addSectionTitlePage(model, { title: "Panel Details" }).model;
  model = addDrawingSheet(model, "Panel 1").model;
  return model;
}

describe("drawing package sections", () => {
  it("derives front matter, sequential sections, members, and empty sections", () => {
    const model = addSectionTitlePage(sectionedModel(), {
      title: "Empty Section",
      sectionNumber: "99"
    }).model;
    const index = buildDrawingSectionIndex(model);

    expect(index.frontMatterSheetIds).toEqual(["sheet_1", "sheet_2"]);
    expect(index.sections.map((section) => ({
      number: section.number,
      title: section.title,
      members: section.memberSheetIds
    }))).toEqual([
      { number: 1, title: "Field Wiring", members: ["sheet_4", "sheet_5"] },
      { number: 2, title: "Panel Details", members: ["sheet_7"] },
      { number: 3, title: "Empty Section", members: [] }
    ]);
  });

  it("moves complete section blocks without moving front matter", () => {
    const model = sectionedModel();
    const secondSectionId = buildDrawingSectionIndex(model).sections[1].id;
    const moved = moveDrawingSection(model, secondSectionId, "first");

    expect(moved.sheets.map((sheet) => sheet.name)).toEqual([
      "Sheet 1",
      "Index",
      "Panel Details Title Page",
      "Panel 1",
      "Field Wiring Title Page",
      "Field 1",
      "Field 2"
    ]);
    expect(buildDrawingSectionIndex(moved).sections.map((section) => section.number)).toEqual([1, 2]);
  });

  it("moves member sheets within and between sections", () => {
    const model = sectionedModel();
    const index = buildDrawingSectionIndex(model);
    const reordered = moveSheetWithinSection(model, "sheet_5", -1);
    const transferred = moveSheetToDrawingSection(
      reordered,
      "sheet_5",
      index.sections[1].id
    );

    expect(reordered.sheets.map((sheet) => sheet.name)).toContain("Field 2");
    expect(
      buildDrawingSectionIndex(transferred).sections[1].memberSheetIds
    ).toEqual(["sheet_7", "sheet_5"]);
  });

  it("inserts a new section after the active section or before the first section", () => {
    const model = sectionedModel();

    expect(getSectionInsertionIndex(model, "sheet_1")).toBe(2);
    expect(getSectionInsertionIndex(model, "sheet_4")).toBe(5);
  });

  it("removes only the divider and merges members into the preceding group", () => {
    const model = sectionedModel();
    const sections = buildDrawingSectionIndex(model).sections;
    const merged = removeSectionDivider(model, sections[1].id);
    const mergedIndex = buildDrawingSectionIndex(merged);

    expect(merged.sheets.some((sheet) => sheet.name === "Panel Details Title Page")).toBe(false);
    expect(merged.sheets.some((sheet) => sheet.name === "Panel 1")).toBe(true);
    expect(mergedIndex.sections).toHaveLength(1);
    expect(mergedIndex.sections[0].memberSheetIds).toContain("sheet_7");
  });

  it("renders derived section numbers instead of legacy stored values", () => {
    const model = sectionedModel();
    const titlePage = model.sheets.find(
      (sheet) => sheet.kind === "section_title"
    )!;
    titlePage.sectionTitlePage = {
      ...titlePage.sectionTitlePage,
      sectionNumber: "99"
    };
    const membership = buildDrawingSectionIndex(model).membershipBySheetId.get(
      titlePage.id
    );
    const svg = renderDrawingToSvg({
      model: toSheetCanvasModel(model, titlePage.id),
      approvedSymbols: [],
      sheetKind: titlePage.kind,
      sectionTitlePage: titlePage.sectionTitlePage,
      derivedSectionNumber:
        membership?.kind === "section"
          ? membership.sectionNumber
          : undefined
    });

    expect(svg).toContain("SECTION 1");
    expect(svg).not.toContain("SECTION 99");
  });
});
