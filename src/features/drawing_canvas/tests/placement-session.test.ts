// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, StrictMode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { usePlacementSession } from "../ui/canvas/hooks/usePlacementSession";
import { createDefaultDrawingModel } from "../data/schema";
import type { PlacementSource } from "../logic/services/drawing-placement";

let root: Root;
let container: HTMLDivElement;
let controller: ReturnType<typeof usePlacementSession>;
const model = createDefaultDrawingModel();
const source: Omit<PlacementSource, "id"> = {
  sheetId: model.sheets[0].id, tool: "symbol", label: "Device",
  identity: { mode: "create", tagMode: "automatic" },
  canRotate: true, targetKind: "sheet", build: () => model
};
function Harness() {
  const session = usePlacementSession();
  useEffect(() => { controller = session; }, [session]);
  return null;
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(StrictMode, null, createElement(Harness))));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
describe("placement controller in React Strict Mode", () => {
  it("starts transiently without calling insertion logic", async () => {
    let calls = 0;
    await act(async () => controller.start({ ...source, build: () => { calls++; return model; } }));
    expect(controller.session).not.toHaveProperty("repeat");
    expect(controller.current.current).toBe(controller.session);
    expect(calls).toBe(0);
    expect(model.assets).toEqual([]);
  });
  it("cancels synchronously and invalidates outstanding catalogue requests", async () => {
    await act(async () => controller.start(source));
    const generation = controller.generation.current;
    await act(async () => {
      controller.cancel();
      expect(controller.current.current).toBeNull();
      expect(controller.generation.current).toBeGreaterThan(generation);
    });
    expect(controller.session).toBeNull();
  });
  it("advances a queue within the session and gives a newly started tool a new identity", async () => {
    await act(async () => controller.start(source));
    const previous = controller.session!;
    await act(async () => controller.replace({ ...previous, identity: { mode: "reference", assetId: "second" } }));
    expect(controller.session!.id).toBe(previous.id);
    expect(controller.current.current!.identity).toEqual({ mode: "reference", assetId: "second" });
    await act(async () => controller.start(source));
    expect(controller.session!.id).not.toBe(previous.id);
  });
  it("invalidates asynchronous work when unmounted", async () => {
    await act(async () => controller.start(source));
    const generation = controller.generation;
    const before = generation.current;
    await act(async () => root.unmount());
    expect(generation.current).toBeGreaterThan(before);
    expect(controller.current.current).toBeNull();
    root = createRoot(container);
  });
});
