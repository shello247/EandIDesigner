"use client";

import { RotateCcw } from "lucide-react";

export default function SavedPanelAnalysisError({
  reset
}: {
  reset: () => void;
}) {
  return (
    <div className="tool-panel max-w-2xl p-6">
      <h1 className="text-lg font-bold">This drawing could not be analyzed</h1>
      <p className="mt-2 text-sm text-slate-600">
        No drawing data was changed. Retry the saved-revision analysis.
      </p>
      <button type="button" className="icon-button mt-4" onClick={() => reset()}>
        <RotateCcw aria-hidden="true" size={15} /> Try again
      </button>
    </div>
  );
}
