import { describe, expect, it } from "vitest";
import { itemEngineeringProfileSchema, itemEngineeringRevisionSchema, symbolItemConfigurationSchema } from "../api/public";

const profile = {
  version: 1, deviceType: "breaker", terminalConductorRanges: [],
  groups: [{ key: "poles", label: "Main poles", context: "device",
    attributes: { version: 1, values: [] } }]
};
const rating = {
  key: "capacity", groupKey: "poles", ratingType: "breaking_capacity",
  designation: "Manufacturer stated capacity", currentKa: 6, voltageV: 400,
  supplyNature: "ac", conditions: "Synthetic fixture; stated test conditions only.",
  source: { kind: "manufacturer", reference: "Synthetic datasheet" }
};

describe("Item revision and qualification contracts", () => {
  it("retains rating kind, voltage, context and evidence without inferring panel SCCR", () => {
    const parsed = itemEngineeringProfileSchema.parse({ ...profile, shortCircuitRatings: [rating] });
    if (parsed.version !== 1) throw new Error("Legacy profile changed version.");
    expect(parsed.shortCircuitRatings[0]).toEqual(rating);
    expect(parsed.groups[0].attributes.values).toEqual([]);
  });
  it.each([
    { voltageV: 0 }, { source: { kind: "manufacturer" } },
    { groupKey: "missing" }, { conditions: "" }, { ratingType: "universal" }
  ])("rejects incomplete rating conditions: %j", (override) => {
    expect(itemEngineeringProfileSchema.safeParse({
      ...profile, shortCircuitRatings: [{ ...rating, ...override }]
    }).success).toBe(false);
  });
  it("pins revision identity and rejects duplicate guidance", () => {
    const revision = {
      id: "rev-1", itemId: "item-1", revisionNumber: 1,
      identity: { itemKey: "BOM-1", displayName: "20 A breaker", manufacturer: null, model: null, partNumber: null },
      profile, noteIds: [], documentIds: [], contentHash: "a".repeat(64),
      createdAt: "2026-09-05T14:00:00Z"
    };
    expect(itemEngineeringRevisionSchema.safeParse(revision).success).toBe(true);
    expect(itemEngineeringRevisionSchema.safeParse({ ...revision, noteIds: ["note-1", "note-1"] }).success).toBe(false);
  });
  it("requires exact symbol qualification and distinct product alternatives", () => {
    const option = { itemId: "item-1", itemEngineeringRevisionId: "revision-1", usage: "schematic", evidence: "Terminal map inspected" };
    const configuration = { id: "config-1", symbolVersionId: "version-1",
      revisionNumber: 1, symbolContractHash: "a".repeat(64), options: [option] };
    expect(symbolItemConfigurationSchema.safeParse(configuration).success).toBe(true);
    expect(symbolItemConfigurationSchema.safeParse({ ...configuration, options: [option, option] }).success).toBe(false);
    expect(symbolItemConfigurationSchema.safeParse({ ...configuration, symbolContractHash: "" }).success).toBe(false);
  });
});
