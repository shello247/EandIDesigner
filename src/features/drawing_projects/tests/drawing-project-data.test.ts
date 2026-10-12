import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  project: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  },
  projectNumberSequence: {
    upsert: vi.fn()
  },
  client: {
    findUnique: vi.fn()
  },
  drawing: {
    count: vi.fn(),
    findMany: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMocks }));

import {
  createDrawingProject,
  setDrawingProjectStatus
} from "../data/mutations";
import {
  listAssignableDrawingProjects,
  listDrawingProjectPage,
  listProjectDrawingPage
} from "../data/queries";
import { resolveDrawingProjectAssignment } from "../logic/services/project-assignment";

const now = new Date("2026-09-02T10:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("drawing project data services", () => {
  it("paginates Project summaries without drawing documents", async () => {
    prismaMocks.project.count.mockResolvedValue(30);
    prismaMocks.project.findMany.mockResolvedValue([
      {
        id: "project_1",
        name: "Tank Automation",
        projectNumber: "TA-01",
        clientId: "client_1",
        client: "WASA",
        description: "Tank controls",
        status: "active",
        updatedAt: now,
        _count: { drawings: 3 }
      }
    ]);
    const result = await listDrawingProjectPage({
      requestedPage: 2,
      status: "active"
    });
    expect(result).toMatchObject({ page: 2, pageSize: 25, totalCount: 30 });
    expect(result.items[0]).toMatchObject({ drawingCount: 3 });
    expect(prismaMocks.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
        select: expect.not.objectContaining({ drawings: true })
      })
    );
  });

  it("loads linked drawing summaries without modelJson", async () => {
    prismaMocks.drawing.count.mockResolvedValue(1);
    prismaMocks.drawing.findMany.mockResolvedValue([
      {
        id: "drawing_1",
        title: "PLC Panel",
        description: null,
        status: "draft",
        updatedAt: now
      }
    ]);
    const result = await listProjectDrawingPage({
      projectId: "project_1",
      requestedPage: 1
    });
    expect(result.items).toHaveLength(1);
    const call = prismaMocks.drawing.findMany.mock.calls[0]?.[0];
    expect(call.select.modelJson).toBeUndefined();
    expect(call.select).toEqual({
      id: true,
      title: true,
      description: true,
      status: true,
      updatedAt: true
    });
  });

  it("loads active options plus an archived current Project", async () => {
    prismaMocks.project.findMany.mockResolvedValue([
      {
        id: "project_current",
        name: "Completed Project",
        projectNumber: null,
        clientId: null,
        client: null,
        status: "archived"
      }
    ]);
    const result = await listAssignableDrawingProjects("project_current");
    expect(result[0]?.status).toBe("archived");
    expect(prismaMocks.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ status: "active" }, { id: "project_current" }]
        }
      })
    );
  });

  it("allows an archived current association but rejects a new one", async () => {
    prismaMocks.project.findUnique.mockResolvedValue({
      id: "project_archived",
      name: "Archived",
      projectNumber: null,
      clientId: null,
      client: null,
      status: "archived"
    });
    await expect(
      resolveDrawingProjectAssignment({
        projectId: "project_archived",
        currentProjectId: "project_archived"
      })
    ).resolves.toMatchObject({ id: "project_archived", status: "archived" });
    await expect(
      resolveDrawingProjectAssignment({ projectId: "project_archived" })
    ).rejects.toThrow("archived");
  });

  it("allocates an automatic number and stores the selected Client snapshot", async () => {
    prismaMocks.projectNumberSequence.upsert.mockResolvedValue({ lastValue: 1 });
    prismaMocks.client.findUnique.mockResolvedValue({
      id: "client_1",
      name: "WASA"
    });
    prismaMocks.project.create.mockResolvedValue({ id: "project_created" });
    prismaMocks.project.findUnique.mockResolvedValue({
      id: "project_created",
      name: "Created Project",
      projectNumber: "PRJ-000001",
      clientId: "client_1",
      client: "WASA",
      description: null,
      status: "active",
      createdAt: now,
      updatedAt: now,
      _count: { drawings: 0 }
    });
    await createDrawingProject({
      name: "Created Project",
      clientId: "client_1"
    });
    expect(prismaMocks.projectNumberSequence.upsert).toHaveBeenCalledWith({
      where: { scope: "drawing-project" },
      create: { scope: "drawing-project", lastValue: 1 },
      update: { lastValue: { increment: 1 } },
      select: { lastValue: true }
    });
    expect(prismaMocks.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectNumber: "PRJ-000001",
          normalizedProjectNumber: "prj-000001",
          clientId: "client_1",
          client: "WASA"
        })
      })
    );
  });

  it("retries an automatic-number collision with the next sequence", async () => {
    prismaMocks.projectNumberSequence.upsert
      .mockResolvedValueOnce({ lastValue: 8 })
      .mockResolvedValueOnce({ lastValue: 9 });
    prismaMocks.project.create
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("duplicate", {
          code: "P2002",
          clientVersion: "6.19.3"
        })
      )
      .mockResolvedValueOnce({ id: "project_created" });
    prismaMocks.project.findUnique.mockResolvedValue({
      id: "project_created",
      name: "Created Project",
      projectNumber: "PRJ-000009",
      clientId: null,
      client: null,
      description: null,
      status: "active",
      createdAt: now,
      updatedAt: now,
      _count: { drawings: 0 }
    });
    await createDrawingProject({ name: "Created Project" });
    expect(prismaMocks.project.create).toHaveBeenCalledTimes(2);
    expect(prismaMocks.project.create.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          projectNumber: "PRJ-000009",
          normalizedProjectNumber: "prj-000009"
        })
      })
    );
  });

  it("rejects an unavailable Client before allocating a number", async () => {
    prismaMocks.client.findUnique.mockResolvedValue(null);
    await expect(
      createDrawingProject({ name: "Created Project", clientId: "missing" })
    ).rejects.toMatchObject({
      code: "client_not_found",
      message: "The selected Client is unavailable."
    });
    expect(prismaMocks.projectNumberSequence.upsert).not.toHaveBeenCalled();
    expect(prismaMocks.project.create).not.toHaveBeenCalled();
  });

  it("archives without touching linked drawings", async () => {
    prismaMocks.project.updateMany.mockResolvedValue({ count: 1 });
    prismaMocks.project.findUnique.mockResolvedValue({
      id: "project_1",
      name: "Project",
      projectNumber: null,
      clientId: null,
      client: null,
      description: null,
      status: "archived",
      createdAt: now,
      updatedAt: now,
      _count: { drawings: 4 }
    });
    await setDrawingProjectStatus({
      projectId: "project_1",
      status: "archived"
    });
    expect(prismaMocks.project.updateMany).toHaveBeenCalledWith({
      where: { id: "project_1" },
      data: { status: "archived" }
    });
    expect(prismaMocks.drawing.findMany).not.toHaveBeenCalled();
  });
});
