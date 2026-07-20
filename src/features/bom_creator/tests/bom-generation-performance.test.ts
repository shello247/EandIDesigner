import { describe, expect, it } from "vitest";
import { generateDrawingBom } from "../logic/use_cases/generate-drawing-bom";
import { buildBomGenerationContexts } from "../logic/services/bom-generation-context";
import { createBomGenerationFixture } from "./fixtures/bom-generation-fixtures";

describe("drawing BOM generation performance invariants", () => {
  it("indexes each connection once when several endpoints touch the same asset", () => {
    const fixture = createBomGenerationFixture(1);
    const connection = fixture.model.sheets[0].connections[0];
    connection.to.placementId = connection.from.placementId;
    fixture.model.sheets[0].connections.push({ ...connection });

    const contexts = buildBomGenerationContexts(fixture.model);

    expect(contexts[0].connectionCount).toBe(2);
  });

  it("generates a deterministic 2,500-asset result with stable totals", () => {
    const fixture = createBomGenerationFixture(2_500);
    const first = generateDrawingBom(fixture);
    const second = generateDrawingBom(fixture);

    expect(second).toEqual(first);
    expect(first.assemblies).toHaveLength(2_500);
    expect(first.assemblies[0].sheetRefs).toHaveLength(2);
    expect(first.assemblies[0].lines).toHaveLength(5);
    expect(first.consolidatedLines).toHaveLength(5);
    expect(first.consolidatedLines[0].sourceAssetTags).toHaveLength(2_500);
    expect(
      first.consolidatedLines.find((line) => line.itemId === "perf_item_3")
        ?.quantity
    ).toBe(5_000);
  });

  it("keeps warning order deterministic for the warning-heavy fixture", () => {
    const bom = generateDrawingBom(
      createBomGenerationFixture(500, { warningHeavy: true })
    );

    expect(bom.warnings.slice(0, 2).map((warning) => warning.code)).toEqual([
      "archived_item",
      "manual_quantity_required"
    ]);
    expect(generateDrawingBom(createBomGenerationFixture(500, { warningHeavy: true }))).toEqual(bom);
  });
});
