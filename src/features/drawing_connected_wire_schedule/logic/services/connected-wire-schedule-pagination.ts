import type { ConnectedWireSchedulePagination } from "../../data/schema";
import type { AssetConnectedWireRow } from "../../types";

export type ConnectedWireSchedulePage = {
  rows: AssetConnectedWireRow[];
  totalRows: number;
  pageIndex: number;
  pageCount: number;
  rowsPerPage?: number;
  firstRowNumber?: number;
  lastRowNumber?: number;
  isPageInRange: boolean;
};

export function paginateConnectedWireScheduleRows(
  rows: readonly AssetConnectedWireRow[],
  pagination?: ConnectedWireSchedulePagination
): ConnectedWireSchedulePage {
  const totalRows = rows.length;

  if (!pagination) {
    return {
      rows: [...rows],
      totalRows,
      pageIndex: 0,
      pageCount: 1,
      ...(totalRows > 0
        ? { firstRowNumber: 1, lastRowNumber: totalRows }
        : {}),
      isPageInRange: true
    };
  }

  const pageCount = Math.max(1, Math.ceil(totalRows / pagination.rowsPerPage));
  const start = pagination.pageIndex * pagination.rowsPerPage;
  const end = Math.min(start + pagination.rowsPerPage, totalRows);
  const isPageInRange = pagination.pageIndex < pageCount;

  return {
    rows: isPageInRange ? rows.slice(start, end) : [],
    totalRows,
    pageIndex: pagination.pageIndex,
    pageCount,
    rowsPerPage: pagination.rowsPerPage,
    ...(isPageInRange && start < end
      ? { firstRowNumber: start + 1, lastRowNumber: end }
      : {}),
    isPageInRange
  };
}

export function formatConnectedWireSchedulePageLabel(input: {
  pageIndex: number;
  pageCount: number;
}): string {
  return `Part ${input.pageIndex + 1} of ${input.pageCount}`;
}

export function formatConnectedWireScheduleRowRange(input: {
  firstRowNumber?: number;
  lastRowNumber?: number;
  totalRows: number;
}): string {
  if (
    input.firstRowNumber === undefined ||
    input.lastRowNumber === undefined
  ) {
    return input.totalRows === 0 ? "No rows" : `0 of ${input.totalRows} rows`;
  }

  return `Rows ${input.firstRowNumber}–${input.lastRowNumber} of ${input.totalRows}`;
}
