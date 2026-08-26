import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeSymbolCategoryName,
  resolveLegacySymbolCategoryName,
  resolveLegacySymbolTechnicalKind,
  sortSymbolCategories
} from "../api/public";

const database = vi.hoisted(() => {
  const categoryFindUnique = vi.fn();
  const categoryFindFirst = vi.fn();
  const categoryCreate = vi.fn();
  const categoryUpdate = vi.fn();
  const categoryDelete = vi.fn();
  const symbolUpdateMany = vi.fn();
  const listSymbolCategories = vi.fn();
  const transactionClient = {
    symbol: { updateMany: symbolUpdateMany },
    symbolCategory: { delete: categoryDelete }
  };

  return {
    categoryFindUnique,
    categoryFindFirst,
    categoryCreate,
    categoryUpdate,
    categoryDelete,
    symbolUpdateMany,
    listSymbolCategories,
    transactionClient,
    transaction: vi.fn()
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    symbolCategory: {
      findUnique: database.categoryFindUnique,
      findFirst: database.categoryFindFirst,
      create: database.categoryCreate,
      update: database.categoryUpdate
    },
    $transaction: database.transaction
  }
}));

vi.mock("../data/queries", () => ({
  listSymbolCategories: database.listSymbolCategories
}));

import {
  createSymbolCategory,
  deleteSymbolCategory,
  updateSymbolCategory
} from "../data/mutations";

describe("symbol categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.listSymbolCategories.mockResolvedValue([]);
    database.transaction.mockImplementation(
      async (
        operation: (client: typeof database.transactionClient) => unknown
      ) => operation(database.transactionClient)
    );
  });

  it("normalizes names for case-insensitive uniqueness", () => {
    expect(normalizeSymbolCategoryName("  Circuit   Protection ")).toBe(
      "circuit protection"
    );
  });

  it("uses panel category first and preserves technical kind separately", () => {
    expect(
      resolveLegacySymbolCategoryName({
        panelCategory: "controller",
        technicalKind: "other"
      })
    ).toBe("Controller");
    expect(
      resolveLegacySymbolTechnicalKind({
        panelCategory: "controller",
        technicalKind: "other"
      })
    ).toBe("controller");
    expect(
      resolveLegacySymbolTechnicalKind({
        panelCategory: "controller",
        technicalKind: "network_device"
      })
    ).toBe("network_device");
  });

  it("sorts categories alphabetically with Other last", () => {
    expect(
      sortSymbolCategories([
        { name: "Other" },
        { name: "Termination" },
        { name: "Controller" }
      ]).map((category) => category.name)
    ).toEqual(["Controller", "Termination", "Other"]);
  });

  it("creates categories with a normalized unique name", async () => {
    database.categoryFindUnique.mockResolvedValue(null);

    await createSymbolCategory({
      name: "  Circuit Protection ",
      description: " Breakers and fuse devices "
    });

    expect(database.categoryCreate).toHaveBeenCalledWith({
      data: {
        name: "Circuit Protection",
        normalizedName: "circuit protection",
        description: "Breakers and fuse devices"
      }
    });
  });

  it("rejects a case-insensitive duplicate category", async () => {
    database.categoryFindUnique.mockResolvedValue({ id: "existing" });

    await expect(
      createSymbolCategory({ name: "controller" })
    ).rejects.toThrow(/already exists/i);
    expect(database.categoryCreate).not.toHaveBeenCalled();
  });

  it("allows the protected category description to change but not its name", async () => {
    database.categoryFindUnique.mockResolvedValue({
      id: "other",
      name: "Other",
      normalizedName: "other",
      description: null,
      isProtected: true
    });

    await expect(
      updateSymbolCategory({
        categoryId: "other",
        name: "Miscellaneous"
      })
    ).rejects.toThrow(/cannot be renamed/i);

    database.categoryFindFirst.mockResolvedValue(null);
    await updateSymbolCategory({
      categoryId: "other",
      name: "Other",
      description: "Fallback category"
    });
    expect(database.categoryUpdate).toHaveBeenCalledWith({
      where: { id: "other" },
      data: {
        name: "Other",
        normalizedName: "other",
        description: "Fallback category"
      }
    });
  });

  it("requires a replacement before deleting an assigned category", async () => {
    database.categoryFindUnique.mockResolvedValue({
      id: "controller",
      name: "Controller",
      normalizedName: "controller",
      isProtected: false,
      _count: { symbols: 2 }
    });

    await expect(
      deleteSymbolCategory({ categoryId: "controller" })
    ).rejects.toThrow(/choose a replacement/i);
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it("reassigns symbols and deletes the category in one transaction", async () => {
    database.categoryFindUnique
      .mockResolvedValueOnce({
        id: "controller",
        name: "Controller",
        normalizedName: "controller",
        isProtected: false,
        _count: { symbols: 2 }
      })
      .mockResolvedValueOnce({ id: "other" });

    await deleteSymbolCategory({
      categoryId: "controller",
      replacementCategoryId: "other"
    });

    expect(database.symbolUpdateMany).toHaveBeenCalledWith({
      where: { categoryId: "controller" },
      data: { categoryId: "other" }
    });
    expect(database.categoryDelete).toHaveBeenCalledWith({
      where: { id: "controller" }
    });
  });
});
