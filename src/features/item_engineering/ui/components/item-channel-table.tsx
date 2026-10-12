"use client";
import { useState } from "react";
import type { ItemProfileV3 } from "../../api/public";
import { AttributeEvidenceEditor } from "./attribute-evidence-editor";
export function ItemChannelTable({ itemId,profile,onChange,disabled }: { itemId: string; profile: Omit<ItemProfileV3,"entries">; onChange: (profile: Omit<ItemProfileV3,"entries">) => void; disabled: boolean }) {
  const [open,setOpen] = useState(false);
  const terminals = profile.terminals; const channels = profile.channels;
  return <details className="rounded-lg border bg-white p-3" onToggle={e => setOpen(e.currentTarget.open)}><summary className="cursor-pointer text-sm font-semibold">Channels and terminals · {channels.length} channels · {terminals.length} terminals</summary>
    {open && <><p className="my-3 text-xs text-slate-600">Product terminal numbers are separate from channel numbers. Membership describes the connection function; it does not establish electrical continuity.</p>
    <fieldset disabled={disabled}><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs" aria-label="Product terminals"><thead><tr><th>Terminal number</th><th>Function</th><th>Connectable</th><th>Shared</th><th>Isolation identity</th><th /></tr></thead><tbody>{terminals.map((terminal,index) => {
      const update = (change: Partial<typeof terminal>) => onChange({ ...profile,terminals: terminals.map(t => t.id === terminal.id ? { ...t,...change } : t) });
      return <tr key={terminal.id} className="border-t"><td className="p-1"><input className="field-input w-24" aria-label={`Terminal ${index+1} number`} value={terminal.number} onChange={e => update({ number: e.target.value })} /></td>
        <td className="p-1"><input className="field-input w-full" aria-label={`Terminal ${terminal.number || index+1} function`} value={terminal.function} onChange={e => update({ function: e.target.value })} /></td>
        <td className="p-1"><input type="checkbox" aria-label={`Terminal ${terminal.number || index+1} connectable`} checked={terminal.connectable} onChange={e => update({ connectable: e.target.checked })} /></td>
        <td className="p-1"><input type="checkbox" aria-label={`Terminal ${terminal.number || index+1} shared`} checked={terminal.shared} onChange={e => update({ shared: e.target.checked })} /></td>
        <td className="p-1"><input className="field-input w-28" aria-label={`Terminal ${terminal.number || index+1} isolation identity`} value={terminal.isolationGroup ?? ""} onChange={e => update({ isolationGroup: e.target.value || undefined })} /></td>
        <td className="p-1"><button className="icon-button" onClick={() => onChange({ ...profile,terminals: terminals.filter(t => t.id !== terminal.id) })}>Remove</button></td></tr>;
    })}</tbody></table></div>
      {!disabled && <button className="icon-button my-2" onClick={() => onChange({ ...profile,terminals: [...terminals,{ id: crypto.randomUUID(),number: "",function: "",connectable: true,shared: false,evidence: [] }] })}>Add terminal</button>}
    </fieldset>
    {terminals.filter(t => t.shared).map(terminal => <div key={terminal.id} className="my-2 rounded border p-2"><p className="mb-2 text-xs font-semibold">Shared terminal {terminal.number} evidence</p><AttributeEvidenceEditor itemId={itemId} disabled={disabled} value={terminal.evidence} onChange={evidence => onChange({ ...profile,terminals: terminals.map(t => t.id === terminal.id ? { ...t,evidence } : t) })} /></div>)}
    <div className="mt-4 space-y-3">{channels.map((channel,index) => {
      const update = (change: Partial<typeof channel>) => onChange({ ...profile,channels: channels.map(c => c.id === channel.id ? { ...c,...change } : c) });
      return <fieldset disabled={disabled} className="rounded-lg border p-3" key={channel.id}>
        <div className="flex flex-wrap items-center gap-2"><label className="text-xs">Channel<input className="field-input ml-2 w-20" aria-label={`Channel ${index+1} number`} value={channel.number} onChange={e => update({ number: e.target.value })} /></label>
          <select className="field-input text-xs" aria-label={`Channel ${channel.number || index+1} direction`} value={channel.direction} onChange={e => update({ direction: e.target.value as typeof channel.direction })}>{["unknown","input","output","bidirectional"].map(v => <option key={v}>{v}</option>)}</select>
          <select className="field-input text-xs" aria-label={`Channel ${channel.number || index+1} signal type`} value={channel.signalType} onChange={e => update({ signalType: e.target.value as typeof channel.signalType })}>{["unknown","analog_current","analog_voltage","digital","relay","serial","other"].map(v => <option key={v}>{v}</option>)}</select>
          {!disabled && <button className="icon-button ml-auto" onClick={() => onChange({ ...profile,channels: channels.filter(c => c.id !== channel.id) })}>Remove channel</button>}
        </div>
        <div className="mt-3 space-y-2">{channel.terminals.map((member,i) => <div className="flex flex-wrap gap-2" key={i}>
          <select className="field-input text-xs" aria-label={`Channel ${channel.number} terminal ${i+1}`} value={member.terminalId} onChange={e => update({ terminals: channel.terminals.map((m,j) => i === j ? { ...m,terminalId: e.target.value } : m) })}><option value="">Choose terminal…</option>{terminals.filter(t => t.connectable).map(t => <option key={t.id} value={t.id}>{t.number} · {t.function}</option>)}</select>
          <input className="field-input min-w-32 flex-1 text-xs" aria-label={`Channel ${channel.number} terminal ${i+1} function`} placeholder="Function in this channel" value={member.function} onChange={e => update({ terminals: channel.terminals.map((m,j) => i === j ? { ...m,function: e.target.value } : m) })} />
          <select className="field-input text-xs" aria-label={`Channel ${channel.number} terminal ${i+1} electrical role`} value={member.role??""} onChange={e=>update({terminals:channel.terminals.map((m,j)=>i===j?{...m,role:(e.target.value||undefined) as typeof member.role}:m)})}><option value="">Role needs review</option>{["signal","return","supply","shield","other"].map(role=><option key={role} value={role}>{role}</option>)}</select>
          {!disabled && <button className="icon-button" onClick={() => update({ terminals: channel.terminals.filter((_,j) => i !== j) })}>Remove member</button>}
        </div>)}</div>
        {!disabled && <button className="icon-button mt-2" onClick={() => update({ terminals: [...channel.terminals,{ terminalId: "",function: "" }] })}>Add terminal to channel</button>}
        <div className="mt-3 space-y-2">{channel.ranges.map((range,i) => <div className="flex flex-wrap gap-2" key={i}>
          <label className="text-xs">Minimum<input className="field-input ml-2 w-24" type="number" step="any" aria-label={`Channel ${channel.number} range ${i+1} minimum`} value={Number.isNaN(range.minimum) ? "" : range.minimum} onChange={e => update({ ranges: channel.ranges.map((r,j) => i === j ? { ...r,minimum: e.target.value === "" ? NaN : Number(e.target.value) } : r) })} /></label>
          <label className="text-xs">Maximum<input className="field-input ml-2 w-24" type="number" step="any" aria-label={`Channel ${channel.number} range ${i+1} maximum`} value={Number.isNaN(range.maximum) ? "" : range.maximum} onChange={e => update({ ranges: channel.ranges.map((r,j) => i === j ? { ...r,maximum: e.target.value === "" ? NaN : Number(e.target.value) } : r) })} /></label>
          <input className="field-input w-20 text-xs" aria-label={`Channel ${channel.number} range ${i+1} units`} placeholder="Unit" value={range.unit} onChange={e => update({ ranges: channel.ranges.map((r,j) => i === j ? { ...r,unit: e.target.value } : r) })} />
          {!disabled && <button className="icon-button" onClick={() => update({ ranges: channel.ranges.filter((_,j) => i !== j) })}>Remove range</button>}
        </div>)}</div>
        {!disabled && <button className="icon-button mt-2" onClick={() => update({ ranges: [...channel.ranges,{ minimum: NaN,maximum: NaN,unit: "" }] })}>Add supported range</button>}
      </fieldset>;
    })}</div>
    {!disabled && <button className="icon-button mt-3" onClick={() => onChange({ ...profile,channels: [...channels,{ id: crypto.randomUUID(),number: "",direction: "unknown",signalType: "unknown",ranges: [],terminals: [],evidence: [] }] })}>Add channel</button>}
    </>}
  </details>;
}
