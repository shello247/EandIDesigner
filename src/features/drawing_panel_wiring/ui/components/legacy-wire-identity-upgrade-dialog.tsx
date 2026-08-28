"use client";

import { ArrowRight, Hash, X } from "lucide-react";
import type { LegacyWireIdentityUpgradePreview } from "../../api/public";

export function LegacyWireIdentityUpgradeDialog({
  preview,
  onCancel,
  onApply
}: {
  preview: LegacyWireIdentityUpgradePreview;
  onCancel: () => void;
  onApply: () => void;
}) {
  const titleId = "legacy-wire-identity-upgrade-title";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-800">
            <Hash aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-bold">
              Upgrade wire identifiers
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Review the package-wide numbering result. Record IDs, endpoints,
              routes, patterns, descriptions, and specifications are preserved.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            aria-label="Close wire upgrade"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="sticky top-0 bg-white text-[10px] font-bold uppercase text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2">Existing ID</th>
                <th className="border-b border-slate-200 px-3 py-2">Wire #</th>
                <th className="border-b border-slate-200 px-3 py-2">New Wire ID</th>
                <th className="border-b border-slate-200 px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row.wireRecordId}>
                  <td className="border-b border-slate-100 px-3 py-2 font-mono">
                    {row.oldWireId}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 font-mono">
                    {row.wireNumberLabel ?? "—"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 font-mono">
                    {row.newWireId ?? "—"}
                  </td>
                  <td
                    className={[
                      "border-b border-slate-100 px-3 py-2",
                      row.blockingReason ? "text-rose-700" : "text-emerald-700"
                    ].join(" ")}
                  >
                    {row.blockingReason ?? "Ready"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-500">
            {preview.rows.length} legacy internal wire
            {preview.rows.length === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <button type="button" className="icon-button" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="icon-button icon-button-primary"
              disabled={!preview.canApply}
              onClick={onApply}
            >
              Apply upgrade
              <ArrowRight aria-hidden="true" size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
