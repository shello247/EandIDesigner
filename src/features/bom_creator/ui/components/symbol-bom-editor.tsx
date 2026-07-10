"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertCircle, Plus, Save, Trash2 } from "lucide-react";
import { saveSymbolBomTemplateAction } from "../../api/actions";
import type {
  BomItemSummary,
  BomQuantityRule,
  SaveSymbolBomTemplateInput,
  SymbolBomTemplateDetail
} from "../../data/schema";

type DraftLine = {
  clientId: string;
  itemId: string;
  quantityRule: BomQuantityRule;
  quantity: number;
  notes: string;
};

const quantityRuleOptions: Array<{
  value: BomQuantityRule;
  label: string;
}> = [
  { value: "fixed_per_assembly", label: "Fixed per assembly" },
  { value: "per_cable_end", label: "Per cable end" },
  { value: "per_conductor_termination", label: "Per conductor termination" },
  { value: "per_connection", label: "Per connection" },
  { value: "manual", label: "Manual" }
];

function createClientId(): string {
  return `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function templateLinesToDraft(
  template: SymbolBomTemplateDetail | null
): DraftLine[] {
  return (
    template?.lines.map((line) => ({
      clientId: line.id,
      itemId: line.itemId,
      quantityRule: line.quantityRule,
      quantity: line.quantity,
      notes: line.notes ?? ""
    })) ?? []
  );
}

function itemLabel(item: BomItemSummary): string {
  return `${item.displayName} (${item.itemKey})${
    item.status === "archived" ? " - archived" : ""
  }`;
}

export function SymbolBomEditor({
  symbolId,
  items,
  template
}: {
  symbolId: string;
  items: BomItemSummary[];
  template: SymbolBomTemplateDetail | null;
}) {
  const router = useRouter();
  const activeItems = useMemo(
    () => items.filter((item) => item.status === "active"),
    [items]
  );
  const firstItemId = activeItems[0]?.id ?? items[0]?.id ?? "";
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [lines, setLines] = useState<DraftLine[]>(
    templateLinesToDraft(template)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const addLine = () => {
    if (!firstItemId) {
      setMessage("Create a BOM item before adding template lines.");
      return;
    }

    setLines((current) => [
      ...current,
      {
        clientId: createClientId(),
        itemId: firstItemId,
        quantityRule: "fixed_per_assembly",
        quantity: 1,
        notes: ""
      }
    ]);
  };

  const updateLine = (clientId: string, updates: Partial<DraftLine>) => {
    setLines((current) =>
      current.map((line) =>
        line.clientId === clientId ? { ...line, ...updates } : line
      )
    );
  };

  const removeLine = (clientId: string) => {
    setLines((current) => current.filter((line) => line.clientId !== clientId));
  };

  const saveTemplate = () => {
    const input: SaveSymbolBomTemplateInput = {
      symbolId,
      notes,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        quantityRule: line.quantityRule,
        quantity: line.quantity,
        notes: line.notes
      }))
    };

    startTransition(async () => {
      setMessage(null);
      const result = await saveSymbolBomTemplateAction(input);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setMessage("Symbol BOM saved.");
      router.refresh();
    });
  };

  return (
    <div className="tool-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold">Symbol Mini BOM</h2>
          <p className="mt-1 text-xs text-slate-500">
            {lines.length} linked item{lines.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/bom/items" className="icon-button">
            Items library
          </Link>
          <button
            type="button"
            className="icon-button"
            onClick={addLine}
            disabled={isPending || items.length === 0}
          >
            <Plus aria-hidden="true" size={14} />
            Add item
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            onClick={saveTemplate}
            disabled={isPending}
          >
            <Save aria-hidden="true" size={14} />
            {isPending ? "Saving..." : "Save BOM"}
          </button>
        </div>
      </div>

      {message ? (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
          <AlertCircle aria-hidden="true" size={14} className="text-teal-700" />
          <span>{message}</span>
        </div>
      ) : null}

      <div className="border-b border-slate-200 p-4">
        <label className="field-label" htmlFor="symbol-bom-notes">
          Notes
        </label>
        <textarea
          id="symbol-bom-notes"
          className="field-input min-h-20"
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
        />
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-sm text-slate-600">
          The item library is empty.
        </div>
      ) : lines.length === 0 ? (
        <div className="p-6 text-sm text-slate-600">
          No BOM items are linked to this symbol.
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity Rule</th>
                <th>Quantity</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.clientId}>
                  <td>
                    <select
                      aria-label={`BOM item ${index + 1}`}
                      className="field-input min-w-64"
                      value={line.itemId}
                      onChange={(event) =>
                        updateLine(line.clientId, {
                          itemId: event.currentTarget.value
                        })
                      }
                    >
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {itemLabel(item)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`Quantity rule ${index + 1}`}
                      className="field-input min-w-52"
                      value={line.quantityRule}
                      onChange={(event) =>
                        updateLine(line.clientId, {
                          quantityRule: event.currentTarget.value as BomQuantityRule
                        })
                      }
                    >
                      {quantityRuleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`Quantity ${index + 1}`}
                      className="field-input min-w-28"
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.clientId, {
                          quantity: Number(event.currentTarget.value)
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Line notes ${index + 1}`}
                      className="field-input min-w-48"
                      value={line.notes}
                      onChange={(event) =>
                        updateLine(line.clientId, {
                          notes: event.currentTarget.value
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-button icon-button-danger min-h-7 px-2 py-1 text-[12px]"
                      aria-label={`Remove BOM line ${index + 1}`}
                      onClick={() => removeLine(line.clientId)}
                      disabled={isPending}
                    >
                      <Trash2 aria-hidden="true" size={13} />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
