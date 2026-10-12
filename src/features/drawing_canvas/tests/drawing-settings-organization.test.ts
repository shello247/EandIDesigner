// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDrawingModel } from "../data/schema";
import { DrawingSettingsDialog } from "../ui/components/drawing-settings-dialog";
import { applyProjectCopyProposal, buildProjectCopyProposal, isDrawingSettingsDirty, mapDrawingSettingsIssues, normalizeDrawingSettingsDraft } from "../logic/services/drawing-settings-draft";
import { drawingSettingsDraftSchema, type DrawingSettingsDraft } from "../data/schema";

describe("Drawing Settings organization", () => {
  it("separates linked Project membership from printable title-block fields", () => {
    const model = createDefaultDrawingModel();
    const markup = renderToStaticMarkup(
      createElement(DrawingSettingsDialog, {
        drawingTitle: "PLC Panel",
        drawingDescription: "Main automation panel",
        linkedProject: {
          id: "project_1",
          name: "North Oropouche Upgrade",
          projectNumber: "NOP-01",
          client: "WASA",
          status: "active"
        },
        projectOptions: [
          {
            id: "project_1",
            name: "North Oropouche Upgrade",
            projectNumber: "NOP-01",
            client: "WASA",
            status: "active"
          }
        ],
        projectOptionsLoading: false,
        titleBlock: model.titleBlock,
        measurementUnit: model.measurementUnit,
        onCancel: vi.fn(),
        onRetryProjectOptions: vi.fn(),
        onApply: vi.fn()
      })
    );

    expect(markup).toContain("General");
    expect(markup).toContain("Printed Title Block");
    expect(markup).toContain("Linked Project");
    expect(markup).toContain("Drawing description");
    expect(markup).toContain("Use project details");
    expect(markup).toContain("Printed project / process");
    expect(markup).toContain('name="projectId"');
    expect(markup).toContain('name="titleBlock.project"');
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('rows="3"');
  });

  it("explains archived-current compatibility", () => {
    const model = createDefaultDrawingModel();
    const markup = renderToStaticMarkup(
      createElement(DrawingSettingsDialog, {
        drawingTitle: "Legacy Drawing",
        drawingDescription: "",
        linkedProject: {
          id: "project_archived",
          name: "Completed Project",
          status: "archived"
        },
        projectOptions: [
          {
            id: "project_archived",
            name: "Completed Project",
            status: "archived"
          }
        ],
        projectOptionsLoading: false,
        titleBlock: model.titleBlock,
        measurementUnit: model.measurementUnit,
        onCancel: vi.fn(),
        onRetryProjectOptions: vi.fn(),
        onApply: vi.fn()
      })
    );
    expect(markup).toContain("Completed Project (Archived)");
    expect(markup).toContain("retains its archived Project");
  });
});

const project = { id: "project1", name: "New process", client: "New client", status: "active" as const };
const initial: DrawingSettingsDraft = { title: "Panel", description: "", projectId: project.id, measurementUnit: "mm", titleBlock: { client: "Old client", project: "Old process", date: "As issued", revision: "R2" } };

