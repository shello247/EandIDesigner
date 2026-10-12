import { expect, it } from "vitest";
import { ATTRIBUTE_TYPE_SEEDS, ATTRIBUTE_TEMPLATES, attributeTypeSnapshotSchema } from "@/features/engineering_attributes/api/public";
import { createTemplateEntries } from "../logic/services/attribute-template-entries";

it("provides all requested starter templates with no invented values", () => {
  expect(ATTRIBUTE_TEMPLATES).toHaveLength(7);
  expect(new Set(ATTRIBUTE_TYPE_SEEDS.map(t => t.typeId)).size).toBe(ATTRIBUTE_TYPE_SEEDS.length);
  expect(new Set(ATTRIBUTE_TYPE_SEEDS.map(t => t.definition.label.toLowerCase())).size).toBe(ATTRIBUTE_TYPE_SEEDS.length);
  let id = 0;
  for (const template of ATTRIBUTE_TEMPLATES) {
    const result = createTemplateEntries(template.id, ATTRIBUTE_TYPE_SEEDS, "device", () => `${++id}`);
    expect(result.missingTypes).toEqual([]);
    expect(result.entries.every(entry => entry.payload.kind === "unresolved" && !Object.hasOwn(entry.payload, "value"))).toBe(true);
    for (const entry of result.entries) expect(attributeTypeSnapshotSchema.safeParse(entry.type).success).toBe(true);
  }
});
it("reports missing or retired template types without inventing global definitions", () => {
  expect(createTemplateEntries("io_module", [], "g", () => "x").missingTypes.length).toBeGreaterThan(0);
});
