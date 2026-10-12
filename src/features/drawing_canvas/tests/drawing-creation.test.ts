import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getDrawingDetail: vi.fn(),
  resolveAssignment: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { drawing: { create: mocks.create } }
}));
vi.mock("../data/queries", () => ({
  getDrawingDetail: mocks.getDrawingDetail
}));
vi.mock("@/features/drawing_projects/api/server", () => ({
  resolveDrawingProjectAssignment: mocks.resolveAssignment
}));

import { createDrawing } from "../data/mutations";
import {
  generateUniqueDrawingKey,
  normalizeDrawingKey
} from "../logic/services/drawing-key";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveAssignment.mockResolvedValue(null);
  mocks.getDrawingDetail.mockResolvedValue({ id: "drawing_created" });
});

describe("automatic drawing identification", () => {
  it("normalizes titles and creates deterministic collision suffixes", () => {
    expect(normalizeDrawingKey("  Tank 1 / PLC Panel  ")).toBe(
      "tank_1_plc_panel"
    );
    expect(generateUniqueDrawingKey("Tank 1 / PLC Panel")).toBe(
      "tank_1_plc_panel"
    );
    expect(generateUniqueDrawingKey("Tank 1 / PLC Panel", 1)).toBe(
      "tank_1_plc_panel_2"
    );
  });

  it("retries the authoritative unique constraint and initializes Project title-block values", async () => {
    mocks.resolveAssignment.mockResolvedValue({
      id: "project_1",
      name: "North Oropouche Upgrade",
      client: "WASA",
      status: "active"
    });
    mocks.create
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002",
          clientVersion: "6.19.3",
          meta: { target: ["drawingKey"] }
        })
      )
      .mockResolvedValueOnce({ id: "drawing_created" });

    await expect(
      createDrawing({
        title: "PLC Panel",
        description: "Main panel wiring",
        projectId: "project_1"
      })
    ).resolves.toEqual({ id: "drawing_created" });

    expect(mocks.create).toHaveBeenCalledTimes(2);
    const firstData = mocks.create.mock.calls[0]?.[0].data;
    const secondData = mocks.create.mock.calls[1]?.[0].data;
    expect(firstData.drawingKey).toBe("plc_panel");
    expect(secondData).toMatchObject({
      drawingKey: "plc_panel_2",
      description: "Main panel wiring",
      projectId: "project_1"
    });
    expect(JSON.parse(secondData.modelJson).titleBlock).toMatchObject({
      project: "North Oropouche Upgrade",
      client: "WASA"
    });
  });

  it.each([undefined, "", "   "])("rejects creation without a project (%s)", async (projectId) => {
    await expect(createDrawing({ title: "Unassigned Drawing", projectId })).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects an unresolved project", async () => {
    await expect(createDrawing({ title: "Drawing", projectId: "missing" })).rejects.toThrow("active project");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

