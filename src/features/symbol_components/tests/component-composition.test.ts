import { describe, expect, it } from "vitest";
import type { SymbolMetadata } from "@/features/symbol_registry/api/public";
import {
  createDefaultDrawingModel,
  type DrawingPlacement
} from "@/features/drawing_canvas/data/schema";
import { toSheetCanvasModel } from "@/features/drawing_canvas/logic/commands/drawing-sheet-commands";
import { renderDrawingToSvg } from "@/features/drawing_canvas/logic/services/drawing-svg-renderer";
import type { ApprovedDrawingSymbol } from "@/features/drawing_canvas/types";
import {
  composeSelectedComponents,
  getComponentCompositionBounds,
  resolveAutomaticComponentSelections,
  validateDrawingComponentSelections,
  validateSymbolComponentDefinitions
} from "../api/public";
import { generateDrawingBom } from "@/features/bom_creator/logic/use_cases/generate-drawing-bom";

function metadata(
  overrides: Partial<SymbolMetadata> = {}
): SymbolMetadata {
  return {
    symbolKey: "symbol",
    displayName: "Symbol",
    category: "other",
    layoutUsage: "panel_layout",
    physicalWidthMm: 100,
    physicalHeightMm: 100,
    viewBox: { x: 0, y: 0, width: 100, height: 100 },
    anchors: [],
    terminals: [],
    ...overrides
  };
}

const child: ApprovedDrawingSymbol = {
  symbolId: "child",
  symbolKey: "child",
  displayName: "Relay",
  category: "other",
  versionId: "child-v1",
  versionNumber: 1,
  svg: '<svg viewBox="0 0 24 41"><rect x="0" y="0" width="24" height="41"/></svg>',
  metadata: metadata({
    symbolKey: "child",
    displayName: "Relay",
    physicalWidthMm: 30,
    physicalHeightMm: 20,
    viewBox: { x: 0, y: 0, width: 24, height: 41 }
  })
};

const parent: ApprovedDrawingSymbol = {
  symbolId: "parent",
  symbolKey: "parent",
  displayName: "Relay Base",
  category: "other",
  versionId: "parent-v2",
  versionNumber: 2,
  svg: '<svg viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100"/></svg>',
  metadata: metadata({
    symbolKey: "parent",
    displayName: "Relay Base",
    componentPositions: [
      {
        key: "1",
        label: "Position 1",
        required: true,
        components: [
          {
            key: "relay",
            label: "Relay",
            box: {
              centerX: 50,
              centerY: 50,
              width: 10,
              height: 12,
              rotationDeg: 0
            },
            allowedSymbolIds: ["child"]
          }
        ]
      }
    ]
  })
};

const selection = {
  positionKey: "1",
  componentKey: "relay",
  symbolId: "child",
  versionId: "child-v1",
  children: []
};

describe("component selection resolution", () => {
  it("auto-selects a required single alternative and pins its exact version", () => {
    expect(
      resolveAutomaticComponentSelections({
        parent,
        symbols: [parent, child]
      })
    ).toEqual({
      selections: [selection],
      issues: []
    });
  });

  it("blocks missing required choices and accepts optional empty positions", () => {
    expect(
      validateDrawingComponentSelections({
        parent,
        selections: [],
        symbols: [parent, child]
      }).map((issue) => issue.code)
    ).toEqual(["COMPONENT_SELECTION_REQUIRED"]);

    expect(
      validateDrawingComponentSelections({
        parent: {
          ...parent,
          metadata: {
            ...parent.metadata,
            componentPositions: parent.metadata.componentPositions?.map(
              (position) => ({ ...position, required: false })
            )
          }
        },
        selections: [],
        symbols: [parent, child]
      })
    ).toEqual([]);
  });

  it("detects unavailable alternatives and direct cycles", () => {
    const cyclicMetadata = {
      ...parent.metadata,
      componentPositions: parent.metadata.componentPositions?.map((position) => ({
        ...position,
        components: position.components.map((component) => ({
          ...component,
          allowedSymbolIds: ["parent", "missing"]
        }))
      }))
    };
    expect(
      validateSymbolComponentDefinitions({
        parentSymbolId: "parent",
        metadata: cyclicMetadata,
        candidates: [
          {
            symbolId: "parent",
            displayName: "Relay Base",
            versionId: "parent-v2",
            versionNumber: 2,
            metadata: cyclicMetadata
          }
        ]
      }).map((issue) => issue.code)
    ).toEqual(
      expect.arrayContaining([
        "COMPONENT_ALTERNATIVE_UNAVAILABLE",
        "COMPONENT_CYCLE"
      ])
    );
  });
});

