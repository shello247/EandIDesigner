"use client";

import { AlertTriangle, Network, X } from "lucide-react";
import type { PanelPatternCommandResult } from "../../api/public";

export function PanelPatternReviewDialog({
  result,
  memberLabels,
  onCancel,
  onConfirm
}: {
  result: PanelPatternCommandResult;
  memberLabels: string[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const record = result.pattern?.record;
  const errors = result.warnings.filter((finding) => finding.severity === "error");
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-panel w-[min(760px,calc(100vw-32px))]" role="dialog" aria-modal="true" aria-labelledby="panel-pattern-review-title">
        <header className="dialog-header">
          <div className="flex items-center gap-3">
            <span className="rounded border border-teal-200 bg-teal-50 p-2 text-teal-700">
              <Network aria-hidden="true" size={18} />
            </span>
            <div>
              <h2 id="panel-pattern-review-title" className="text-base font-semibold">Review connection pattern</h2>
              <p className="text-xs text-slate-500">{record?.patternCode ?? "Pending pattern"}</p>
            </div>
          </div>
          <button type="button" className="dialog-close" onClick={onCancel} aria-label="Close review"><X aria-hidden="true" size={16} /></button>
        </header>
        <div className="space-y-5 p-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-xs font-semibold text-slate-500">Pattern</dt><dd>{record?.patternCode ?? "Not allocated"}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Domain</dt><dd className="capitalize">{record && "domain" in record ? (record.domain ?? record.kind).replaceAll("_", " ") : "-"}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Members</dt><dd>{memberLabels.length}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Owned wires</dt><dd>{result.wires?.length ?? 0}</dd></div>
          </dl>
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-500">Terminal order</h3>
            <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {memberLabels.map((label, index) => <li key={`${label}:${index}`}><span className="mr-2 font-mono text-slate-400">{index + 1}</span>{label}</li>)}
            </ol>
          </div>
          {(result.wires?.length ?? 0) > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase text-slate-500">Generated wires</h3>
              <div className="mt-2 flex flex-wrap gap-2">{result.wires?.map((wire) => <span key={wire.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs">{wire.wireId}</span>)}</div>
            </div>
          ) : null}
          {result.warnings.length > 0 ? (
            <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              {result.warnings.map((finding) => <p key={finding.id} className="flex gap-2"><AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={14} /><span>{finding.message}</span></p>)}
            </div>
          ) : null}
        </div>
        <footer className="dialog-footer">
          <button type="button" className="icon-button" onClick={onCancel}>Back</button>
          <button type="button" className="icon-button icon-button-primary" disabled={!result.pattern || errors.length > 0} onClick={onConfirm}>Create pattern</button>
        </footer>
      </section>
    </div>
  );
}
