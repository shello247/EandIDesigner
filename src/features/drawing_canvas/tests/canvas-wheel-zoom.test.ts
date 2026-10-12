// @vitest-environment jsdom

import { act, createElement, StrictMode, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasWheelZoom } from "../ui/canvas/hooks/useCanvasWheelZoom";

function Canvas({ onZoom }: { onZoom: (event: WheelEvent) => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  useCanvasWheelZoom(viewportRef, onZoom);
  // createElement forwards this ref to React; it does not read ref.current.
  // eslint-disable-next-line react-hooks/refs
  return createElement("div", { ref: viewportRef, "data-testid": "canvas" },
    createElement("svg", null, createElement("rect")));
}

function wheel(options: WheelEventInit = {}) {
  return new WheelEvent("wheel", {
    bubbles: true, cancelable: true, ctrlKey: true, deltaY: -120,
    clientX: 123, clientY: 456, ...options
  });
}

describe("canvas-only native wheel zoom", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderCanvas = async (onZoom = vi.fn()) => {
    await act(async () => root.render(createElement(StrictMode, null,
      createElement(Canvas, { onZoom }))));
    return host.querySelector<HTMLDivElement>('[data-testid="canvas"]')!;
  };

  it("registers non-passively on the canvas, not on the document", async () => {
    const registrations = vi.spyOn(EventTarget.prototype, "addEventListener");
    const canvas = await renderCanvas();
    const nativeWheel = registrations.mock.calls.flatMap((args, index) =>
      args[0] === "wheel" && registrations.mock.contexts[index] === canvas ? [args] : []);
    expect(nativeWheel.length).toBeGreaterThan(0);
    expect(nativeWheel.every((args) => (args[2] as AddEventListenerOptions).passive === false)).toBe(true);
  });

  it("cancels native page zoom from an SVG descendant and handles the gesture once", async () => {
    const onZoom = vi.fn((event: WheelEvent) => expect(event.defaultPrevented).toBe(true));
    const canvas = await renderCanvas(onZoom);
    const event = wheel();
    expect(canvas.querySelector("rect")!.dispatchEvent(event)).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(onZoom).toHaveBeenCalledExactlyOnceWith(event);
    expect(onZoom.mock.calls[0][0]).toMatchObject({ clientX: 123, clientY: 456 });
  });

  it.each([{ ctrlKey: false }, { ctrlKey: false, shiftKey: true }])(
    "leaves ordinary scrolling alone: %j", async (options) => {
      const onZoom = vi.fn();
      const canvas = await renderCanvas(onZoom);
      const event = wheel(options);
      expect(canvas.dispatchEvent(event)).toBe(true);
      expect(event.defaultPrevented).toBe(false);
      expect(onZoom).not.toHaveBeenCalled();
    }
  );

  it("does not intercept Ctrl+wheel outside the canvas", async () => {
    const onZoom = vi.fn();
    await renderCanvas(onZoom);
    const event = wheel();
    expect(host.dispatchEvent(event)).toBe(true);
    expect(onZoom).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("uses the latest callback without retaining duplicate listeners", async () => {
    const previous = vi.fn();
    await renderCanvas(previous);
    const latest = vi.fn();
    const canvas = await renderCanvas(latest);
    const event = wheel();
    canvas.dispatchEvent(event);
    expect(previous).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledExactlyOnceWith(event);
  });

  it("removes the listener when the canvas unmounts", async () => {
    const onZoom = vi.fn();
    const canvas = await renderCanvas(onZoom);
    await act(async () => root.render(null));
    const event = wheel();
    expect(canvas.dispatchEvent(event)).toBe(true);
    expect(onZoom).not.toHaveBeenCalled();
  });

  it("does not also zoom the canvas when the browser event cannot be cancelled", async () => {
    const onZoom = vi.fn();
    const canvas = await renderCanvas(onZoom);
    canvas.dispatchEvent(wheel({ cancelable: false }));
    expect(onZoom).not.toHaveBeenCalled();
  });

  it("respects a gesture already consumed by a child control", async () => {
    const onZoom = vi.fn();
    const canvas = await renderCanvas(onZoom);
    const event = wheel();
    event.preventDefault();
    canvas.dispatchEvent(event);
    expect(onZoom).not.toHaveBeenCalled();
  });
});
