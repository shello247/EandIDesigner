import { describe, expect, it } from "vitest";
import {
  createDefaultStructuredTerminalStrip,
  insertStructuredTerminalStripMember,
  type TerminalStripMemberSymbol
} from "@/features/drawing_terminal_blocks/api/public";
import {
  createAndPlaceStructuredTerminalStrip,
  placeStructuredTerminalStripReference,
  updateStructuredTerminalStrip
} from "../logic/commands/drawing-structured-terminal-strip-commands";
import {
  createDefaultDrawingModel,
  drawingPackageModelSchema
} from "../data/schema";
import type { ApprovedDrawingSymbol } from "../types";
import { buildDrawingPanelWiringSource } from "../logic/services/drawing-panel-wiring-source";
import { renderDrawingToSvg } from "../logic/services/drawing-svg-renderer";
import { toSheetCanvasModel } from "../logic/commands/drawing-sheet-commands";
import { reconcileDrawingAssets } from "@/features/drawing_asset_manager/logic/use_cases/drawing-asset-manager-use-cases";
import { createPanelEnclosurePlacement } from "../logic/services/drawing-asset-containment";
import { createBackplanePlacement } from "../logic/services/drawing-backplane-layouts";

function memberSymbol(params: {
  id: string;
  role: "electrical" | "end_bracket";
  defaultForNewStrips?: boolean;
}): ApprovedDrawingSymbol {
  const electrical = params.role === "electrical";
  return {
    symbolId: params.id,
    symbolKey: params.id,
    displayName: params.id,
    category: "terminal_block",
    versionId: `${params.id}_v1`,
    versionNumber: 1,
    selectable: true,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><rect width="10" height="20"/></svg>',
    metadata: {
      symbolKey: params.id,
      displayName: params.id,
      category: "terminal_block",
      layoutUsage: "panel_layout",
      mountingType: "din_rail",
      physicalWidthMm: electrical ? 5.2 : 8,
      physicalHeightMm: electrical ? 35.3 : 52.4,
      viewBox: { x: 0, y: 0, width: 10, height: 20 },
      terminalStripCapability: {
        role: params.role,
        railDatumMm: electrical ? 22 : 31,
        defaultForNewStrips: params.defaultForNewStrips
      },
      anchors: electrical
        ? [{ key: "a1", x: 5, y: 10, kind: "terminal" }]
        : [],
      terminals: electrical
        ? [
            {
              key: "1",
              label: "1",
              anchorKey: "a1",
              panelSide: "single",
              requiredForWiring: true
            }
          ]
        : []
    }
  };
}

const symbols = [
  memberSymbol({
    id: "pt_2_5",
    role: "electrical",
    defaultForNewStrips: true
  }),
  memberSymbol({
    id: "ss2",
    role: "end_bracket",
    defaultForNewStrips: true
  })
];

const dinRailSymbol: ApprovedDrawingSymbol = {
  symbolId: "din_rail",
  symbolKey: "din_rail",
  displayName: "Standard TH35 DIN Rail",
  category: "rail",
  technicalKind: "rail",
  versionId: "din_rail_v1",
  versionNumber: 1,
  selectable: true,
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 35"><rect width="300" height="35"/></svg>',
  metadata: {
    symbolKey: "din_rail",
    displayName: "Standard TH35 DIN Rail",
    category: "rail",
    layoutUsage: "panel_layout",
    mountingType: "backplate",
    anchors: [],
    terminals: [],
    physicalWidthMm: 300,
    physicalHeightMm: 35,
    viewBox: { x: 0, y: 0, width: 300, height: 35 }
  }
};

