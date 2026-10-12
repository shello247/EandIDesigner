import { expect, it } from "vitest";
import { ATTRIBUTE_TYPE_SEEDS } from "../api/public";
import { attributeApplicability, rankAttributeTypes } from "../logic/services/attribute-applicability";
import { itemProfileV3Schema } from "@/features/item_engineering/data/profile-v3-schema";
import { previewCatalogueReconciliation } from "@/features/item_engineering/logic/services/catalogue-reconciliation";

it("ranks recommended fields without hiding or blocking other device classes", () => {
  const type = ATTRIBUTE_TYPE_SEEDS.find(t => t.analysisKey === "pole_count")!;
  expect(attributeApplicability(type,"io_module").warnings).toHaveLength(1);
  expect(rankAttributeTypes([type],{ deviceType: "io_module" })).toHaveLength(1);
  const entry = { id: "a", groupKey: "g", title: "Poles", description: "", type, payload: { kind: "number", value: 3 }, source: { kind: "manufacturer" },
    scope: { kind: "device" }, modes: [], condition: "", evidence: [], ratingBasis: "unspecified" };
  expect(itemProfileV3Schema.safeParse({ version: 3, deviceType: "io_module", groups: [{ key: "g", label: "Device", context: "device" }],
    entries: [entry], terminals: [], channels: [], modes: [] }).success).toBe(true);
});
it("leaves ambiguous legacy text unchanged in reconciliation", () => {
  const target = ATTRIBUTE_TYPE_SEEDS.find(t => t.analysisKey === "length")!;
  const base = { id: "a", groupKey: "g", title: "Legacy", description: "", type: target, source: { kind: "manufacturer" as const },
    scope: { kind: "device" as const }, modes: [], condition: "", evidence: [], ratingBasis: "unspecified" as const };
  const entries = ["52.5 mm", "about 50 mm depending on model", ""].map((value,i) => ({ ...base, id: `${i}`, payload: { kind: "text" as const, value } }));
  const before = JSON.stringify(entries);
  expect(previewCatalogueReconciliation(entries,{ [target.typeId]: target }).map(r => r.status)).toEqual(["proposed","needs_review","needs_review"]);
  expect(JSON.stringify(entries)).toBe(before);
});
