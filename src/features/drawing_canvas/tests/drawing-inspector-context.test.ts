import { describe, expect, it } from "vitest";
import {
  isInspectorLayoutOnlyPlacement,
  resolveDrawingInspectorContext
} from "../logic/services/drawing-inspector-context";
import type { DrawingPlacement } from "../data/schema";
import type { ApprovedDrawingSymbol } from "../types";

function panelSymbol({
  panelCategory,
  resizable
}: {
  panelCategory: ApprovedDrawingSymbol["metadata"]["panelCategory"];
  resizable?: boolean;
}): ApprovedDrawingSymbol {
  return {
    symbolId: `symbol_${panelCategory}`,
    symbolKey: `symbol_${panelCategory}`,
    displayName: `Panel ${panelCategory}`,
    category: "other",
    versionId: `version_${panelCategory}`,
    versionNumber: 1,
    svg: '<svg viewBox="0 0 10 10"/>',
    metadata: {
      symbolKey: `symbol_${panelCategory}`,
      displayName: `Panel ${panelCategory}`,
      category: "other",
      layoutUsage: "panel_layout",
      panelCategory,
      resizable,
      physicalWidthMm: 10,
      physicalHeightMm: 10,
      viewBox: { x: 0, y: 0, width: 10, height: 10 },
      anchors: [],
      terminals: []
    }
  };
}

describe("drawing inspector context", () => {
  it("returns the empty state when nothing is selected", () => {
    expect(
      resolveDrawingInspectorContext({
        selection: { placementIds: [], annotationIds: [] }
      })
    ).toEqual({ kind: "empty" });
  });

  it("resolves a single placement", () => {
    expect(
      resolveDrawingInspectorContext({
        selection: { placementIds: ["pl_1"], annotationIds: [] }
      })
    ).toEqual({ kind: "placement", placementId: "pl_1" });
  });

  it("resolves a single annotation", () => {
    expect(
      resolveDrawingInspectorContext({
        selection: { placementIds: [], annotationIds: ["ann_1"] }
      })
    ).toEqual({ kind: "annotation", annotationId: "ann_1" });
  });

  it("resolves a selected connection before an empty canvas selection", () => {
    expect(
      resolveDrawingInspectorContext({
        selection: { placementIds: [], annotationIds: [] },
        selectedConnectionId: "conn_1"
      })
    ).toEqual({ kind: "connection", connectionId: "conn_1" });
  });

  it("suppresses individual editing for multiple selected objects", () => {
    expect(
      resolveDrawingInspectorContext({
        selection: {
          placementIds: ["pl_1"],
          annotationIds: ["ann_1"]
        },
        selectedConnectionId: "conn_1"
      })
    ).toEqual({
      kind: "multiple",
      placementCount: 1,
      annotationCount: 1
    });
  });

  it("keeps fixed-size panel equipment editable while excluding layout material", () => {
    const placement: DrawingPlacement = {
      id: "pl_1",
      assetId: "asset_1",
      symbolId: "symbol_protection",
      versionId: "version_protection",
      role: "device",
      tag: "MCB-101",
      x: 10,
      y: 10,
      rotation: 0,
      scale: 1,
      layoutKind: "layout_helper"
    };

    expect(
      isInspectorLayoutOnlyPlacement(
        placement,
        panelSymbol({ panelCategory: "protection", resizable: false })
      )
    ).toBe(false);
    expect(
      isInspectorLayoutOnlyPlacement(
        placement,
        panelSymbol({ panelCategory: "rail", resizable: true })
      )
    ).toBe(true);
  });
});
