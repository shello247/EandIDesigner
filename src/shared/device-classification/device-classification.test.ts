import { describe, expect, it } from "vitest";
import { DEVICE_TYPE_OPTIONS, deviceTypeSchema, deviceTypeFamily, isDeviceTypeApplicable, legacyTechnicalTypeProposal } from "./device-types";
import { resolveDeviceClassification, type ClassificationSource } from "./classification-resolution";

const source = (kind: ClassificationSource["kind"], deviceType: ClassificationSource["deviceType"], revisionId = "pinned-v1"): ClassificationSource =>
  ({ kind, deviceType, recordId: kind + "-id", revisionId });
const available = (entry: ClassificationSource) => ({ state: "available" as const, source: entry });

describe("controlled Device Types", () => {
  it("has unique stable identifiers and labels, including separate UPS and chassis", () => {
    expect(new Set(DEVICE_TYPE_OPTIONS.map(entry => entry.value)).size).toBe(22);
    expect(new Set(DEVICE_TYPE_OPTIONS.map(entry => entry.label)).size).toBe(22);
    expect(deviceTypeSchema.safeParse("needs_classification").success).toBe(false);
    expect(deviceTypeSchema.safeParse("my-new-type").success).toBe(false);
  });
  it("inherits supply applicability for UPS only", () => {
    expect(deviceTypeFamily("ups")).toBe("power_supply");
    expect(isDeviceTypeApplicable("ups", ["power_supply"])).toBe(true);
    expect(isDeviceTypeApplicable("chassis_rack", ["controller", "io_module"])).toBe(false);
    expect(isDeviceTypeApplicable("power_supply", ["ups"])).toBe(false);
  });
  it.each(["power", "protection", "other", "__proto__"])("does not guess from broad group %s", kind => {
    expect(legacyTechnicalTypeProposal(kind)).toBeNull();
  });
});

describe("exact-revision classification resolution", () => {
  it("uses the pinned Item and retains provenance", () => {
    const pinned = source("item_revision", "ups", "old-revision");
    const result = resolveDeviceClassification({ item: available(pinned), symbol: available(source("symbol_version", "ups")) });
    expect(result).toMatchObject({ status: "resolved", deviceType: "ups", source: pinned, issues: [] });
  });
  it("reports specific disagreements rather than hiding the Symbol or snapshot", () => {
    const result = resolveDeviceClassification({ item: available(source("item_revision", "ups")),
      symbol: available(source("symbol_version", "power_supply")), evidence: [source("drawing_snapshot", "controller")] });
    expect(result.status).toBe("conflicting");
    expect(result.issues).toHaveLength(2);
    expect(result.deviceType).toBe("ups");
  });
  it("does not replace an unavailable selected Item with the Symbol", () => {
    expect(resolveDeviceClassification({ item: { state: "unavailable", recordId: "i", revisionId: "old", reason: "Missing" },
      symbol: available(source("symbol_version", "controller")) })).toMatchObject({ status: "unavailable", deviceType: null });
  });
  it("uses an exact Symbol without an Item, and an explicit unlinked type without either", () => {
    expect(resolveDeviceClassification({ symbol: available(source("symbol_version", "chassis_rack")) }).deviceType).toBe("chassis_rack");
    expect(resolveDeviceClassification({ unlinkedAsset: source("managed_asset", "other") })).toMatchObject({ status: "resolved", deviceType: "other" });
  });
  it("leaves missing types unresolved while offering a narrow evidence proposal", () => {
    const input = { symbol: available(source("symbol_version", null)), evidence: [source("legacy_metadata", "controller")] };
    const before = JSON.stringify(input);
    expect(resolveDeviceClassification(input)).toMatchObject({ status: "needs_classification", deviceType: null, proposedType: "controller" });
    expect(JSON.stringify(input)).toBe(before);
  });
  it("distinguishes legacy Other, explicit Other and conflicting legacy evidence", () => {
    expect(resolveDeviceClassification({ evidence: [source("drawing_snapshot", "other")] }).status).toBe("needs_classification");
    expect(resolveDeviceClassification({ symbol: available(source("symbol_version", "other")) }).status).toBe("resolved");
    expect(resolveDeviceClassification({ evidence: [source("legacy_metadata", "controller"), source("drawing_snapshot", "instrument")] }).status).toBe("conflicting");
  });
  it("proposes a snapshot repair without mutating the snapshot", () => {
    expect(resolveDeviceClassification({ symbol: available(source("symbol_version", "controller")), evidence: [source("drawing_snapshot", "other")] }))
      .toMatchObject({ status: "resolved", deviceType: "controller", proposedType: "controller", issues: [{ code: "snapshot_mismatch" }] });
  });
  it("discloses unavailable secondary evidence", () => {
    expect(resolveDeviceClassification({ item: available(source("item_revision", "controller")),
      symbol: { state: "unavailable", recordId: "s", revisionId: "v1", reason: "Missing" } }).issues[0].code).toBe("source_unavailable");
  });
});
