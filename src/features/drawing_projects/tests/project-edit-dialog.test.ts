// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectEditButton } from "../ui/components/project-edit-button";
import { DrawingProjectForm } from "../ui/components/drawing-project-form";
import type { DrawingProjectDetail } from "../types";

const mocks = vi.hoisted(() => ({ save: vi.fn(), create: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
vi.mock("../api/actions", () => ({ updateDrawingProjectAction: mocks.save, createDrawingProjectAction: mocks.create }));
vi.mock("@/features/drawing_clients/ui/components/client-create-dialog", () => ({
  ClientCreateDialog: ({ onCreated, onCancel }: { onCreated: (value: { id: string; name: string }) => void; onCancel: () => void }) => createElement("div", { role: "dialog", "aria-label": "Add Client" },
    createElement("button", { onClick: () => onCreated({ id: "new-client", name: "New client" }) }, "Finish client"),
    createElement("button", { onClick: onCancel }, "Cancel client"))
}));

const project: DrawingProjectDetail = { id: "p1", name: "Test", projectNumber: "PRJ-000003", clientId: "c1", client: "Client", description: "Existing description", status: "active", drawingCount: 1, createdAt: "2026-09-11", updatedAt: "2026-09-11" };
const clients = [{ id: "c1", name: "Client" }];
let host: HTMLDivElement;
let root: Root;
function button(text: string) { return Array.from(host.querySelectorAll("button")).find(node => node.textContent?.trim() === text)!; }
async function click(text: string) { await act(async () => button(text).click()); }
async function setName(value: string) {
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>("#project-name")!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(ProjectEditButton, { project, clients })));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("project editing popup", () => {
  it("keeps the form out of the main view and focuses it only when opened", async () => {
    expect(host.querySelector("input")).toBeNull();
    button("Edit project").focus();
    await click("Edit project");
    expect(document.activeElement?.id).toBe("project-name");
    expect(button("Save Project").disabled).toBe(true);
    await click("Cancel");
    expect(host.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(button("Edit project"));
  });
  it("confirms dirty cancellation and retains a refused discard", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await click("Edit project"); await setName("Unsaved"); await click("Cancel");
    expect(host.querySelector<HTMLInputElement>("input")?.value).toBe("Unsaved");
    confirm.mockReturnValue(true); await click("Cancel"); await click("Edit project");
    expect(host.querySelector<HTMLInputElement>("input")?.value).toBe("Test");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("saves through the existing action, closes and refreshes", async () => {
    mocks.save.mockResolvedValue({ ok: true, data: project });
    await click("Edit project"); await setName("Updated"); await click("Save Project");
    const submitted = mocks.save.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(submitted)).toEqual({ projectId: "p1", name: "Updated", clientId: "c1", description: "Existing description" });
    expect(host.querySelector("dialog")).toBeNull();
    expect(host.textContent).not.toContain("Project details saved."); expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("retains failed saves and focuses the invalid field", async () => {
    mocks.save.mockResolvedValue({ ok: false, error: "Invalid name", fieldErrors: { name: "Invalid name" } });
    await click("Edit project"); await setName("Keep draft"); await click("Save Project");
    expect(host.querySelector<HTMLInputElement>("input")?.value).toBe("Keep draft");
    expect(document.activeElement?.id).toBe("project-name");
    expect(host.textContent).toContain("Invalid name");
  });
  it("blocks edits and dismissal while saving, and preserves a rejected request", async () => {
    let reject!: (error: Error) => void;
    mocks.save.mockImplementation(() => new Promise((_, failure) => { reject = failure; }));
    await click("Edit project"); await setName("Pending draft"); await click("Save Project");
    expect(button("Cancel").disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>("input")?.disabled).toBe(true);
    await act(async () => host.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true })));
    expect(host.querySelector("dialog")).not.toBeNull();
    await act(async () => reject(new Error("Network error")));
    expect(host.textContent).toContain("Your changes are still here");
    expect(host.querySelector<HTMLInputElement>("input")?.value).toBe("Pending draft");
  });
  it("keeps the draft while adding a client without nesting popups", async () => {
    await click("Edit project"); await setName("Draft with client"); await click("Add Client");
    expect(host.querySelector("dialog")).toBeNull();
    await click("Finish client");
    expect(host.querySelector<HTMLInputElement>("input")?.value).toBe("Draft with client");
    expect(host.querySelector<HTMLSelectElement>("select")?.value).toBe("new-client");
  });
  it("retains the standalone creation form", async () => {
    await act(async () => root.render(createElement(DrawingProjectForm, { initialClients: clients })));
    expect(host.querySelector("dialog")).toBeNull(); expect(button("Create Project")).toBeDefined();
  });
});
