// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SchematicPreview } from "../ui/components/schematic-preview";
import { createPowerSupplyExample } from "../logic/services/example";
import * as projection from "../logic/services/projection";

describe("embedded schematic presentation", () => {
  let host: HTMLDivElement; let toolbar: HTMLDivElement; let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    host = document.createElement("div"); toolbar = document.createElement("div");
    document.body.append(toolbar, host); root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount()); host.remove(); toolbar.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  });
  it("portals controls once, preserves qualifications and does not re-project when zoom changes", async () => {
    const source = createPowerSupplyExample(); const before = JSON.stringify(source);
    const project = vi.spyOn(projection, "projectSchematic");
    await act(async () => root.render(createElement(SchematicPreview, { source, presentation: { kind: "embedded", toolbarHost: toolbar } })));
    expect(host.querySelector("h2")).toBeNull();
    expect(host.textContent).toContain("Read-only");
    expect(host.textContent).toContain("IEC review pending");
    expect(toolbar.querySelectorAll('[aria-label="Zoom in preview"]')).toHaveLength(1);
    expect(host.querySelector('[aria-label="Zoom in preview"]')).toBeNull();
    const count = project.mock.calls.length;
    await act(async () => toolbar.querySelector<HTMLButtonElement>('[aria-label="Zoom in preview"]')!.click());
    expect(toolbar.textContent).toContain("125%");
    expect(project).toHaveBeenCalledTimes(count);
    expect(JSON.stringify(source)).toBe(before);
    await act(async () => root.unmount());
    expect(toolbar.childElementCount).toBe(0);
    root = createRoot(host);
  });
  it("keeps standalone controls, heading and comparison tabs as the default", async () => {
    await act(async () => root.render(createElement(SchematicPreview, { source: createPowerSupplyExample(), allowOutline: true })));
    expect(host.querySelector("h2")).not.toBeNull();
    expect(host.querySelector('[role="tablist"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Zoom in preview"]')).not.toBeNull();
    expect(toolbar.childElementCount).toBe(0);
  });
  it("handles an unavailable host and projection failure without publishing controls", async () => {
    const source = createPowerSupplyExample();
    await act(async () => root.render(createElement(SchematicPreview, { source, presentation: { kind: "embedded", toolbarHost: null } })));
    expect(toolbar.childElementCount).toBe(0);
    vi.spyOn(projection, "projectSchematic").mockImplementation(() => { throw new Error("Invalid fixture"); });
    await act(async () => root.render(createElement(SchematicPreview, { source: { ...source }, presentation: { kind: "embedded", toolbarHost: toolbar } })));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("original drawing is unchanged");
    expect(toolbar.childElementCount).toBe(0);
  });
});
