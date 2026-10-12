"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Download,
  FileDown,
  FileSpreadsheet,
  Printer
} from "lucide-react";
import { SearchInput } from "@/shared/ui/search-input";
import type { PanelAnalysisBomResult, PanelAnalysisResult } from "../../types";
import {
  buildPanelTabularRows,
  panelDeliverableQueryString,
  panelReportColumns,
  type PanelDeliverableBundle,
  type PanelReportKind,
  type PanelReportTraceRef
} from "@/features/drawing_panel_reports/api/public";
import { PanelScheduleTable } from "@/features/drawing_panel_reports/ui/components/panel-schedule-table";
import { panelAnalysisDrawingHref } from "./panel-analysis-finding-card";

function valueCompare(first: unknown, second: unknown): number {
  if (typeof first === "number" && typeof second === "number") {
    return first - second;
  }
  return String(first ?? "").localeCompare(String(second ?? ""), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function reportBundle({
  analysis,
  report,
  panelAssetId,
  bom
}: {
  analysis: PanelAnalysisResult;
  report: PanelReportKind;
  panelAssetId?: string;
  bom?: PanelAnalysisBomResult;
}): PanelDeliverableBundle {
  const bomByPanel = new Map(
    (bom?.panels ?? []).map((panel) => [panel.panelAssetId, panel])
  );
  const schedules = panelAssetId
    ? analysis.schedules.filter((panel) => panel.panelAssetId === panelAssetId)
    : analysis.schedules;
  return {
    manifest: {
      drawingId: analysis.sourceRevision.drawingId,
      drawingKey: analysis.sourceRevision.drawingKey,
      drawingTitle: analysis.sourceRevision.title,
      drawingStatus: analysis.sourceRevision.status,
      issueMode: "draft",
      scope: panelAssetId
        ? { kind: "active_panel", panelAssetId }
        : { kind: "all_panels" },
      reports: [report],
      qcCounts: {
        blockingErrors: analysis.summary.errors,
        warnings: analysis.summary.warnings,
        information: analysis.summary.information
      },
      canIssue: false,
      information: schedules.flatMap(
        (panel) => bomByPanel.get(panel.panelAssetId)?.information ?? []
      )
    },
    panels: schedules.map((panel) => ({
      panelAssetId: panel.panelAssetId,
      panelTag: panel.panelTag,
      terminalSchedule: panel.terminals,
      wireSchedule: panel.internalWires,
      assetSchedule: panel.assets,
      bomProjection: panel.bomProjection,
      bom: bomByPanel.get(panel.panelAssetId)?.bom
    }))
  };
}

export function PanelAnalysisScheduleSection({
  analysis,
  report,
  bom,
  bomLoading,
  bomError,
  onRetryBom
}: {
  analysis: PanelAnalysisResult;
  report: PanelReportKind;
  bom?: PanelAnalysisBomResult;
  bomLoading?: boolean;
  bomError?: string;
  onRetryBom?: () => void;
}) {
  const [panelAssetId, setPanelAssetId] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [sortKey, setSortKey] = useState<string>();
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const bundle = useMemo(
    () => reportBundle({ analysis, report, panelAssetId: panelAssetId || undefined, bom }),
    [analysis, bom, panelAssetId, report]
  );
  const rows = useMemo(() => {
    const search = deferredQuery.trim().toLocaleLowerCase();
    const matching = buildPanelTabularRows(bundle, report).filter(
      (row) => !search || Object.values(row).join(" ").toLocaleLowerCase().includes(search)
    );
    if (!sortKey) return matching;
    return [...matching].sort((first, second) => {
      const result = valueCompare(first[sortKey], second[sortKey]);
      return sortDirection === "asc" ? result : -result;
    });
  }, [bundle, deferredQuery, report, sortDirection, sortKey]);
  const tracesByRowId = useMemo(() => {
    const traces = new Map<string, PanelReportTraceRef[]>();
    bundle.panels.forEach((panel) => {
      panel.terminalSchedule.forEach((row) => traces.set(row.id, row.traces));
      panel.wireSchedule.forEach((row) => traces.set(row.id, row.traces));
      panel.assetSchedule.forEach((row) => traces.set(row.id, row.traces));
    });
    return traces;
  }, [bundle.panels]);
  const request = {
    scope: panelAssetId
      ? ({ kind: "active_panel", panelAssetId } as const)
      : ({ kind: "all_panels" } as const),
    reports: [report],
    issueMode: "draft" as const,
    pdfComposition: "schedules_only" as const
  };
  const queryString = panelDeliverableQueryString(request);
  const drawingId = analysis.sourceRevision.drawingId;
  const warnings = bundle.panels.flatMap((panel) => panel.bom?.warnings ?? []);

  if (report === "bom" && bomLoading) {
    return (
      <div className="grid min-h-64 place-items-center rounded-lg border border-slate-200 bg-slate-50" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" />
          <p className="mt-3 text-sm font-semibold">Loading material templates…</p>
          <p className="mt-1 text-xs text-slate-500">The drawing remains read-only.</p>
        </div>
      </div>
    );
  }
  if (report === "bom" && bomError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
        <h2 className="text-sm font-bold">Materials could not be loaded</h2>
        <p className="mt-2 text-xs">{bomError}</p>
        <button type="button" className="icon-button mt-4" onClick={onRetryBom}>Try again</button>
      </div>
    );
  }

  return (
    <section className="space-y-3" aria-label={`${report.replaceAll("_", " ")} report`}>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label className="min-w-64">
          <span className="field-label">Panel</span>
          <select className="field-input" value={panelAssetId} onChange={(event) => setPanelAssetId(event.currentTarget.value)}>
            <option value="">All panels</option>
            {analysis.panels.map((panel) => <option key={panel.assetId} value={panel.assetId}>{panel.tag} — {panel.title}</option>)}
          </select>
        </label>
        <label className="min-w-72 flex-1">
          <span className="field-label">Search current report</span>
          <SearchInput value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Tag, terminal, wire, item, or sheet" />
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <a className="icon-button" href={`/drawings/${drawingId}/deliverables/csv?${queryString}&report=${report}`} target="_blank" rel="noreferrer"><Download aria-hidden="true" size={14} /> CSV</a>
          <a className="icon-button" href={`/drawings/${drawingId}/deliverables/xlsx?${queryString}`} target="_blank" rel="noreferrer"><FileSpreadsheet aria-hidden="true" size={14} /> XLSX</a>
          <a className="icon-button" href={`/drawings/${drawingId}/print?${queryString}`} target="_blank" rel="noreferrer"><Printer aria-hidden="true" size={14} /> Print</a>
          <a className="icon-button icon-button-primary" href={`/drawings/${drawingId}/pdf?${queryString}`} target="_blank" rel="noreferrer"><FileDown aria-hidden="true" size={14} /> PDF</a>
        </div>
      </div>
      {report === "bom" && (warnings.length > 0 || bundle.manifest.information.length > 0) ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {[...new Set([
            ...warnings.map((warning) => warning.message),
            ...bundle.manifest.information
          ])].join(" ")}
        </div>
      ) : null}
      <div className="min-h-[420px] overflow-hidden rounded-lg border border-slate-200">
        <PanelScheduleTable
          key={`${report}:${panelAssetId}`}
          columns={panelReportColumns(report)}
          rows={rows}
          sortKey={sortKey}
          onSort={(key) => {
            if (sortKey === key) {
              setSortDirection((current) => current === "asc" ? "desc" : "asc");
            } else {
              setSortKey(key);
              setSortDirection("asc");
            }
          }}
          tracesForRow={(row) => tracesByRowId.get(String(row.rowId ?? "")) ?? []}
          onNavigate={(trace) => {
            window.location.assign(
              trace.kind === "sheet_object"
                ? panelAnalysisDrawingHref({
                    drawingId,
                    sheetId: trace.sheet.sheetId,
                    objectKind: trace.objectKind,
                    objectId: trace.sheet.objectId
                  })
                : `/drawings/${drawingId}`
            );
          }}
        />
      </div>
    </section>
  );
}