describe("drawing settings pure drafts", () => {
  it("normalizes optional blanks and whitespace without mutating the draft", () => {
    const draft = { ...initial, title: " Panel ", description: "  ", titleBlock: { date: " ", client: " Customer " } };
    expect(normalizeDrawingSettingsDraft(draft)).toMatchObject({ title: "Panel", description: undefined, titleBlock: { client: "Customer", date: undefined } });
    expect(draft.titleBlock.client).toBe(" Customer ");
    expect(isDrawingSettingsDirty({ ...initial, title: " Panel ", description: undefined }, initial)).toBe(false);
    for (const change of [{ title: "Other" }, { projectId: "" }, { description: "Scope" }, { measurementUnit: "in" as const }, { titleBlock: { revision: "B" } }]) {
      expect(isDrawingSettingsDirty({ ...initial, ...change }, initial)).toBe(true);
    }
  });
  it("routes and deduplicates Zod issues including inactive printed fields", () => {
    const result = drawingSettingsDraftSchema.safeParse({ ...initial, title: "", titleBlock: { client: "x".repeat(161) } });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected invalid draft");
    expect(mapDrawingSettingsIssues(result.error.issues).map(({ field, tab }) => [field, tab])).toEqual([["title", "general"], ["titleBlock.client", "printed"]]);
    expect(mapDrawingSettingsIssues([{ path: ["unknown"], message: "Error" }, { path: ["title"], message: "Second" }])).toHaveLength(1);
  });
  it("copies exactly reviewed client/project fields, leaving source and other fields intact", () => {
    const proposal = buildProjectCopyProposal(initial.titleBlock, project);
    expect(proposal.changes.map(change => [change.field, change.before, change.after])).toEqual([["client", "Old client", "New client"], ["project", "Old process", "New process"]]);
    expect(applyProjectCopyProposal(initial.titleBlock, proposal, project)).toEqual({ ...initial.titleBlock, client: "New client", project: "New process" });
    expect(initial.titleBlock.client).toBe("Old client");
  });
  it("keeps missing values, identifies no changes, and rejects stale or missing sources", () => {
    const incomplete = { ...project, client: undefined };
    const proposal = buildProjectCopyProposal(initial.titleBlock, incomplete);
    expect(proposal.missingFields).toEqual(["Client"]);
    expect(applyProjectCopyProposal(initial.titleBlock, proposal, incomplete)?.client).toBe("Old client");
    expect(applyProjectCopyProposal(initial.titleBlock, proposal, project)).toBeNull();
    expect(applyProjectCopyProposal(initial.titleBlock, proposal, { ...incomplete, id: "different" })).toBeNull();
    expect(applyProjectCopyProposal(initial.titleBlock, proposal, null)).toBeNull();
    expect(buildProjectCopyProposal({ client: " New client ", project: "New process" }, project).changes).toEqual([]);
  });
});

