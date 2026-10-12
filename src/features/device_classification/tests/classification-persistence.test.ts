import { beforeEach, describe, expect, it, vi } from "vitest";
const { row, update, transaction, lookup } = vi.hoisted(() => ({
  row: { id: "v1", symbolId: "s1", versionNumber: 1, status: "approved", deviceType: null as string | null,
    svg: "<svg/>", metadataJson: '{"historic":true}', symbol: { status: "approved" } },
  update: vi.fn(), transaction: vi.fn(), lookup: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction } }));
import { saveSymbolClassification } from "../data/mutations";
import { classificationContentToken } from "../logic/services/classification-token";
beforeEach(() => {
  vi.clearAllMocks(); row.deviceType = null; row.status = "approved"; row.symbol.status = "approved";
  lookup.mockResolvedValue(row); update.mockResolvedValue({ count: 1 });
  transaction.mockImplementation(callback => callback({ symbolVersion: { findUnique: lookup, updateMany: update } }));
});
describe("bounded classification persistence", () => {
  it("writes only the additive column and returns an evidence receipt", async () => {
    const before = JSON.stringify(row);
    const result = await saveSymbolClassification({ versionId: "v1", expectedToken: classificationContentToken(row), deviceType: "ups", evidence: "Manufacturer manual edition 1, p. 2, exact variant" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { deviceType: "ups" },
      where: expect.objectContaining({ id: "v1", deviceType: null, svg: "<svg/>", metadataJson: row.metadataJson }) }));
    expect(result).toMatchObject({ before: null, after: "ups", revisionId: "v1", changed: true });
    expect(JSON.stringify(row)).toBe(before);
  });
  it("rejects stale previews and refuses archive changes before a write", async () => {
    const input = { versionId: "v1", expectedToken: "a".repeat(64), deviceType: "ups" as const, evidence: "Source p. 1" };
    await expect(saveSymbolClassification(input)).rejects.toThrow("changed");
    row.symbol.status = "archived";
    await expect(saveSymbolClassification({ ...input, expectedToken: classificationContentToken(row) })).rejects.toThrow("Archived");
    expect(update).not.toHaveBeenCalled();
  });
  it("requires evidence and detects a lost compare-and-set", async () => {
    const input = { versionId: "v1", expectedToken: classificationContentToken(row), deviceType: "chassis_rack" as const, evidence: "" };
    await expect(saveSymbolClassification(input)).rejects.toThrow("evidence");
    expect(transaction).not.toHaveBeenCalled();
    update.mockResolvedValue({ count: 0 });
    await expect(saveSymbolClassification({ ...input, evidence: "Source p. 1" })).rejects.toThrow("changed during");
  });
  it("does not issue a write for an identical classification", async () => {
    row.deviceType = "ups";
    expect((await saveSymbolClassification({ versionId: "v1", expectedToken: classificationContentToken(row), deviceType: "ups", evidence: "Source p. 1" })).changed).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
