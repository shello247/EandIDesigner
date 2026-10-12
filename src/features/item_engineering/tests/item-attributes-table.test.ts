// @vitest-environment jsdom
import { act,createElement } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { ItemAttributesTable,type SpecificationWorkspace } from "../ui/components/item-attributes-table";
import { ItemWorkspaceProvider } from "../ui/components/item-workspace-context";
import { saveItemAttributeBatchAction,loadAttributeEvidenceAction } from "../api/batch-actions";
import { ATTRIBUTE_TYPE_SEEDS } from "@/features/engineering_attributes/api/public";

vi.mock("../api/batch-actions",() => ({ saveItemAttributeBatchAction: vi.fn(),loadAttributeEvidenceAction: vi.fn(),loadSpecificationWorkspaceAction: vi.fn(),previewItemAttributeBatchAction: vi.fn() }));
const workspace: SpecificationWorkspace = { itemName: "Synthetic I/O",status: "active",revisionId: "r1",revisionNumber: 1,updatedAt: "2026-09-18T11:00:00.000Z",
  profile: { version: 3,deviceType: "io_module",groups: [{ key: "g",label: "Device",context: "device" }],modes: [],terminals: [],channels: [],entries: [{ id: "length",groupKey: "g",title: "Length",description: "",
    type: ATTRIBUTE_TYPE_SEEDS.find(t => t.analysisKey === "length")!,payload: { kind: "quantity",value: 50,unit: "mm" },source: { kind: "manufacturer" },scope: { kind: "device" },modes: [],condition: "",ratingBasis: "continuous",evidence: [] }] } };
let host: HTMLDivElement; let root: Root;
const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === label)!;
async function edit(value: string) {
  const input = host.querySelector<HTMLInputElement>('[aria-label="Length Value"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,value); input.dispatchEvent(new Event("input",{ bubbles: true })); });
}
async function render(readOnly = false) {
  const providerProps = { itemId: "item",revisionId: "r1",readOnly,children: undefined };
  await act(async () => root.render(createElement(ItemWorkspaceProvider,providerProps,createElement(ItemAttributesTable,{ workspace,onSaved: vi.fn() }))));
}
beforeEach(async () => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true); vi.clearAllMocks(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("does not fetch attachment metadata before expansion and keeps blank values unsaved", async () => {
  await render(); expect(loadAttributeEvidenceAction).not.toHaveBeenCalled();
  await edit(""); await act(async () => button("Save changes").click());
  expect(saveItemAttributeBatchAction).not.toHaveBeenCalled(); expect(host.textContent).toContain("Blank values are not saved as zero");
});
it("batches edits and retains newer input when a delayed save acknowledges", async () => {
  let complete: (value: Awaited<ReturnType<typeof saveItemAttributeBatchAction>>) => void = () => {};
  vi.mocked(saveItemAttributeBatchAction).mockReturnValue(new Promise(resolve => { complete = resolve; }));
  await render(); await edit("60"); await act(async () => button("Save changes").click());
  expect(vi.mocked(saveItemAttributeBatchAction).mock.calls[0][0]).toMatchObject({ updates: [{ id: "length",payload: { value: 60 } }],expectedLatestRevisionId: "r1" });
  await edit("70");
  const saved = structuredClone(workspace); saved.revisionId = "r2"; saved.profile.entries[0].payload = { kind: "quantity",value: 60,unit: "mm" };
  await act(async () => complete({ ok: true,data: { ...saved,created: true,warnings: [],summary: { added: 0,updated: 1,removed: 0 } } }));
  expect(host.querySelector<HTMLInputElement>('[aria-label="Length Value"]')!.value).toBe("70");
  expect(button("Save changes").disabled).toBe(false);
});
it("renders archived specifications read-only", async () => {
  await render(true); expect(button("Save changes")).toBeUndefined();
  expect(host.querySelector('fieldset')?.hasAttribute("disabled")).toBe(true);
});
