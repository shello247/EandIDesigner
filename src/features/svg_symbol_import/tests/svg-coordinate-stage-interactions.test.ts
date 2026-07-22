// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SymbolMetadata } from "@/features/symbol_registry/data/schema";
import { SvgPreviewPanel } from "@/features/symbol_registry/ui/components/svg-preview-panel";
import { ImportAnchorReviewCanvas } from "../ui/components/import-anchor-review-canvas";

const viewBox = { x: 0, y: 0, width: 42, height: 143 };
const stageWidth = (620 * viewBox.width) / viewBox.height;
const stageScale = stageWidth / viewBox.width;

class TestResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    void callback;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

const svg = `
<svg viewBox="0 0 42 143" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="4" width="30" height="135" fill="white" stroke="black"/>
</svg>`;

const metadata: SymbolMetadata = {
  symbolKey: "phoenix_test",
  displayName: "Phoenix Test",
  category: "other",
  viewBox,
  anchors: [
    { key: "2.5", x: 21.5, y: 39.5, kind: "terminal" },
    { key: "3.1", x: 21.5, y: 48.5, kind: "terminal" },
    { key: "3.2", x: 21.5, y: 52.5, kind: "terminal" }
  ],
  terminals: [
    {
      key: "2.5",
      label: "0 V DC",
      function: "Negative",
      anchorKey: "2.5",
      requiredForWiring: true
    },
    {
      key: "3.1",
      label: "13",
      function: "DC OK",
      anchorKey: "3.1",
      requiredForWiring: true
    },
    {
      key: "3.2",
      label: "14",
      function: "DC OK",
      anchorKey: "3.2",
      requiredForWiring: true
    }
  ]
};

describe("SVG coordinate-stage interactions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    vi.spyOn(SVGSVGElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: stageWidth,
      bottom: 620,
      width: stageWidth,
      height: 620,
      toJSON: () => ({})
    });
    Object.defineProperty(SVGSVGElement.prototype, "getScreenCTM", {
      configurable: true,
      value: () => ({
        inverse: () => ({
          a: 1 / stageScale,
          b: 0,
          c: 0,
          d: 1 / stageScale,
          e: 0,
          f: 0
        })
      })
    });
    Object.defineProperty(SVGSVGElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    });
    Object.defineProperty(SVGSVGElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: vi.fn(() => true)
    });
    Object.defineProperty(SVGSVGElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn()
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("uses one aligned stage and keeps Registry markers at 18 screen pixels", async () => {
    await act(async () => {
      root.render(createElement(SvgPreviewPanel, { svg, metadata }));
    });

    const stage = container.querySelector('[data-testid="svg-coordinate-stage"]');
    const artwork = container.querySelector(
      '[data-testid="svg-coordinate-artwork"]'
    );
    const overlay = container.querySelector<SVGSVGElement>(
      '[data-testid="svg-coordinate-overlay"]'
    );
    const marker = container.querySelector<SVGCircleElement>(
      '[data-terminal-hotspot="3.2"]'
    );

    expect(stage).not.toBeNull();
    expect(artwork?.parentElement).toBe(stage);
    expect(overlay?.parentElement).toBe(stage);
    expect(Number(marker?.getAttribute("r")) * 2 * stageScale).toBeCloseTo(18);
  });

  it("selects the nearest marker, pins it, clears it, and supports the keyboard", async () => {
    await act(async () => {
      root.render(createElement(SvgPreviewPanel, { svg, metadata }));
    });

    const overlay = container.querySelector<SVGSVGElement>(
      '[data-testid="svg-coordinate-overlay"]'
    );
    const terminalControl = container.querySelector<SVGCircleElement>(
      '[data-terminal-hotspot="3.1"]'
    );
    expect(overlay).not.toBeNull();
    expect(terminalControl).not.toBeNull();

    await act(async () => {
      overlay?.dispatchEvent(
        new TestPointerEvent("pointermove", {
          bubbles: true,
          clientX: 21.5 * stageScale,
          clientY: 52.2 * stageScale
        })
      );
    });
    expect(container.querySelector('[data-terminal-tooltip="3.2"]')).not.toBeNull();

    await act(async () => {
      overlay?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: 21.5 * stageScale,
          clientY: 52.2 * stageScale
        })
      );
      overlay?.dispatchEvent(new TestPointerEvent("pointerleave", { bubbles: true }));
    });
    expect(container.querySelector('[data-terminal-tooltip="3.2"]')).not.toBeNull();

    await act(async () => {
      overlay?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: 2 * stageScale,
          clientY: 2 * stageScale
        })
      );
    });
    expect(container.querySelector('[data-terminal-tooltip="3.2"]')).toBeNull();

    await act(async () => {
      terminalControl?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      terminalControl?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
      );
      terminalControl?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(container.querySelector('[data-terminal-tooltip="3.1"]')).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(container.querySelector('[data-terminal-tooltip="3.1"]')).toBeNull();
  });

  it("drags the nearest import anchor through the screen matrix and cancels cleanly", async () => {
    const onAnchorMove = vi.fn();
    await act(async () => {
      root.render(
        createElement(ImportAnchorReviewCanvas, {
          svg,
          metadata: {
            viewBox,
            anchors: metadata.anchors
          },
          onAnchorMove
        })
      );
    });

    const overlay = container.querySelector<SVGSVGElement>(
      '[data-testid="svg-coordinate-overlay"]'
    );
    const marker = container.querySelector<SVGCircleElement>(
      '[data-import-anchor-marker="2.5"]'
    );
    expect(Number(marker?.getAttribute("r")) * 2 * stageScale).toBeCloseTo(18);

    await act(async () => {
      overlay?.dispatchEvent(
        new TestPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerId: 7,
          clientX: 21.5 * stageScale,
          clientY: 39.5 * stageScale
        })
      );
      overlay?.dispatchEvent(
        new TestPointerEvent("pointermove", {
          bubbles: true,
          pointerId: 7,
          clientX: 1000,
          clientY: -100
        })
      );
    });
    expect(onAnchorMove).toHaveBeenLastCalledWith("2.5", 42, 0);

    await act(async () => {
      overlay?.dispatchEvent(
        new TestPointerEvent("pointercancel", {
          bubbles: true,
          pointerId: 7
        })
      );
      overlay?.dispatchEvent(
        new TestPointerEvent("pointermove", {
          bubbles: true,
          pointerId: 7,
          clientX: 20,
          clientY: 20
        })
      );
    });
    expect(onAnchorMove).toHaveBeenCalledTimes(1);

    await act(async () => {
      overlay?.dispatchEvent(
        new TestPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerId: 8,
          clientX: 21.5 * stageScale,
          clientY: 39.5 * stageScale
        })
      );
      overlay?.dispatchEvent(
        new TestPointerEvent("lostpointercapture", {
          bubbles: true,
          pointerId: 8
        })
      );
      overlay?.dispatchEvent(
        new TestPointerEvent("pointermove", {
          bubbles: true,
          pointerId: 8,
          clientX: 30,
          clientY: 30
        })
      );
    });
    expect(onAnchorMove).toHaveBeenCalledTimes(1);
  });
});
