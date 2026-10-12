import { describe, expect, it } from "vitest";
import { drawingPlacementSchema, type DrawingPlacement } from "../data/schema";
import type { ApprovedDrawingSymbol } from "../types";
import {
  getLayoutLabelPoint,
  isDinRailSymbol,
  resolveLayoutLabel,
  resolveLayoutLabelGeometry,
  layoutLabelDisplayToStored,
  renderLayoutLabelText,
  renderLayoutLabelLeader
} from "../logic/services/drawing-layout-labels";
import {
  createGeneratedWireTrayLibrarySymbol,
  GENERATED_WIRE_TRAY_SYMBOL_ID,
  GENERATED_WIRE_TRAY_VERSION_ID
} from "../logic/services/drawing-wire-tray-layouts";
import { resolveLayoutHelperDisplayPlacement } from "../logic/services/drawing-backplane-scale";
import { createBackplanePlacement } from "../logic/services/drawing-backplane-layouts";

function createSymbol(
  overrides: Partial<ApprovedDrawingSymbol> = {}
): ApprovedDrawingSymbol {
  return {
    symbolId: "symbol_1",
    symbolKey: "test_symbol",
    displayName: "Test Symbol",
    category: "other",
    versionId: "version_1",
    versionNumber: 1,
    svg: '<svg viewBox="0 0 100 20"></svg>',
    metadata: {
      symbolKey: "test_symbol",
      displayName: "Test Symbol",
      category: "other",
      viewBox: { x: 0, y: 0, width: 100, height: 20 },
      anchors: [],
      terminals: []
    },
    ...overrides
  };
}

function createPlacement(
  overrides: Partial<DrawingPlacement> = {}
): DrawingPlacement {
  return {
    id: "placement_1",
    symbolId: "symbol_1",
    versionId: "version_1",
    role: "other",
    tag: "TEST-1",
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    layoutKind: "layout_helper",
    layoutParentId: "backplane_1",
    ...overrides
  };
}

describe("isDinRailSymbol", () => {
  it("recognizes a registered rail by its panel category", () => {
    const symbol = createSymbol({
      metadata: {
        ...createSymbol().metadata,
        panelCategory: "rail"
      }
    });

    expect(isDinRailSymbol(symbol)).toBe(true);
  });

  it("does not treat equipment mounted on DIN rail as rail material", () => {
    const symbol = createSymbol({
      metadata: {
        ...createSymbol().metadata,
        mountingType: "din_rail"
      }
    });

    expect(isDinRailSymbol(symbol)).toBe(false);
  });

  it("retains legacy name and key recognition", () => {
    expect(
      isDinRailSymbol(
        createSymbol({
          symbolKey: "standard_th35_din_rail",
          displayName: "Standard TH35 DIN Rail"
        })
      )
    ).toBe(true);
  });
});

describe("resolveLayoutLabel", () => {
  it("hides DIN rail labels by default", () => {
    const symbol = createSymbol({
      metadata: {
        ...createSymbol().metadata,
        panelCategory: "rail"
      }
    });

    expect(
      resolveLayoutLabel({
        placement: createPlacement({ assetId: "asset_rail_1" }),
        symbol
      }).visible
    ).toBe(false);
  });

  it("hides generated wire tray labels by default", () => {
    expect(
      resolveLayoutLabel({
        placement: createPlacement({
          symbolId: GENERATED_WIRE_TRAY_SYMBOL_ID,
          versionId: GENERATED_WIRE_TRAY_VERSION_ID
        }),
        symbol: createGeneratedWireTrayLibrarySymbol()
      }).visible
    ).toBe(false);
  });

  it("keeps ordinary asset labels visible by default", () => {
    expect(
      resolveLayoutLabel({
        placement: createPlacement({ assetId: "asset_equipment_1" }),
        symbol: createSymbol()
      }).visible
    ).toBe(true);
  });

  it("honors an explicit label visibility override", () => {
    const symbol = createSymbol({
      metadata: {
        ...createSymbol().metadata,
        panelCategory: "rail"
      }
    });

    expect(
      resolveLayoutLabel({
        placement: createPlacement({
          layoutLabel: { visible: true, position: "top-right" }
        }),
        symbol
      }).visible
    ).toBe(true);
  });
});

