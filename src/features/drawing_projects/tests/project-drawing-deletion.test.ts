// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectDrawingTable } from "../ui/components/project-drawing-table";

const mocks = vi.hoisted(() => ({ remove: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/drawing_canvas/api/actions", () => ({ deleteDrawingAction: mocks.remove }));
let host: HTMLDivElement;
let root: Root;
const result = { page: 1, pageSize: 25, totalCount: 1, totalPages: 1, items: [{ id: "drawing-1", title: "Test drawing", status: "draft", updatedAt: "2026-09-11T00:00:00Z" }] };
async function click(label: string) {
  await act(async () => Array.from(host.querySelectorAll("button")).find(node => node.textContent?.trim() === label)!.click());
}
beforeEach(async () => {
  vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(ProjectDrawingTable, { projectId: "project-1", result })));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("linked drawing deletion", () => {
  it("retains Open and requires the shared permanent-delete confirmation", async () => {
    expect(host.querySelector('a[href="/drawings/drawing-1"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label="Delete Test drawing"]')).not.toBeNull();
    await click("Delete");
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("This action cannot be undone.");
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Test drawing");
    expect(mocks.remove).not.toHaveBeenCalled();
    await click("Cancel");
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("deletes only the chosen drawing and refreshes the current project", async () => {
    mocks.remove.mockResolvedValue({ ok: true, data: { id: "drawing-1" } });
    await click("Delete"); await click("Delete drawing");
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith("drawing-1");
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
  it("retains the confirmation and displays a failed deletion", async () => {
    mocks.remove.mockResolvedValue({ ok: false, error: "Deletion failed" });
    await click("Delete"); await click("Delete drawing");
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Deletion failed");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("disables repeated submission and cancellation while pending", async () => {
    let resolve!: (result: { ok: boolean; error: string }) => void;
    mocks.remove.mockImplementation(() => new Promise(done => { resolve = done; }));
    await click("Delete"); await click("Delete drawing");
    expect(Array.from(host.querySelectorAll('[role="dialog"] button')).every(node => (node as HTMLButtonElement).disabled)).toBe(true);
    await act(async () => resolve({ ok: false, error: "Retry later" }));
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
  it("has no deletion control in the empty state", async () => {
    await act(async () => root.render(createElement(ProjectDrawingTable, { projectId: "project-1", result: { ...result, items: [], totalCount: 0 } })));
    expect(host.querySelector("button")).toBeNull();
    expect(host.textContent).toContain("No drawings are linked");
  });
});
