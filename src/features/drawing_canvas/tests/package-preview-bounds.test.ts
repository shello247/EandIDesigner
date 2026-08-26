// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDrawingModel } from "../data/schema";
import { buildDrawingSectionIndex } from "../logic/services/drawing-sections";
import { PackagePreviewSurface } from "../ui/components/package-preview-surface";

type ObserverCallback = IntersectionObserverCallback;

class TestIntersectionObserver {
  static callbacks: ObserverCallback[] = [];
  readonly callback: ObserverCallback;

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    TestIntersectionObserver.callbacks.push(callback);
  }

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];
}

describe("package preview mounting bounds", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    TestIntersectionObserver.callbacks = [];
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("keeps no more than twelve full sheet SVGs mounted", async () => {
    const base = createDefaultDrawingModel();
    const sourceSheet = base.sheets[0];
    const model = {
      ...base,
      sheets: Array.from({ length: 20 }, (_, index) => ({
        ...sourceSheet,
        id: `preview_sheet_${index + 1}`,
        name: `Preview Sheet ${index + 1}`
      }))
    };

    await act(async () => {
      root.render(
        createElement(PackagePreviewSurface, {
          model,
          sectionIndex: buildDrawingSectionIndex(model),
          drawingTitle: "Bounded Preview",
          symbols: [],
          onExitPreview: () => undefined,
          previewPdfHref: "/drawings/test/pdf"
        })
      );
    });

    await act(async () => {
      TestIntersectionObserver.callbacks.forEach((callback) =>
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      );
    });

    expect(
      container.querySelectorAll('[data-preview-svg-mounted="true"]')
        .length
    ).toBeLessThanOrEqual(12);
    expect(
      container.querySelectorAll('[data-testid="drawing-package-preview-page"]')
        .length
    ).toBe(20);
  });
});
