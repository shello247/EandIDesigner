"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import {
  EngineeringTablePagination,
  paginateTableRows
} from "@/shared/ui/table-pagination";
import type { PanelReportTraceRef } from "../../data/schema";
import type {
  PanelTabularColumn,
  PanelTabularRow
} from "../../logic/services/panel-schedule-export";

export function PanelScheduleTable({
  columns,
  rows,
  sortKey,
  onSort,
  tracesForRow,
  onNavigate
}: {
  columns: PanelTabularColumn[];
  rows: PanelTabularRow[];
  sortKey?: string;
  onSort: (key: string) => void;
  tracesForRow: (row: PanelTabularRow) => PanelReportTraceRef[];
  onNavigate: (trace: PanelReportTraceRef) => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const pageRows = useMemo(
    () => paginateTableRows(rows, page, pageSize),
    [page, pageSize, rows]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[1400px] border-separate border-spacing-0 text-left">
        <thead className="sticky top-0 z-10 bg-white text-[10px] font-bold uppercase text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="border-b border-slate-200 px-3 py-2.5">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                  onClick={() => {
                    setPage(1);
                    onSort(column.key);
                  }}
                >
                  {column.label}
                  <ArrowUpDown aria-hidden="true" size={11} />
                  <span className="sr-only">
                    {sortKey === column.key ? "Change sort direction" : "Sort column"}
                  </span>
                </button>
              </th>
            ))}
            <th className="sticky right-0 w-44 border-b border-l border-slate-200 bg-white px-3 py-2.5 text-right">
              Trace
            </th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, index) => {
            const traces = tracesForRow(row);
            return (
              <tr key={String(row.rowId ?? index)} className="hover:bg-slate-50">
                {columns.map((column) => (
                  <td key={column.key} className="max-w-80 border-b border-slate-100 px-3 py-2 text-xs text-slate-700">
                    <span className="line-clamp-2">
                      {typeof row[column.key] === "boolean"
                        ? row[column.key] ? "Yes" : "No"
                        : String(row[column.key] ?? "-")}
                    </span>
                  </td>
                ))}
                <td className="sticky right-0 border-b border-l border-slate-100 bg-white px-3 py-2 text-right">
                  {traces.slice(0, 2).map((trace) => (
                    <button
                      key={`${trace.kind}:${trace.label}`}
                      type="button"
                      className="ml-1 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-900"
                      onClick={() => onNavigate(trace)}
                    >
                      <ExternalLink aria-hidden="true" size={11} />
                      {trace.label}
                    </button>
                  ))}
                  {traces.length === 0 ? <span className="text-xs text-slate-400">-</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-500">
          No report rows match the current filters.
        </div>
      ) : null}
      </div>
      <EngineeringTablePagination
        page={page}
        pageSize={pageSize}
        rowCount={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPage(1);
          setPageSize(nextPageSize);
        }}
      />
    </div>
  );
}
