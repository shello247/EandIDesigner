"use client";

import { useMemo, useState } from "react";
import { FileText, Layers, Search, X } from "lucide-react";
import {
  filterSheetLoaderRows,
  type SheetLoaderRow
} from "../../logic/services/sheet-loader-rows";

export function SheetLoaderDialog({
  rows,
  activeSheetId,
  onCancel,
  onLoadSheet
}: {
  rows: SheetLoaderRow[];
  activeSheetId: string;
  onCancel: () => void;
  onLoadSheet: (sheetId: string) => void;
}) {
  const titleId = "sheet-loader-dialog-title";
  const descriptionId = "sheet-loader-dialog-description";
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => {
    return filterSheetLoaderRows(rows, query);
  }, [query, rows]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="flex max-h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <Layers aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Sheet Loader
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Load one sheet into the edit workspace. Package preview and PDF
              still include the full drawing set.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close sheet loader"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="min-h-0 overflow-auto px-5 py-4">
          <label className="mb-3 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
            <Search aria-hidden="true" size={14} className="shrink-0" />
            <span className="sr-only">Search sheets</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by sheet number, name, type, or description"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="w-20 py-2 pr-3">Sheet</th>
                <th className="min-w-52 py-2 pr-3">Name</th>
                <th className="w-32 py-2 pr-3">Type</th>
                <th className="min-w-56 py-2 pr-3">Description</th>
                <th className="w-24 py-2 pr-3 text-right">Placements</th>
                <th className="w-20 py-2 pr-3 text-right">Assets</th>
                <th className="w-24 py-2 pr-3 text-right">Connections</th>
                <th className="w-24 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const isActive = row.sheetId === activeSheetId;

                return (
                  <tr
                    key={row.sheetId}
                    className={[
                      "border-b border-slate-100",
                      isActive ? "bg-sky-50/65" : "hover:bg-slate-50"
                    ].join(" ")}
                  >
                    <td className="py-3 pr-3 font-semibold text-slate-700">
                      Sheet {row.sheetNumber}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <FileText
                          aria-hidden="true"
                          size={14}
                          className="shrink-0 text-slate-400"
                        />
                        <span className="font-semibold text-slate-950">
                          {row.name || `Sheet ${row.sheetNumber}`}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">
                      {row.typeLabel}
                    </td>
                    <td className="max-w-80 py-3 pr-3 text-slate-500">
                      <span className="line-clamp-2">
                        {row.description || "No description"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right font-medium text-slate-700">
                      {row.placementCount}
                    </td>
                    <td className="py-3 pr-3 text-right font-medium text-slate-700">
                      {row.assetCount}
                    </td>
                    <td className="py-3 pr-3 text-right font-medium text-slate-700">
                      {row.connectionCount}
                    </td>
                    <td className="py-3 text-right">
                      {isActive ? (
                        <span className="inline-flex h-8 items-center rounded-md border border-sky-300 bg-sky-100 px-3 text-xs font-bold text-sky-800">
                          Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="icon-button h-8"
                          onClick={() => onLoadSheet(row.sheetId)}
                        >
                          Load
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-sm font-medium text-slate-500"
                  >
                    No sheets match your search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
