// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WireCatalogManager } from "../ui/components/wire-catalog-manager";

vi.mock("../api/actions", () => ({
  createWireCatalogEntryAction: vi.fn(), deleteWireCatalogEntryAction: vi.fn(),
  setDefaultWireCatalogEntryAction: vi.fn(), updateWireCatalogEntryAction: vi.fn()
}));

describe("Wire Catalog nested dialog keyboard ownership", () => {
  let host: HTMLDivElement;
  let root: Root;
  const parentEscape = vi.fn();
  const onClose = vi.fn();
  const onEntriesUpdated = vi.fn();
  const parentListener = (event: KeyboardEvent) => {
    if (event.key === "Escape") parentEscape();
  };
  const render = async (open: boolean) => {
    await act(async () => root.render(createElement(WireCatalogManager, {
      open, initialEntries: [], onClose, onEntriesUpdated
    })));
  };
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    document.addEventListener("keydown", parentListener);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    document.removeEventListener("keydown", parentListener);
    host.remove();
    vi.unstubAllGlobals();
  });
  it("consumes Escape before the workbench's document listener", async () => {
    await render(true);
    await act(async () => {
      host.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Escape", bubbles: true, cancelable: true
      }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(parentEscape).not.toHaveBeenCalled();
  });
  it("releases keyboard ownership while closed and reacquires it on reopen", async () => {
    await render(true);
    await render(false);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(parentEscape).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    await render(true);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(parentEscape).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
