"use client";
import type { ItemProfileV3 } from "../../api/public";
export function AttributeOperatingModes({ modes,onChange,disabled }: { modes: ItemProfileV3["modes"]; onChange: (modes: ItemProfileV3["modes"]) => void; disabled: boolean }) {
  return <details className="rounded-lg border bg-white p-3"><summary className="cursor-pointer text-sm font-semibold">Operating modes ({modes.length})</summary>
    <p className="my-2 text-xs text-slate-500">Add named alternatives such as external or chassis loop power. Ratings apply only to the selected choice; group names remain separate.</p>
    {modes.map((mode,index) => <fieldset disabled={disabled} className="my-3 flex flex-wrap items-start gap-2 border-t pt-3" key={mode.id}>
      <input aria-label={`Operating mode ${index+1} name`} className="field-input" placeholder="Mode name" value={mode.label} onChange={e => onChange(modes.map(m => m.id === mode.id ? { ...m,label: e.target.value } : m))} />
      {mode.choices.map((choice,i) => <input key={choice.id} aria-label={`Mode ${index+1} choice ${i+1}`} className="field-input" placeholder={`Choice ${i+1}`} value={choice.label} onChange={e => onChange(modes.map(m => m.id === mode.id ? { ...m,choices: m.choices.map(c => c.id === choice.id ? { ...c,label: e.target.value } : c) } : m))} />)}
      <button className="icon-button" onClick={() => onChange(modes.map(m => m.id === mode.id ? { ...m,choices: [...m.choices,{ id: crypto.randomUUID(),label: "" }] } : m))}>Add choice</button>
      <button className="icon-button" onClick={() => onChange(modes.filter(m => m.id !== mode.id))}>Remove mode</button>
    </fieldset>)}
    {!disabled && <button className="icon-button mt-2" onClick={() => onChange([...modes,{ id: crypto.randomUUID(),label: "",choices: [{ id: crypto.randomUUID(),label: "" },{ id: crypto.randomUUID(),label: "" }] }])}>Add operating mode</button>}
  </details>;
}
