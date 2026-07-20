import { describe, expect, it } from "vitest";
import { generateDrawingBom } from "../logic/use_cases/generate-drawing-bom";
import {
  buildGeneratedBomViewUrl,
  parseGeneratedBomViewSearchParams,
  selectGeneratedBomView
} from "../logic/services/generated-bom-view";
import { createBomGenerationFixture } from "./fixtures/bom-generation-fixtures";

describe("generated BOM views", () => {
  const bom = generateDrawingBom(
    createBomGenerationFixture(120, { warningHeavy: true })
  );

  it("parses defaults and view-specific page-size bounds", () => {
    expect(parseGeneratedBomViewSearchParams({})).toEqual({
      view: "consolidated",
      page: 1,
      pageSize: 50
    });
    expect(
      parseGeneratedBomViewSearchParams({
        view: "assembly",
        page: "2",
        pageSize: "500"
      })
    ).toEqual({ view: "assembly", page: 2, pageSize: 25 });
  });

  it("serializes only the selected bounded view", () => {
    const assembly = selectGeneratedBomView(bom, {
      view: "assembly",
      page: 1,
      pageSize: 25
    });
    const consolidated = selectGeneratedBomView(bom, {
      view: "consolidated",
      page: 1,
      pageSize: 50
    });

    expect(assembly.view).toBe("assembly");
    if (assembly.view === "assembly") expect(assembly.assemblies).toHaveLength(25);
    expect("consolidatedLines" in assembly).toBe(false);
    expect(consolidated.view).toBe("consolidated");
    if (consolidated.view === "consolidated") {
      expect(consolidated.consolidatedLines[0].sourceAssetPreview).toHaveLength(8);
      expect(consolidated.consolidatedLines[0].sourceAssetCount).toBe(120);
    }
    expect("assemblies" in consolidated).toBe(false);
  });

  it("summarizes warning codes and clamps out-of-range pages", () => {
    const review = selectGeneratedBomView(bom, {
      view: "review",
      page: 999,
      pageSize: 50
    });

    expect(review.page).toBe(review.totalPages);
    expect(review.warningSummary).toEqual([
      { code: "archived_item", count: 120 },
      { code: "manual_quantity_required", count: 120 }
    ]);
  });

  it("builds canonical URLs without default parameters", () => {
    expect(buildGeneratedBomViewUrl({ drawingId: "drawing_1", view: "consolidated" })).toBe("/bom?drawingId=drawing_1");
    expect(buildGeneratedBomViewUrl({ drawingId: "drawing_1", view: "assembly", page: 2 })).toBe("/bom?drawingId=drawing_1&view=assembly&page=2");
  });
});
