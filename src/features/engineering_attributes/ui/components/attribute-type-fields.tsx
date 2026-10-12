import { ATTRIBUTE_UNITS, type AttributeTypeDefinition } from "../../api/public";

export type AttributeTypeSection = "details" | "units" | "applicability";
import { DEVICE_TYPE_OPTIONS } from "@/shared/device-classification/device-types";
export const typeValueLabels = { number: "Number", quantity: "Quantity", text: "Text", choice: "Selection", range: "Range" };

export function AttributeTypeFields({ draft: d, existing, section, id, change }: {
  draft: AttributeTypeDefinition; existing: boolean; section: AttributeTypeSection; id: string;
  change: (patch: Partial<AttributeTypeDefinition>) => void;
}) {
  const panel = (value: AttributeTypeSection) => ({ role: "tabpanel", id: `${id}-panel-${value}`, "aria-labelledby": `${id}-tab-${value}`, "data-type-section": value, hidden: section !== value });
  return <>
    <section {...panel("details")} className="space-y-3">
      <label className="block"><span className="font-bold">Type name</span><input aria-label="Type name" className="field-input mt-1 block w-full" required maxLength={160} value={d.label} onChange={event => change({ label: event.target.value })} /></label>
      <label className="block"><span className="font-bold">Default description</span><textarea aria-label="Default description" rows={3} className="field-input mt-1 block w-full resize-y" maxLength={1000} value={d.description} onChange={event => change({ description: event.target.value })} /></label>
      <label className="block"><span className="font-bold">Value format</span><select aria-label="Value format" className="field-input mt-1 block w-full" disabled={existing} value={d.valueKind} onChange={event => {
        const kind = event.target.value as typeof d.valueKind;
        change({ valueKind: kind, ...(kind === "quantity" || kind === "range" ? { engineeringDimension: "current", canonicalUnit: "A", allowedUnits: ["mA", "A", "kA"] } :
          { engineeringDimension: undefined, canonicalUnit: undefined, allowedUnits: undefined }), choices: kind === "choice" ? [] : undefined });
      }}>{Object.entries(typeValueLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {existing && <p className="text-[11px] text-slate-500">Existing Item entries keep their saved version. A different format or dimension requires a new type.</p>}
    </section>
    <section {...panel("units")} className="space-y-3">
      {(d.valueKind === "quantity" || d.valueKind === "range") && <label className="block"><span className="font-bold">Engineering dimension</span><select aria-label="Engineering dimension" className="field-input mt-1 block w-full" disabled={existing} value={d.engineeringDimension} onChange={event => {
        const dimension = event.target.value as typeof d.engineeringDimension;
        const units = Object.keys(ATTRIBUTE_UNITS[dimension!]);
        change({ engineeringDimension: dimension, allowedUnits: units, canonicalUnit: units[0] });
      }}>{Object.keys(ATTRIBUTE_UNITS).map(dimension => <option key={dimension} value={dimension}>{dimension.replaceAll("_", " ")}</option>)}</select></label>}
      {d.engineeringDimension && <fieldset className="rounded-lg border border-slate-200 p-3"><legend className="px-1 font-bold">Permitted units</legend><div className="flex flex-wrap gap-x-4 gap-y-2">
        {Object.keys(ATTRIBUTE_UNITS[d.engineeringDimension]).map(unit => <label className="flex items-center gap-2" key={unit}><input type="checkbox" checked={d.allowedUnits?.includes(unit) ?? false}
          onChange={event => { const units = event.target.checked ? [...(d.allowedUnits ?? []), unit] : d.allowedUnits?.filter(value => value !== unit);
            change({ allowedUnits: units, canonicalUnit: units?.includes(d.canonicalUnit!) ? d.canonicalUnit : units?.[0] }); }} />{unit}</label>)}</div>
        <label className="mt-3 block"><span className="font-bold">Default unit</span><select aria-label="Default unit" className="field-input mt-1 block w-full" value={d.canonicalUnit ?? ""} onChange={event => change({ canonicalUnit: event.target.value })}>
          {(d.allowedUnits ?? []).map(unit => <option key={unit}>{unit}</option>)}</select></label></fieldset>}
      {["number", "quantity", "range"].includes(d.valueKind) && <div className="grid gap-3 sm:grid-cols-3">
        {(["minimum", "maximum", "precision"] as const).map(key => <label className="block" key={key}><span className="font-bold capitalize">{key}</span><input aria-label={key} className="field-input mt-1 block w-full" type="number" step={key === "precision" ? "1" : "any"} value={d[key] ?? ""} onChange={event => change({ [key]: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>)}
        <label className="flex items-center gap-2 sm:col-span-3"><input type="checkbox" checked={d.minimumExclusive ?? false} onChange={event => change({ minimumExclusive: event.target.checked })} />Value must be greater than the minimum</label>
      </div>}
      {d.valueKind === "text" && <label className="block"><span className="font-bold">Maximum text length</span><input aria-label="Maximum text length" type="number" className="field-input mt-1 block w-full" value={d.maximumTextLength ?? 400} onChange={event => change({ maximumTextLength: Number(event.target.value) })} /></label>}
      {d.valueKind === "choice" && <label className="block"><span className="font-bold">Selection options — one per line</span><textarea aria-label="Selection options — one per line" rows={6} className="field-input mt-1 block w-full" value={d.choices?.map(choice => choice.label).join("\n") ?? ""}
        onChange={event => change({ choices: event.target.value.split("\n").map(label => ({ label, value: d.choices?.find(choice => choice.label === label)?.value ?? label })) })} /></label>}
    </section>
    <section {...panel("applicability")} className="space-y-3">
      <fieldset className="rounded-lg border border-slate-200 p-3"><legend className="px-1 font-bold">Applicable classifications</legend>
        <p className="mb-3 text-[11px] text-slate-500">Leave all unchecked to allow any device type.</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
        {DEVICE_TYPE_OPTIONS.map(({ value: kind, label }) => <label className="flex items-center gap-2" key={kind}><input type="checkbox" checked={d.applicableAssetTypes?.includes(kind) ?? false}
          onChange={event => { const kinds = event.target.checked ? [...(d.applicableAssetTypes ?? []), kind] : d.applicableAssetTypes?.filter(value => value !== kind); change({ applicableAssetTypes: kinds?.length ? kinds : undefined }); }} />{label}</label>)}</div></fieldset>
      <p className="text-[11px] text-slate-500">Custom types do not automatically add analysis rules.</p>
    </section>
  </>;
}
