"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { searchBomItemPickerAction } from "../../api/actions";
import type {
  BomGenerationItem,
  BomItemPickerResult
} from "../../data/schema";

export function BomItemPickerDialog({
  currentItem,
  onClose,
  onSelect
}: {
  currentItem?: BomGenerationItem;
  onClose: () => void;
  onSelect: (item: BomGenerationItem) => void;
}) {
  const [draftQuery, setDraftQuery] = useState("");
  const [result, setResult] = useState<BomItemPickerResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadPage = (query: string | undefined, page: number) => {
    startTransition(async () => {
      setMessage(null);
      const response = await searchBomItemPickerAction({ query, page });

      if (!response.ok) {
        setMessage(response.error);
        return;
      }

      setResult(response.data);
    });
  };

  useEffect(() => {
    loadPage(undefined, 1);
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loadPage(draftQuery.trim() || undefined, 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="presentation">
      <div className="flex max-h-[min(720px,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby="bom-item-picker-title" data-testid="bom-item-picker-dialog">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div><h2 id="bom-item-picker-title" className="text-base font-semibold">Select BOM item</h2><p className="mt-1 text-xs text-slate-500">Search the active Items Library by name, key, part, manufacturer, or supplier.</p></div>
          <button type="button" className="icon-button h-8 w-8 shrink-0 p-0" aria-label="Close item picker" onClick={onClose}><X aria-hidden="true" size={16} /></button>
        </div>

        {currentItem ? (
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs">
            Current: <span className="font-semibold">{currentItem.displayName} ({currentItem.itemKey})</span>{currentItem.status === "archived" ? " - archived" : ""}
          </div>
        ) : null}

        <form className="flex gap-2 border-b border-slate-200 p-4" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="bom-item-picker-search">Search items</label>
          <input id="bom-item-picker-search" className="field-input" value={draftQuery} onChange={(event) => setDraftQuery(event.currentTarget.value)} maxLength={120} autoFocus />
          <button type="submit" className="icon-button icon-button-primary" disabled={isPending}><Search aria-hidden="true" size={14} />Search</button>
        </form>

        {message ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">{message}</div> : null}

        <div className="min-h-56 flex-1 overflow-auto">
          {!result ? (
            <div className="grid min-h-56 place-items-center text-sm text-slate-500" role="status">Loading items...</div>
          ) : result.items.length === 0 ? (
            <div className="grid min-h-56 place-items-center p-6 text-sm text-slate-500">No active items match this search.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {result.items.map((item) => (
                <button key={item.id} type="button" className="flex w-full items-start justify-between gap-4 px-5 py-3 text-left hover:bg-slate-50" onClick={() => onSelect(item)}>
                  <span><span className="block text-sm font-semibold text-slate-950">{item.displayName}</span><span className="mt-1 block text-xs text-slate-500">{item.itemKey} / {item.category.replace(/_/g, " ")} / {item.unit}</span></span>
                  <span className="text-right text-xs text-slate-500">{item.manufacturer ?? ""}{item.partNumber ? <span className="block">{item.partNumber}</span> : null}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div className="text-xs font-semibold text-slate-500">{result ? `${result.totalItems} items / page ${result.page} of ${result.totalPages}` : "Loading"}</div>
          <div className="flex gap-2">
            <button type="button" className="icon-button" disabled={!result || result.page <= 1 || isPending} onClick={() => result && loadPage(result.query, result.page - 1)}>Previous</button>
            <button type="button" className="icon-button" disabled={!result || result.page >= result.totalPages || isPending} onClick={() => result && loadPage(result.query, result.page + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
