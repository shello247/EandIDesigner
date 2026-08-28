import { describe, expect, it } from "vitest";
import {
  createDefaultStructuredTerminalStrip,
  type TerminalStripMemberSymbol
} from "@/features/drawing_terminal_blocks/api/public";
import {
  createDefaultDrawingModel,
  createDefaultDrawingSheet,
  drawingPackageModelSchema,
  type DrawingModel,
  type DrawingPlacement
} from "../data/schema";
import {
  createAndPlaceStructuredTerminalStrip
} from "../logic/commands/drawing-structured-terminal-strip-commands";
import {
  listStructuredTerminalStripReuseDestinations,
  reuseStructuredTerminalStrip
} from "../logic/commands/drawing-structured-terminal-strip-reuse-commands";
import { createPanelEnclosurePlacement } from "../logic/services/drawing-asset-containment";
import { createBackplanePlacement } from "../logic/services/drawing-backplane-layouts";
import {
  copySelectionToClipboard,
  pasteClipboardToSheet
} from "../logic/services/drawing-clipboard-commands";
import type { ApprovedDrawingSymbol } from "../types";

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

function panelAndBackplane(params: {
  model: DrawingModel;
  sheet: DrawingModel["sheets"][number];
  panelAssetId: string;
  panelTag: string;
  suffix: string;
}) {
  const panel = {
    ...createPanelEnclosurePlacement({
      model: params.model,
      activeSheet: params.sheet,
      assetId: params.panelAssetId,
      tag: params.panelTag,
      title: `${params.panelTag} Panel`,
      x: 20,
      y: 20
    }),
    id: `panel_${params.suffix}`
  };
  const backplane = {
    ...createBackplanePlacement({
      panelPlacement: panel,
      id: `backplane_${params.suffix}`
    }),
    layoutDimensions: { lengthMm: 300, widthMm: 200 }
  };
  return { panel, backplane };
}

function createFixture() {
  const base = createDefaultDrawingModel();
  const sheets = [
    { ...base.sheets[0], id: "sheet_source", name: "Source layout" },
    createDefaultDrawingSheet({ id: "sheet_same_mount", name: "Same panel" }),
    createDefaultDrawingSheet({ id: "sheet_other_mount", name: "Other panel" }),
    createDefaultDrawingSheet({ id: "sheet_unmounted", name: "Wiring view" })
  ];
  const source = panelAndBackplane({
    model: base,
    sheet: sheets[0],
    panelAssetId: "asset_panel_1",
    panelTag: "PLC-001",
    suffix: "source"
  });
  const sameMount = panelAndBackplane({
    model: base,
    sheet: sheets[1],
    panelAssetId: "asset_panel_1",
    panelTag: "PLC-001",
    suffix: "same"
  });
  const otherMount = panelAndBackplane({
    model: base,
    sheet: sheets[2],
    panelAssetId: "asset_panel_2",
    panelTag: "JB-001",
    suffix: "other"
  });
  const model = drawingPackageModelSchema.parse({
    ...base,
    assets: [
      { id: "asset_panel_1", tag: "PLC-001", type: "panel", title: "PLC Panel" },
      { id: "asset_panel_2", tag: "JB-001", type: "junction_box", title: "Junction Box" }
    ],
    sheets: [
      { ...sheets[0], placements: [source.panel, source.backplane] },
      { ...sheets[1], placements: [sameMount.panel, sameMount.backplane] },
      { ...sheets[2], placements: [otherMount.panel, otherMount.backplane] },
      sheets[3]
    ]
  });
  const strip = createDefaultStructuredTerminalStrip(
    symbols as TerminalStripMemberSymbol[]
  );
  strip.members[1] = {
    ...strip.members[1],
    description: "Supply isolation",
    componentSelections: [
      {
        positionKey: "fuse",
        componentKey: "fuse",
        symbolId: "component_symbol",
        versionId: "component_version",
        children: [
          {
            positionKey: "insert",
            componentKey: "insert",
            symbolId: "nested_symbol",
            versionId: "nested_version"
          }
        ]
      }
    ]
  };
  const created = createAndPlaceStructuredTerminalStrip({
    model,
    symbols,
    input: {
      sheetId: "sheet_source",
      backplaneId: source.backplane.id,
      assetId: "asset_tb_101",
      placementId: "placement_tb_101",
      name: "Main terminal strip",
      description: "Field terminations",
      engineeringAttributes: {
        version: 1,
        values: [
          {
            definitionKey: "engineering_purpose",
            definitionVersion: 1,
            kind: "text",
            value: "Tank 1 field termination",
            source: { kind: "engineer_entered" }
          },
          {
            definitionKey: "nominal_voltage",
            definitionVersion: 1,
            kind: "quantity",
            value: 24,
            unit: "V",
            source: { kind: "manufacturer", reference: "Terminal datasheet" }
          }
        ]
      },
      strip
    }
  });
  const sourcePlacement = {
    ...created.placement,
    rotation: 0,
    layoutLabel: { visible: false as const, position: "bottom-center" as const },
    labelPosition: { x: created.placement.x + 4, y: created.placement.y - 5 }
  };
  const createdModel = drawingPackageModelSchema.parse({
    ...created.model,
    sheets: created.model.sheets.map((sheet) =>
      sheet.id === "sheet_source"
        ? {
            ...sheet,
            placements: sheet.placements.map((placement) =>
              placement.id === sourcePlacement.id ? sourcePlacement : placement
            ),
            connections: [
              {
                id: "source_route",
                from: { placementId: sourcePlacement.id, anchorKey: "M02.a1" },
                to: { placementId: sourcePlacement.id, anchorKey: "M03.a1" }
              }
            ]
          }
        : sheet
    )
  });
  return { model: createdModel, sourcePlacement, source, sameMount, otherMount };
}

