"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { CheckCircle2, Search, ShieldAlert, X } from "lucide-react";
import {
  EngineeringTablePagination,
  paginateTableRows
} from "@/shared/ui/table-pagination";
import type {
  PanelDrawingFindingCategory,
  PanelDrawingFindingSeverity,
  PanelDrawingQualityFinding,
  PanelDrawingQualityReport
} from "../../data/schema";
import {
  formatPanelFindingCategory,
  PanelFindingRow
} from "./panel-finding-row";

const severityOptions: Array<{
  value: "all" | PanelDrawingFindingSeverity;
  label: string;
}> = [
  { value: "all", label: "All severities" },
  { value: "blocking_error", label: "Blocking errors" },
  { value: "warning", label: "Warnings" },
  { value: "information", label: "Information" }
];

export function PanelDrawingReviewDialog({
  report,
  isUpdating = false,
  onCancel,
  onNavigate,
  onRepair
}: {
  report: PanelDrawingQualityReport;
  isUpdating?: boolean;
  onCancel: () => void;
  onNavigate: (finding: PanelDrawingQualityFinding) => void;
  onRepair: (finding: PanelDrawingQualityFinding) => void;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [severity, setSeverity] = useState<
    "all" | PanelDrawingFindingSeverity
  >("all");
  const [category, setCategory] = useState<
    "all" | PanelDrawingFindingCategory
  >("all");
  const [sheetId, setSheetId] = useState("all");
  const categories = useMemo(
    () => [...new Set(report.findings.map((finding) => finding.category))].sort(),
    [report.findings]
  );
  const sheets = useMemo(
    () =>
      [...new Map(
        report.findings.flatMap((finding) =>
          finding.locations.map((location) => [location.sheetId, location] as const)
        )
      ).values()].sort((first, second) => first.sheetNumber - second.sheetNumber),
    [report.findings]
  );
  const filtered = useMemo(() => {
    const search = deferredQuery.trim().toLowerCase();
    return report.findings.filter((finding) => {
      if (severity !== "all" && finding.severity !== severity) return false;
      if (category !== "all" && finding.category !== category) return false;
      if (
        sheetId !== "all" &&
        !finding.locations.some((location) => location.sheetId === sheetId)
      ) {
        return false;
      }
      return (
        !search ||
        [
          finding.message,
          finding.code,
          finding.assetTag,
          finding.wireId,
          finding.patternId,
          finding.terminal?.terminalKey,
          ...finding.locations.map((location) => location.sheetName)
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search)
      );
    });
  }, [category, deferredQuery, report.findings, severity, sheetId]);
  const pageRows = useMemo(
    () => paginateTableRows(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-review-title"
        className="flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${report.canApprove ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {report.canApprove ? (
              <CheckCircle2 aria-hidden="true" size={18} />
            ) : (
              <ShieldAlert aria-hidden="true" size={18} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="panel-review-title" className="text-sm font-semibold text-slate-950">
              {report.panelTag} Panel Drawing Review
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Deterministic review of structured assets, terminals, wires, routes,
              and connection patterns for this panel.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            aria-label="Close panel review"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50">
          {[
            ["Blocking errors", report.counts.blockingErrors, "text-red-700"],
            ["Warnings", report.counts.warnings, "text-amber-700"],
            ["Information", report.counts.information, "text-sky-700"]
          ].map(([label, count, color]) => (
            <div key={String(label)} className="border-r border-slate-200 px-5 py-3 last:border-r-0">
              <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
              <p className={`mt-1 text-xl font-semibold ${color}`}>{count}</p>
            </div>
          ))}
        </div>
        {isUpdating ? (
          <div className="border-b border-sky-200 bg-sky-50 px-5 py-2 text-xs font-medium text-sky-900">
            Review updating from the latest committed drawing revision.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-b border-slate-200 px-5 py-3">
          <label className="flex min-w-72 flex-1 items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
            <Search aria-hidden="true" size={14} className="text-slate-400" />
            <span className="sr-only">Search panel findings</span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder="Search tag, terminal, wire, sheet, or finding"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs outline-none"
            />
          </label>
          <select
            className="field-input w-44"
            aria-label="Finding severity"
            value={severity}
            onChange={(event) => {
              setPage(1);
              setSeverity(event.currentTarget.value as typeof severity);
            }}
          >
            {severityOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            className="field-input w-48"
            aria-label="Finding category"
            value={category}
            onChange={(event) => {
              setPage(1);
              setCategory(event.currentTarget.value as typeof category);
            }}
          >
            <option value="all">All categories</option>
            {categories.map((value) => (
              <option key={value} value={value}>{formatPanelFindingCategory(value)}</option>
            ))}
          </select>
          <select
            className="field-input w-52"
            aria-label="Finding sheet"
            value={sheetId}
            onChange={(event) => {
              setPage(1);
              setSheetId(event.currentTarget.value);
            }}
          >
            <option value="all">All source sheets</option>
            {sheets.map((sheet) => (
              <option key={sheet.sheetId} value={sheet.sheetId}>
                Sheet {sheet.sheetNumber}: {sheet.sheetName}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10 bg-white text-[10px] font-bold uppercase text-slate-500">
              <tr>
                <th className="w-28 border-b border-slate-200 px-3 py-2.5">Severity</th>
                <th className="w-40 border-b border-slate-200 px-3 py-2.5">Category</th>
                <th className="border-b border-slate-200 px-3 py-2.5">Finding</th>
                <th className="w-72 border-b border-slate-200 px-3 py-2.5">Source</th>
                <th className="w-48 border-b border-slate-200 px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((finding) => (
                <PanelFindingRow
                  key={finding.id}
                  finding={finding}
                  onNavigate={onNavigate}
                  onRepair={onRepair}
                />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No findings match the current filters.
            </div>
          ) : null}
        </div>
        <EngineeringTablePagination
          page={page}
          pageSize={pageSize}
          rowCount={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPage(1);
            setPageSize(nextPageSize);
          }}
        />
      </div>
    </div>
  );
}
