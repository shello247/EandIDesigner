"use client";

import { RotateCcw } from "lucide-react";

export default function BomCreatorError({ reset }: { reset: () => void }) {
  return (
    <div className="tool-panel p-6" role="alert">
      <h1 className="text-lg font-semibold">BOM Creator could not be loaded</h1>
      <p className="mt-2 text-sm text-slate-600">The drawing BOM request failed. Retry without changing the selected drawing.</p>
      <button type="button" className="icon-button mt-4" onClick={reset}><RotateCcw aria-hidden="true" size={14} />Retry</button>
    </div>
  );
}
