import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultDrawingModel,
  parseDrawingListPage,
  stringifyDrawingModel
} from "../data/schema";

const database = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drawing: database
  }
}));

import { DRAWING_LIST_PAGE_SIZE, listDrawingPage } from "../data/queries";

function drawingRow(id: string, sheetCount: number) {
  const model = createDefaultDrawingModel();
  model.sheets = Array.from({ length: sheetCount }, (_, index) => ({
    ...model.sheets[0],
    id: `${id}_sheet_${index + 1}`,
    name: `Sheet ${index + 1}`
  }));

  return {
    id,
    title: `Drawing ${id}`,
    status: "needs_review",
    modelJson: stringifyDrawingModel(model),
    updatedAt: new Date("2026-08-26T12:00:00.000Z")
  };
}

describe("drawing list pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [undefined, 1],
    ["", 1],
    ["0", 1],
    ["-1", 1],
    ["1.5", 1],
    ["abc", 1],
    [["2"], 1],
    ["2", 2]
  ])("resolves page input %j to %i", (input, expected) => {
    expect(parseDrawingListPage(input)).toBe(expected);
  });

  it("counts separately and parses only the requested ordered page", async () => {
    database.count.mockResolvedValue(100);
    database.findMany.mockResolvedValue([
      drawingRow("drawing_026", 2),
      drawingRow("drawing_027", 4)
    ]);

    const result = await listDrawingPage(2);

    expect(database.count).toHaveBeenCalledWith({
      where: { NOT: { status: "archived" } }
    });
    expect(database.findMany).toHaveBeenCalledWith({
      where: { NOT: { status: "archived" } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: DRAWING_LIST_PAGE_SIZE,
      take: DRAWING_LIST_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        status: true,
        modelJson: true,
        updatedAt: true
      }
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({ id: "drawing_026", sheetCount: 2 }),
        expect.objectContaining({ id: "drawing_027", sheetCount: 4 })
      ],
      page: 2,
      pageSize: 25,
      totalCount: 100,
      totalPages: 4
    });
  });

  it("clamps an out-of-range page before fetching rows", async () => {
    database.count.mockResolvedValue(51);
    database.findMany.mockResolvedValue([drawingRow("drawing_051", 1)]);

    const result = await listDrawingPage(999);

    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(3);
    expect(database.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 25 })
    );
  });
});
