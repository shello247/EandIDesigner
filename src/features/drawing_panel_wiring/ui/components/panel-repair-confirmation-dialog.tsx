import { ShieldCheck, X } from "lucide-react";
import type { PanelDrawingQualityFinding } from "../../data/schema";

export function PanelRepairConfirmationDialog({
  finding,
  onCancel,
  onConfirm
}: {
  finding: PanelDrawingQualityFinding;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!finding.repair) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="panel-repair-title"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <ShieldCheck aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="panel-repair-title" className="text-sm font-semibold text-slate-950">
              {finding.repair.label}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {finding.repair.confirmation}
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            aria-label="Cancel repair"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>
        <div className="bg-slate-50 px-5 py-3 text-xs text-slate-600">
          Only the identified visual occurrence or mapping override will be removed.
          Physical assets and authoritative field connections are preserved.
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" className="icon-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            onClick={onConfirm}
          >
            Confirm repair
          </button>
        </div>
      </div>
    </div>
  );
}
