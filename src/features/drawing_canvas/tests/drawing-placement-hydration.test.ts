// @vitest-environment jsdom

import { act, createElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDrawingModel, type DrawingPlacement } from "../data/schema";
import { createPanelEnclosurePlacement } from "../logic/services/drawing-asset-containment";
import { PlacementOverlay } from "../ui/canvas/PlacementOverlay";

describe("panel placement hydration", () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = undefined;
    container.remove();
    vi.unstubAllGlobals();
  });

  it.each(["enclosure", "connection_reference"] as const)(
    "preserves the %s title and existing SVG nodes during hydration",
    async (kind) => {
      const model = createDefaultDrawingModel();
      const sheet = model.sheets[0];
      const panel = createPanelEnclosurePlacement({
        model, activeSheet: sheet, tag: "JB001", title: "Tank & Pump <Panel>"
      });
      const placement: DrawingPlacement = kind === "enclosure" ? panel : {
        ...panel, enclosure: undefined, title: "Tank & Pump <Panel>",
        panelConnectionView: {
          kind: "schematic_reference", sourceBackplanePlacementId: "backplane_source",
          displayWidth: 100, displayHeight: 120
        }
      };
      const noop = () => undefined;
      const element = createElement("svg", null, createElement(PlacementOverlay, {
        model: { sheet: { ...sheet.page, titleBlock: model.titleBlock },
          placements: [placement], connections: [], annotations: [] },
        symbols: [], selectedPlacementId: placement.id,
        selectedPlacementIds: new Set([placement.id]), connectionMode: "idle",
        viewportZoom: 1, screenScale: 1, dimensionSnapFeedback: null, dragState: null,
        onFocusCanvas: noop, onSelectPlacement: noop, onConnectionSelect: noop,
        onDragStart: noop, onDragMove: noop, onDragEnd: noop, onDragCancel: noop,
        onPlacementRemove: noop, onResizeStart: noop, onResizeMove: noop,
        onResizeEnd: noop, onResizeCancel: noop, onRotationStart: noop,
        onRotationMove: noop, onRotationEnd: noop, onRotationCancel: noop
      }));
      container.innerHTML = renderToString(element);
      const originalSvg = container.querySelector("svg");
      const originalTitle = container.querySelector("title");
      expect(originalTitle?.textContent).toBe("JB001 Tank & Pump <Panel>");
      const recoverableErrors: unknown[] = [];
      await act(async () => {
        root = hydrateRoot(container, element, {
          onRecoverableError: (error) => recoverableErrors.push(error)
        });
      });
      expect(recoverableErrors).toEqual([]);
      expect(container.querySelector("svg")).toBe(originalSvg);
      expect(container.querySelector("title")).toBe(originalTitle);
      expect(originalTitle?.textContent).toBe("JB001 Tank & Pump <Panel>");
    }
  );
});
