import { describe, expect, it } from "vitest";
import { createDrawingActionMeasurement } from "../drawing-performance-audit/browser-metrics";

describe("drawing action measurement contract", () => {
  it("keeps settled interaction time separate from correlated calculation stages", () => {
    const operations = [
      { name: "panel.graph", durationMs: 12, attributes: { actionId: "select:4" } },
      { name: "canvas.svg", durationMs: 4, attributes: { actionId: "previous:3" } }
    ];
    const result = createDrawingActionMeasurement({
      actionId: "select:4", settledInteractionMs: 36, automationWallMs: 41,
      snapshot: { operations, counts: { "panel.graph": { count: 1 } } }
    });
    expect(result.settledInteractionMs).toBe(36);
    expect(result.elapsedMs).toBe(36);
    expect(result.automationWallMs).toBe(41);
    expect(result.calculationStages).toEqual([operations[0]]);
    expect(result.operations).toBe(operations);
  });
});
