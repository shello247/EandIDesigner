import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  networkMapStatusSchema,
  parseNetworkMapModelJson
} from "./schema";
import type { NetworkMapDetail, NetworkMapListItem } from "../types";

export const listNetworkMaps = cache(
  async (): Promise<NetworkMapListItem[]> => {
    const rows = await prisma.networkMap.findMany({
      where: {
        NOT: { status: "archived" }
      },
      orderBy: { updatedAt: "desc" }
    });

    return rows.map((row) => {
      const model = parseNetworkMapModelJson(row.modelJson);
      const nodeCount = model.sheets.reduce(
        (total, sheet) => total + sheet.nodes.length,
        0
      );
      const linkCount = model.sheets.reduce(
        (total, sheet) => total + sheet.links.length,
        0
      );

      return {
        id: row.id,
        mapKey: row.mapKey,
        title: row.title,
        status: networkMapStatusSchema.parse(row.status),
        sheetCount: model.sheets.length,
        nodeCount,
        linkCount,
        updatedAt: row.updatedAt.toISOString()
      };
    });
  }
);

export const getNetworkMapDetail = cache(
  async (id: string): Promise<NetworkMapDetail | null> => {
    const row = await prisma.networkMap.findUnique({
      where: { id }
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      mapKey: row.mapKey,
      title: row.title,
      status: networkMapStatusSchema.parse(row.status),
      model: parseNetworkMapModelJson(row.modelJson),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
);
