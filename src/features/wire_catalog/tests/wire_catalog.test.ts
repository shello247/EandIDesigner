import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWireSpecificationSnapshot,
  normalizeWireCatalogName
} from "../api/public";

const database = vi.hoisted(() => {
  const findFirst = vi.fn();
  const findUnique = vi.fn();
  const count = vi.fn();
  const updateMany = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const remove = vi.fn();
  const transactionClient = {
    wireCatalogEntry: {
      findUnique,
      count,
      updateMany,
      create,
      update,
      delete: remove
    }
  };
  return {
    findFirst,
    findUnique,
    count,
    updateMany,
    create,
    update,
    remove,
    transactionClient,
    transaction: vi.fn(),
    list: vi.fn()
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    wireCatalogEntry: {
      findFirst: database.findFirst,
      findUnique: database.findUnique,
      count: database.count,
      updateMany: database.updateMany,
      update: database.update
    },
    $transaction: database.transaction
  }
}));

vi.mock("../data/queries", () => ({
  listWireCatalogEntries: database.list
}));

import {
  createWireCatalogEntry,
  deleteWireCatalogEntry,
  updateWireCatalogEntry
} from "../data/mutations";

describe("wire catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.list.mockResolvedValue([]);
    database.transaction.mockImplementation(
      async (
        operation:
          | ((client: typeof database.transactionClient) => unknown)
          | unknown[]
      ) =>
        typeof operation === "function"
          ? operation(database.transactionClient)
          : operation
    );
  });

  it("normalizes names case-insensitively", () => {
    expect(normalizeWireCatalogName("  Panel   Blue 1.5  ")).toBe(
      "panel blue 1.5"
    );
  });

  it("makes the first catalog entry the default", async () => {
    database.findFirst.mockResolvedValue(null);
    database.count.mockResolvedValue(0);

    await createWireCatalogEntry({
      name: "Panel Blue 1.5",
      wireType: "H07V-K",
      size: "1.5 mm²",
      color: "Blue"
    });

    expect(database.updateMany).toHaveBeenCalledWith({
      data: { isDefault: false }
    });
    expect(database.create).toHaveBeenCalledWith({
      data: {
        name: "Panel Blue 1.5",
        normalizedName: "panel blue 1.5",
        wireType: "H07V-K",
        size: "1.5 mm²",
        color: "Blue",
        notes: null,
        isDefault: true
      }
    });
  });

  it("rejects case-insensitive duplicate names", async () => {
    database.findFirst.mockResolvedValue({ id: "existing" });

    await expect(
      createWireCatalogEntry({
        name: "panel blue 1.5",
        wireType: "H07V-K",
        size: "1.5 mm²",
        color: "Blue"
      })
    ).rejects.toThrow(/already exists/i);
  });

  it("requires a replacement before deleting the current default", async () => {
    database.findUnique.mockResolvedValue({
      id: "blue",
      isDefault: true
    });
    database.count.mockResolvedValue(2);

    await expect(
      deleteWireCatalogEntry({ entryId: "blue" })
    ).rejects.toThrow(/replacement default/i);
    expect(database.remove).not.toHaveBeenCalled();
  });

  it("replaces the default and deletes atomically", async () => {
    database.findUnique
      .mockResolvedValueOnce({ id: "blue", isDefault: true })
      .mockResolvedValueOnce({ id: "red" });
    database.count.mockResolvedValue(2);

    await deleteWireCatalogEntry({
      entryId: "blue",
      replacementDefaultId: "red"
    });

    expect(database.update).toHaveBeenCalledWith({
      where: { id: "red" },
      data: { isDefault: true }
    });
    expect(database.remove).toHaveBeenCalledWith({
      where: { id: "blue" }
    });
  });

  it("keeps existing specification snapshots immutable", async () => {
    const entry = {
      id: "blue",
      name: "Panel Blue 1.5",
      wireType: "H07V-K",
      size: "1.5 mm²",
      color: "Blue",
      isDefault: true,
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z"
    };
    const snapshot = createWireSpecificationSnapshot(entry);

    database.findUnique.mockResolvedValue({
      ...entry,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt)
    });
    database.findFirst.mockResolvedValue(null);

    await updateWireCatalogEntry({
      entryId: entry.id,
      name: entry.name,
      wireType: "MTW",
      size: entry.size,
      color: "Dark blue"
    });

    expect(snapshot).toEqual({
      catalogEntryId: "blue",
      catalogEntryName: "Panel Blue 1.5",
      wireType: "H07V-K",
      size: "1.5 mm²",
      color: "Blue"
    });
  });
});
