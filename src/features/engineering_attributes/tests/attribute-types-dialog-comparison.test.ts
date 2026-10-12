// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttributeTypesDialog } from "../ui/components/attribute-types-dialog";
import { listAttributeTypesAction, loadCurrentAttributeTypeAction, saveAttributeTypeAction } from "../api/actions";
import type { AttributeTypeOption } from "../api/public";

vi.mock("../api/actions", () => ({
  listAttributeTypesAction: vi.fn(), loadCurrentAttributeTypeAction: vi.fn(),
  saveAttributeTypeAction: vi.fn(), setAttributeTypeStatusAction: vi.fn()
}));
vi.mock("@/shared/ui/engineering-dialog", () => ({
  EngineeringDialog: ({ children }: { children: ReactNode }) => createElement("section", null, children)
}));

const type = (id: string, revisionNumber = 1): AttributeTypeOption => ({
  typeId: id, revisionId: `${id}-v${revisionNumber}`, revisionNumber, status: "active", analysisKey: null,
  definition: { label: id, description: "Synthetic type", category: "documentation", valueKind: "number", payloadKind: "scalar", precision: 0 }
});

describe("Attribute Types comparison editor ownership", () => {
  let host: HTMLDivElement; let root: Root;
  const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>("button")]
    .find(node => node.getAttribute("aria-label") === label || node.textContent === label)!;
  const click = async (label: string) => { await act(async () => button(label).click()); };
  const rename = async (name: string) => {
    const input = host.querySelector<HTMLInputElement>('input[maxlength="160"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, name);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const submit = async () => { await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); };
  beforeEach(async () => {
    vi.useFakeTimers(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(listAttributeTypesAction).mockResolvedValue({ ok: true, data: { items: [type("Alpha"), type("Beta")], page: 1, pages: 1, count: 2 } });
    vi.mocked(saveAttributeTypeAction).mockResolvedValue({ ok: false, code: "REVISION_CONFLICT", fieldErrors: {}, error: "Type changed in another browser." });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(createElement(AttributeTypesDialog, { onClose: vi.fn(), onDirty: vi.fn(), returnLabel: "Back to Edit details" })));
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  });
  afterEach(async () => {
    await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  });
  it.each(["ready", "delayed"] as const)("never carries a %s comparison from Type Alpha into Type Beta", async mode => {
    let complete: ((result: Awaited<ReturnType<typeof loadCurrentAttributeTypeAction>>) => void) | undefined;
    if (mode === "ready") vi.mocked(loadCurrentAttributeTypeAction).mockResolvedValue({ ok: true, data: type("Alpha", 2) });
    else vi.mocked(loadCurrentAttributeTypeAction).mockReturnValue(new Promise(resolve => { complete = resolve; }));
    await click("Edit type Alpha"); await rename("Alpha draft"); await submit(); await click("Compare latest type");
    if (mode === "ready") expect(host.textContent).toContain("Latest saved type · version 2");
    await click("Cancel"); await click("Edit type Beta");
    if (complete) await act(async () => complete!({ ok: true, data: type("Alpha", 2) }));
    expect(host.textContent).not.toContain("Latest saved type");
    expect(host.querySelector<HTMLInputElement>('input[maxlength="160"]')!.value).toBe("Beta");
    await rename("Beta draft"); await submit();
    expect(vi.mocked(saveAttributeTypeAction).mock.calls.at(-1)![0]).toMatchObject({ typeId: "Beta", expectedRevision: 1, definition: { label: "Beta draft" } });
  });
});
