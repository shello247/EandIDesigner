"use client";
import type { AttributeTypeDefinition } from "@/features/engineering_attributes/api/public";

import { type ValueDraft } from "../../logic/services/attribute-value-draft";
export { payloadDraft, buildPayload } from "../../logic/services/attribute-value-draft";
export type { ValueDraft } from "../../logic/services/attribute-value-draft";

export function ItemAttributeValueFields({ definition, draft, onChange }: {
  definition: AttributeTypeDefinition; draft: ValueDraft; onChange: (draft: ValueDraft) => void;
}) {
  const text = (label: string, key: string, numeric = false) => <label className="block text-sm" key={key}>{label}
    <input aria-label={label} className="field-input mt-1 block w-full" type={numeric ? "number" : "text"} step="any"
      value={draft[key] ?? ""} onChange={event => onChange({ ...draft, [key]: event.target.value })} /></label>;
  const select = (label: string, key: string, options: string[]) => <label className="block text-sm" key={key}>{label}
    <select aria-label={label} className="field-input mt-1 block w-full" value={draft[key] ?? ""} onChange={event => onChange({ ...draft, [key]: event.target.value })}>
      <option value="">Choose…</option>{options.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>;
  if (definition.payloadKind === "short_circuit") return <div className="grid gap-4 sm:grid-cols-2">
    {select("Units", "unit", definition.allowedUnits ?? ["kA"])}{text("Value", "currentKa", true)}{text("Applicable voltage (V)", "voltageV", true)}
    {text("Rating designation", "designation")}{select("Supply nature", "supplyNature", ["ac", "dc"])}
    <label className="block text-sm sm:col-span-2">Rating conditions<textarea className="field-input mt-1 block w-full" value={draft.conditions ?? ""} onChange={event => onChange({ ...draft, conditions: event.target.value })} maxLength={2000} /></label>
  </div>;
  if (definition.payloadKind === "terminal_range") return <div className="grid gap-4 sm:grid-cols-2">
    {text("Minimum value (mm²)", "minimumMm2", true)}{text("Maximum value (mm²)", "maximumMm2", true)}
    {text("Terminal keys (comma-separated)", "terminalKeys")}{text("Maximum conductors", "maximumConductors", true)}
    {select("Conductor class", "conductorClass", ["solid", "stranded", "fine_stranded"])}{select("Termination", "termination", ["bare", "ferruled"])}
  </div>;
  return <div className="grid gap-4 sm:grid-cols-2">
    {(definition.valueKind === "quantity" || definition.valueKind === "range") && select("Units", "unit", definition.allowedUnits ?? [])}
    {definition.valueKind === "range" ? <>{text("Minimum value", "minimum", true)}{text("Maximum value", "maximum", true)}</> :
      definition.valueKind === "choice" ? <label className="text-sm">Value<select className="field-input mt-1 block w-full" value={draft.value ?? ""} onChange={event => onChange({ ...draft, value: event.target.value })}>
        <option value="">Choose…</option>{definition.choices?.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label> :
        text("Value", "value", definition.valueKind !== "text")}
  </div>;
}
