"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Download,
  FileDown,
  FileSpreadsheet,
  Printer,
  Search,
  X
} from "lucide-react";
import type { SymbolBomTemplateDetail } from "@/features/bom_creator/api/public";
import type {
  ApprovedDrawingSymbol
} from "@/features/drawing_canvas/api/asset-contracts";
import type {
  PackagePanelDrawingQualityReport,
  PanelConnectivityGraph
} from "@/features/drawing_panel_wiring/api/public";
import type {
  PanelDeliverableRequest,
  PanelPdfComposition,
  PanelReportKind,
  PanelReportTraceRef
} from "../../data/schema";
import { buildPanelDeliverablesFromGraph } from "../../logic/use_cases/build-panel-deliverables";
import {
  buildPanelTabularRows,
  panelReportColumns,
  type PanelTabularRow
} from "../../logic/services/panel-schedule-export";
import { panelDeliverableQueryString } from "../../logic/services/panel-deliverable-query";
import { PanelScheduleTable } from "./panel-schedule-table";

const reportOptions: Array<{ value: PanelReportKind; label: string }> = [
  { value: "terminal_schedule", label: "Terminal Schedule" },
  { value: "internal_wire_schedule", label: "Internal Wires" },
  { value: "panel_asset_schedule", label: "Panel Assets" },
  { value: "bom", label: "BOM" }
];

