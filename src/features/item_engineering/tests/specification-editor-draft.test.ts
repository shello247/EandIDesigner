import { expect,it } from "vitest";
import { ATTRIBUTE_TYPE_SEEDS } from "@/features/engineering_attributes/api/public";
import { editSpecificationProfile, changeSpecificationUnit, materializeSpecificationDraft } from "../logic/services/specification-editor-draft";
import { acknowledgeSectionSave } from "../logic/services/item-workspace-state";
import type { ItemProfileV3 } from "../data/profile-v3-schema";
const profile: ItemProfileV3 = { version: 3,deviceType: "io_module",groups: [{ key: "g",label: "Device",context: "device" }],modes: [],channels: [],terminals: [],entries: [
  { id: "temperature",groupKey: "g",title: "Temperature",description: "",type: ATTRIBUTE_TYPE_SEEDS.find(t => t.analysisKey === "operating_temperature_range")!,
    payload: { kind: "range",minimum: 0,maximum: 100,unit: "°C" },source: { kind: "manufacturer" },scope: { kind: "device" },modes: [],evidence: [],condition: "",ratingBasis: "continuous" }
] };
it("converts displayed values when units change instead of changing engineering meaning", () => {
  const draft = editSpecificationProfile(profile);
  draft.rows[0] = changeSpecificationUnit(draft.rows[0],"°F");
  expect(materializeSpecificationDraft(draft).profile.entries[0].payload).toEqual({ kind: "range",minimum: 32,maximum: 212,unit: "°F" });
});
it("retains invalid raw text for correction without writing zero", () => {
  const draft = editSpecificationProfile(profile); draft.rows[0].value.minimum = "";
  expect(materializeSpecificationDraft(draft).errors).toHaveProperty("rows.temperature.payload");
  draft.rows[0].availability = "missing";
  expect(materializeSpecificationDraft(draft).profile.entries[0].payload).toEqual({ kind: "unresolved",status: "missing",reason: "" });
});
it("preserves edits made while a batch save is in flight", () => {
  const saved = editSpecificationProfile(profile); const submitted = structuredClone(saved); submitted.rows[0].value.maximum = "110";
  const draft = structuredClone(submitted); draft.rows[0].value.maximum = "120";
  const result = acknowledgeSectionSave({ saved,draft },submitted,submitted);
  expect(result.saved.rows[0].value.maximum).toBe("110"); expect(result.draft.rows[0].value.maximum).toBe("120");
});
