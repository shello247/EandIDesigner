"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { SymbolDetail } from "../../types";
import { SymbolStatusBadge } from "./symbol-status-badge";
import { SymbolMetadataEditor } from "./symbol-metadata-editor";
import type { ComponentAlternativeCandidate } from "@/features/symbol_components/api/public";
import type { SymbolCategoryRecord } from "@/features/symbol_categories/api/public";
import styles from "./symbol-detail-workspace.module.css";

export function SymbolDetailPanel({
  symbol,
  componentAlternatives,
  categories
}: {
  symbol: SymbolDetail;
  componentAlternatives: ComponentAlternativeCandidate[];
  categories: SymbolCategoryRecord[];
}) {
  const latest = symbol.latestVersion;
  const [displayName, setDisplayName] = useState(symbol.displayName);
  const [description, setDescription] = useState(latest?.metadata.description);

  return (
    <div className={`flex flex-col gap-5 ${styles.workspace}`}>
      <div
        className={`flex flex-wrap items-start justify-between gap-4 ${styles.workspaceHeader}`}
      >
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
              {displayName}
            </h1>
            <SymbolStatusBadge status={symbol.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {symbol.symbolKey}
            {symbol.manufacturer ? ` / ${symbol.manufacturer}` : ""}
            {symbol.model ? ` / ${symbol.model}` : ""}
          </p>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {latest ? (
        <SymbolMetadataEditor
          symbol={symbol}
          latest={latest}
          componentAlternatives={componentAlternatives}
          categories={categories}
          onSavedRegistryDetails={(details) => {
            setDisplayName(details.displayName);
            setDescription(details.description);
          }}
        />
      ) : (
        <div className="tool-panel p-6 text-sm text-slate-600">
          This symbol does not have any versions.
        </div>
      )}
    </div>
  );
}
