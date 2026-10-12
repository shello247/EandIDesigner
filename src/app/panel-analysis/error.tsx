"use client";

import { RotateCcw } from "lucide-react";

export default function PanelAnalysisError({ reset }: { reset: () => void }) {
  return (
    <div className="tool-panel max-w-2xl p-6">
      <h1 className="text-lg font-bold">Panel Analysis could not be loaded</h1>
      <p className="mt-2 text-sm text-slate-600">
        The saved drawing was not changed. Retry the read-only analysis.
      </p>
      <button type="button" className="icon-button mt-4" onClick={() => reset()}>
        <RotateCcw aria-hidden="true" size={15} /> Try again
      </button>
    </div>
  );
}
