import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  client: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMocks }));

import {
  createDrawingClient,
  DrawingClientDomainError
} from "../data/mutations";
import {
  findDrawingClientById,
  listDrawingClients
} from "../data/queries";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("drawing Client data services", () => {
  it("creates a normalized reusable Client", async () => {
    prismaMocks.client.create.mockResolvedValue({
      id: "client_1",
      name: "Water Authority"
    });
    await expect(
      createDrawingClient({ name: "  Water Authority  " })
    ).resolves.toEqual({ id: "client_1", name: "Water Authority" });
    expect(prismaMocks.client.create).toHaveBeenCalledWith({
      data: {
        name: "Water Authority",
        normalizedName: "water authority"
      },
      select: { id: true, name: true }
    });
  });

  it("maps database uniqueness conflicts to a field-safe error", async () => {
    prismaMocks.client.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "6.19.3"
      })
    );
    await expect(
      createDrawingClient({ name: "Water Authority" })
    ).rejects.toMatchObject({
      code: "duplicate_name",
      message: "A Client with this name already exists."
    } satisfies Partial<DrawingClientDomainError>);
  });

  it("loads only lightweight Client options in stable order", async () => {
    prismaMocks.client.findMany.mockResolvedValue([
      { id: "client_1", name: "Alpha" }
    ]);
    await expect(listDrawingClients()).resolves.toEqual([
      { id: "client_1", name: "Alpha" }
    ]);
    expect(prismaMocks.client.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true }
    });
  });

  it("resolves a selected Client by identifier", async () => {
    prismaMocks.client.findUnique.mockResolvedValue({
      id: "client_1",
      name: "Alpha"
    });
    await expect(findDrawingClientById(" client_1 ")).resolves.toEqual({
      id: "client_1",
      name: "Alpha"
    });
    expect(prismaMocks.client.findUnique).toHaveBeenCalledWith({
      where: { id: "client_1" },
      select: { id: true, name: true }
    });
  });
});