function valueCompare(first: unknown, second: unknown) {
  if (typeof first === "number" && typeof second === "number") return first - second;
  return String(first ?? "").localeCompare(String(second ?? ""), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

export function PanelDeliverablesDialog({
  drawingId,
  drawingKey,
  drawingTitle,
  drawingStatus,
  graph,
  quality,
  symbols,
  templates,
  initialPanelAssetId,
  isSaved,
  onCancel,
  onNavigate
}: {
  drawingId: string;
  drawingKey?: string;
  drawingTitle: string;
  drawingStatus: "draft" | "needs_review" | "approved" | "archived";
  graph: PanelConnectivityGraph;
  quality: PackagePanelDrawingQualityReport;
  symbols: ApprovedDrawingSymbol[];
  templates: SymbolBomTemplateDetail[];
  initialPanelAssetId?: string;
  isSaved: boolean;
  onCancel: () => void;
  onNavigate: (trace: PanelReportTraceRef) => void;
}) {
  const panelOptions = useMemo(() => {
    const firstSheet = new Map<string, number>();
    graph.source.sheets.forEach((sheet, index) => {
      const panelAssetId = sheet.panelDrawingContext?.panelAssetId;
      if (panelAssetId && !firstSheet.has(panelAssetId)) firstSheet.set(panelAssetId, index);
    });
    return [...firstSheet]
      .sort((first, second) => first[1] - second[1])
      .map(([assetId]) => {
        const asset = graph.assetsById.get(assetId);
        return { assetId, label: asset ? `${asset.tag} / ${asset.title}` : assetId };
      });
  }, [graph]);
  const defaultPanelId = initialPanelAssetId ?? panelOptions[0]?.assetId ?? "";
  const [scopeKind, setScopeKind] = useState<"active_panel" | "all_panels">(
    initialPanelAssetId ? "active_panel" : "all_panels"
  );
  const [panelAssetId, setPanelAssetId] = useState(defaultPanelId);
  const [issueMode, setIssueMode] = useState<"draft" | "issued">("draft");
  const [composition, setComposition] = useState<PanelPdfComposition>("schedules_only");
  const [selectedReports, setSelectedReports] = useState<PanelReportKind[]>(
    reportOptions.map((option) => option.value)
  );
  const [activeReport, setActiveReport] = useState<PanelReportKind>("terminal_schedule");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [statusFilter, setStatusFilter] = useState<"all" | "clean" | "findings">("all");
  const [sortKey, setSortKey] = useState<string>();
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const request = useMemo<PanelDeliverableRequest>(() => ({
    scope: scopeKind === "all_panels"
      ? { kind: "all_panels" }
      : { kind: "active_panel", panelAssetId },
    reports: selectedReports.length > 0 ? selectedReports : [activeReport],
    issueMode,
    pdfComposition: composition
  }), [activeReport, composition, issueMode, panelAssetId, scopeKind, selectedReports]);
  const bundle = useMemo(
    () => buildPanelDeliverablesFromGraph({
      drawingId,
      drawingKey,
      drawingTitle,
      drawingStatus,
      graph,
      quality,
      symbols,
      templates,
      request,
      enforceIssuance: false
    }),
    [drawingId, drawingKey, drawingStatus, drawingTitle, graph, quality, request, symbols, templates]
  );
  const columns = panelReportColumns(activeReport);
  const allRows = useMemo(
    () => buildPanelTabularRows(bundle, activeReport),
    [activeReport, bundle]
  );
  const rows = useMemo(() => {
    const search = deferredQuery.trim().toLowerCase();
    const filtered = allRows.filter((row) => {
      const findings = Number(row.findings ?? 0);
      if (statusFilter === "clean" && findings > 0) return false;
      if (statusFilter === "findings" && findings === 0) return false;
      return !search || Object.values(row).join(" ").toLowerCase().includes(search);
    });
    if (!sortKey) return filtered;
    return [...filtered].sort((first, second) => {
      const compared = valueCompare(first[sortKey], second[sortKey]);
      return sortDirection === "asc" ? compared : -compared;
    });
  }, [allRows, deferredQuery, sortDirection, sortKey, statusFilter]);
  const tracesByRowId = useMemo(() => {
    const traces = new Map<string, PanelReportTraceRef[]>();
    bundle.panels.forEach((panel) => {
      panel.terminalSchedule.forEach((row) => traces.set(row.id, row.traces));
      panel.wireSchedule.forEach((row) => traces.set(row.id, row.traces));
      panel.assetSchedule.forEach((row) => traces.set(row.id, row.traces));
    });
    return traces;
  }, [bundle.panels]);
  const issuedBlocked = issueMode === "issued" && !bundle.manifest.canIssue;
  const canExport = isSaved && !issuedBlocked;
  const bomWarnings = bundle.panels.flatMap((panel) => panel.bom?.warnings ?? []);

  const toggleReport = (report: PanelReportKind) => {
    setSelectedReports((current) =>
      current.includes(report)
        ? current.length === 1
          ? current
          : current.filter((candidate) => candidate !== report)
        : [...current, report]
    );
  };
  const queryString = panelDeliverableQueryString(request);
  const openExport = (path: string) => {
    if (!canExport) return;
    window.open(path, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-labelledby="panel-deliverables-title" className="flex max-h-[92vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <FileSpreadsheet aria-hidden="true" size={20} className="mt-0.5 text-teal-700" />
          <div className="min-w-0 flex-1">
            <h2 id="panel-deliverables-title" className="text-sm font-semibold text-slate-950">Panel Engineering Deliverables</h2>
            <p className="mt-1 text-xs text-slate-600">Live terminal, wire, asset, and BOM reports derived from structured connectivity.</p>
          </div>
          <button type="button" className="icon-button h-8 w-8 p-0" aria-label="Close deliverables" onClick={onCancel}>
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
          <label className="grid gap-1 text-[10px] font-bold uppercase text-slate-500">
            Scope
            <select className="field-input w-48" value={scopeKind} onChange={(event) => setScopeKind(event.currentTarget.value as typeof scopeKind)}>
              <option value="active_panel">Selected panel</option>
              <option value="all_panels">All panels</option>
            </select>
          </label>
          {scopeKind === "active_panel" ? (
            <label className="grid gap-1 text-[10px] font-bold uppercase text-slate-500">
              Panel
              <select className="field-input w-64" value={panelAssetId} onChange={(event) => setPanelAssetId(event.currentTarget.value)}>
                {panelOptions.map((panel) => <option key={panel.assetId} value={panel.assetId}>{panel.label}</option>)}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1 text-[10px] font-bold uppercase text-slate-500">
            Issue status
            <select className="field-input w-32" value={issueMode} onChange={(event) => setIssueMode(event.currentTarget.value as typeof issueMode)}>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
            </select>
          </label>
          <div className="ml-auto text-right text-xs">
            <p className={bundle.manifest.qcCounts.blockingErrors > 0 ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>
              {bundle.manifest.qcCounts.blockingErrors > 0 ? `${bundle.manifest.qcCounts.blockingErrors} blocking QC finding(s)` : "QC clear for selected scope"}
            </p>
            <p className="mt-1 text-slate-500">{isSaved ? "Saved model" : "Save drawing before exporting"}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
          {reportOptions.map((option) => (
            <button key={option.value} type="button" className={activeReport === option.value ? "btn-primary" : "btn-secondary"} onClick={() => setActiveReport(option.value)}>
              {option.label}
            </button>
          ))}
          <label className="ml-auto flex min-w-64 items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
            <Search aria-hidden="true" size={14} className="text-slate-400" />
            <input type="search" className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs outline-none" placeholder="Search current report" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
          </label>
          <select className="field-input w-40" aria-label="Report status filter" value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value as typeof statusFilter)}>
            <option value="all">All rows</option>
            <option value="clean">No findings</option>
            <option value="findings">With findings</option>
          </select>
        </div>

        {activeReport === "bom" && (bomWarnings.length > 0 || bundle.manifest.information.length > 0) ? (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-900">
            {[...new Set([
              ...bomWarnings.map((warning) => warning.message),
              ...bundle.manifest.information
            ])].join(" ")}
          </div>
        ) : null}

        <PanelScheduleTable
          columns={columns}
          rows={rows}
          sortKey={sortKey}
          onSort={(key) => {
            if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc");
            else { setSortKey(key); setSortDirection("asc"); }
          }}
          tracesForRow={(row: PanelTabularRow) => tracesByRowId.get(String(row.rowId ?? "")) ?? []}
          onNavigate={onNavigate}
        />

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-3">
              {reportOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input type="checkbox" checked={selectedReports.includes(option.value)} onChange={() => toggleReport(option.value)} />
                  {option.label}
                </label>
              ))}
            </div>
            <select className="field-input ml-auto w-56" aria-label="PDF composition" value={composition} onChange={(event) => setComposition(event.currentTarget.value as PanelPdfComposition)}>
              <option value="drawings_only">Drawings only</option>
              <option value="schedules_only">Schedules only</option>
              <option value="drawings_and_schedules">Drawings + schedules</option>
            </select>
            <button type="button" className="icon-button" disabled={!canExport} onClick={() => openExport(`/drawings/${drawingId}/deliverables/csv?${queryString}&report=${activeReport}`)}>
              <Download aria-hidden="true" size={14} /> CSV
            </button>
            <button type="button" className="icon-button" disabled={!canExport} onClick={() => openExport(`/drawings/${drawingId}/deliverables/xlsx?${queryString}`)}>
              <FileSpreadsheet aria-hidden="true" size={14} /> XLSX
            </button>
            <button type="button" className="icon-button" disabled={!canExport} onClick={() => openExport(`/drawings/${drawingId}/print?${queryString}`)}>
              <Printer aria-hidden="true" size={14} /> Print
            </button>
            <button type="button" className="icon-button icon-button-primary" disabled={!canExport} onClick={() => openExport(`/drawings/${drawingId}/pdf?${queryString}`)}>
              <FileDown aria-hidden="true" size={14} /> PDF
            </button>
          </div>
          {!isSaved ? <p className="mt-2 text-xs font-medium text-amber-700">Save drawing before exporting.</p> : null}
          {issuedBlocked ? <p className="mt-2 text-xs font-medium text-red-700">Issued output requires Approved status and zero blocking panel QC findings.</p> : null}
        </div>
      </div>
    </div>
  );
}
