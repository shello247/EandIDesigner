import { describe, expect, it } from "vitest";
import {
  clampTablePage,
  paginateTableRows
} from "@/shared/ui/table-pagination";

describe("engineering table pagination", () => {
  it("uses stable 100-row pages and clamps stale page selections", () => {
    const rows = Array.from({ length: 205 }, (_, index) => index + 1);

    expect(paginateTableRows(rows, 1, 100)).toEqual(rows.slice(0, 100));
    expect(paginateTableRows(rows, 3, 100)).toEqual(rows.slice(200));
    expect(paginateTableRows(rows.slice(0, 10), 3, 100)).toEqual(
      rows.slice(0, 10)
    );
    expect(clampTablePage(8, 205, 100)).toBe(3);
    expect(clampTablePage(0, 0, 100)).toBe(1);
  });
});
