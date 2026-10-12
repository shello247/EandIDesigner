import { describe, expect, it, vi } from "vitest";

const { attachments } = vi.hoisted(() => ({ attachments: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const empty = () => ({ findMany: vi.fn().mockResolvedValue([]) });
  const db = { symbol: empty(), symbolVersion: empty(), bomItem: empty(),
    bomItemEngineeringRevision: empty(), drawing: empty(), symbolItemConfiguration: empty(),
    symbolBomTemplate: empty(), $queryRaw: attachments, $queryRawUnsafe: vi.fn().mockResolvedValue([]) };
  return { prisma: { $transaction: (work: (transaction: typeof db) => unknown) => work(db) } };
});
import { readClassificationAudit } from "../data/audit-queries";

describe("classification audit database projection", () => {
  it("serializes SQLite integer attachment results and retains unavailable-content findings", async () => {
    attachments.mockResolvedValue([
      { kind: "symbol_source", id: "present", ownerId: null, title: "Present", sizeBytes: 42n, contentPresent: 1n },
      { kind: "symbol_source", id: "missing", ownerId: null, title: "Missing", sizeBytes: 0n, contentPresent: 0n }
    ]);
    const report = await readClassificationAudit();
    expect(() => JSON.stringify(report)).not.toThrow();
    expect(report.inventory.attachments[0]).toMatchObject({ sizeBytes: 42, contentPresent: 1 });
    expect(report.inventory.attachments[1]).toMatchObject({ sizeBytes: 0, contentPresent: 0 });
    expect(report.records.find(row => row.id === "missing")?.issues).toContain("Attachment content unavailable.");
    expect(report.records.find(row => row.id === "present")?.issues).toEqual([]);
  });
});
