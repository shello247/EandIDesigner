import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  symbolFindMany: vi.fn(),
  versionFindMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    symbol: { findMany: database.symbolFindMany },
    symbolVersion: { findMany: database.versionFindMany }
  }
}));

import {
  listDrawingSymbolCatalogSummaries,
  listDrawingSymbolVersions,
  listDrawingSymbolVersionsByIds
} from "../data/queries";
import {
  drawingSymbolCatalogSummarySchema,
  drawingSymbolVersionIdsSchema
} from "../data/schema";

const metadataJson = JSON.stringify({
  symbolKey: "terminal_module",
  displayName: "Feed-through Terminal",
  category: "terminal_block",
  layoutUsage: "panel_layout",
  physicalWidthMm: 5.2,
  physicalHeightMm: 42,
  mountingType: "din_rail",
  panelCategory: "termination",
  terminalBlockModule: {
    kind: "feed_through",
    defaultForGeneratedGroups: true
  },
  terminalStripCapability: {
    role: "electrical",
    railDatumMm: 21,
    defaultForNewStrips: true
  },
  viewBox: { x: 0, y: 0, width: 10, height: 20 },
  terminals: [
    {
      key: "1",
      label: "1",
      anchorKey: "T1",
      requiredForWiring: true
    }
  ],
  anchors: [{ key: "T1", x: 5, y: 10, kind: "terminal" }]
});

function versionRow(versionId: string, versionNumber = 1) {
  return {
    id: versionId,
    symbolId: `symbol_${versionId}`,
    versionNumber,
    svg: `<svg data-version="${versionId}"></svg>`,
    metadataJson,
    symbol: {
      id: `symbol_${versionId}`,
      symbolKey: `key_${versionId}`,
      displayName: `Symbol ${versionId}`,
      manufacturer: "Example",
      model: versionId,
      category: "terminal_block",
      managedCategory: { id: "category_termination", name: "Termination" }
    }
  };
}

function catalogRow() {
  return {
    id: "symbol_terminal",
    symbolKey: "terminal_module",
    displayName: "Feed-through Terminal",
    manufacturer: "Example",
    model: "FT-5",
    category: "terminal_block",
    managedCategory: { id: "category_termination", name: "Termination" },
    versions: [
      {
        id: "version_latest",
        versionNumber: 7,
        metadataJson
      }
    ]
  };
}

beforeEach(() => {
  database.symbolFindMany.mockReset();
  database.versionFindMany.mockReset();
});

describe("drawing symbol query split", () => {
  it("validates and deduplicates exact version requests", () => {
    expect(
      drawingSymbolVersionIdsSchema.parse([
        " version_2 ",
        "version_1",
        "version_2"
      ])
    ).toEqual(["version_2", "version_1"]);
    expect(
      drawingSymbolVersionIdsSchema.safeParse(Array.from({ length: 5001 }, (_, index) => `v_${index}`)).success
    ).toBe(false);
  });

  it("loads only requested exact versions and restores request order", async () => {
    database.versionFindMany.mockResolvedValue([
      versionRow("version_2", 2),
      versionRow("version_1", 1)
    ]);

    const result = await listDrawingSymbolVersionsByIds([
      "version_1",
      "version_missing",
      "version_2",
      "version_1"
    ]);

    expect(database.symbolFindMany).not.toHaveBeenCalled();
    expect(database.versionFindMany).toHaveBeenCalledTimes(1);
    expect(database.versionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["version_1", "version_missing", "version_2"] },
          symbol: { category: { not: "network_device" } }
        }
      })
    );
    expect(result.map((symbol) => symbol.versionId)).toEqual([
      "version_1",
      "version_2"
    ]);
    expect(result[0]).toMatchObject({
      svg: '<svg data-version="version_1"></svg>',
      selectable: false
    });
  });

  it("chunks large exact-version bundles below the SQLite parameter limit", async () => {
    database.versionFindMany.mockImplementation(
      async (query: { where: { id: { in: string[] } } }) =>
        query.where.id.in.map((versionId) => versionRow(versionId))
    );
    const versionIds = Array.from({ length: 401 }, (_, index) =>
      `version_${String(index).padStart(3, "0")}`
    );

    const result = await listDrawingSymbolVersionsByIds(versionIds);

    expect(database.versionFindMany).toHaveBeenCalledTimes(2);
    expect(
      database.versionFindMany.mock.calls.map(
        ([query]) => query.where.id.in.length
      )
    ).toEqual([400, 1]);
    expect(result.map((symbol) => symbol.versionId)).toEqual(versionIds);
  });

  it("returns catalogue summaries without full render data", async () => {
    database.symbolFindMany.mockResolvedValue([catalogRow()]);

    const result = await listDrawingSymbolCatalogSummaries();

    expect(result).toHaveLength(1);
    expect(drawingSymbolCatalogSummarySchema.parse(result[0])).toEqual(
      result[0]
    );
    expect(result[0]).toMatchObject({
      symbolId: "symbol_terminal",
      versionId: "version_latest",
      technicalKind: "terminal_block",
      managedCategory: {
        id: "category_termination",
        name: "Termination"
      },
      capabilities: {
        layoutUsage: "panel_layout",
        physicalWidthMm: 5.2,
        physicalHeightMm: 42,
        mountingType: "din_rail",
        panelCategory: "termination",
        terminalBlockModule: {
          kind: "feed_through",
          defaultForGeneratedGroups: true
        },
        terminalStripCapability: {
          role: "electrical",
          railDatumMm: 21,
          defaultForNewStrips: true
        }
      }
    });
    expect(result[0]).not.toHaveProperty("svg");
    expect(result[0]).not.toHaveProperty("metadata");
    expect(Buffer.byteLength(JSON.stringify(result[0]), "utf8")).toBeLessThan(
      768
    );

    const query = database.symbolFindMany.mock.calls[0][0];
    expect(query.select.versions.select).not.toHaveProperty("svg");
    expect(query.select.versions.select).toMatchObject({
      id: true,
      versionNumber: true,
      metadataJson: true
    });
  });

  it("keeps the legacy full-catalogue query available for current callers", async () => {
    const row = catalogRow();
    database.symbolFindMany.mockResolvedValue([
      {
        ...row,
        versions: [
          {
            ...row.versions[0],
            svg: '<svg data-version="version_latest"></svg>'
          }
        ]
      }
    ]);

    const result = await listDrawingSymbolVersions();

    expect(result[0]).toMatchObject({
      versionId: "version_latest",
      svg: '<svg data-version="version_latest"></svg>',
      selectable: true
    });
  });
});
