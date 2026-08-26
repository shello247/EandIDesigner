"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SymbolListItem } from "../../types";
import { SymbolDeleteButton } from "./symbol-delete-button";
import { SymbolStatusBadge } from "./symbol-status-badge";

type SymbolTableProps = {
  categories: Array<SymbolListItem["category"]>;
  symbols: SymbolListItem[];
};

export function SymbolTable({ categories, symbols }: SymbolTableProps) {
  const [categoryId, setCategoryId] = useState("all");
  const filteredSymbols = useMemo(
    () =>
      categoryId === "all"
        ? symbols
        : symbols.filter((symbol) => symbol.category.id === categoryId),
    [categoryId, symbols]
  );

  if (symbols.length === 0) {
    return (
      <div className="tool-panel flex min-h-[260px] items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-lg font-bold">No symbols yet</h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Import an approved SVG symbol, validate its terminal map, then
            approve it into the registry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tool-panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-3 py-2">
        <label className="grid min-w-56 gap-1 text-xs font-semibold text-slate-700">
          Category
          <select
            aria-label="Filter symbols by category"
            className="field-control h-9 py-1.5"
            onChange={(event) => setCategoryId(event.target.value)}
            value={categoryId}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <span className="pb-1 text-xs text-slate-500">
          {filteredSymbols.length}{" "}
          {filteredSymbols.length === 1 ? "symbol" : "symbols"}
        </span>
      </div>
      <table className="data-table table-fixed [&_td]:!py-1.5 [&_td]:!align-middle [&_th]:!py-1.5">
        <colgroup>
          <col className="w-[48%]" />
          <col className="w-[18%]" />
          <col className="w-[14%]" />
          <col className="w-[8%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Category</th>
            <th>Status</th>
            <th>Version</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredSymbols.map((symbol) => (
            <tr key={symbol.id} className="hover:bg-slate-50">
              <td>
                <Link
                  href={`/symbols/${symbol.id}`}
                  className="font-normal leading-5 text-slate-950 hover:text-teal-800"
                >
                  {symbol.displayName}
                </Link>
              </td>
              <td className="whitespace-nowrap">
                {symbol.category.name}
              </td>
              <td className="whitespace-nowrap">
                <SymbolStatusBadge status={symbol.status} />
              </td>
              <td className="whitespace-nowrap">
                {symbol.latestVersionNumber ?? "-"}
              </td>
              <td className="whitespace-nowrap">
                <SymbolDeleteButton
                  displayName={symbol.displayName}
                  symbolId={symbol.id}
                  symbolKey={symbol.symbolKey}
                />
              </td>
            </tr>
          ))}
          {filteredSymbols.length === 0 ? (
            <tr>
              <td
                className="py-8 text-center text-sm text-slate-500"
                colSpan={5}
              >
                No symbols are assigned to this category.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
