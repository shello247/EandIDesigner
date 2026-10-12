import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDrawingModel } from "../data/schema";

const prismaMocks = vi.hoisted(() => ({
  updateManyAndReturn: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  getDrawingDetail: vi.fn(),
  resolveAssignment: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drawing: prismaMocks
  }
}));

vi.mock("../data/queries", () => ({
  getDrawingDetail: prismaMocks.getDrawingDetail
}));

vi.mock("@/features/drawing_projects/api/server", () => ({
  resolveDrawingProjectAssignment: prismaMocks.resolveAssignment
}));

import {
  DrawingRevisionConflictError,
  saveDrawing,
  saveDrawingReviewState
} from "../data/mutations";

describe("drawing optimistic concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.resolveAssignment.mockResolvedValue(null);
  });

  it("updates only the expected revision", async () => {
    const expectedUpdatedAt = "2026-07-11T12:00:00.000Z";
    const persistedUpdatedAt = new Date("2026-07-11T12:00:01.000Z");
    prismaMocks.updateManyAndReturn.mockResolvedValue([
      { id: "drawing_1", updatedAt: persistedUpdatedAt }
    ]);

    const result = await saveDrawing({
      drawingId: "drawing_1",
      title: "Concurrent drawing",
      model: createDefaultDrawingModel(),
      expectedUpdatedAt
    });

    expect(prismaMocks.updateManyAndReturn).toHaveBeenCalledWith({
      where: {
        id: "drawing_1",
        updatedAt: new Date(expectedUpdatedAt)
      },
      data: expect.objectContaining({ title: "Concurrent drawing" }),
      limit: 1,
      select: { id: true, updatedAt: true }
    });
    expect(result).toEqual({
      id: "drawing_1",
      updatedAt: persistedUpdatedAt.toISOString()
    });
    expect(prismaMocks.getDrawingDetail).not.toHaveBeenCalled();
    expect(prismaMocks.update).not.toHaveBeenCalled();
  });

  it("returns the persisted revision when no expected revision is supplied", async () => {
    const persistedUpdatedAt = new Date("2026-07-11T12:00:02.000Z");
    prismaMocks.update.mockResolvedValue({
      id: "drawing_1",
      updatedAt: persistedUpdatedAt
    });

    const result = await saveDrawing({
      drawingId: "drawing_1",
      title: "Unversioned drawing",
      model: createDefaultDrawingModel()
    });

    expect(prismaMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "drawing_1" },
        select: { id: true, updatedAt: true }
      })
    );
    expect(result.updatedAt).toBe(persistedUpdatedAt.toISOString());
    expect(prismaMocks.getDrawingDetail).not.toHaveBeenCalled();
  });

  it("persists drawing description and a validated current Project association", async () => {
    const persistedUpdatedAt = new Date("2026-07-11T12:00:02.500Z");
    prismaMocks.findUnique.mockResolvedValue({ projectId: "project_1" });
    prismaMocks.resolveAssignment.mockResolvedValue({
      id: "project_1",
      name: "Tank Automation",
      status: "archived"
    });
    prismaMocks.updateManyAndReturn.mockResolvedValue([
      { id: "drawing_1", updatedAt: persistedUpdatedAt }
    ]);

    await saveDrawing({
      drawingId: "drawing_1",
      title: "Project drawing",
      description: "PLC panel scope",
      projectId: "project_1",
      model: createDefaultDrawingModel(),
      expectedUpdatedAt: "2026-07-11T12:00:00.000Z"
    });

    expect(prismaMocks.resolveAssignment).toHaveBeenCalledWith({
      projectId: "project_1",
      currentProjectId: "project_1"
    });
    expect(prismaMocks.updateManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: "PLC panel scope",
          projectId: "project_1"
        })
      })
    );
  });

  it("returns the current server revision without discarding local work", async () => {
    const latest = new Date("2026-07-11T13:00:00.000Z");
    prismaMocks.updateManyAndReturn.mockResolvedValue([]);
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

  it("retains the full-detail review wrapper for approval callers", async () => {
    const persistedUpdatedAt = new Date("2026-07-11T12:00:03.000Z");
    const detail = { id: "drawing_1", updatedAt: persistedUpdatedAt.toISOString() };
    prismaMocks.updateManyAndReturn.mockResolvedValue([
      { id: "drawing_1", updatedAt: persistedUpdatedAt }
    ]);
    prismaMocks.getDrawingDetail.mockResolvedValue(detail);

    await expect(
      saveDrawingReviewState(
        {
          drawingId: "drawing_1",
          title: "Approved drawing",
          model: createDefaultDrawingModel(),
          expectedUpdatedAt: "2026-07-11T12:00:00.000Z"
        },
        "approved"
      )
    ).resolves.toBe(detail);
    expect(prismaMocks.getDrawingDetail).toHaveBeenCalledWith("drawing_1");
  });
});