describe("component physical composition", () => {
  const placement: DrawingPlacement = {
    id: "placement",
    assetId: "asset-parent",
    symbolId: parent.symbolId,
    versionId: parent.versionId,
    role: "device",
    tag: "K-101",
    x: 10,
    y: 20,
    rotation: 0,
    scale: 1,
    layoutKind: "layout_helper",
    layoutDimensions: { lengthMm: 100, widthMm: 100 }
  };

  it("uses registered child dimensions rather than the smaller Position Box", () => {
    const result = composeSelectedComponents({
      parentPlacement: placement,
      parentSymbol: parent,
      selections: [selection],
      symbols: [parent, child]
    });

    expect(result.warnings).toEqual([]);
    expect(result.placements[0]).toMatchObject({
      centerX: 60,
      centerY: 70,
      widthMm: 30,
      heightMm: 20,
      rotationDeg: 0
    });
    expect(result.placements[0].widthMm).toBeGreaterThan(
      parent.metadata.componentPositions![0].components[0].box.width
    );
  });

  it("expands placement bounds to the actual rotated child envelope", () => {
    const overhangingParent = {
      ...parent,
      metadata: {
        ...parent.metadata,
        componentPositions: parent.metadata.componentPositions?.map(
          (position) => ({
            ...position,
            components: position.components.map((component) => ({
              ...component,
              box: { ...component.box, centerX: 100, rotationDeg: 90 }
            }))
          })
        )
      }
    };
    const bounds = getComponentCompositionBounds({
      parentPlacement: placement,
      parentSymbol: overhangingParent,
      selections: [selection],
      symbols: [overhangingParent, child]
    });

    expect(bounds.x).toBe(10);
    expect(bounds.width).toBe(110);
  });

  it("renders child artwork only on panel-layout occurrences with uniform meet", () => {
    const model = createDefaultDrawingModel();
    const canvas = {
      ...toSheetCanvasModel(model, "sheet_1"),
      placements: [placement]
    };
    const assets = [
      {
        id: "asset-parent",
        tag: "K-101",
        type: "relay" as const,
        title: "Relay Base",
        symbolId: "parent",
        versionId: "parent-v2",
        componentSelections: [selection]
      }
    ];
    const panelSvg = renderDrawingToSvg({
      model: canvas,
      approvedSymbols: [parent, child],
      assets
    });
    const wiringSvg = renderDrawingToSvg({
      model: {
        ...canvas,
        placements: [
          {
            ...placement,
            layoutKind: undefined,
            layoutDimensions: undefined
          }
        ]
      },
      approvedSymbols: [parent, child],
      assets
    });

    expect(panelSvg).toContain('data-component-symbol-id="child"');
    expect(panelSvg).toContain('width="30"');
    expect(panelSvg).toContain('height="20"');
    expect(panelSvg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(wiringSvg).not.toContain("data-component-symbol-id");
  });
});

describe("component BOM expansion", () => {
  it("expands selected child templates once under the parent asset and tag", () => {
    const model = createDefaultDrawingModel();
    model.assets = [
      {
        id: "asset-parent",
        tag: "K-101",
        type: "relay",
        title: "Relay Base",
        symbolId: "parent",
        versionId: "parent-v2",
        componentSelections: [selection]
      }
    ];
    model.sheets[0].placements = [
      {
        id: "p1",
        assetId: "asset-parent",
        symbolId: "parent",
        versionId: "parent-v2",
        role: "device",
        tag: "K-101",
        x: 10,
        y: 10,
        rotation: 0,
        scale: 1
      },
      {
        id: "p2",
        assetId: "asset-parent",
        symbolId: "parent",
        versionId: "parent-v2",
        role: "device",
        tag: "K-101",
        x: 80,
        y: 10,
        rotation: 0,
        scale: 1
      }
    ];
    const item = (id: string, name: string) => ({
      id,
      itemKey: id,
      displayName: name,
      category: "other",
      unit: "each",
      status: "active" as const
    });
    const template = (
      id: string,
      symbolId: string,
      itemId: string,
      name: string
    ) => ({
      id,
      symbolId,
      lines: [
        {
          id: `${id}-line`,
          itemId,
          lineNumber: 1,
          quantityRule: "fixed_per_assembly" as const,
          quantity: 1,
          item: item(itemId, name)
        }
      ]
    });
    const bom = generateDrawingBom({
      drawingId: "drawing",
      drawingTitle: "Drawing",
      model,
      symbols: [
        { symbolId: "parent", versionId: "parent-v2", displayName: "Base" },
        { symbolId: "child", versionId: "child-v1", displayName: "Relay" }
      ],
      templates: [
        template("parent-template", "parent", "base-item", "Base"),
        template("child-template", "child", "relay-item", "Relay")
      ]
    });

    expect(bom.assemblies).toHaveLength(1);
    expect(bom.assemblies[0].assetTag).toBe("K-101");
    expect(bom.assemblies[0].lines).toHaveLength(2);
    expect(
      bom.assemblies[0].lines.find((line) => line.itemId === "relay-item")
        ?.componentPath
    ).toEqual(["1", "relay"]);
    expect(
      bom.consolidatedLines.find((line) => line.itemId === "relay-item")
        ?.quantity
    ).toBe(1);
  });
});
