import { describe, expect, it } from "vitest";
import {
  ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY,
  normalizeEngineeringQuantity,
  validateEngineeringAttributeValue,
  engineeringAttributeContainerSchema,
  listApplicableEngineeringAttributeDefinitionsForSubject,
  validateEngineeringAttributeContainer
} from "@/features/engineering_attributes/api/public";

it("supports sourced breaker attributes without inventing missing or fractional poles", () => {
  const source = { kind: "manufacturer" as const, reference: "Synthetic manufacturer sheet" };
  const poles = { definitionKey:"pole_count",definitionVersion:1 as const,kind:"number" as const,value:3,source };
  expect(validateEngineeringAttributeValue({value:poles,subject:{kind:"item",typeToken:"breaker"}})).toEqual([]);
  expect(validateEngineeringAttributeValue({value:{...poles,value:2.5},subject:{kind:"item",typeToken:"breaker"}}).length).toBeGreaterThan(0);
  expect(validateEngineeringAttributeValue({value:poles,subject:{kind:"item",typeToken:"instrument"}}).length).toBeGreaterThan(0);
  expect(normalizeEngineeringQuantity({definition:ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY.get("physical_width")!,value:5.25,unit:"cm"})).toEqual({ok:true,value:52.5,unit:"mm"});
});
import {
  itemEngineeringProfileSchema,
  itemSelectionSchema,
  terminalConductorRangeSchema
} from "../data/schema";
import { resolveItemEngineeringProfile } from "../logic/services/item-engineering-profile";

function quantity(definitionKey: string, value: number, unit: string) {
  return {
    definitionKey, definitionVersion: 1, kind: "quantity", value, unit,
    source: { kind: "manufacturer", reference: "Synthetic product datasheet" }
  };
}

function profile(values: unknown[] = []) {
  return {
    version: 1, deviceType: "power_supply",
    groups: [{ key: "input", context: "supply_input", label: "Supply input",
      attributes: { version: 1, values } }],
    terminalConductorRanges: []
  };
}

describe("Item engineering contracts", () => {
  it("reuses definition applicability for Item subjects without offering project purpose", () => {
    const keys = listApplicableEngineeringAttributeDefinitionsForSubject({
      kind: "item", typeToken: "breaker"
    }).map((definition) => definition.key);
    expect(keys).toContain("rated_current");
    expect(keys).not.toContain("engineering_purpose");
    expect(keys).not.toContain("conductor_cross_section");
    const container = engineeringAttributeContainerSchema.parse({
      version: 1, values: [quantity("conductor_cross_section", 2.5, "mm²")]
    });
    expect(validateEngineeringAttributeContainer({
      container, subject: { kind: "item", typeToken: "breaker" }
    }).ok).toBe(false);
  });

  it("keeps input and output voltage independent and normalizes existing units", () => {
    const candidate = profile([quantity("nominal_voltage", 0.24, "kV")]);
    candidate.groups.push({ key: "output", context: "supply_output", label: "DC output",
      attributes: { version: 1, values: [quantity("nominal_voltage", 24, "V")] } });
    const result = resolveItemEngineeringProfile(candidate);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Valid profile rejected");
    expect(result.groups.map((group) => group.facts[0].value)).toEqual([240, 24]);
    expect(result.groups.map((group) => group.context)).toEqual(["supply_input", "supply_output"]);
    expect(result.groups[0].facts[0].source.kind).toBe("manufacturer");
  });

  it.each([
    ["wrong unit", quantity("nominal_voltage", 24, "A")],
    ["unknown definition", quantity("invented_rating", 24, "V")],
    ["negative rating", quantity("rated_current", -2, "A")],
    ["project purpose", { definitionKey: "engineering_purpose", definitionVersion: 1,
      kind: "text", value: "Tank 1", source: { kind: "engineer_entered" } }]
  ])("rejects %s instead of retaining unvalidated manufacturer facts", (_label, value) => {
    expect(itemEngineeringProfileSchema.safeParse(profile([value])).success).toBe(false);
  });

  it("rejects duplicate group keys and duplicate values within a group", () => {
    const candidate = profile();
    candidate.groups.push({ ...candidate.groups[0] });
    expect(itemEngineeringProfileSchema.safeParse(candidate).success).toBe(false);
    expect(itemEngineeringProfileSchema.safeParse(profile([
      quantity("nominal_voltage", 24, "V"), quantity("nominal_voltage", 12, "V")
    ])).success).toBe(false);
  });

  it("does not treat an empty specification as zero or manufacture an output", () => {
    const result = resolveItemEngineeringProfile(profile());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Empty profile rejected");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].facts).toEqual([]);
  });

  it("keeps contradictions visible within their own input/output context", () => {
    const result = resolveItemEngineeringProfile(profile([
      { definitionKey: "supply_nature", definitionVersion: 1, kind: "choice", value: "dc" },
      quantity("frequency", 60, "Hz")
    ]));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Profile rejected before diagnostic projection");
    expect(result.groups[0].diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "inconsistent_values", definitionKey: "frequency" })
    ]));
  });

  it("preserves legacy project containers unchanged", () => {
    const container = engineeringAttributeContainerSchema.parse({ version: 1,
      values: [quantity("nominal_voltage", 24, "V")] });
    expect(validateEngineeringAttributeContainer({ container, assetType: "power_supply" }))
      .toEqual({ ok: true, container });
  });

  it("validates terminal capacity as a range, separately from an installed wire", () => {
    const range = {
      key: "power-terminals", terminalKeys: ["L", "N"],
      conductorClass: "fine_stranded", termination: "ferruled",
      minimumMm2: 0.5, maximumMm2: 2.5, maximumConductors: 1,
      source: { kind: "manufacturer", reference: "Synthetic datasheet" }
    };
    expect(terminalConductorRangeSchema.safeParse(range).success).toBe(true);
    expect(terminalConductorRangeSchema.safeParse({ ...range, minimumMm2: 4 }).success).toBe(false);
    expect(terminalConductorRangeSchema.safeParse({ ...range, terminalKeys: ["L", "L"] }).success).toBe(false);
    expect(terminalConductorRangeSchema.safeParse({ ...range, terminalKeys: [] }).success).toBe(false);
  });

  it("requires exact product references but makes unassignment explicit", () => {
    expect(itemSelectionSchema.parse({ version: 1, status: "unassigned", configurationId: "config-1" }))
      .toEqual({ version: 1, status: "unassigned", configurationId: "config-1" });
    const selected = { version: 1, status: "selected", configurationId: "config-1",
      itemId: "item-20A", itemEngineeringRevisionId: "revision-1" };
    expect(itemSelectionSchema.safeParse(selected).success).toBe(true);
    expect(itemSelectionSchema.safeParse({ ...selected, itemEngineeringRevisionId: "" }).success).toBe(false);
    expect(itemSelectionSchema.safeParse({ ...selected, status: "unassigned" }).success).toBe(false);
    expect(itemSelectionSchema.safeParse(undefined).success).toBe(false);
  });

  it("rejects unknown profile versions and malformed input without throwing", () => {
    expect(resolveItemEngineeringProfile({ ...profile(), version: 3 }).ok).toBe(false);
    expect(resolveItemEngineeringProfile(null).ok).toBe(false);
  });
});
