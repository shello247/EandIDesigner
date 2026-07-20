"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { getSymbolBomEditorDataAction } from "../../api/actions";
import type { SymbolBomEditorData } from "../../data/schema";

const loadEditorModule = () => import("./symbol-bom-editor");
const SymbolBomEditor = dynamic(
  () => loadEditorModule().then((module) => module.SymbolBomEditor),
  { ssr: false }
);

export function SymbolBomPanelLoader({ symbolId }: { symbolId: string }) {
  const [data, setData] = useState<SymbolBomEditorData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void Promise.all([getSymbolBomEditorDataAction(symbolId), loadEditorModule()]).then(([result]) => {
      if (!active) return;
      if (!result.ok) { setError(result.error); return; }
      setData(result.data);
    });

    return () => { active = false; };
  }, [symbolId]);

  if (error) {
    return <div className="tool-panel flex items-center gap-2 p-5 text-sm text-amber-800" role="alert"><AlertCircle aria-hidden="true" size={16} />{error}</div>;
  }

  if (!data) {
    return <div className="tool-panel min-h-40 p-5 text-sm text-slate-500" role="status">Loading symbol mini BOM...</div>;
  }

  return <SymbolBomEditor symbolId={symbolId} template={data.template} />;
}
