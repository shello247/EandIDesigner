import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  drawingPackageModelSchema
} from "../data/schema";
import { buildPackageConnectivityGraph } from "@/features/drawing_panel_wiring/api/public";
import { createPanelEnclosurePlacement } from "../logic/services/drawing-asset-containment";
import { createBackplanePlacement } from "../logic/services/drawing-backplane-layouts";
import { createAndPlaceStructuredTerminalStrip } from "../logic/commands/drawing-structured-terminal-strip-commands";
import { buildDrawingPanelWiringSource } from "../logic/services/drawing-panel-wiring-source";
import { createTerminalBlockPlacement } from "../logic/services/drawing-terminal-blocks";
import type { ApprovedDrawingSymbol } from "../types";

describe("drawing panel-wiring source", () => {
  it("resolves approved cable terminals and their permanent continuity", () => {
    const cableSymbol: ApprovedDrawingSymbol = {
      symbolId: "cable_symbol",
      symbolKey: "cable_symbol",
      displayName: "Two-core cable",
      category: "cable_assembly",
      versionId: "cable_symbol_v1",
      versionNumber: 1,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"/>',
      metadata: {
        symbolKey: "cable_symbol",
        displayName: "Two-core cable",
        category: "cable_assembly",
        viewBox: { x: 0, y: 0, width: 100, height: 40 },
        anchors: [
          { key: "CORE01_A", x: 0, y: 20, kind: "terminal" },
          { key: "CORE01_B", x: 100, y: 20, kind: "terminal" }
        ],
        terminals: [
          {
            key: "CORE01_A",
            label: "Core 1 end A",
            anchorKey: "CORE01_A",
            panelSide: "single",
          },
          {
            key: "CORE01_B",
            label: "Core 1 end B",
            anchorKey: "CORE01_B",
            panelSide: "single",
          }
        ],
        electricalTopology: {
          version: 1,
          permanentContinuityGroups: [
            {
              key: "core_01",
              label: "Core 1",
              terminalKeys: ["CORE01_A", "CORE01_B"]
            }
          ]
        }
      }
    };
    const base = createDefaultDrawingModel();
    const model = drawingPackageModelSchema.parse({
      ...base,
      assets: [
        {
          id: "asset_cable",
          tag: "C-101",
          type: "cable",
          title: "Two-core cable",
          symbolId: cableSymbol.symbolId,
          versionId: cableSymbol.versionId
        }
      ],
      sheets: [
        {
          ...base.sheets[0],
          placements: [
            {
              id: "placement_cable",
              assetId: "asset_cable",
              symbolId: cableSymbol.symbolId,
              versionId: cableSymbol.versionId,
              role: "cable_assembly",
              tag: "C-101",
              x: 100,
              y: 100,
              rotation: 0,
              scale: 1
            }
          ]
        }
      ]
    });

    const source = buildDrawingPanelWiringSource(model, [cableSymbol]);
    const occurrence = source.sheets[0].occurrences[0];
    const graph = buildPackageConnectivityGraph(source);

    expect(occurrence).toMatchObject({
      role: "cable_assembly",
      terminalResolutionStatus: "resolved",
      electricalTopology: {
        permanentContinuityGroups: [
          { terminalKeys: ["CORE01_A", "CORE01_B"] }
        ]
      }
    });
    expect(occurrence.terminals.map((terminal) => terminal.terminalKey)).toEqual([
      "CORE01_A",
      "CORE01_B"
    ]);
    expect(
      graph.findings.filter(
        (finding) => finding.code === "registry_topology_missing_terminal"
      )
    ).toEqual([]);
  });

  it("keeps graphics without wiring metadata out of terminal analysis", () => {
    const graphicSymbol: ApprovedDrawingSymbol = {
      symbolId: "graphic_symbol",
      symbolKey: "graphic_symbol",
      displayName: "Drawing graphic",
      category: "other",
      versionId: "graphic_symbol_v1",
      versionNumber: 1,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"/>',
      metadata: {
        symbolKey: "graphic_symbol",
        displayName: "Drawing graphic",
        category: "other",
        viewBox: { x: 0, y: 0, width: 100, height: 40 },
        anchors: [],
        terminals: []
      }
    };
    const base = createDefaultDrawingModel();
    const model = drawingPackageModelSchema.parse({
      ...base,
      sheets: [
        {
          ...base.sheets[0],
          placements: [
            {
              id: "placement_graphic",
              symbolId: graphicSymbol.symbolId,
              versionId: graphicSymbol.versionId,
              role: "other",
              tag: "GRAPHIC-1",
              x: 100,
              y: 100,
              rotation: 0,
              scale: 1
            }
          ]
        }
      ]
    });

    const source = buildDrawingPanelWiringSource(model, [graphicSymbol]);

    expect(source.sheets[0].occurrences[0]).toMatchObject({
      terminalResolutionStatus: "not_applicable",
      terminals: []
    });
  });

  it("classifies panel connection views as derived references", () => {
    const base = createDefaultDrawingModel();
    const model = drawingPackageModelSchema.parse({
      ...base,
      assets: [
        {
          id: "asset_panel",
          tag: "PLC-001",
          type: "panel",
          title: "PLC Panel",
          symbolId: "__generated_panel_enclosure__",
          versionId: "generated_panel_enclosure_v1"
        }
      ],
      sheets: [
        {
          ...base.sheets[0],
          placements: [
            {
              id: "panel_connection_view",
              assetId: "asset_panel",
              symbolId: "__generated_panel_connection_view__",
              versionId: "generated_panel_connection_view_v1",
              role: "enclosure",
              tag: "PLC-001",
              x: 20,
              y: 20,
              rotation: 0,
              scale: 1,
              panelConnectionView: {
                kind: "schematic_reference",
                sourceBackplanePlacementId: "backplane_source",
                displayWidth: 110,
                displayHeight: 120
              }
            }
          ]
        }
      ]
    });

    const source = buildDrawingPanelWiringSource(model, []);

    expect(source.sheets[0].occurrences[0]).toMatchObject({
      assetId: "asset_panel",
      occurrenceKind: "derived_reference",
      symbolId: "__generated_panel_connection_view__",
      versionId: "generated_panel_connection_view_v1"
    });
  });

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
          },
          {
            key: "1",
            label: "1",
            function: "Fuse circuit terminal 1; recommended line/supply side",
            anchorKey: "1",
            panelSide: "internal",
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
      status: "resolved"
    });
    expect(terminalsByKey.get("M12.1")).toMatchObject({
      function: "Fuse circuit terminal 1; recommended line/supply side",
      supportedSides: ["internal"],
      status: "resolved"
    });
    expect(created.model.panelWiring?.internalWires ?? []).toEqual([]);
  });
});
