import type { ConnectedWireScheduleAnnotation } from "../../data/schema";
import type { ConnectedWireScheduleProjection } from "../../types";
import {
  CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN,
  createConnectedWireScheduleLayout
} from "./connected-wire-schedule-layout";
import { paginateConnectedWireScheduleRows } from "./connected-wire-schedule-pagination";

export type ConnectedWireScheduleCapacity = {
  rowsPerPage: number;
  pageCount: number;
  fitsHorizontally: boolean;
  fitsVertically: boolean;
  overflowPageIndexes: number[];
};

function projectionForPage(input: {
  projection: ConnectedWireScheduleProjection;
  annotation: ConnectedWireScheduleAnnotation;
  pageIndex: number;
  rowsPerPage: number;
}): ConnectedWireScheduleProjection {
  const page = paginateConnectedWireScheduleRows(input.projection.allRows, {
    version: 1,
    continuationSetId:
      input.annotation.schedule.pagination?.continuationSetId ??
      "capacity_preview",
    pageIndex: input.pageIndex,
    rowsPerPage: input.rowsPerPage
  });

  return {
    ...input.projection,
    ...page,
    allRows: input.projection.allRows
  };
}

export function evaluateConnectedWireScheduleCapacity(input: {
  annotation: ConnectedWireScheduleAnnotation;
  projection: ConnectedWireScheduleProjection;
  sheet: { width: number; height: number };
  rowsPerPage: number;
}): ConnectedWireScheduleCapacity {
  if (
    !Number.isInteger(input.rowsPerPage) ||
    input.rowsPerPage < 1 ||
    input.rowsPerPage > 100
  ) {
    throw new Error("Rows per sheet must be a whole number from 1 to 100.");
  }

  const pageCount = Math.max(
    1,
    Math.ceil(input.projection.totalRows / input.rowsPerPage)
  );
  const fitsHorizontally =
    input.annotation.x >= CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN &&
    input.annotation.x + input.annotation.width <=
      input.sheet.width - CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN;
  const overflowPageIndexes: number[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const annotation: ConnectedWireScheduleAnnotation = {
      ...input.annotation,
      schedule: {
        ...input.annotation.schedule,
        pagination: {
          version: 1,
          continuationSetId:
            input.annotation.schedule.pagination?.continuationSetId ??
            "capacity_preview",
          pageIndex,
          rowsPerPage: input.rowsPerPage
        }
      }
    };
    const layout = createConnectedWireScheduleLayout({
      annotation,
      projection: projectionForPage({
        projection: input.projection,
        annotation,
        pageIndex,
        rowsPerPage: input.rowsPerPage
      }),
      sheet: input.sheet
    });
    const fitsVertically =
      annotation.y >= CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN &&
      annotation.y + layout.height <=
        input.sheet.height - CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN;

    if (!fitsVertically) overflowPageIndexes.push(pageIndex);
  }

  return {
    rowsPerPage: input.rowsPerPage,
    pageCount,
    fitsHorizontally,
    fitsVertically: overflowPageIndexes.length === 0,
    overflowPageIndexes
  };
}

export function recommendConnectedWireScheduleRowsPerPage(input: {
  annotation: ConnectedWireScheduleAnnotation;
  projection: ConnectedWireScheduleProjection;
  sheet: { width: number; height: number };
}): ConnectedWireScheduleCapacity {
  const maximum = Math.min(100, Math.max(1, input.projection.totalRows));
  let fallback = evaluateConnectedWireScheduleCapacity({
    ...input,
    rowsPerPage: 1
  });

  for (let rowsPerPage = maximum; rowsPerPage >= 1; rowsPerPage -= 1) {
    const result = evaluateConnectedWireScheduleCapacity({
      ...input,
      rowsPerPage
    });
    fallback = result;
    if (result.fitsHorizontally && result.fitsVertically) return result;
  }

  return fallback;
}