describe("drawing settings local interactions", () => {
  let host: HTMLDivElement;
  let root: Root;
  let props: ComponentProps<typeof DrawingSettingsDialog>;
  let dialogDescriptors: Array<[string, PropertyDescriptor | undefined]>;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    dialogDescriptors = ["showModal", "close"].map(name => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]);
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    props = { drawingTitle: initial.title, drawingDescription: "", linkedProject: project, projectOptions: [project], projectOptionsLoading: false,
      titleBlock: initial.titleBlock, measurementUnit: "mm", onCancel: vi.fn(), onRetryProjectOptions: vi.fn(), onApply: vi.fn() };
  });
  afterEach(async () => {
    await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    for (const [name, descriptor] of dialogDescriptors) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
  });
  const render = async () => { await act(async () => root.render(createElement(DrawingSettingsDialog, props))); };
  const button = (text: string) => Array.from(host.querySelectorAll("button")).find(node => node.textContent === text)!;
  const click = async (text: string) => { await act(async () => button(text).click()); };
  const input = (name: string) => host.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  const fill = async (name: string, value: string) => {
    await act(async () => {
      const node = input(name);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, value);
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const submit = async () => { await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); };

  it("keeps draft through tabs and asynchronous project loads; applies only once", async () => {
    await render();
    expect(button("Apply").disabled).toBe(true);
    await fill("title", "Draft panel");
    await click("Printed Title Block");
    await fill("titleBlock.client", "Draft client");
    props = { ...props, projectOptions: null, projectOptionsLoading: true };
    await render();
    expect(input("title").value).toBe("Draft panel");
    expect(input("titleBlock.client").value).toBe("Draft client");
    expect(button("Use project details").disabled).toBe(true);
    props = { ...props, projectOptions: [project], projectOptionsLoading: false };
    await render();
    await click("General");
    expect(props.onApply).not.toHaveBeenCalled();
    await submit(); await submit();
    expect(props.onApply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ title: "Draft panel", titleBlock: expect.objectContaining({ client: "Draft client" }) }), project);
  });
  it("cancels review on tab change and invalidates refreshed source permanently", async () => {
    await render(); await click("Printed Title Block"); await click("Use project details");
    expect(button("Apply").disabled).toBe(true);
    await click("General"); await click("Printed Title Block");
    expect(host.textContent).not.toContain("Review project details");
    await click("Use project details");
    props = { ...props, projectOptions: [{ ...project, client: "Refreshed" }] };
    await render();
    expect(host.textContent).not.toContain("Review project details");
    expect(host.textContent).toContain("Project details changed");
    expect(input("titleBlock.client").value).toBe("Old client");
    props = { ...props, projectOptions: [project] }; await render();
    expect(host.textContent).not.toContain("Review project details");
    await click("Use project details"); await click("Cancel copy");
    expect(input("titleBlock.client").value).toBe("Old client");
    await click("Use project details"); await click("Use these values");
    expect(input("titleBlock.client").value).toBe("New client");
    expect(props.onApply).not.toHaveBeenCalled();
    await click("Use project details");
    expect(host.textContent).toContain("Already matches the linked project");
  });
  it("selects the invalid field's tab and preserves all entered values", async () => {
    await render(); await click("Printed Title Block"); await fill("titleBlock.client", "x".repeat(161)); await click("General");
    await submit();
    expect(button("Printed Title Block!").getAttribute("aria-selected")).toBe("true");
    expect(input("titleBlock.client").getAttribute("aria-invalid")).toBe("true");
    expect(input("titleBlock.client").value).toHaveLength(161);
    expect(props.onApply).not.toHaveBeenCalled();
    await fill("titleBlock.client", "Valid"); await click("General"); await fill("title", ""); await click("Printed Title Block"); await submit();
    expect(button("General!").getAttribute("aria-selected")).toBe("true");
    expect(input("title").getAttribute("aria-invalid")).toBe("true");
  });
  it("protects dirty cancel and isolates keyboard events without background handlers", async () => {
    await render(); await fill("title", "Keep me"); await click("Cancel");
    expect(window.confirm).toHaveBeenCalledTimes(1); expect(props.onCancel).not.toHaveBeenCalled();
    const background = vi.fn(); window.addEventListener("keydown", background);
    try {
      await act(async () => button("General").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })));
      expect(button("Printed Title Block").getAttribute("aria-selected")).toBe("true");
      expect(background).not.toHaveBeenCalled();
      const editorUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
      await act(async () => button("Printed Title Block").dispatchEvent(editorUndo));
      expect(editorUndo.defaultPrevented).toBe(true);
      const textUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
      await act(async () => input("titleBlock.client").dispatchEvent(textUndo));
      expect(textUndo.defaultPrevented).toBe(false);
    } finally { window.removeEventListener("keydown", background); }
    vi.mocked(window.confirm).mockReturnValue(true); await click("Cancel");
    expect(props.onCancel).toHaveBeenCalledOnce();
  });
  it("retains retry and project-resolution errors without resetting the draft", async () => {
    props = { ...props, linkedProject: null }; await render();
    await fill("title", "Edited");
    props = { ...props, projectOptionsError: "Projects unavailable", projectOptions: null }; await render();
    await click("Retry"); expect(props.onRetryProjectOptions).toHaveBeenCalledOnce();
    expect(input("title").value).toBe("Edited");
    props = { ...props, projectOptionsError: undefined, projectOptions: [project] }; await render();
    await act(async () => { input("projectId").value = project.id; input("projectId").dispatchEvent(new Event("change", { bubbles: true })); });
    props = { ...props, projectOptions: [] }; await render(); await submit();
    expect(host.textContent).toContain("no longer available"); expect(props.onApply).not.toHaveBeenCalled();
  });
});
