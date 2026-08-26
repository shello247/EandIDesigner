import { describe, expect, it } from "vitest";
import {
  evaluateConnectedWireScheduleCapacity,
  createConnectedWireScheduleLayout,
  paginateConnectedWireScheduleRows,
  recommendConnectedWireScheduleRowsPerPage,
  renderConnectedWireScheduleSvg,
  type AssetConnectedWireRow,
  type ConnectedWireScheduleAnnotation,
  type ConnectedWireScheduleProjection
} from "../api/public";

function row(index: number, description = `Wire ${index}`): AssetConnectedWireRow {
  return {
    canonicalKind: "internal_wire",
    canonicalId: `wire_${index}`,
    wireNumber: index,
    wireId: `W-${index}`,
    from: { assetTag: "PDB-101", terminalKey: `T${index}` },
    to: { assetTag: "LOAD-101", terminalKey: `T${index}` },
    description,
    sourceSheets: []
  };
}

function annotation(): ConnectedWireScheduleAnnotation {
  return {
    id: "schedule_1",
    kind: "connected_wire_schedule",
    x: 210,
    y: 20,
    width: 190,
    schedule: {
      assetId: "asset_pdb_101",
      sourcePlacementId: "placement_pdb_101",
      scope: "all_connected"
    }
  };
}

function projection(rows: AssetConnectedWireRow[]): ConnectedWireScheduleProjection {
  return {
    annotationId: "schedule_1",
    allRows: rows,
    rows,
    totalRows: rows.length,
    pageIndex: 0,
    pageCount: 1,
    ...(rows.length > 0
      ? { firstRowNumber: 1, lastRowNumber: rows.length }
      : {}),
    isPageInRange: true,
    unresolvedCount: 0,
    linkedOccurrenceAvailable: true
  };
}

describe("connected wire schedule pagination", () => {
  it("preserves legacy all-row behavior without pagination", () => {
    const rows = [row(1), row(2), row(3)];
    const result = paginateConnectedWireScheduleRows(rows);

    expect(result.rows).toEqual(rows);
    expect(result.rows).not.toBe(rows);
    expect(result).toMatchObject({
      totalRows: 3,
      pageIndex: 0,
      pageCount: 1,
      firstRowNumber: 1,
      lastRowNumber: 3,
      isPageInRange: true
    });
  });

  it("slices exact boundaries and a final remainder without duplicates", () => {
    const rows = Array.from({ length: 25 }, (_, index) => row(index + 1));
    const pages = [0, 1, 2].map((pageIndex) =>
      paginateConnectedWireScheduleRows(rows, {
        version: 1,
        continuationSetId: "set_1",
        pageIndex,
        rowsPerPage: 10
      })
    );

    expect(pages.map((page) => page.rows.length)).toEqual([10, 10, 5]);
    expect(pages.map((page) => [page.firstRowNumber, page.lastRowNumber])).toEqual([
      [1, 10],
      [11, 20],
      [21, 25]
    ]);
    expect(pages.flatMap((page) => page.rows.map((item) => item.canonicalId))).toEqual(
      rows.map((item) => item.canonicalId)
    );
  });

  it("fails closed for an out-of-range page", () => {
    const result = paginateConnectedWireScheduleRows([row(1), row(2)], {
      version: 1,
      continuationSetId: "set_1",
      pageIndex: 2,
      rowsPerPage: 1
    });

    expect(result).toMatchObject({
      rows: [],
      pageCount: 2,
      isPageInRange: false
    });
  });

  it("rejects invalid manual row counts", () => {
    expect(() =>
      evaluateConnectedWireScheduleCapacity({
        annotation: annotation(),
        projection: projection([row(1)]),
        sheet: { width: 420, height: 297 },
        rowsPerPage: 0
      })
    ).toThrow(/whole number from 1 to 100/i);
  });

  it("recommends the largest row count whose wrapped pages fit", () => {
    const rows = Array.from({ length: 30 }, (_, index) =>
      row(
        index + 1,
        `Detailed conductor purpose ${index + 1} with enough text to wrap into multiple lines`
      )
    );
    const input = {
      annotation: annotation(),
      projection: projection(rows),
      sheet: { width: 420, height: 297 }
    };
    const recommended = recommendConnectedWireScheduleRowsPerPage(input);

    expect(recommended.fitsHorizontally).toBe(true);
    expect(recommended.fitsVertically).toBe(true);
    expect(recommended.rowsPerPage).toBeGreaterThan(0);
    expect(recommended.rowsPerPage).toBeLessThanOrEqual(30);

    if (recommended.rowsPerPage < 30) {
      expect(
        evaluateConnectedWireScheduleCapacity({
          ...input,
          rowsPerPage: recommended.rowsPerPage + 1
        }).fitsVertically
      ).toBe(false);
    }
  });

  it("reports horizontal overflow separately from vertical capacity", () => {
    const result = evaluateConnectedWireScheduleCapacity({
      annotation: { ...annotation(), x: 300 },
      projection: projection([row(1)]),
      sheet: { width: 420, height: 297 },
      rowsPerPage: 1
    });

    expect(result.fitsHorizontally).toBe(false);
    expect(result.fitsVertically).toBe(true);
  });

  it("renders identical part and row-range metadata from the shared renderer", () => {
    const rows = Array.from({ length: 25 }, (_, index) => row(index + 1));
    const page = paginateConnectedWireScheduleRows(rows, {
      version: 1,
      continuationSetId: "set_1",
      pageIndex: 1,
      rowsPerPage: 10
    });
    const paginatedAnnotation: ConnectedWireScheduleAnnotation = {
      ...annotation(),
      schedule: {
        ...annotation().schedule,
        pagination: {
          version: 1,
          continuationSetId: "set_1",
          pageIndex: 1,
          rowsPerPage: 10
        }
      }
    };
    const pageProjection: ConnectedWireScheduleProjection = {
      ...projection(rows),
      ...page,
      allRows: rows
    };
    const svg = renderConnectedWireScheduleSvg({
      layout: createConnectedWireScheduleLayout({
        annotation: paginatedAnnotation,
        projection: pageProjection,
        sheet: { width: 420, height: 297 }
      }),
      assetTag: "PDB-101",
      linkedOccurrenceAvailable: true,
      unresolvedCount: 0
    });

    expect(svg).toContain("Part 2 of 3");
    expect(svg).toContain("Rows 11–20 of 25");
  });
});
