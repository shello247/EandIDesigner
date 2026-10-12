import { describe, expect, it } from "vitest";
import { ATTRIBUTE_TYPE_SEEDS } from "@/features/engineering_attributes/api/public";
import { itemProfileV3Schema, type ItemProfileV3, type SpecificationEntry } from "../data/profile-v3-schema";
import { itemEngineeringProfileSchema } from "../data/schema";
import { projectItemProfileV3 } from "../logic/services/profile-v3-adapter";
import { hashItemEngineeringContent } from "../logic/services/item-engineering-revision";

const type = ATTRIBUTE_TYPE_SEEDS.find(t => t.analysisKey === "length")!;
export function specification(patch: Partial<SpecificationEntry> = {}): SpecificationEntry {
  return { id: "length", groupKey: "device", title: "Length", description: "", type,
    source: { kind: "manufacturer" }, payload: { kind: "quantity", value: 50, unit: "mm" },
    scope: { kind: "device" }, modes: [], condition: "", ratingBasis: "continuous", evidence: [], ...patch };
}
export function profileV3(): ItemProfileV3 {
  return { version: 3, deviceType: "io_module", groups: [{ key: "device", label: "Device", context: "device" }],
    modes: [], entries: [], channels: [], terminals: [] };
}
describe("Item profile v3", () => {
  it("projects both legacy versions without changing serialized content or hashes", () => {
    const legacy = itemEngineeringProfileSchema.parse({ version: 1, deviceType: "other", groups: [{ key: "old", label: "Named legacy group", context: "device",
      attributes: { version: 1, values: [{ definitionKey: "physical_width", definitionVersion: 1, kind: "quantity", value: 5, unit: "cm", source: { kind: "manufacturer", reference: "old source" } }] } }], terminalConductorRanges: [] });
    const before = hashItemEngineeringContent(legacy);
    const projected = projectItemProfileV3(legacy);
    expect(hashItemEngineeringContent(legacy)).toBe(before);
    expect(projected.groups[0].label).toBe("Named legacy group");
    expect(projected.modes).toEqual([]);
    expect(projected.entries[0].payload).toEqual({ kind: "quantity", value: 5, unit: "cm" });
    const entry = specification();
    const v2 = itemEngineeringProfileSchema.parse({ version: 2, deviceType: "other", groups: profileV3().groups,
      entries: [{ id: entry.id, groupKey: entry.groupKey, title: entry.title, description: entry.description, type: entry.type, source: entry.source, payload: entry.payload }] });
    const v2hash = hashItemEngineeringContent(v2);
    expect(projectItemProfileV3(v2).entries[0].id).toBe(entry.id);
    expect(hashItemEngineeringContent(v2)).toBe(v2hash);
  });
  it("retains conditional alternatives and competing values but identifies exact duplicates", () => {
    const profile = profileV3();
    profile.entries = [specification(), specification({ id: "other", payload: { kind: "quantity", value: 60, unit: "mm" } })];
    expect(itemProfileV3Schema.safeParse(profile).success).toBe(true);
    profile.entries[1].payload = profile.entries[0].payload;
    expect(itemProfileV3Schema.safeParse(profile).success).toBe(false);
    profile.entries[1].condition = "At maximum load";
    expect(itemProfileV3Schema.safeParse(profile).success).toBe(true);
  });
  it("allows explicit unknowns without default values and rejects broken mode identities", () => {
    const profile = profileV3(); profile.entries = [specification({ payload: { kind: "unresolved", status: "missing", reason: "No manufacturer value available" } })];
    expect(itemProfileV3Schema.parse(profile).entries[0].payload).not.toHaveProperty("value");
    profile.entries[0].modes = [{ setId: "power", choiceId: "chassis" }];
    expect(itemProfileV3Schema.safeParse(profile).success).toBe(false);
    profile.modes = [{ id: "power", label: "Loop power", choices: [{ id: "chassis", label: "Chassis" }, { id: "external", label: "External" }] }];
    expect(itemProfileV3Schema.safeParse(profile).success).toBe(true);
  });
  it("requires evidence for shared terminals and refuses unused channel members", () => {
    const profile = profileV3();
    profile.terminals = [{ id: "1", number: "1", function: "Input", connectable: true, shared: false, evidence: [] }];
    profile.channels = [0,1].map(n => ({ id: `ch${n}`, number: `${n}`, direction: "input", signalType: "analog_current", ranges: [], terminals: [{ terminalId: "1", function: "Common" }], evidence: [] }));
    expect(itemProfileV3Schema.safeParse(profile).success).toBe(false);
    profile.terminals[0].shared = true; profile.terminals[0].evidence = [{ kind: "engineer", reference: "Synthetic shared-common evidence" }];
    expect(itemProfileV3Schema.safeParse(profile).success).toBe(true);
    profile.terminals[0].connectable = false;
    expect(itemProfileV3Schema.safeParse(profile).success).toBe(false);
  });
});
