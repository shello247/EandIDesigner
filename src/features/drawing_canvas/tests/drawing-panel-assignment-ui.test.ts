import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDefaultDrawingModel, type DrawingModel } from "../data/schema";
import { toSheetCanvasModel } from "../logic/commands/drawing-sheet-commands";
import { createPanelEnclosurePlacement } from "../logic/services/drawing-asset-containment";
import {
  autosizeLayoutHelperToBackplane,
  createBackplanePlacement
} from "../logic/services/drawing-backplane-layouts";
import { EMPTY_CANVAS_SELECTION } from "../logic/services/drawing-selection";
import type { ApprovedDrawingSymbol } from "../types";
import { AddSymbolAssetDialog } from "../ui/components/add-symbol-asset-dialog";
import { AddTerminalBlockDialog } from "../ui/components/add-terminal-block-dialog";
import { DrawingObjectInspector } from "../ui/components/drawing-object-inspector";

const noop = () => {};
const symbol: ApprovedDrawingSymbol = {
  symbolId: "symbol_breaker",
  versionId: "version_breaker",
  versionNumber: 1,
  symbolKey: "breaker",
  displayName: "Circuit Breaker",
  category: "terminal_block",
  svg: '<svg viewBox="0 0 40 60"></svg>',
  metadata: {
    symbolKey: "breaker",
    displayName: "Circuit Breaker",
    category: "terminal_block",
    viewBox: { x: 0, y: 0, width: 40, height: 60 },
    physicalWidthMm: 40,
    physicalHeightMm: 60,
    layoutUsage: "both",
    anchors: [{ key: "LINE", x: 20, y: 0, kind: "terminal" }],
    terminals: [{ key: "L", label: "Line", anchorKey: "LINE", panelSide: "single" }],
    panelWiring: { assetType: "breaker", tagPrefix: "MCB", schematicScale: 0.5 }
  }
};

function fixture(detailed: boolean, showPanel: boolean): DrawingModel {
  const model = createDefaultDrawingModel();
  const sheet = model.sheets[0];
  const panel = createPanelEnclosurePlacement({
    model, activeSheet: sheet, assetId: "panel", tag: "PLC-001"
  });
  return {
    ...model,
    assets: [
      { id: "panel", tag: "PLC-001", title: "Control Panel", type: "panel" },
      { id: "breaker", tag: "MCB-101", title: symbol.displayName, type: "breaker",
        symbolId: symbol.symbolId, versionId: symbol.versionId }
    ],
    sheets: [{
      ...sheet,
      panelDrawingContext: detailed
        ? { kind: "detailed_panel_wiring", panelAssetId: "panel" }
        : undefined,
      placements: [
        ...(showPanel ? [panel] : []),
        { id: "breaker_occurrence", assetId: "breaker", containerAssetId: "panel",
          symbolId: symbol.symbolId, versionId: symbol.versionId,
          tag: "MCB-101", role: "device", x: 40, y: 50, rotation: 0, scale: 1 }
      ]
    }]
  };
}

function renderInspector(model: DrawingModel) {
  const props: ComponentProps<typeof DrawingObjectInspector> = {
    model: toSheetCanvasModel(model, model.sheets[0].id),
    packageModel: model,
    activeSheet: model.sheets[0],
    symbols: [symbol],
    measurementUnit: "mm",
    selection: { ...EMPTY_CANVAS_SELECTION, placementIds: ["breaker_occurrence"] },
    onArrangeSelection: noop,
    onAssetChange: noop,
    onOpenAssetLinkDialog: noop,
    onPlacementChange: noop,
    onAssetComponentSelectionsChange: noop,
    onConnectionDisplayModeChange: noop,
    onFitPanelConnectionView: noop,
    onEditTerminalStrip: noop,
    onReuseTerminalStrip: noop,
    onConnectionChange: noop,
    onConnectionRemove: noop,
    onConnectionRouteRecover: noop,
    onConnectionRouteReset: noop,
    onAnnotationChange: noop,
    onAnnotationRemove: noop,
    onConnectedWireScheduleSynchronize: noop,
    onConnectedWireSchedulePaginationRemove: noop,
    onConnectedWireScheduleOpenPartOne: noop
  };
  return renderToStaticMarkup(createElement(DrawingObjectInspector, props));
}

describe("panel assignment authoring boundary", () => {
  it.each([
    { detailed: false, showPanel: false },
    { detailed: false, showPanel: true },
    { detailed: true, showPanel: false },
    { detailed: true, showPanel: true }
  ])("removes generic reassignment without altering saved membership ($detailed / $showPanel)", ({ detailed, showPanel }) => {
    const model = fixture(detailed, showPanel);
    const before = structuredClone(model);
    const markup = renderInspector(model);
    expect(markup).not.toContain("Location / Enclosure");
    expect(markup).not.toContain("selected-placement-container");
    expect(markup).not.toContain("Contained in panel");
    expect(markup).toContain("Asset Identity");
    expect(markup).toContain("Engineering Attributes");
    expect(markup).toContain("Connection Display");
    if (detailed) expect(markup).toContain("Panel Component");
    expect(model).toEqual(before);
  });

  it("keeps panel membership inherited from an editable parent backplane in Panel Layout", () => {
    const model = fixture(false, true);
    const sheet = model.sheets[0];
    const panel = sheet.placements[0];
    const canvas = toSheetCanvasModel(model, sheet.id);
    const backplane = createBackplanePlacement({ panelPlacement: panel, sheet: canvas.sheet });
    const layoutPlacement = autosizeLayoutHelperToBackplane({
      placement: sheet.placements[1], backplane, symbol,
      sheet: canvas.sheet, parentPanel: panel
    });
    sheet.placements = [panel, backplane, layoutPlacement];
    const markup = renderInspector(model);
    expect(layoutPlacement.containerAssetId).toBe("panel");
    expect(layoutPlacement.layoutParentId).toBe(backplane.id);
    expect(markup).toContain("Panel Layout");
    expect(markup).toContain('id="layout-symbol-backplane"');
    expect(markup).not.toContain("Location / Enclosure");
  });

  it("does not offer panel assignment in Add Symbol, even when a panel is visible", () => {
    const markup = renderToStaticMarkup(createElement(AddSymbolAssetDialog, {
      model: fixture(false, true), symbol, symbols: [symbol], onCancel: noop, onPlace: noop
    }));
    expect(markup).toContain('role="dialog"');
    expect(markup).not.toContain("Contained in panel");
    expect(markup).not.toContain("add-symbol-container");
  });

  it("does not retain a panel assignment control in the legacy terminal dialog", () => {
    const markup = renderToStaticMarkup(createElement(AddTerminalBlockDialog, {
      model: fixture(false, true), onCancel: noop, onPlace: noop
    }));
    expect(markup).toContain('role="dialog"');
    expect(markup).not.toContain("Contained in panel");
    expect(markup).not.toContain("terminal-block-container");
  });
});
