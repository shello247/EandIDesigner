import { describe, expect, it } from "vitest";
import {
  cloneStructuredTerminalStrip,
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
  listStructuredTerminalStripCopySources,
  reuseStructuredTerminalStrip
} from "../logic/commands/drawing-structured-terminal-strip-reuse-commands";
import { createPanelEnclosurePlacement } from "../logic/services/drawing-asset-containment";
import { createBackplanePlacement } from "../logic/services/drawing-backplane-layouts";
import {
  structuredTerminalStripSymbolId,
  structuredTerminalStripVersionId
} from "../logic/services/drawing-generated-symbols";
import type { ApprovedDrawingSymbol } from "../types";

function memberSymbol(params: {
  id: string;
  role: "electrical" | "end_bracket";
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
        defaultForNewStrips: true
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
  memberSymbol({ id: "pt_2_5", role: "electrical" }),
  memberSymbol({ id: "ss2", role: "end_bracket" })
];

function panelAndBackplane(params: {
  model: DrawingModel;
  sheet: DrawingModel["sheets"][number];
  assetId: string;
  tag: string;
  suffix: string;
}) {
  const panel = {
    ...createPanelEnclosurePlacement({
      model: params.model,
      activeSheet: params.sheet,
      assetId: params.assetId,
      tag: params.tag,
      title: `${params.tag} Panel`,
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
  const unmountedSheet = {
    ...base.sheets[0],
    id: "sheet_unmounted",
    name: "Wiring Overview"
  };
  const sourceSheet = createDefaultDrawingSheet({
    id: "sheet_source",
    name: "JB001 Layout"
  });
  const targetSheet = createDefaultDrawingSheet({
    id: "sheet_target",
    name: "PLC001 Layout"
  });
  const sourcePanel = panelAndBackplane({
    model: base,
    sheet: sourceSheet,
    assetId: "asset_jb_001",
    tag: "JB001",
    suffix: "source"
  });
  const targetPanel = panelAndBackplane({
    model: base,
    sheet: targetSheet,
    assetId: "asset_plc_001",
    tag: "PLC001",
    suffix: "target"
  });
  const model = drawingPackageModelSchema.parse({
    ...base,
    assets: [
      {
        id: "asset_jb_001",
        tag: "JB001",
        type: "junction_box",
        title: "Junction Box 1"
      },
      {
        id: "asset_plc_001",
        tag: "PLC001",
        type: "panel",
        title: "PLC Panel 1"
      }
    ],
    sheets: [
      unmountedSheet,
      {
        ...sourceSheet,
        placements: [sourcePanel.panel, sourcePanel.backplane]
      },
      {
        ...targetSheet,
        placements: [targetPanel.panel, targetPanel.backplane]
      }
    ]
  });
  const strip = createDefaultStructuredTerminalStrip(
    symbols as TerminalStripMemberSymbol[]
  );
  strip.members[1] = {
    ...strip.members[1],
    description: "Incoming supply",
    componentSelections: [
      {
        positionKey: "fuse",
        componentKey: "fuse",
        symbolId: "component_symbol",
        versionId: "component_version"
      }
    ]
  };
  const created = createAndPlaceStructuredTerminalStrip({
    model,
    symbols,
    input: {
      sheetId: sourceSheet.id,
      backplaneId: sourcePanel.backplane.id,
      assetId: "asset_tb_101",
      placementId: "placement_tb_101",
      name: "Field terminal strip",
      description: "JB001 field terminations",
      strip
    }
  });
  const withRoute = drawingPackageModelSchema.parse({
    ...created.model,
    sheets: created.model.sheets.map((sheet) =>
      sheet.id === sourceSheet.id
        ? {
            ...sheet,
            connections: [
              {
                id: "source_route",
                from: {
                  placementId: created.placement.id,
                  anchorKey: "M02.a1"
                },
                to: {
                  placementId: created.placement.id,
                  anchorKey: "M03.a1"
                }
              }
            ]
          }
        : sheet
    )
  });
  return {
    model: withRoute,
    sourcePanel,
    targetPanel,
    sourcePlacement: created.placement
  };
}

function unmountedOccurrence(params: {
  assetId: string;
  tag: string;
  placementId: string;
  symbolId?: string;
}): DrawingPlacement {
  return {
    id: params.placementId,
    assetId: params.assetId,
    symbolId:
      params.symbolId ?? structuredTerminalStripSymbolId(params.assetId),
    versionId: structuredTerminalStripVersionId(params.assetId),
    role: "terminal_block",
    tag: params.tag,
    title: params.tag,
    x: 30,
    y: 30,
    rotation: 0,
    scale: 1
  };
}

describe("destination-first structured terminal strip copy", () => {
  it("lists valid assets once, prefers mounted occurrences, and excludes invalid sources", () => {
    const fixture = createFixture();
    const sourceAsset = fixture.model.assets.find(
      (asset) => asset.id === "asset_tb_101"
    )!;
    const secondAssetId = "asset_tb_2";
    const orphanAssetId = "asset_tb_orphan";
    const staleAssetId = "asset_tb_stale";
    const missingAssetId = "asset_tb_missing";
    const secondAsset = {
      ...sourceAsset,
      id: secondAssetId,
      tag: "TB-2",
      symbolId: structuredTerminalStripSymbolId(secondAssetId),
      versionId: structuredTerminalStripVersionId(secondAssetId),
      terminalStrip: cloneStructuredTerminalStrip(sourceAsset.terminalStrip!)
    };
    const orphanAsset = {
      ...sourceAsset,
      id: orphanAssetId,
      tag: "TB-1",
      symbolId: structuredTerminalStripSymbolId(orphanAssetId),
      versionId: structuredTerminalStripVersionId(orphanAssetId),
      terminalStrip: cloneStructuredTerminalStrip(sourceAsset.terminalStrip!)
    };
    const staleAsset = {
      ...sourceAsset,
      id: staleAssetId,
      tag: "TB-3",
      symbolId: structuredTerminalStripSymbolId(staleAssetId),
      versionId: structuredTerminalStripVersionId(staleAssetId),
      terminalStrip: cloneStructuredTerminalStrip(sourceAsset.terminalStrip!)
    };
    const missingStrip = cloneStructuredTerminalStrip(sourceAsset.terminalStrip!);
    missingStrip.members[1] = {
      ...missingStrip.members[1],
      versionId: "missing_version"
    };
    const missingAsset = {
      ...sourceAsset,
      id: missingAssetId,
      tag: "TB-4",
      symbolId: structuredTerminalStripSymbolId(missingAssetId),
      versionId: structuredTerminalStripVersionId(missingAssetId),
      terminalStrip: missingStrip
    };
    const model = drawingPackageModelSchema.parse({
      ...fixture.model,
      assets: [
        ...fixture.model.assets,
        secondAsset,
        orphanAsset,
        staleAsset,
        missingAsset
      ],
      sheets: fixture.model.sheets.map((sheet) =>
        sheet.id === "sheet_unmounted"
          ? {
              ...sheet,
              placements: [
                unmountedOccurrence({
                  assetId: "asset_tb_101",
                  tag: "TB-101",
                  placementId: "representation_tb_101"
                }),
                unmountedOccurrence({
                  assetId: secondAssetId,
                  tag: "TB-2",
                  placementId: "placement_tb_2"
                }),
                unmountedOccurrence({
                  assetId: staleAssetId,
                  tag: "TB-3",
                  placementId: "placement_tb_stale",
                  symbolId: "wrong_generated_symbol"
                }),
                unmountedOccurrence({
                  assetId: missingAssetId,
                  tag: "TB-4",
                  placementId: "placement_tb_missing"
                })
              ]
            }
          : sheet
      )
    });

    const sources = listStructuredTerminalStripCopySources({ model, symbols });

    expect(sources.map((source) => source.tag)).toEqual(["TB-2", "TB-101"]);
    expect(sources.find((source) => source.tag === "TB-101")).toMatchObject({
      sourcePlacementId: "placement_tb_101",
      sourceMount: "JB001 Backplane",
      sourceSheet: "JB001 Layout",
      memberCount: 7,
      terminalCount: 5
    });
  });

  it("creates an independent mounted copy without cloning source wiring", () => {
    const fixture = createFixture();
    const source = listStructuredTerminalStripCopySources({
      model: fixture.model,
      symbols
    })[0];
    const result = reuseStructuredTerminalStrip({
      model: fixture.model,
      symbols,
      input: {
        mode: "copy_as_new",
        sourceSheetId: source.sourceSheetId,
        sourcePlacementId: source.sourcePlacementId,
        targetSheetId: "sheet_target",
        targetBackplaneId: fixture.targetPanel.backplane.id
      }
    });
    const sourceAsset = fixture.model.assets.find(
      (asset) => asset.id === source.assetId
    )!;
    const copiedAsset = result.model.assets.find(
      (asset) => asset.id === result.assetId
    )!;

    expect(copiedAsset).toMatchObject({
      tag: "TB-102",
      title: sourceAsset.title,
      description: sourceAsset.description
    });
    expect(copiedAsset.id).not.toBe(sourceAsset.id);
    expect(result.placement).toMatchObject({
      assetId: copiedAsset.id,
      containerAssetId: "asset_plc_001",
      layoutParentId: fixture.targetPanel.backplane.id,
      tag: "TB-102"
    });
    expect(
      copiedAsset.terminalStrip?.members.map((member) => member.token)
    ).toEqual(sourceAsset.terminalStrip?.members.map((member) => member.token));
    expect(
      copiedAsset.terminalStrip?.members.map((member) => member.id)
    ).not.toEqual(sourceAsset.terminalStrip?.members.map((member) => member.id));
    expect(copiedAsset.terminalStrip?.members[1].componentSelections).toEqual(
      sourceAsset.terminalStrip?.members[1].componentSelections
    );
    expect(copiedAsset.terminalStrip?.members[1].componentSelections).not.toBe(
      sourceAsset.terminalStrip?.members[1].componentSelections
    );
    expect(
      result.model.sheets.find((sheet) => sheet.id === "sheet_target")
        ?.connections
    ).toEqual([]);
    expect(
      result.model.sheets.find((sheet) => sheet.id === "sheet_source")
        ?.connections
    ).toEqual(
      fixture.model.sheets.find((sheet) => sheet.id === "sheet_source")
        ?.connections
    );
  });
});
