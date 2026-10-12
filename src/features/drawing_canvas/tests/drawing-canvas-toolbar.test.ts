// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrawingCanvasAddMenu } from "../ui/components/drawing-canvas-add-menu";
import { DrawingRepresentationControl } from "../ui/components/drawing-representation-control";

describe("drawing canvas toolbar interactions", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  });
  const key = async (element: Element, value: string) => {
    await act(async () => { element.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true })); });
  };
  const options = () => ({
    onAddPanel: vi.fn(), onAddTerminalBlock: vi.fn(), onCopyTerminalBlock: vi.fn(),
    onAddNote: vi.fn(), onAddConnectedWireSchedule: vi.fn(), canAddConnectedWireSchedule: false
  });
  it("opens, navigates enabled actions, closes with Escape and restores focus without inserting", async () => {
    const actions = options();
    await act(async () => root.render(createElement(DrawingCanvasAddMenu, actions)));
    const trigger = host.querySelector("button")!;
    await key(trigger, "ArrowDown");
    expect(host.querySelector('[role="menu"]')).not.toBeNull();
    await key(trigger, "End");
    expect(document.activeElement?.textContent).toContain("Note");
    await key(document.activeElement!, "ArrowDown");
    expect(document.activeElement?.textContent).toContain("Panel / enclosure");
    await key(document.activeElement!, "Escape");
    expect(host.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    for (const action of Object.values(actions)) if (typeof action === "function") expect(action).not.toHaveBeenCalled();
  });
  it("keeps contextual actions and dismisses before invoking the original callback once", async () => {
    const actions = options();
    await act(async () => root.render(createElement(DrawingCanvasAddMenu, { ...actions, showDrawingItems: false })));
    await act(async () => host.querySelector("button")!.click());
    expect(host.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
    expect(host.querySelector<HTMLButtonElement>('[role="menuitem"]:disabled')).not.toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click());
    expect(actions.onAddNote).toHaveBeenCalledOnce();
    expect(host.querySelector('[role="menu"]')).toBeNull();
  });
  it("dismisses on an outside pointer and prevents disabled insertion", async () => {
    await act(async () => root.render(createElement(DrawingCanvasAddMenu, options())));
    await act(async () => host.querySelector("button")!.click());
    await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(host.querySelector('[role="menu"]')).toBeNull();
    await act(async () => root.render(createElement(DrawingCanvasAddMenu, { ...options(), disabled: true })));
    await act(async () => host.querySelector("button")!.click());
    expect(host.querySelector('[role="menu"]')).toBeNull();
  });
  it("uses a labelled select, preserves the view guard and removes obsolete tab semantics", async () => {
    const changed = vi.fn();
    await act(async () => root.render(createElement(DrawingRepresentationControl, { schematic: false, disabled: false, onChange: changed })));
    const select = host.querySelector("select")!;
    expect(select.getAttribute("aria-label")).toBe("Drawing view");
    expect(select.value).toBe("outline");
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    await act(async () => { select.value = "schematic"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(changed).toHaveBeenCalledExactlyOnceWith(true);
    await act(async () => root.render(createElement(DrawingRepresentationControl, { schematic: true, disabled: true, onChange: changed })));
    expect(select.disabled).toBe(true);
    expect(select.getAttribute("aria-controls")).toBe("drawing-schematic-panel");
  });
});
