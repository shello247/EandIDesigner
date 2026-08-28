import { describe, expect, it } from "vitest";
import { createDefaultDrawingModel, drawingModelSchema } from "../data/schema";
import {
  collectPlacementWireContextRequests,
  getPlacementConnectionDisplayMode,
  sheetHasCompleteWiringDisplay
} from "../logic/services/drawing-placement-connection-display";

describe("drawing placement connection display", () => {
  it("keeps legacy placements in sheet-only mode", () => {
    const model = createDefaultDrawingModel();
    model.sheets[0].placements.push({
      id: "placement_1",
      symbolId: "symbol_1",
      versionId: "version_1",
      role: "device",
      tag: "PLC-101",
      x: 10,
      y: 20,
      rotation: 0,
      scale: 1
    });
    const parsed = drawingModelSchema.parse(model);

    expect(
      getPlacementConnectionDisplayMode(parsed.sheets[0].placements[0])
    ).toBe("sheet_only");
    expect(parsed.sheets[0].placements[0]).not.toHaveProperty(
      "connectionDisplayMode"
    );
    expect(sheetHasCompleteWiringDisplay(parsed.sheets[0])).toBe(false);
  });

  it("resolves Detailed Panel legacy placements to external while accepting every stored mode", () => {
    const model = createDefaultDrawingModel();
    model.sheets[0].panelDrawingContext = {
      kind: "detailed_panel_wiring",
      panelAssetId: "panel_1"
    };
    model.sheets[0].placements = [
      {
        id: "placement_legacy",
        symbolId: "symbol_1",
        versionId: "version_1",
        role: "terminal_block",
        tag: "TB-101",
        x: 10,
        y: 20,
        rotation: 0,
        scale: 1
      },
      ...(
        [
          "sheet_only",
          "internal_connected",
          "external_connected",
          "all_connected"
        ] as const
      ).map((connectionDisplayMode, index) => ({
        id: `placement_${connectionDisplayMode}`,
        symbolId: `symbol_${index + 2}`,
        versionId: `version_${index + 2}`,
        role: "terminal_block" as const,
        tag: `TB-${index + 102}`,
        x: 30 + index * 20,
        y: 20,
        rotation: 0,
        scale: 1,
        connectionDisplayMode
      }))
    ];
    const parsed = drawingModelSchema.parse(model);

    expect(
      getPlacementConnectionDisplayMode(
        parsed.sheets[0].placements[0],
        parsed.sheets[0]
      )
    ).toBe("external_connected");
    expect(
      parsed.sheets[0].placements.slice(1).map((placement) =>
        getPlacementConnectionDisplayMode(placement, parsed.sheets[0])
      )
    ).toEqual([
      "sheet_only",
      "internal_connected",
      "external_connected",
      "all_connected"
    ]);
  });

  it("collects only explicitly enabled occurrences", () => {
    const model = createDefaultDrawingModel();
    model.sheets[0].placements.push(
      {
        id: "placement_all",
        symbolId: "symbol_1",
        versionId: "version_1",
        role: "device",
        tag: "PLC-101",
        x: 10,
        y: 20,
        rotation: 0,
        scale: 1,
        connectionDisplayMode: "all_connected"
      },
      {
        id: "placement_default",
        symbolId: "symbol_2",
        versionId: "version_2",
        role: "device",
        tag: "PLC-102",
        x: 30,
        y: 20,
        rotation: 0,
        scale: 1
      }
    );

    expect(sheetHasCompleteWiringDisplay(model.sheets[0])).toBe(true);
    expect(collectPlacementWireContextRequests(model)).toEqual([
      {
        sheetId: "sheet_1",
        placementId: "placement_all",
        mode: "all_connected"
      }
    ]);
  });
});
