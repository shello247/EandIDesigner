import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { SymbolListItem } from "../../types";
import { SymbolStatusBadge } from "./symbol-status-badge";

export function SymbolTable({ symbols }: { symbols: SymbolListItem[] }) {
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
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Category</th>
            <th>Status</th>
            <th>Version</th>
            <th>Issues</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {symbols.map((symbol) => (
            <tr key={symbol.id} className="hover:bg-slate-50">
              <td>
                <Link
                  href={`/symbols/${symbol.id}`}
                  className="font-bold text-slate-950 hover:text-teal-800"
                >
                  {symbol.displayName}
                </Link>
                <div className="mt-1 text-xs text-slate-500">
                  {symbol.symbolKey}
                  {symbol.model ? ` / ${symbol.model}` : ""}
                </div>
              </td>
              <td className="capitalize">{symbol.category.replace("_", " ")}</td>
              <td>
                <SymbolStatusBadge status={symbol.status} />
              </td>
              <td>{symbol.latestVersionNumber ?? "-"}</td>
              <td>
                {symbol.blockingIssueCount > 0 ? (
                  <span className="inline-flex items-center gap-1 font-bold text-red-700">
                    <AlertTriangle aria-hidden="true" size={15} />
                    {symbol.blockingIssueCount}
                  </span>
                ) : (
                  <span className="text-slate-500">0</span>
                )}
              </td>
              <td>{new Date(symbol.updatedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
