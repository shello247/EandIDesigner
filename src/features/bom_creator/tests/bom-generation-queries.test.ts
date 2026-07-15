import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  templateFindMany: vi.fn(),
  lineFindMany: vi.fn(),
  itemFindMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    symbolBomTemplate: { findMany: database.templateFindMany },
    symbolBomTemplateLine: { findMany: database.lineFindMany },
    bomItem: { findMany: database.itemFindMany }
  }
}));

import { listBomGenerationTemplatesForSymbols } from "../data/generation-queries";

describe("lean BOM generation queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.templateFindMany.mockResolvedValue([
      { id: "template_1", symbolId: "symbol_1", notes: null }
    ]);
    database.lineFindMany.mockResolvedValue(
      Array.from({ length: 1_000 }, (_, index) => ({
        id: `line_${index}`,
        templateId: "template_1",
        itemId: `item_${index % 10}`,
        lineNumber: index + 1,
        quantityRule: "fixed_per_assembly",
        quantity: 1,
        notes: null
      }))
    );
    database.itemFindMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        id: `item_${index}`,
        itemKey: `ITEM-${index}`,
        displayName: `Item ${index}`,
        category: "accessory",
        unit: "each",
        manufacturer: null,
        partNumber: null,
        status: "active"
      }))
    );
  });

  it("uses one header, one line, and one item query independent of line count", async () => {
    const templates = await listBomGenerationTemplatesForSymbols(["symbol_1"]);

    expect(templates[0].lines).toHaveLength(1_000);
    expect(database.templateFindMany).toHaveBeenCalledTimes(1);
    expect(database.lineFindMany).toHaveBeenCalledTimes(1);
    expect(database.itemFindMany).toHaveBeenCalledTimes(1);
  });

  it("does not query when there are no symbol IDs", async () => {
    expect(await listBomGenerationTemplatesForSymbols([])).toEqual([]);
    expect(database.templateFindMany).not.toHaveBeenCalled();
    expect(database.lineFindMany).not.toHaveBeenCalled();
    expect(database.itemFindMany).not.toHaveBeenCalled();
  });
});
