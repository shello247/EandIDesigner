"use client";
import type { SpecificationDraft } from "../../logic/services/specification-editor-draft";
import { changeSpecificationUnit } from "../../logic/services/specification-editor-draft";
import { ItemAttributeValueFields } from "./item-attribute-value-fields";
export function SpecificationValueEditor({ row, onChange, disabled }: { row: SpecificationDraft; onChange: (row: SpecificationDraft) => void; disabled: boolean }) {
  const definition = row.entry.type.definition;
  const field = (key: string, label: string, numeric = false) => <input aria-label={`${row.entry.title} ${label}`} placeholder={label} type={numeric ? "number" : "text"} step="any"
    className="field-input min-w-0 w-full" value={row.value[key] ?? ""} onChange={event => onChange({ ...row,value: { ...row.value,[key]: event.target.value } })} />;
  return <fieldset disabled={disabled} className="min-w-0 space-y-2">
    <select aria-label={`${row.entry.title} information status`} className="field-input w-full text-xs" value={row.availability} onChange={e => onChange({ ...row, availability: e.target.value as SpecificationDraft["availability"] })}>
      <option value="recorded">Recorded value</option><option value="missing">Missing</option><option value="needs_review">Needs review</option></select>
    {row.availability === "recorded" ? <>
      {row.value.unit === "AWG" ? field("gauge","AWG designation") : definition.payloadKind !== "scalar" ? <details open><summary>Rating details</summary><ItemAttributeValueFields definition={definition} draft={row.value} onChange={value => {
        const changed = value.unit && value.unit !== row.value.unit ? changeSpecificationUnit(row,value.unit).value : value;
        onChange({ ...row,value: changed });
      }} /></details> : definition.valueKind === "range" ? <div className="flex gap-1">{field("minimum","Minimum",true)}<span className="self-center">–</span>{field("maximum","Maximum",true)}</div> :
        definition.valueKind === "choice" ? <select className="field-input w-full" aria-label={`${row.entry.title} value`} value={row.value.value ?? ""} onChange={e => onChange({ ...row,value: { ...row.value,value: e.target.value } })}><option value="">Choose…</option>{definition.choices?.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select> : field("value","Value",definition.valueKind !== "text")}
      {definition.payloadKind === "scalar" && !!definition.allowedUnits?.length && <select className="field-input w-full" aria-label={`${row.entry.title} units`} value={row.value.unit ?? definition.canonicalUnit} onChange={e => onChange(changeSpecificationUnit(row,e.target.value))}>
        {definition.allowedUnits.map(unit => <option key={unit}>{unit}</option>)}{definition.engineeringDimension === "cross_section" && definition.valueKind === "quantity" && <option>AWG</option>}</select>}
    </> : <input aria-label={`${row.entry.title} missing information note`} className="field-input w-full" placeholder="Optional note about missing information" value={row.entry.payload.kind === "unresolved" ? row.entry.payload.reason : ""}
      onChange={e => onChange({ ...row,entry: { ...row.entry,payload: { kind: "unresolved",status: row.availability === "recorded" ? "missing" : row.availability, reason: e.target.value } } })} />}
  </fieldset>;
}
