import { expect,it } from "vitest";
import { ATTRIBUTE_TYPE_SEEDS } from "@/features/engineering_attributes/api/public";
import { previewAttributePaste } from "../logic/services/attribute-paste";
import { editSpecificationProfile,materializeSpecificationDraft,type SpecificationEditorDraft } from "../logic/services/specification-editor-draft";
import { reconcileSpecificationDraft } from "../logic/services/attribute-conflict-review";

function draft(): SpecificationEditorDraft {
  let id = 0;
  return { profile: { version: 3,deviceType: "io_module",groups: [{ key: "g",label: "Device",context: "device" }],modes: [],channels: [],terminals: [] },
    rows: previewAttributePaste("Length\t50\tmm",ATTRIBUTE_TYPE_SEEDS,"g",() => `r${++id}`).rows };
}
it("previews existing types and preserves blank cells as missing", () => {
  let id = 0;
  const result = previewAttributePaste("Specification\tValue\tUnit\tCondition\tSource\nOperating temperature range\t−20 to 70\t°C\tDevice\tDatasheet p. 3\nLength\t\tmm",ATTRIBUTE_TYPE_SEEDS,"g",() => `${++id}`);
  expect(result.errors).toEqual([]); expect(result.rows[1].availability).toBe("missing");
  const materialized = materializeSpecificationDraft({ ...draft(),rows: result.rows });
  expect(materialized.errors).toEqual({}); expect(materialized.profile.entries[0].payload).toEqual({ kind: "range",minimum: -20,maximum: 70,unit: "°C" });
  expect(materialized.profile.entries[1].payload).not.toHaveProperty("value");
  expect(previewAttributePaste("Invented global type\t12\tA",ATTRIBUTE_TYPE_SEEDS,"g",() => "x").errors[0].message).toContain("cannot create global types");
});
it("proposes disjoint changes and requires a choice for overlapping edits", () => {
  const base = draft(); const local = structuredClone(base); const remote = structuredClone(base);
  local.rows[0].value.value = "60"; remote.rows[0].entry.condition = "Front cover closed";
  const merge = reconcileSpecificationDraft(base,local,remote);
  expect(merge.conflicts).toEqual([]); expect(merge.draft.rows[0].value.value).toBe("60"); expect(merge.draft.rows[0].entry.condition).toBe("Front cover closed");
  remote.rows[0].value.value = "70";
  const conflict = reconcileSpecificationDraft(base,local,remote); expect(conflict.conflicts).toHaveLength(1);
  const chosen = reconcileSpecificationDraft(base,local,remote,{ [conflict.conflicts[0].path]: "saved" });
  expect(chosen.conflicts).toEqual([]); expect(chosen.draft.rows[0].value.value).toBe("70");
  expect(base.rows[0].value.value).toBe("50");
});
it("does not silently accept deletion when the other version changed that row", () => {
  const base = draft(); const local = structuredClone(base); local.rows = [];
  const remote = structuredClone(base); remote.rows[0].value.value = "70";
  const result = reconcileSpecificationDraft(base,local,remote); expect(result.conflicts).toHaveLength(1);
  expect(reconcileSpecificationDraft(base,local,remote,{ [result.conflicts[0].path]: "draft" }).draft.rows).toEqual([]);
});
it("offers one conflict for a value edited during an earlier save acknowledgement",()=>{
  const initial=draft();const base=editSpecificationProfile(materializeSpecificationDraft(initial).profile);
  const local=structuredClone(initial);local.rows[0].value.value="60";
  const saved=materializeSpecificationDraft(base).profile;if(saved.entries[0].payload.kind!=="quantity")throw new Error("Invalid fixture");saved.entries[0].payload.value=55;
  const remote=editSpecificationProfile(saved);const result=reconcileSpecificationDraft(base,local,remote);
  expect(result.conflicts).toHaveLength(1);
  const resolved=reconcileSpecificationDraft(base,local,remote,{[result.conflicts[0].path]:"draft"});
  expect(materializeSpecificationDraft(resolved.draft).profile.entries[0].payload).toEqual({kind:"quantity",value:60,unit:"mm"});
});
