"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export const ENGINEERING_TABLE_PAGE_SIZES = [50, 100, 250] as const;

export function clampTablePage(
  page: number,
  rowCount: number,
  pageSize: number
): number {
  const pageCount = Math.max(1, Math.ceil(rowCount / pageSize));
  return Math.min(Math.max(1, page), pageCount);
}

export function paginateTableRows<T>(
  rows: T[],
  page: number,
  pageSize: number
): T[] {
  const safePage = clampTablePage(page, rows.length, pageSize);
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function EngineeringTablePagination({
  page,
  pageSize,
  rowCount,
  onPageChange,
  onPageSizeChange
}: {
  page: number;
  pageSize: number;
  rowCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(rowCount / pageSize));
  const safePage = clampTablePage(page, rowCount, pageSize);
  const firstRow = rowCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastRow = Math.min(rowCount, safePage * pageSize);

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
      <span className="font-medium">
        {rowCount === 0 ? "No rows" : `${firstRow}-${lastRow} of ${rowCount}`}
      </span>
      <label className="ml-auto flex items-center gap-2">
        Rows
        <select
          className="field-input h-8 w-20 py-1"
          aria-label="Rows per page"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.currentTarget.value))}
        >
          {ENGINEERING_TABLE_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="icon-button h-8 w-8 p-0"
        aria-label="Previous page"
        disabled={safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
      >
        <ChevronLeft aria-hidden="true" size={14} />
      </button>
      <span className="min-w-20 text-center font-medium">
        {safePage} / {pageCount}
      </span>
      <button
        type="button"
        className="icon-button h-8 w-8 p-0"
        aria-label="Next page"
        disabled={safePage >= pageCount}
        onClick={() => onPageChange(safePage + 1)}
      >
        <ChevronRight aria-hidden="true" size={14} />
      </button>
    </div>
  );
}
