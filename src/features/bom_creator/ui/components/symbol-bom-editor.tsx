"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Plus, Save, Search, Trash2 } from "lucide-react";
import { saveSymbolBomTemplateAction } from "../../api/actions";
import type {
  BomGenerationItem,
  BomGenerationTemplate,
  BomQuantityRule,
  SaveSymbolBomTemplateInput
} from "../../data/schema";

const loadPickerModule = () => import("./bom-item-picker-dialog");
const BomItemPickerDialog = dynamic(
  () => loadPickerModule().then((module) => module.BomItemPickerDialog),
  { ssr: false }
);

type DraftLine = {
  clientId: string;
  item: BomGenerationItem;
  quantityRule: BomQuantityRule;
  quantity: number;
  notes: string;
};

const quantityRuleOptions: Array<{ value: BomQuantityRule; label: string }> = [
  { value: "fixed_per_assembly", label: "Fixed per assembly" },
  { value: "per_cable_end", label: "Per cable end" },
  { value: "per_conductor_termination", label: "Per conductor termination" },
  { value: "per_connection", label: "Per connection" },
  { value: "manual", label: "Manual" }
];

function createClientId(): string {
  return `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function templateLinesToDraft(template: BomGenerationTemplate | null): DraftLine[] {
  return template?.lines.map((line) => ({
    clientId: line.id,
    item: line.item,
    quantityRule: line.quantityRule,
    quantity: line.quantity,
    notes: line.notes ?? ""
  })) ?? [];
}

export function SymbolBomEditor({
  symbolId,
  template
}: {
  symbolId: string;
  template: BomGenerationTemplate | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [lines, setLines] = useState<DraftLine[]>(templateLinesToDraft(template));
  const [pickerLineId, setPickerLineId] = useState<string | null | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateLine = (clientId: string, updates: Partial<DraftLine>) => {
    setLines((current) => current.map((line) => line.clientId === clientId ? { ...line, ...updates } : line));
  };

  const saveTemplate = () => {
    const input: SaveSymbolBomTemplateInput = {
      symbolId,
      notes,
      lines: lines.map((line) => ({
        itemId: line.item.id,
        quantityRule: line.quantityRule,
        quantity: line.quantity,
        notes: line.notes
      }))
    };

    startTransition(async () => {
      setMessage(null);
      const result = await saveSymbolBomTemplateAction(input);
      if (!result.ok) { setMessage(result.error); return; }
      setMessage("Symbol BOM saved.");
      router.refresh();
    });
  };

  const selectedPickerLine = typeof pickerLineId === "string"
    ? lines.find((line) => line.clientId === pickerLineId)
    : undefined;

  return (
    <div className="tool-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div><h2 className="text-sm font-bold">Symbol Mini BOM</h2><p className="mt-1 text-xs text-slate-500">{lines.length} linked item{lines.length === 1 ? "" : "s"}</p></div>
        <div className="flex flex-wrap gap-2">
          <Link href="/bom/items" className="icon-button">Items library</Link>
          <button type="button" className="icon-button" onClick={() => { void loadPickerModule(); setPickerLineId(null); }} disabled={isPending}><Plus aria-hidden="true" size={14} />Add item</button>
          <button type="button" className="icon-button icon-button-primary" onClick={saveTemplate} disabled={isPending}><Save aria-hidden="true" size={14} />{isPending ? "Saving..." : "Save BOM"}</button>
        </div>
      </div>

      {message ? <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 text-xs text-slate-600"><AlertCircle aria-hidden="true" size={14} className="text-teal-700" /><span>{message}</span></div> : null}
      <div className="border-b border-slate-200 p-4"><label className="field-label" htmlFor="symbol-bom-notes">Notes</label><textarea id="symbol-bom-notes" className="field-input min-h-20" value={notes} onChange={(event) => setNotes(event.currentTarget.value)} /></div>

      {lines.length === 0 ? (
        <div className="p-6 text-sm text-slate-600">No BOM items are linked to this symbol.</div>
      ) : (
        <div className="overflow-auto"><table className="data-table"><thead><tr><th>Item</th><th>Quantity Rule</th><th>Quantity</th><th>Notes</th><th></th></tr></thead><tbody>
          {lines.map((line, index) => (
            <tr key={line.clientId}>
              <td><div className="min-w-64"><div className="font-semibold">{line.item.displayName}</div><div className="mt-1 text-xs text-slate-500">{line.item.itemKey}{line.item.status === "archived" ? " / archived" : ""}</div><button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700" onClick={() => { void loadPickerModule(); setPickerLineId(line.clientId); }}><Search aria-hidden="true" size={13} />Change item</button></div></td>
              <td><select aria-label={`Quantity rule ${index + 1}`} className="field-input min-w-52" value={line.quantityRule} onChange={(event) => updateLine(line.clientId, { quantityRule: event.currentTarget.value as BomQuantityRule })}>{quantityRuleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td>
              <td><input aria-label={`Quantity ${index + 1}`} className="field-input min-w-28" type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateLine(line.clientId, { quantity: Number(event.currentTarget.value) })} /></td>
              <td><input aria-label={`Line notes ${index + 1}`} className="field-input min-w-48" value={line.notes} onChange={(event) => updateLine(line.clientId, { notes: event.currentTarget.value })} /></td>
              <td><button type="button" className="icon-button icon-button-danger min-h-7 px-2 py-1 text-[12px]" aria-label={`Remove BOM line ${index + 1}`} onClick={() => setLines((current) => current.filter((item) => item.clientId !== line.clientId))} disabled={isPending}><Trash2 aria-hidden="true" size={13} />Remove</button></td>
            </tr>
          ))}
        </tbody></table></div>
      )}

      {pickerLineId !== undefined ? (
        <BomItemPickerDialog
          currentItem={selectedPickerLine?.item}
          onClose={() => setPickerLineId(undefined)}
          onSelect={(item) => {
            if (typeof pickerLineId === "string") {
              updateLine(pickerLineId, { item });
            } else {
              setLines((current) => [...current, { clientId: createClientId(), item, quantityRule: "fixed_per_assembly", quantity: 1, notes: "" }]);
            }
            setPickerLineId(undefined);
          }}
        />
      ) : null}
    </div>
  );
}