describe("getLayoutLabelPoint", () => {
  it("derives the automatic top-center point from rendered layout bounds", () => {
    expect(
      getLayoutLabelPoint({
        placement: createPlacement({
          x: 20,
          y: 30,
          layoutDimensions: { lengthMm: 40, widthMm: 15 }
        }),
        position: "top-center"
      })
    ).toEqual({ x: 40, y: 28.65, textAnchor: "middle" });
  });

  it("uses a saved manual label position without changing the placement", () => {
    expect(
      getLayoutLabelPoint({
        placement: createPlacement({
          x: 20,
          y: 30,
          layoutDimensions: { lengthMm: 40, widthMm: 15 },
          labelPosition: { x: 72.25, y: 41.5 }
        }),
        position: "bottom-right"
      })
    ).toEqual({ x: 72.25, y: 41.5, textAnchor: "middle" });
  });
});

describe("compact panel label contract and geometry", () => {
  const placement = () => createPlacement({ assetId: "asset", x: 20, y: 30,
    layoutDimensions: { lengthMm: 40, widthMm: 15 } });
  it("resolves legacy defaults without adding saved fields or changing coordinates", () => {
    const source = placement();
    const before = JSON.stringify(source);
    const resolved = resolveLayoutLabelGeometry({ placement: source, symbol: createSymbol() });
    expect(resolved).toMatchObject({ fontSize: 2, size: "compact", rotation: 0,
      point: { x: 40, y: 28.65 } });
    expect(resolved.leader).toBeUndefined();
    expect(JSON.stringify(source)).toBe(before);
    expect(drawingPlacementSchema.parse(source).layoutLabel).toBeUndefined();
    expect(renderLayoutLabelText(source.id, resolved)).toContain('font-weight="400" letter-spacing="0"');
  });
  it.each(["tiny", 12, null])("rejects invalid size %s", size => {
    expect(drawingPlacementSchema.safeParse({ ...placement(), layoutLabel: { size } }).success).toBe(false);
  });
  it.each([-90, 45, 360])("rejects unsupported rotation %s", rotation => {
    expect(drawingPlacementSchema.safeParse({ ...placement(), layoutLabel: { rotation } }).success).toBe(false);
  });
  it.each(["compact", "standard", "large"] as const)("round trips %s at each orientation", size => {
    for (const rotation of [0, 90, 270] as const) {
      const source = { ...placement(), labelPosition: { x: 82.25, y: 12 },
        layoutLabel: { size, rotation, leader: true, visible: true, position: "bottom-left" as const } };
      expect(drawingPlacementSchema.parse(source).layoutLabel).toEqual(source.layoutLabel);
      const geometry = resolveLayoutLabelGeometry({ placement: source, symbol: createSymbol() });
      expect(geometry.point).toMatchObject(source.labelPosition);
      expect(geometry.fontSize).toBe({ compact: 2, standard: 2.5, large: 3 }[size]);
      expect(geometry.rotation).toBe(rotation);
      expect(geometry.textCorners).toHaveLength(4);
      expect(renderLayoutLabelText(source.id, geometry)).toContain(`rotate(${rotation} 82.25 12)`);
    }
  });
  it("retains automatic centred-duct rotation, but honors a horizontal override", () => {
    const source = { ...placement(), symbolId: GENERATED_WIRE_TRAY_SYMBOL_ID,
      versionId: GENERATED_WIRE_TRAY_VERSION_ID, rotation: 270, layoutLabel: { visible: true } };
    const symbol = createGeneratedWireTrayLibrarySymbol();
    expect(resolveLayoutLabelGeometry({ placement: source, symbol }).rotation).toBe(90);
    expect(resolveLayoutLabelGeometry({ placement: { ...source, layoutLabel: { visible: true, rotation: 0 } }, symbol }).rotation).toBe(0);
  });
  it("renders no leader unless explicitly enabled; hidden and inside-body labels suppress it", () => {
    for (const preferences of [undefined, { leader: false }, { leader: true, visible: false }]) {
      const geometry = resolveLayoutLabelGeometry({ placement: { ...placement(), layoutLabel: preferences }, symbol: createSymbol() });
      expect(geometry.leader).toBeUndefined();
      expect(renderLayoutLabelLeader("test", geometry)).toBe("");
    }
    for (const rotation of [0, 90, 45]) {
      const geometry = resolveLayoutLabelGeometry({ placement: { ...placement(), rotation,
        layoutLabel: { leader: true, position: "center" } }, symbol: createSymbol() });
      expect(geometry.leader).toBeUndefined();
    }
  });
  it("ends a leader before text and starts on the displayed rotated body boundary", () => {
    const source = { ...placement(), rotation: 90, labelPosition: { x: 100, y: 37.5 },
      layoutLabel: { leader: true } };
    const geometry = resolveLayoutLabelGeometry({ placement: source, symbol: createSymbol() });
    expect(geometry.leader?.from.x).toBeCloseTo(47.5);
    expect(geometry.leader!.to.x).toBeLessThan(Math.min(...geometry.textCorners.map(p => p.x)));
    expect(renderLayoutLabelLeader(source.id, geometry)).not.toMatch(/marker-end|wire-id|terminal/);
  });
  it("suppresses zero/overlapping leader spans and escapes full tag text", () => {
    const geometry = resolveLayoutLabelGeometry({ placement: { ...placement(), tag: '<TAG>&"long"',
      labelPosition: { x: 40, y: 29.5 }, layoutLabel: { leader: true } }, symbol: createSymbol() });
    expect(geometry.leader).toBeUndefined();
    expect(renderLayoutLabelText("safe", geometry)).toContain('&lt;TAG&gt;&amp;&quot;long&quot;');
  });
  it("reset clears only manual coordinates; presets never change engineering identity", () => {
    const source = { ...placement(), labelPosition: { x: 100, y: 45 },
      layoutLabel: { size: "large" as const, rotation: 270 as const, leader: true, visible: true } };
    const reset = { ...source, labelPosition: undefined };
    expect(resolveLayoutLabelGeometry({ placement: reset, symbol: createSymbol() })).toMatchObject({
      size: "large", rotation: 270, point: { x: 40, y: 28.65 } });
    expect(reset.layoutLabel).toEqual(source.layoutLabel);
    expect(reset.assetId).toBe(source.assetId);
  });
  it.each([.2, .5, 1])("inverts projected manual coordinates at physical scale %s", factor => {
    const sheet = { size: "A3_LANDSCAPE" as const, width: 420, height: 297, gridSize: 5, titleBlock: {} };
    const backplane = { ...createBackplanePlacement({ panelPlacement: placement(), sheet }), x: 50, y: 40,
      layoutScale: { mode: "manual" as const, value: 1 / factor } };
    const source = { ...placement(), layoutParentId: backplane.id,
      labelPosition: { x: 40, y: 22 }, layoutPosition: { xMm: 45, yMm: 70 } };
    const displayed = resolveLayoutHelperDisplayPlacement({ sheet, placement: source, backplane });
    expect(displayed.layoutDimensions!.lengthMm).toBeCloseTo(source.layoutDimensions!.lengthMm * factor);
    expect(layoutLabelDisplayToStored(displayed.labelPosition!, source, displayed)).toEqual(source.labelPosition);
    const changed = { x: displayed.labelPosition!.x + 12, y: displayed.labelPosition!.y - 5 };
    const stored = layoutLabelDisplayToStored(changed, source, displayed);
    const after = resolveLayoutHelperDisplayPlacement({ sheet, placement: { ...source, labelPosition: stored }, backplane });
    expect(after.labelPosition).toEqual(changed);
    expect(resolveLayoutLabelGeometry({ placement: after, symbol: createSymbol() }).fontSize).toBe(2);
  });
});
