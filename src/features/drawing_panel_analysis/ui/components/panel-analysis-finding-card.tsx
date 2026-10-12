"use client";

import Link from "next/link";
import {EvidenceLinks} from "@/features/item_engineering/ui/components/inherited-specifications";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import type { FilteredPanelAnalysisFindingGroup } from "../../logic/services/panel-analysis-filtering";
import { panelAnalysisCategoryLabel } from "./panel-analysis-filters";

const severityLabels = {
  error: "Error",
  warning: "Warning",
  data_gap: "Data gap",
  information: "Information"
} as const;

const severityTone = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  data_gap: "border-sky-200 bg-sky-50 text-sky-800",
  information: "border-slate-200 bg-slate-50 text-slate-700"
} as const;

export function panelAnalysisDrawingHref({
  drawingId,
  sheetId,
  objectKind,
  objectId
}: {
  drawingId: string;
  sheetId: string;
  objectKind?: string;
  objectId?: string;
}): string {
  const params = new URLSearchParams({ sheetId });
  if (
    objectKind &&
    objectId &&
    ["placement", "connection", "annotation"].includes(objectKind)
  ) {
    params.set("objectKind", objectKind);
    params.set("objectId", objectId);
  }
  return `/drawings/${encodeURIComponent(drawingId)}?${params.toString()}`;
}

export function PanelAnalysisFindingCard({
  drawingId,
  item
}: {
  drawingId: string;
  item: FilteredPanelAnalysisFindingGroup;
}) {
  const router = useRouter();
  const [isRechecking, startRecheckTransition] = useTransition();
  const [recheckStatus, setRecheckStatus] = useState<string | undefined>();
  const recheckRequestedRef = useRef(false);
  const { group, findings } = item;
  const locations = findings.flatMap((finding) => finding.locations);
  const firstLocation = locations.length === 1 ? locations[0] : undefined;
  const recheckLabel =
    group.severity === "error"
      ? "Recheck This Error"
      : group.severity === "warning"
        ? "Recheck This Warning"
        : undefined;

  useEffect(() => {
    if (isRechecking || !recheckRequestedRef.current) {
      return;
    }
    recheckRequestedRef.current = false;
    setRecheckStatus("Rechecked against the latest saved drawing revision.");
  }, [isRechecking]);

  const recheckFinding = () => {
    recheckRequestedRef.current = true;
    setRecheckStatus(undefined);
    startRecheckTransition(() => {
      router.refresh();
    });
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${severityTone[group.severity]}`}>
              {severityLabels[group.severity]}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {panelAnalysisCategoryLabel(group.category)}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-bold text-slate-950">{group.title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">{group.summary}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            {firstLocation ? (
              <Link
                href={panelAnalysisDrawingHref({
                  drawingId,
                  sheetId: firstLocation.sheetId,
                  objectKind: firstLocation.objectKind,
                  objectId: firstLocation.objectId
                })}
                target="_blank"
                rel="noopener noreferrer"
                prefetch={false}
                className="icon-button min-h-8 px-2 py-1 text-xs"
                title="Open the affected drawing location in a new tab"
              >
                <ExternalLink aria-hidden="true" size={14} />
                Fix in Drawing
              </Link>
            ) : null}
            {recheckLabel ? (
              <button
                type="button"
                className="icon-button min-h-8 px-2 py-1 text-xs"
                disabled={isRechecking}
                onClick={recheckFinding}
                title="Recheck this finding against the latest saved drawing revision"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={isRechecking ? "animate-spin" : undefined}
                  size={14}
                />
                {isRechecking ? "Rechecking…" : recheckLabel}
              </button>
            ) : null}
          </div>
          <p
            className="min-h-4 text-right text-[11px] text-slate-500"
            role="status"
            aria-live="polite"
          >
            {recheckStatus}
          </p>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {findings.map((finding, index) => (
          <details key={finding.id} className="group p-4" open={findings.length === 1 && index === 0}>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-slate-800 marker:content-none">
              <ChevronRight className="transition-transform group-open:rotate-90" aria-hidden="true" size={15} />
              {finding.title}
              <span className="ml-auto text-[11px] font-medium text-slate-500">
                {finding.evidenceLevel === "verified" ? "Verified evidence" : "Inferred evidence"}
              </span>
            </summary>
            <div className="mt-3 grid gap-4 pl-6 text-xs leading-5 lg:grid-cols-3">
              <div>
                <h4 className="font-bold text-slate-800">Problem</h4>
                <p className="mt-1 text-slate-600">{finding.problem}</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800">Why it matters</h4>
                <p className="mt-1 text-slate-600">{finding.significance}</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800">Recommended action</h4>
                <p className="mt-1 text-slate-600">{finding.recommendedAction}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 border-t border-slate-100 pt-3 pl-6 text-xs lg:grid-cols-3">
              <div>
                <h4 className="font-bold text-slate-800">Evidence</h4>
                {finding.evidence.length > 0 ? (
                  <dl className="mt-1 space-y-1 text-slate-600">
                    {finding.evidence.map((evidence) => (
                      <div key={`${evidence.label}:${evidence.value}`}>
                        <dt className="inline font-semibold">{evidence.label}: </dt>
                        <dd className="inline break-words">{evidence.value}{evidence.productSource&&<div><a className="text-teal-700 underline" href={`/bom/items/${encodeURIComponent(evidence.productSource.itemId)}?revisionId=${encodeURIComponent(evidence.productSource.revisionId)}`} target="_blank" rel="noreferrer">Open exact Item revision</a><div><EvidenceLinks revision={{itemId:evidence.productSource.itemId,id:evidence.productSource.revisionId}} evidence={evidence.productSource.references}/></div></div>}</dd>
                      </div>
                    ))}
                  </dl>
                ) : <p className="mt-1 text-slate-500">No additional evidence recorded.</p>}
              </div>
              <div>
                <h4 className="font-bold text-slate-800">Affected records</h4>
                <ul className="mt-1 space-y-1 text-slate-600">
                  {finding.affectedRecords.map((record) => (
                    <li key={`${record.kind}:${record.id}`} className="break-words">
                      <span className="font-semibold capitalize">{record.kind.replaceAll("_", " ")}</span>: {record.label ?? record.id}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-slate-800">Drawing location</h4>
                <ul className="mt-1 space-y-1 text-slate-600">
                  {finding.locations.map((location) => {
                    const affectedConnection = finding.affectedRecords.find(
                      (record) =>
                        record.kind === "connection" &&
                        record.id === location.objectId
                    );
                    return (
                      <li
                        key={`${location.sheetId}:${location.objectKind}:${location.objectId ?? "context"}`}
                      >
                        <Link
                          className="font-semibold text-teal-700 hover:text-teal-900"
                          href={panelAnalysisDrawingHref({
                            drawingId,
                            sheetId: location.sheetId,
                            objectKind: location.objectKind,
                            objectId: location.objectId
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          prefetch={false}
                        >
                          {affectedConnection
                            ? `Open ${affectedConnection.label ?? "connection"}`
                            : `Open Sheet ${location.sheetNumber}`}
                          {location.sheetName
                            ? ` — ${location.sheetName}`
                            : ""}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <p className="mt-3 border-t border-slate-100 pt-2 pl-6 text-[11px] text-slate-400">
              Rule {finding.ruleCode} · version {finding.ruleVersion}
            </p>
          </details>
        ))}
      </div>
    </article>
  );
}
