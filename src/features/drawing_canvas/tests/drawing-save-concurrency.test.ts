import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDrawingModel } from "../data/schema";

const prismaMocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drawing: prismaMocks
  }
}));

vi.mock("../data/queries", () => ({
  getDrawingDetail: vi.fn(async (id: string) => ({ id }))
}));

import {
  DrawingRevisionConflictError,
  saveDrawing
} from "../data/mutations";

describe("drawing optimistic concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates only the expected revision", async () => {
    const expectedUpdatedAt = "2026-07-11T12:00:00.000Z";
    prismaMocks.updateMany.mockResolvedValue({ count: 1 });

    await saveDrawing({
      drawingId: "drawing_1",
      title: "Concurrent drawing",
      model: createDefaultDrawingModel(),
      expectedUpdatedAt
    });

    expect(prismaMocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "drawing_1",
          updatedAt: new Date(expectedUpdatedAt)
        }
      })
    );
    expect(prismaMocks.update).not.toHaveBeenCalled();
  });

  it("returns the current server revision without discarding local work", async () => {
    const latest = new Date("2026-07-11T13:00:00.000Z");
    prismaMocks.updateMany.mockResolvedValue({ count: 0 });
    prismaMocks.findUnique.mockResolvedValue({ updatedAt: latest });

    const promise = saveDrawing({
      drawingId: "drawing_1",
      title: "Local unsaved drawing",
      model: createDefaultDrawingModel(),
      expectedUpdatedAt: "2026-07-11T12:00:00.000Z"
    });

    await expect(promise).rejects.toMatchObject({
      name: "DrawingRevisionConflictError",
      latestUpdatedAt: latest.toISOString()
    });
    await expect(promise).rejects.toBeInstanceOf(DrawingRevisionConflictError);
  });
});