describe("structured terminal strip drawing commands", () => {
  it("creates one managed asset with nested members and references it without cloning", () => {
    const model = createDefaultDrawingModel();
    const strip = createDefaultStructuredTerminalStrip(
      symbols as TerminalStripMemberSymbol[]
    );
    const created = createAndPlaceStructuredTerminalStrip({
      model,
      symbols,
      input: {
        sheetId: model.sheets[0].id,
        assetId: "asset_tb_101",
        placementId: "placement_tb_101",
        name: "Tank terminal strip",
        description: "Field terminations",
        strip,
        x: 40,
        y: 50
      }
    });

    expect(created.model.assets.at(-1)).toMatchObject({
      id: "asset_tb_101",
      tag: "TB-101",
      title: "Tank terminal strip",
      terminalStrip: { kind: "structured_terminal_strip" }
    });
    expect(created.placement).toMatchObject({
      assetId: "asset_tb_101",
      symbolId: "__generated_structured_terminal_strip__:asset_tb_101",
      role: "terminal_block"
    });
    expect(created.placement.terminalBlock).toBeUndefined();
    const rendered = renderDrawingToSvg({
      model: toSheetCanvasModel(created.model, model.sheets[0].id),
      approvedSymbols: symbols,
      assets: created.model.assets
    });
    expect(rendered).toContain('data-terminal-strip-member="M01"');
    expect(rendered).toContain('data-terminal-strip-member="M07"');
    const reconciled = reconcileDrawingAssets(created.model, symbols);
    expect(reconciled.assets[0].terminalStrip).toEqual(strip);
    const reconciledRender = renderDrawingToSvg({
      model: toSheetCanvasModel(reconciled, model.sheets[0].id),
      approvedSymbols: symbols,
      assets: reconciled.assets
    });
    expect(reconciledRender).toContain('data-terminal-strip-member="M01"');
    const source = buildDrawingPanelWiringSource(created.model, symbols);
    expect(
      source.sheets[0].occurrences.find(
        (occurrence) => occurrence.assetId === "asset_tb_101"
      )?.terminals.map((terminal) => terminal.terminalKey)
    ).toEqual(["M02.1", "M03.1", "M04.1", "M05.1", "M06.1"]);

    const referenced = placeStructuredTerminalStripReference({
      model: created.model,
      symbols,
      sheetId: model.sheets[0].id,
      assetId: "asset_tb_101",
      x: 120,
      y: 50
    });
    expect(referenced.model.assets).toHaveLength(1);
    expect(
      referenced.model.sheets[0].placements.filter(
        (placement) => placement.assetId === "asset_tb_101"
      )
    ).toHaveLength(2);
  });

  it("keeps permanent terminal identity through reordering and blocks connected removal", () => {
    const model = createDefaultDrawingModel();
    const strip = createDefaultStructuredTerminalStrip(
      symbols as TerminalStripMemberSymbol[]
    );
    const created = createAndPlaceStructuredTerminalStrip({
      model,
      symbols,
      input: {
        sheetId: model.sheets[0].id,
        assetId: "asset_tb_101",
        placementId: "placement_tb_101",
        name: "Tank terminal strip",
        strip
      }
    });
    const reordered = {
      ...strip,
      members: [
        strip.members[0],
        strip.members[2],
        strip.members[1],
        ...strip.members.slice(3)
      ]
    };
    const updated = updateStructuredTerminalStrip({
      model: created.model,
      symbols,
      assetId: "asset_tb_101",
      name: "Reordered strip",
      strip: reordered
    });
    expect(
      updated.assets[0].terminalStrip?.members.map((member) => member.token)
    ).toEqual(["M01", "M03", "M02", "M04", "M05", "M06", "M07"]);

    const connected = drawingPackageModelSchema.parse({
      ...updated,
      sheets: updated.sheets.map((sheet) => ({
        ...sheet,
        connections: [
          {
            id: "connection_m03",
            from: {
              placementId: "placement_tb_101",
              anchorKey: "M03.a1"
            },
            to: {
              placementId: "placement_tb_101",
              anchorKey: "M02.a1"
            }
          }
        ]
      }))
    });
    const removedM03 = {
      ...reordered,
      members: reordered.members.filter((member) => member.token !== "M03")
    };

    expect(() =>
      updateStructuredTerminalStrip({
        model: connected,
        symbols,
        assetId: "asset_tb_101",
        name: "Invalid strip",
        strip: removedM03
      })
    ).toThrow(/connected or mapped/i);
  });

  it("allows an installed strip to be edited over its supporting DIN rail", () => {
    const base = createDefaultDrawingModel();
    const panel = {
      ...createPanelEnclosurePlacement({
        model: base,
        activeSheet: base.sheets[0],
        assetId: "asset_panel_1",
        tag: "PLC-001",
        title: "PLC Panel",
        x: 20,
        y: 20,
        width: 180,
        height: 150
      }),
      id: "panel_1"
    };
    const backplane = {
      ...createBackplanePlacement({ panelPlacement: panel, id: "backplane_1" }),
      layoutDimensions: { lengthMm: 300, widthMm: 200 }
    };
    const mountedModel = drawingPackageModelSchema.parse({
      ...base,
      assets: [
        {
          id: "asset_panel_1",
          tag: "PLC-001",
          type: "panel",
          title: "PLC Panel"
        }
      ],
      sheets: [
        {
          ...base.sheets[0],
          placements: [panel, backplane]
        }
      ]
    });
    const strip = createDefaultStructuredTerminalStrip(
      symbols as TerminalStripMemberSymbol[]
    );
    const created = createAndPlaceStructuredTerminalStrip({
      model: mountedModel,
      symbols,
      input: {
        sheetId: mountedModel.sheets[0].id,
        backplaneId: backplane.id,
        assetId: "asset_tb_101",
        placementId: "placement_tb_101",
        name: "PLC terminal strip",
        strip
      }
    });
    const stripPlacement = created.placement;
    const rail = {
      id: "rail_1",
      symbolId: dinRailSymbol.symbolId,
      versionId: dinRailSymbol.versionId,
      role: "other" as const,
      tag: "DIN Rail",
      x: stripPlacement.x,
      y: stripPlacement.y,
      rotation: 0,
      scale: 1,
      layoutKind: "layout_helper" as const,
      layoutParentId: backplane.id,
      containerAssetId: "asset_panel_1",
      layoutPosition: stripPlacement.layoutPosition,
      layoutDimensions: { lengthMm: 180, widthMm: 35 }
    };
    const installed = drawingPackageModelSchema.parse({
      ...created.model,
      sheets: created.model.sheets.map((sheet) => ({
        ...sheet,
        placements: [
          ...sheet.placements,
          rail,
          {
            id: "schematic_tb_101",
            assetId: "asset_tb_101",
            symbolId: stripPlacement.symbolId,
            versionId: stripPlacement.versionId,
            role: "terminal_block",
            tag: "TB-101",
            title: "PLC terminal strip",
            x: 25,
            y: 25,
            rotation: 0,
            scale: 0.5,
            layoutParentId: "schematic_panel_reference"
          }
        ]
      }))
    });

    const expandedStrip = insertStructuredTerminalStripMember({
      strip,
      symbol: symbols[0] as TerminalStripMemberSymbol,
      index: strip.members.length - 1
    });
    const updated = updateStructuredTerminalStrip({
      model: installed,
      symbols: [...symbols, dinRailSymbol],
      assetId: "asset_tb_101",
      name: "PLC terminal strip updated",
      strip: expandedStrip
    });
    expect(
      updated.assets
        .find((asset) => asset.id === "asset_tb_101")
        ?.terminalStrip?.members.filter((member) => member.role === "electrical")
    ).toHaveLength(6);

    const blocker = {
      ...rail,
      id: "equipment_1",
      assetId: "asset_tb_104",
      symbolId: symbols[0].symbolId,
      versionId: symbols[0].versionId,
      role: "terminal_block" as const,
      tag: "TB-104",
      layoutDimensions: {
        lengthMm: 30,
        widthMm: 35
      }
    };
    const obstructed = drawingPackageModelSchema.parse({
      ...installed,
      sheets: installed.sheets.map((sheet) => ({
        ...sheet,
        placements: [...sheet.placements, blocker]
      }))
    });

    expect(() =>
      updateStructuredTerminalStrip({
        model: obstructed,
        symbols: [...symbols, dinRailSymbol],
        assetId: "asset_tb_101",
        name: "Blocked terminal strip",
        strip: expandedStrip
      })
    ).toThrow(/TB-104/);
  });
});
