import type { AttributeTypeDefinition } from "@/features/engineering_attributes/api/public";
import type { AttributePayload } from "../../data/attribute-schema";
export type ValueDraft = Record<string, string>;
export function payloadDraft(payload?: AttributePayload): ValueDraft {
  if (!payload) return {};
  if (payload.kind === "short_circuit") return {
    ...Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, String(value)])),
    unit: payload.displayUnit ?? "kA", currentKa: String(payload.currentKa * (payload.displayUnit === "A" ? 1000 : 1))
  };
  return Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "kind").map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value)]));
}
export function buildPayload(definition: AttributeTypeDefinition, draft: ValueDraft): AttributePayload {
  const number = (key: string) => {
    if (!draft[key]?.trim() || !Number.isFinite(Number(draft[key]))) throw new Error("Enter a valid " + key.replace(/([A-Z])/g, " $1").toLowerCase() + ".");
    return Number(draft[key]);
  };
  if (definition.payloadKind === "short_circuit") return { kind: "short_circuit",
    ratingType: draft.ratingType as "sccr" | "breaking_capacity", designation: draft.designation ?? "",
    currentKa: number("currentKa") / (draft.unit === "A" ? 1000 : 1), displayUnit: draft.unit as "A" | "kA",
    voltageV: number("voltageV"), supplyNature: draft.supplyNature as "ac" | "dc", conditions: draft.conditions ?? "" };
  if (definition.payloadKind === "terminal_range") return { kind: "terminal_range", terminalKeys: (draft.terminalKeys ?? "").split(",").map(value => value.trim()),
    conductorClass: draft.conductorClass as "solid", termination: draft.termination as "bare",
    minimumMm2: number("minimumMm2"), maximumMm2: number("maximumMm2"), maximumConductors: number("maximumConductors") };
  if (definition.valueKind === "range") return { kind: "range", minimum: number("minimum"), maximum: number("maximum"), unit: draft.unit ?? "" };
  if (definition.valueKind === "quantity") return { kind: "quantity", value: number("value"), unit: draft.unit ?? "" };
  if (definition.valueKind === "number") return { kind: "number", value: number("value") };
  return { kind: definition.valueKind, value: draft.value ?? "" };
}
