// @vitest-environment jsdom
import { act, createElement, createRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchInput } from "./search-input";

describe("shared search input", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  });
  it("retains labels, form values, limits and a decorative trailing icon", async () => {
    await act(async () => root.render(createElement("form", null,
      createElement("label", { htmlFor: "query" }, "Search items"),
      createElement(SearchInput, { id: "query", name: "q", defaultValue: "Phoenix", maxLength: 120, placeholder: "Item or part", "aria-describedby": "help" }),
      createElement("span", { id: "help" }, "Find a saved item"))));
    const input = host.querySelector("input")!;
    expect(input.labels?.[0].textContent).toBe("Search items");
    expect(new FormData(host.querySelector("form")!).get("q")).toBe("Phoenix");
    expect(input.maxLength).toBe(120); expect(input.type).toBe("text");
    expect(input.getAttribute("aria-describedby")).toBe("help");
    const icon = host.querySelector("svg")!;
    expect(input.nextElementSibling).toBe(icon);
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("focusable")).toBe("false");
    expect(host.querySelector("button")).toBeNull();
  });
  it("preserves controlled typing without introducing its own state or debounce", async () => {
    const changed = vi.fn();
    function ControlledSearch() {
      const [value, setValue] = useState("");
      return createElement(SearchInput, { value, onChange: event => { changed(event.currentTarget.value); setValue(event.currentTarget.value); } });
    }
    await act(async () => root.render(createElement(ControlledSearch)));
    const input = host.querySelector("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "3273100");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(changed).toHaveBeenCalledExactlyOnceWith("3273100"); expect(input.value).toBe("3273100");
  });
  it("forwards the input ref, autofocus and keyboard events", async () => {
    const ref = createRef<HTMLInputElement>(); const keydown = vi.fn();
    await act(async () => root.render(createElement(SearchInput, { ref, autoFocus: true, onKeyDown: keydown })));
    expect(ref.current).toBe(host.querySelector("input")); expect(document.activeElement).toBe(ref.current);
    await act(async () => { ref.current!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    expect(keydown).toHaveBeenCalledOnce();
  });
  it("retains explicit search semantics, disabled and read-only states", async () => {
    await act(async () => root.render(createElement(SearchInput, { type: "search", "aria-label": "Search sheets", disabled: true, readOnly: true, defaultValue: "Saved sheet" })));
    const input = host.querySelector("input")!;
    expect(input.type).toBe("search"); expect(input.disabled).toBe(true); expect(input.readOnly).toBe(true);
    expect(input.getAttribute("aria-label")).toBe("Search sheets");
  });
  it("keeps container layout classes separate from input presentation", async () => {
    await act(async () => root.render(createElement("label", null, "Search types", createElement(SearchInput, { containerClassName: "flex-1 mt-1", className: "custom-control" }))));
    const input = host.querySelector("input")!;
    expect(input.labels?.[0].textContent).toBe("Search types");
    expect(input.classList.contains("search-input-control")).toBe(true);
    expect(input.classList.contains("custom-control")).toBe(true);
    expect(input.classList.contains("flex-1")).toBe(false);
    expect(input.parentElement!.classList.contains("flex-1")).toBe(true);
  });
});
