import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  symbolCount: vi.fn(),
  symbolFindMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    symbol: {
      count: database.symbolCount,
      findMany: database.symbolFindMany
    }
  }
}));

import { listSymbolRegistryPage } from "../data/queries";
import {
  SYMBOL_REGISTRY_PAGE_SIZE,
  symbolRegistryListInputSchema
} from "../data/schema";
import { buildSymbolRegistryListUrl } from "../logic/services/symbol-registry-list-url";

function symbolRow({
  id,
  linkedItemCount = 0
}: {
  id: string;
  linkedItemCount?: number;
}) {
  return {
    id,
    symbolKey: `symbol_key_${id}`,
    displayName: `Symbol ${id}`,
    manufacturer: null,
    model: null,
    category: "instrument",
    status: "approved",
    updatedAt: new Date("2026-08-28T12:00:00.000Z"),
    versions: [{ id: `version_${id}`, versionNumber: 3 }],
    validationIssues: [],
    managedCategory: { id: "category_instrument", name: "Instrument" },
    bomTemplate:
      linkedItemCount > 0
        ? { _count: { lines: linkedItemCount } }
        : null
  };
}

beforeEach(() => {
  database.symbolCount.mockReset();
  database.symbolFindMany.mockReset();
});

describe("Symbol Registry list pagination", () => {
  it("normalizes query values and builds stable list URLs", () => {
    expect(
      symbolRegistryListInputSchema.parse({
        categoryId: [" category_1 ", "ignored"],
        page: ["2", "ignored"]
      })
    ).toEqual({ categoryId: "category_1", page: 2 });
    expect(
      symbolRegistryListInputSchema.parse({ categoryId: "all", page: "bad" })
    ).toEqual({ page: 1 });
    expect(buildSymbolRegistryListUrl({ page: 1 })).toBe("/symbols");
    expect(
      buildSymbolRegistryListUrl({ categoryId: "category_1", page: 2 })
    ).toBe("/symbols?category=category_1&page=2");
  });

  it("loads only one page and reports Mini BOM item associations", async () => {
    database.symbolCount.mockResolvedValue(26);
    database.symbolFindMany.mockResolvedValue([
      symbolRow({ id: "linked", linkedItemCount: 2 }),
      symbolRow({ id: "unlinked" })
    ]);

    const result = await listSymbolRegistryPage({
      categoryId: "category_instrument",
      page: 2
    });

    expect(result).toMatchObject({
      page: 2,
      pageSize: SYMBOL_REGISTRY_PAGE_SIZE,
      totalCount: 26,
      totalPages: 3,
      categoryId: "category_instrument"
    });
    expect(result.items.map((item) => item.linkedItemCount)).toEqual([2, 0]);
    expect(database.symbolFindMany).toHaveBeenCalledTimes(1);
    expect(database.symbolFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          NOT: { status: "archived" },
          categoryId: "category_instrument"
        },
        skip: 10,
        take: 10,
        select: expect.objectContaining({
          bomTemplate: {
            select: {
              _count: { select: { lines: true } }
            }
          }
        })
      })
    );
  });

  it("clamps an out-of-range page after the count is known", async () => {
    database.symbolCount.mockResolvedValue(11);
    database.symbolFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([symbolRow({ id: "last" })]);

    const result = await listSymbolRegistryPage({ page: 999 });

    expect(result.page).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual(["last"]);
    expect(database.symbolFindMany).toHaveBeenCalledTimes(2);
    expect(database.symbolFindMany.mock.calls[1][0]).toMatchObject({
      skip: 10,
      take: 10
    });
  });
});
