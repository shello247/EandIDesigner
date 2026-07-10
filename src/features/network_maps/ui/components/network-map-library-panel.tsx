"use client";

import { type ReactNode } from "react";

export function NetworkMapLibraryPanel({
  headerAction
}: {
  headerAction?: ReactNode;
}) {
  return (
    <section className="tool-panel overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Network Library</h2>
        {headerAction ?? null}
      </div>
      <div className="max-h-[720px] space-y-3 overflow-auto p-4">
        <p className="text-sm text-slate-500">
          No network devices are available for this map.
        </p>
      </div>
    </section>
  );
}
