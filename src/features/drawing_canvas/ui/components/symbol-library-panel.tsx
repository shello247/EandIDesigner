"use client";

import { Plus } from "lucide-react";
import type { ApprovedDrawingSymbol } from "../../types";

function categoryLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export function SymbolLibraryPanel({
  symbols,
  onAddSymbol
}: {
  symbols: ApprovedDrawingSymbol[];
  onAddSymbol: (symbol: ApprovedDrawingSymbol) => void;
}) {
  const groups = new Map<string, ApprovedDrawingSymbol[]>();

  for (const symbol of symbols) {
    const group = groups.get(symbol.category) ?? [];
    group.push(symbol);
    groups.set(symbol.category, group);
  }

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Approved Symbols</h2>
      </div>
      <div className="max-h-[720px] space-y-4 overflow-auto p-4">
        {Array.from(groups.entries()).map(([category, items]) => (
          <div key={category}>
            <div className="mb-2 text-[11px] font-bold uppercase text-slate-500">
              {categoryLabel(category)}
            </div>
            <div className="space-y-2">
              {items.map((symbol) => (
                <button
                  key={symbol.versionId}
                  type="button"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs transition hover:border-teal-200 hover:bg-teal-50"
                  onClick={() => onAddSymbol(symbol)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span>
                      <span className="block font-semibold text-slate-950">
                        {symbol.displayName}
                      </span>
                      <span className="mt-1 block text-slate-500">
                        {symbol.symbolKey}
                      </span>
                    </span>
                    <Plus aria-hidden="true" size={14} className="text-teal-700" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {symbols.length === 0 ? (
          <p className="text-sm text-slate-500">No approved symbols are available.</p>
        ) : null}
      </div>
    </section>
  );
}
