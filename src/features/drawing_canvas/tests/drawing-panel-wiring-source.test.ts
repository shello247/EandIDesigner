import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  drawingPackageModelSchema
} from "../data/schema";
import { createPanelEnclosurePlacement } from "../logic/services/drawing-asset-containment";
import { createBackplanePlacement } from "../logic/services/drawing-backplane-layouts";
import { createAndPlaceStructuredTerminalStrip } from "../logic/commands/drawing-structured-terminal-strip-commands";
import { buildDrawingPanelWiringSource } from "../logic/services/drawing-panel-wiring-source";
import { createTerminalBlockPlacement } from "../logic/services/drawing-terminal-blocks";
import type { ApprovedDrawingSymbol } from "../types";

describe("drawing panel-wiring source", () => {
  it("projects canonical physical panel geometry without persisting derived data", () => {
    const base = createDefaultDrawingModel();
    const sheet = base.sheets[0];
    const panel = createPanelEnclosurePlacement({
      model: base,
      activeSheet: sheet,
      assetId: "asset_panel",
      tag: "PLC-001",
      title: "PLC Panel",
      x: 25,
      y: 20
    });
    const backplane = {
      ...createBackplanePlacement({
        panelPlacement: panel,
        id: "backplane_layout"
      }),
      layoutDimensions: { lengthMm: 600, widthMm: 600 }
    };
    const terminal = {
      ...createTerminalBlockPlacement({
        model: base,
        activeSheet: sheet,
        assetId: "asset_terminal",
        tag: "TB-101",
        x: 80,
        y: 70
      }),
      containerAssetId: "asset_panel",
      layoutKind: "layout_helper" as const,
      layoutParentId: backplane.id,
      layoutPosition: { xMm: 42, yMm: 88 },
      layoutDimensions: { lengthMm: 5.2, widthMm: 50 },
      rotation: 90
    };
    const model = drawingPackageModelSchema.parse({
      ...base,
      assets: [
        {
          id: "asset_panel",
          tag: "PLC-001",
          type: "panel",
          title: "PLC Panel"
        },
        {
          id: "asset_terminal",
          tag: "TB-101",
          type: "terminal_block",
          title: "Terminal Block",
          symbolId: terminal.symbolId,
          versionId: terminal.versionId
        }
      ],
      sheets: [
        {
          ...sheet,
          placements: [panel, backplane, terminal]
        }
      ]
    });
    const before = structuredClone(model);

    const source = buildDrawingPanelWiringSource(model, []);
    const occurrence = source.sheets[0].occurrences.find(
      (candidate) => candidate.assetId === "asset_terminal"
    );

    expect(occurrence?.panelLayout).toMatchObject({
      layoutKind: "layout_helper",
      backplanePlacementId: "backplane_layout",
      xMm: 42,
      yMm: 88,
      widthMm: 5.2,
      heightMm: 50,
      rotationDeg: 90,
      technicalKind: "terminal_block"
    });
    expect(model).toEqual(before);
  });

  it("projects a fused strip member's load side as external and supply side as internal", () => {
    const fuseTerminalSymbol: ApprovedDrawingSymbol = {
      symbolId: "dinkle_dk4_tf_5x20",
      symbolKey: "dinkle_dk4_tf_5x20",
      displayName: "Fuse Terminal Block (5x20)",
      category: "terminal_block",
      versionId: "dinkle_dk4_tf_5x20_v1",
      versionNumber: 1,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 31 229"/>',
      metadata: {
        symbolKey: "dinkle_dk4_tf_5x20",
        displayName: "Fuse Terminal Block (5x20)",
        category: "terminal_block",
        layoutUsage: "both",
        physicalWidthMm: 8,
        physicalHeightMm: 55,
        mountingType: "din_rail",
        terminalStripCapability: {
          role: "electrical",
          railDatumMm: 27.5
        },
        viewBox: { x: 0, y: 0, width: 31, height: 229 },
        anchors: [
          { key: "2", x: 15.5, y: 200.5, kind: "terminal" },
          { key: "1", x: 15.5, y: 16.5, kind: "terminal" }
        ],
        terminals: [
          {
            key: "2",
            label: "2",
            function:
              "Fuse circuit terminal 2; recommended fused load/output side",
            anchorKey: "2",
            panelSide: "external",
            requiredForWiring: true
          },
          {
            key: "1",
            label: "1",
            function: "Fuse circuit terminal 1; recommended line/supply side",
            anchorKey: "1",
            panelSide: "internal",
            requiredForWiring: true
          }
        ]
      }
    };
    const model = createDefaultDrawingModel();
    const created = createAndPlaceStructuredTerminalStrip({
      model,
      symbols: [fuseTerminalSymbol],
      input: {
        sheetId: model.sheets[0].id,
        assetId: "asset_tb_104",
        placementId: "placement_tb_104",
        name: "JB002 field termination block",
        strip: {
          kind: "structured_terminal_strip",
          nextMemberNumber: 13,
          members: [
            {
              id: "member_fuse",
              token: "M12",
              symbolId: fuseTerminalSymbol.symbolId,
              versionId: fuseTerminalSymbol.versionId,
              role: "electrical",
              designation: "11"
            }
          ]
        },
        x: 40,
        y: 50
      }
    });

    const source = buildDrawingPanelWiringSource(created.model, [
      fuseTerminalSymbol
    ]);
    const occurrence = source.sheets[0].occurrences.find(
      (candidate) => candidate.assetId === "asset_tb_104"
    );
    const terminalsByKey = new Map(
      occurrence?.terminals.map((terminal) => [terminal.terminalKey, terminal])
    );

    expect(terminalsByKey.get("M12.2")).toMatchObject({
      function: "Fuse circuit terminal 2; recommended fused load/output side",
      supportedSides: ["external"],
      requiredSides: ["external"],
      status: "resolved"
    });
    expect(terminalsByKey.get("M12.1")).toMatchObject({
      function: "Fuse circuit terminal 1; recommended line/supply side",
      supportedSides: ["internal"],
      requiredSides: ["internal"],
      status: "resolved"
    });
    expect(created.model.panelWiring?.internalWires ?? []).toEqual([]);
  });
});
