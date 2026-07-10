import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { SymbolDetail } from "../../types";
import { ApprovalBar } from "./approval-bar";
import { SymbolStatusBadge } from "./symbol-status-badge";
import { SymbolWorkspaceTabs } from "./symbol-workspace-tabs";

export function SymbolDetailPanel({ symbol }: { symbol: SymbolDetail }) {
  const latest = symbol.latestVersion;
  const blockingIssueCount = symbol.validationIssues.filter(
    (issue) => issue.severity === "blocking"
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/symbols"
            className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-teal-800"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Symbols
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-normal">
              {symbol.displayName}
            </h1>
            <SymbolStatusBadge status={symbol.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {symbol.symbolKey}
            {symbol.manufacturer ? ` / ${symbol.manufacturer}` : ""}
            {symbol.model ? ` / ${symbol.model}` : ""}
          </p>
        </div>
      </div>

      {latest ? (
        <>
          <ApprovalBar
            symbolId={symbol.id}
            versionId={latest.id}
            status={symbol.status}
            blockingIssueCount={blockingIssueCount}
          />
          <SymbolWorkspaceTabs symbol={symbol} latest={latest} />
        </>
      ) : (
        <div className="tool-panel p-6 text-sm text-slate-600">
          This symbol does not have any versions.
        </div>
      )}
    </div>
  );
}
