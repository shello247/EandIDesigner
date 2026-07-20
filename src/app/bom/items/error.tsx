"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function BomItemsError({ reset }: { reset: () => void }) {
  return (
    <div className="tool-panel flex min-h-[320px] items-center justify-center p-8 text-center">
      <div>
        <AlertTriangle
          aria-hidden="true"
          className="mx-auto text-amber-600"
          size={28}
        />
        <h1 className="mt-4 text-lg font-semibold text-slate-950">
          Items Library could not be loaded
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Retry the request. Your current URL filters will be preserved.
        </p>
        <button
          type="button"
          className="icon-button icon-button-primary mt-4"
          onClick={reset}
        >
          <RefreshCw aria-hidden="true" size={14} />
          Retry
        </button>
      </div>
    </div>
  );
}