describe("structured terminal strip reuse", () => {
  it("copies the composition into a new independent asset without copying wiring", () => {
    const fixture = createFixture();
    const result = reuseStructuredTerminalStrip({
      model: fixture.model,
      symbols,
      input: {
        mode: "copy_as_new",
        sourceSheetId: "sheet_source",
        sourcePlacementId: "placement_tb_101",
        targetSheetId: "sheet_other_mount",
        targetBackplaneId: fixture.otherMount.backplane.id
      }
    });
    const sourceAsset = fixture.model.assets.find(
      (asset) => asset.id === "asset_tb_101"
    )!;
    const copiedAsset = result.model.assets.find(
      (asset) => asset.id === result.assetId
    )!;

    expect(result.createdNewAsset).toBe(true);
    expect(copiedAsset).toMatchObject({
      tag: "TB-102",
      title: sourceAsset.title,
      description: sourceAsset.description
    });
    expect(copiedAsset.id).not.toBe(sourceAsset.id);
    expect(
      copiedAsset.terminalStrip?.members.map((member) => member.token)
    ).toEqual(sourceAsset.terminalStrip?.members.map((member) => member.token));
    expect(
      copiedAsset.terminalStrip?.members.map((member) => member.id)
    ).not.toEqual(sourceAsset.terminalStrip?.members.map((member) => member.id));
    expect(copiedAsset.terminalStrip?.members[1].componentSelections).toEqual(
      sourceAsset.terminalStrip?.members[1].componentSelections
    );
    expect(copiedAsset.engineeringAttributes?.values).toEqual([
      expect.objectContaining({
        definitionKey: "nominal_voltage",
        value: 24,
        unit: "V"
      })
    ]);
    expect(
      copiedAsset.engineeringAttributes?.values.some(
        (value) => value.definitionKey === "engineering_purpose"
      )
    ).toBe(false);
    expect(copiedAsset.terminalStrip?.members[1].componentSelections).not.toBe(
      sourceAsset.terminalStrip?.members[1].componentSelections
    );
    expect(
      result.model.sheets.find((sheet) => sheet.id === "sheet_other_mount")
        ?.connections
    ).toEqual([]);
    expect(
      result.model.sheets.find((sheet) => sheet.id === "sheet_source")
        ?.connections
    ).toEqual(
      fixture.model.sheets.find((sheet) => sheet.id === "sheet_source")
        ?.connections
    );
    expect(result.placement.layoutLabel).toEqual(
      fixture.sourcePlacement.layoutLabel
    );
  });

  it("places a same-mount representation at the same physical position", () => {
    const fixture = createFixture();
    const result = reuseStructuredTerminalStrip({
      model: fixture.model,
      symbols,
      input: {
        mode: "place_representation",
        sourceSheetId: "sheet_source",
        sourcePlacementId: "placement_tb_101",
        targetSheetId: "sheet_same_mount",
        targetBackplaneId: fixture.sameMount.backplane.id
      }
    });

    expect(result.createdNewAsset).toBe(false);
    expect(result.assetId).toBe("asset_tb_101");
    expect(result.model.assets).toHaveLength(fixture.model.assets.length);
    expect(result.placement.layoutPosition).toEqual(
      fixture.sourcePlacement.layoutPosition
    );
    expect(result.placement.assetId).toBe("asset_tb_101");
    expect(
      result.model.sheets.find((sheet) => sheet.id === "sheet_same_mount")
        ?.connections
    ).toEqual([]);
  });

  it("allows an unmounted cross-sheet representation", () => {
    const fixture = createFixture();
    const result = reuseStructuredTerminalStrip({
      model: fixture.model,
      symbols,
      input: {
        mode: "place_representation",
        sourceSheetId: "sheet_source",
        sourcePlacementId: "placement_tb_101",
        targetSheetId: "sheet_unmounted"
      }
    });
    expect(result.placement.assetId).toBe("asset_tb_101");
    expect(result.placement.layoutParentId).toBeUndefined();
  });

  it("rejects different mounts, duplicate sheet representations, and collisions atomically", () => {
    const fixture = createFixture();
    expect(() =>
      reuseStructuredTerminalStrip({
        model: fixture.model,
        symbols,
        input: {
          mode: "place_representation",
          sourceSheetId: "sheet_source",
          sourcePlacementId: "placement_tb_101",
          targetSheetId: "sheet_other_mount",
          targetBackplaneId: fixture.otherMount.backplane.id
        }
      })
    ).toThrow(/different physical backplane requires copy as new/i);
    expect(() =>
      reuseStructuredTerminalStrip({
        model: fixture.model,
        symbols,
        input: {
          mode: "place_representation",
          sourceSheetId: "sheet_source",
          sourcePlacementId: "placement_tb_101",
          targetSheetId: "sheet_source"
        }
      })
    ).toThrow(/already represented/i);

    const obstacle: DrawingPlacement = {
      id: "obstacle",
      assetId: "asset_obstacle",
      containerAssetId: "asset_panel_1",
      layoutKind: "layout_helper",
      layoutParentId: fixture.sameMount.backplane.id,
      symbolId: "obstacle_symbol",
      versionId: "obstacle_version",
      role: "device",
      tag: "K-101",
      title: "Obstacle",
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      layoutPosition: fixture.sourcePlacement.layoutPosition,
      layoutDimensions: { lengthMm: 80, widthMm: 80 }
    };
    const withCollision = drawingPackageModelSchema.parse({
      ...fixture.model,
      assets: [
        ...fixture.model.assets,
        {
          id: "asset_obstacle",
          tag: "K-101",
          type: "relay",
          title: "Obstacle"
        }
      ],
      sheets: fixture.model.sheets.map((sheet) =>
        sheet.id === "sheet_same_mount"
          ? { ...sheet, placements: [...sheet.placements, obstacle] }
          : sheet
      )
    });
    expect(() =>
      reuseStructuredTerminalStrip({
        model: withCollision,
        symbols,
        input: {
          mode: "place_representation",
          sourceSheetId: "sheet_source",
          sourcePlacementId: "placement_tb_101",
          targetSheetId: "sheet_same_mount",
          targetBackplaneId: fixture.sameMount.backplane.id
        }
      })
    ).toThrow(/overlaps equipment/i);
    expect(withCollision.assets).toHaveLength(fixture.model.assets.length + 1);
  });

  it("reports mounted-reference eligibility and blocks generic clipboard paste", () => {
    const fixture = createFixture();
    const destinations = listStructuredTerminalStripReuseDestinations({
      model: fixture.model,
      sourceSheetId: "sheet_source",
      sourcePlacementId: "placement_tb_101"
    });
    expect(
      destinations.sheets
        .find((sheet) => sheet.id === "sheet_same_mount")
        ?.backplanes[0].canPlaceRepresentation
    ).toBe(true);
    expect(
      destinations.sheets
        .find((sheet) => sheet.id === "sheet_other_mount")
        ?.backplanes[0]
    ).toMatchObject({
      canPlaceRepresentation: false,
      unavailableReason: expect.stringMatching(/copy as new/i)
    });

    const clipboard = copySelectionToClipboard({
      model: fixture.model,
      sheetId: "sheet_source",
      selection: { placementIds: ["placement_tb_101"], annotationIds: [] }
    });
    expect(clipboard).not.toBeNull();
    expect(() =>
      pasteClipboardToSheet({
        model: fixture.model,
        sheetId: "sheet_unmounted",
        clipboard: clipboard!,
        symbols
      })
    ).toThrow(/use reuse terminal strip in properties/i);
  });
});
