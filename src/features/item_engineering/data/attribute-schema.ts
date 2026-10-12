import { z } from "zod";
import { deviceTypeSchema, isDeviceTypeApplicable } from "@/shared/device-classification/device-types";
import { attributeTypeSnapshotSchema, ATTRIBUTE_UNITS } from "@/features/engineering_attributes/api/public";

export const attributePayloadSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("text"), value: z.string().trim().min(1).max(4000) }),
  z.strictObject({ kind: z.literal("choice"), value: z.string().trim().min(1).max(120) }),
  z.strictObject({ kind: z.literal("number"), value: z.number().finite() }),
  z.strictObject({ kind: z.literal("quantity"), value: z.number().finite(), unit: z.string().min(1) }),
  z.strictObject({ kind: z.literal("range"), minimum: z.number().finite(), maximum: z.number().finite(), unit: z.string().min(1) }),
  z.strictObject({ kind: z.literal("short_circuit"), ratingType: z.enum(["sccr", "breaking_capacity"]),
    displayUnit: z.enum(["A", "kA"]).optional(),
    designation: z.string().trim().min(1).max(160), currentKa: z.number().positive(), voltageV: z.number().positive(),
    supplyNature: z.enum(["ac", "dc"]), conditions: z.string().trim().min(1).max(2000) }),
  z.strictObject({ kind: z.literal("terminal_range"), terminalKeys: z.array(z.string().trim().min(1)).min(1).max(256),
    conductorClass: z.enum(["solid", "stranded", "fine_stranded"]), termination: z.enum(["bare", "ferruled"]),
    minimumMm2: z.number().positive(), maximumMm2: z.number().positive(), maximumConductors: z.number().int().positive().max(32) })
]);
export const itemAttributeEntrySchema = z.strictObject({
  id: z.string().min(1), groupKey: z.string().min(1), title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000), type: attributeTypeSnapshotSchema,
  payload: attributePayloadSchema,
  source: z.strictObject({ kind: z.enum(["manufacturer", "engineer_entered", "imported"]), reference: z.string().trim().max(500).optional() })
});
export type ItemAttributeEntry = z.infer<typeof itemAttributeEntrySchema>;
export type AttributePayload = z.infer<typeof attributePayloadSchema>;
export const itemProfileV2Schema = z.strictObject({
  version: z.literal(2),
  deviceType: deviceTypeSchema,
  groups: z.array(z.strictObject({ key: z.string().min(1).max(160), label: z.string().trim().min(1).max(160),
    // Version 1 allowed 32 groups plus ungrouped terminal limits. Preserve space
    // for the adapter's additional terminal-limits group without dropping data.
    context: z.enum(["device", "supply_input", "supply_output"]) })).max(33),
  entries: z.array(itemAttributeEntrySchema).max(2048)
}).superRefine((profile, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  const groups = new Set(profile.groups.map(group => group.key));
  if (groups.size !== profile.groups.length) fail("Specification groups must have unique identities.");
  const ids = new Set<string>(); const assigned = new Set<string>();
  for (const entry of profile.entries) {
    if (ids.has(entry.id)) fail("Attribute identities must be unique.");
    ids.add(entry.id);
    if (!groups.has(entry.groupKey)) fail("Attribute specification group was not found.");
    const definition = entry.type.definition;
    if (definition.applicableAssetTypes && !isDeviceTypeApplicable(profile.deviceType, definition.applicableAssetTypes))
      fail(entry.title + " is incompatible with this device classification.");
    if (definition.payloadKind === "scalar") {
      const key = entry.groupKey + ":" + entry.type.typeId;
      if (assigned.has(key)) fail(entry.title + " is already assigned in this specification group.");
      assigned.add(key);
    }
    const payload = entry.payload;
    if (definition.payloadKind === "scalar" ? payload.kind !== definition.valueKind : payload.kind !== definition.payloadKind)
      fail("Choose a value format compatible with " + entry.title + ".");
    if (payload.kind === "range" && payload.minimum > payload.maximum ||
        payload.kind === "terminal_range" && payload.minimumMm2 > payload.maximumMm2) fail("Maximum must be at least the minimum.");
    if (payload.kind === "terminal_range" && new Set(payload.terminalKeys).size !== payload.terminalKeys.length) fail("Terminal keys must be distinct.");
    if (payload.kind === "short_circuit" && (!entry.source.reference ||
        (entry.type.analysisKey === "conditional_sccr" ? payload.ratingType !== "sccr" : payload.ratingType !== "breaking_capacity"))) fail("Check the short-circuit type and supporting source.");
    if (payload.kind === "choice" && !definition.choices?.some(choice => choice.value === payload.value)) fail("Choose a supported selection.");
    if (payload.kind === "text" && payload.value.length > (definition.maximumTextLength ?? 400)) fail("Text exceeds the type's limit.");
    if (payload.kind === "quantity" || payload.kind === "range") {
      if (!definition.allowedUnits?.includes(payload.unit) || ATTRIBUTE_UNITS[definition.engineeringDimension ?? ""]?.[payload.unit] === undefined) fail("Choose a compatible unit.");
    }
    const numbers = payload.kind === "number" || payload.kind === "quantity" ? [payload.value] :
      payload.kind === "range" ? [payload.minimum, payload.maximum] :
      payload.kind === "short_circuit" ? [payload.currentKa] :
      payload.kind === "terminal_range" ? [payload.minimumMm2, payload.maximumMm2] : [];
    const unit = payload.kind === "quantity" || payload.kind === "range" ? payload.unit :
      payload.kind === "short_circuit" ? "kA" : payload.kind === "terminal_range" ? "mm²" : undefined;
    const factors = ATTRIBUTE_UNITS[definition.engineeringDimension ?? ""];
    const factor = unit && factors ? factors[unit] / factors[definition.canonicalUnit ?? ""] : 1;
    if (payload.kind === "short_circuit" && !definition.allowedUnits?.includes(payload.displayUnit ?? "kA")) fail("Choose a compatible short-circuit current unit.");
    for (const value of numbers) {
      const normalized = Number((value * factor).toPrecision(15));
      if (definition.minimum !== undefined && (definition.minimumExclusive ? normalized <= definition.minimum : normalized < definition.minimum) ||
          definition.maximum !== undefined && normalized > definition.maximum) fail("Value is outside the permitted range.");
      if (definition.precision !== undefined && Math.abs(value - Number(value.toFixed(definition.precision))) > Number.EPSILON * Math.max(1, Math.abs(value)) * 8) fail("Value has too many decimal places.");
    }
  }
});
export type ItemProfileV2 = z.infer<typeof itemProfileV2Schema>;
