"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import {
  groupSymbolsForLibrary,
  type SymbolLibraryContext
} from "../../logic/services/symbol-library-context";
import type { ApprovedDrawingSymbol } from "../../types";

export function SymbolLibraryPanel({
  symbols,
  context,
  headerAction,
  onAddSymbol
}: {
  symbols: ApprovedDrawingSymbol[];
  context: SymbolLibraryContext;
  headerAction?: ReactNode;
  onAddSymbol: (symbol: ApprovedDrawingSymbol) => void;
}) {
  const groups = useMemo(
    () => groupSymbolsForLibrary(symbols, context),
    [context, symbols]
  );
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set()
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();

  const toggleCategory = (category: string) => {
    setOpenCategories((current) => {
      const next = new Set(current);

      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }

      return next;
    });
  };

  return (
    <section className="tool-panel overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="min-w-0 flex-1 text-sm font-bold">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm text-left text-slate-950 outline-none transition hover:text-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} Symbol Library`}
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? (
              <ChevronDown aria-hidden="true" size={15} />
            ) : (
              <ChevronRight aria-hidden="true" size={15} />
            )}
            <span>Symbol Library</span>
          </button>
        </h2>
        {headerAction ?? null}
      </div>
      {isExpanded ? (
        <div
          id={contentId}
          className="max-h-[720px] space-y-2 overflow-auto p-4"
        >
          {groups.map((group) => (
            <div key={group.key}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                aria-expanded={openCategories.has(group.key)}
                aria-controls={`symbol-library-group-${group.key}`}
                onClick={() => toggleCategory(group.key)}
              >
                <span className="inline-flex items-center gap-1.5">
                  {openCategories.has(group.key) ? (
                    <ChevronDown aria-hidden="true" size={13} />
                  ) : (
                    <ChevronRight aria-hidden="true" size={13} />
                  )}
                  {group.label}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                  {group.symbols.length}
                </span>
              </button>
              {openCategories.has(group.key) ? (
                <div
                  id={`symbol-library-group-${group.key}`}
                  className="mt-2 space-y-2"
                >
                  {group.symbols.map((symbol) => (
                    <button
                      key={symbol.versionId}
                      type="button"
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs transition hover:border-teal-200 hover:bg-teal-50"
                      onClick={() => onAddSymbol(symbol)}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span>
                          <span className="block text-[12px] font-semibold leading-snug text-slate-950">
                            {symbol.displayName}
                          </span>
                        </span>
                        <Plus
                          aria-hidden="true"
                          size={14}
                          className="text-teal-700"
                        />
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {groups.length === 0 ? (
            <p className="text-sm text-slate-500">
              No symbols are available for this sheet.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
