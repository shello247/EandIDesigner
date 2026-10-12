import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  createDefaultDrawingSheet,
  stringifyDrawingModel,
  type DrawingModel
} from "../../src/features/drawing_canvas/data/schema";
import type { ApprovedDrawingSymbol } from "../../src/features/drawing_canvas/types";
import { toPrismaMaintenanceSqliteFileUrl } from "../development-runtime";
import {
  buildNorthTerminalSideRepair,
  NORTH_DRAWING_ID,
  parseNorthTerminalSideRepairArguments,
  repairNorthTerminalSides
} from "../repair-north-terminal-sides";

const TERMINAL_NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13] as const;
const clients: PrismaClient[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.$disconnect()));
});

function symbol(input: {
  symbolId: string;
  category: ApprovedDrawingSymbol["category"];
  anchors: Array<{
    key: string;
    x: number;
    y: number;
    terminalKey: string;
    side: "internal" | "external" | "single";
  }>;
}): ApprovedDrawingSymbol {
  return {
    symbolId: input.symbolId,
    symbolKey: input.symbolId,
    displayName: input.symbolId,
    category: input.category,
    versionId: `${input.symbolId}_v1`,
    versionNumber: 1,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"/>',
    metadata: {
      symbolKey: input.symbolId,
      displayName: input.symbolId,
      category: input.category,
      layoutUsage: "wiring",
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
      anchors: input.anchors.map((anchor) => ({
        key: anchor.key,
        x: anchor.x,
        y: anchor.y,
        kind: "terminal" as const
      })),
      terminals: input.anchors.map((anchor) => ({
        key: anchor.terminalKey,
        label: anchor.terminalKey,
        function: "Test terminal",
        anchorKey: anchor.key,
        panelSide: anchor.side
      }))
    }
  };
}

function buildFixture(): {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
} {
  const terminalAnchors = TERMINAL_NUMBERS.flatMap((number, index) => {
    const token = `M${String(number).padStart(2, "0")}`;
    return [
      {
        key: `${token}.1`,
        terminalKey: token,
        side: "internal" as const,
        x: 10 + index * 7,
        y: 10
      },
      {
        key: `${token}.2`,
        terminalKey: token,
        side: "external" as const,
        x: 10 + index * 7,
        y: 90
      }
    ];
  });
  const singleAnchors = TERMINAL_NUMBERS.map((number, index) => ({
    key: `A${number}`,
    terminalKey: `A${number}`,
    side: "single" as const,
    x: 10 + index * 7,
    y: 50
  }));
  const terminalSymbol = symbol({
    symbolId: "terminal_symbol",
    category: "terminal_block",
    anchors: terminalAnchors
  });
  const instrumentSymbol = symbol({
    symbolId: "instrument_symbol",
    category: "instrument",
    anchors: singleAnchors
  });
  const cableSymbol = symbol({
    symbolId: "cable_symbol",
    category: "cable_assembly",
    anchors: singleAnchors
  });
  const assets: DrawingModel["assets"] = [
    { id: "jb_1", tag: "JB001", type: "junction_box", title: "JB001" },
    { id: "jb_2", tag: "JB002", type: "junction_box", title: "JB002" },
    {
      id: "tb_1",
      tag: "TB-101",
      type: "terminal_block",
      title: "TB-101",
      symbolId: terminalSymbol.symbolId,
      versionId: terminalSymbol.versionId
    },
    {
      id: "tb_2",
      tag: "TB-102",
      type: "terminal_block",
      title: "TB-102",
      symbolId: terminalSymbol.symbolId,
      versionId: terminalSymbol.versionId
    },
    {
      id: "lit_1",
      tag: "LIT-101",
      type: "instrument",
      title: "LIT-101",
      symbolId: instrumentSymbol.symbolId,
      versionId: instrumentSymbol.versionId
    },
    {
      id: "lit_2",
      tag: "LIT-102",
      type: "instrument",
      title: "LIT-102",
      symbolId: instrumentSymbol.symbolId,
      versionId: instrumentSymbol.versionId
    },
    {
      id: "cable_1",
      tag: "C-101",
      type: "cable",
      title: "C-101",
      symbolId: cableSymbol.symbolId,
      versionId: cableSymbol.versionId
    },
    {
      id: "cable_2",
      tag: "C-102",
      type: "cable",
      title: "C-102",
      symbolId: cableSymbol.symbolId,
      versionId: cableSymbol.versionId
    }
  ];

  function placement(input: {
    id: string;
    assetId: string;
    tag: string;
    role: "device" | "terminal_block" | "cable_assembly";
    symbol: ApprovedDrawingSymbol;
    x: number;
    containerAssetId?: string;
  }) {
    return {
      id: input.id,
      assetId: input.assetId,
      containerAssetId: input.containerAssetId,
      symbolId: input.symbol.symbolId,
      versionId: input.symbol.versionId,
      role: input.role,
      tag: input.tag,
      x: input.x,
      y: 100,
      rotation: 0,
      scale: 1
    };
  }

  function instrumentSheet(input: {
    sheetId: "sheet_39" | "sheet_40";
    terminalTag: "TB-101" | "TB-102";
    terminalAssetId: "tb_1" | "tb_2";
    panelAssetId: "jb_1" | "jb_2";
    instrumentAssetId: "lit_1" | "lit_2";
    instrumentTag: "LIT-101" | "LIT-102";
  }) {
    const terminal = placement({
      id: `${input.sheetId}_terminal`,
      assetId: input.terminalAssetId,
      containerAssetId: input.panelAssetId,
      tag: input.terminalTag,
      role: "terminal_block",
      symbol: terminalSymbol,
      x: 250
    });
    const instrument = placement({
      id: `${input.sheetId}_instrument`,
      assetId: input.instrumentAssetId,
      tag: input.instrumentTag,
      role: "device",
      symbol: instrumentSymbol,
      x: 50
    });
    return {
      ...createDefaultDrawingSheet({ id: input.sheetId, name: input.instrumentTag }),
      placements: [terminal, instrument],
      connections: TERMINAL_NUMBERS.map((number) => {
        const token = `M${String(number).padStart(2, "0")}`;
        return {
          id: `${input.sheetId}_${token}_instrument`,
          from: { placementId: terminal.id, anchorKey: `${token}.2` },
          to: { placementId: instrument.id, anchorKey: `A${number}` },
          route: {
            mode: "manual" as const,
            style: "orthogonal" as const,
            points: [
              { id: `${token}_from`, x: 250, y: 190, kind: "endpoint" as const },
              { id: `${token}_control`, x: 150, y: 130, kind: "control" as const },
              { id: `${token}_to`, x: 50, y: 150, kind: "endpoint" as const }
            ],
            locked: true
          }
        };
      })
    };
  }

  function cableSheet(input: {
    sheetId: string;
    terminalTag: "TB-101" | "TB-102";
    terminalAssetId: "tb_1" | "tb_2";
    panelAssetId: "jb_1" | "jb_2";
    cableAssetId: "cable_1" | "cable_2";
    cableTag: "C-101" | "C-102";
  }) {
    const terminal = placement({
      id: `${input.sheetId}_terminal`,
      assetId: input.terminalAssetId,
      containerAssetId: input.panelAssetId,
      tag: input.terminalTag,
      role: "terminal_block",
      symbol: terminalSymbol,
      x: 250
    });
    const cable = placement({
      id: `${input.sheetId}_cable`,
      assetId: input.cableAssetId,
      tag: input.cableTag,
      role: "cable_assembly",
      symbol: cableSymbol,
      x: 50
    });
    return {
      ...createDefaultDrawingSheet({ id: input.sheetId, name: input.cableTag }),
      placements: [cable, terminal],
      connections: TERMINAL_NUMBERS.map((number) => {
        const token = `M${String(number).padStart(2, "0")}`;
        return {
          id: `${input.sheetId}_${token}_cable`,
          from: { placementId: cable.id, anchorKey: `A${number}` },
          to: { placementId: terminal.id, anchorKey: `${token}.2` },
          wireId: `${input.cableTag}-${token}`,
          cablePlacementId: cable.id,
          conductorKey: token
        };
      })
    };
  }

  const base = createDefaultDrawingModel();
  const model: DrawingModel = {
    ...base,
    assets,
    sheets: [
      cableSheet({
        sheetId: "sheet_15",
        terminalTag: "TB-101",
        terminalAssetId: "tb_1",
        panelAssetId: "jb_1",
        cableAssetId: "cable_1",
        cableTag: "C-101"
      }),
      cableSheet({
        sheetId: "sheet_16",
        terminalTag: "TB-102",
        terminalAssetId: "tb_2",
        panelAssetId: "jb_2",
        cableAssetId: "cable_2",
        cableTag: "C-102"
      }),
      instrumentSheet({
        sheetId: "sheet_39",
        terminalTag: "TB-101",
        terminalAssetId: "tb_1",
        panelAssetId: "jb_1",
        instrumentAssetId: "lit_1",
        instrumentTag: "LIT-101"
      }),
      instrumentSheet({
        sheetId: "sheet_40",
        terminalTag: "TB-102",
        terminalAssetId: "tb_2",
        panelAssetId: "jb_2",
        instrumentAssetId: "lit_2",
        instrumentTag: "LIT-102"
      })
    ]
  };
  return {
    model,
    symbols: [terminalSymbol, instrumentSymbol, cableSymbol]
  };
}

async function buildDatabaseFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ei-north-terminal-repair-"));
  const databasePath = path.join(root, "fixture.db");
  const prisma = new PrismaClient({
    datasourceUrl: toPrismaMaintenanceSqliteFileUrl(databasePath)
  });
  clients.push(prisma);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Drawing" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "drawingKey" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "projectId" TEXT,
      "status" TEXT NOT NULL,
      "modelJson" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Symbol" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "symbolKey" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "manufacturer" TEXT,
      "model" TEXT,
      "category" TEXT NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "SymbolVersion" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "symbolId" TEXT NOT NULL,
      "versionNumber" INTEGER NOT NULL,
      "svg" TEXT NOT NULL,
      "metadataJson" TEXT NOT NULL
    )
  `);
  const fixture = buildFixture();
  const createdAt = new Date("2026-09-01T10:00:00.000Z");
  await prisma.$executeRawUnsafe(
    'INSERT INTO "Drawing" ("id", "drawingKey", "title", "description", "projectId", "status", "modelJson", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    NORTH_DRAWING_ID,
    "north-test",
    "North fixture",
    null,
    null,
    "needs_review",
    stringifyDrawingModel(fixture.model),
    createdAt,
    createdAt
  );
  for (const item of fixture.symbols) {
    await prisma.$executeRawUnsafe(
      'INSERT INTO "Symbol" ("id", "symbolKey", "displayName", "manufacturer", "model", "category") VALUES (?, ?, ?, ?, ?, ?)',
      item.symbolId,
      item.symbolKey,
      item.displayName,
      null,
      null,
      item.category
    );
    await prisma.$executeRawUnsafe(
      'INSERT INTO "SymbolVersion" ("id", "symbolId", "versionNumber", "svg", "metadataJson") VALUES (?, ?, ?, ?, ?)',
      item.versionId,
      item.symbolId,
      item.versionNumber,
      item.svg,
      JSON.stringify(item.metadata)
    );
  }
  return { root, databasePath, prisma };
}

describe("North Oropouche terminal-side repair", () => {
  it("is dry-run by default and rejects unknown arguments", () => {
    expect(parseNorthTerminalSideRepairArguments([])).toEqual({ apply: false });
    expect(parseNorthTerminalSideRepairArguments(["--apply"])).toEqual({
      apply: true
    });
    expect(() => parseNorthTerminalSideRepairArguments(["--force"])).toThrow(
      "Unsupported argument"
    );
  });

  it("moves exactly the 22 instrument landings and preserves connection identity and route controls", () => {
    const fixture = buildFixture();
    const result = buildNorthTerminalSideRepair(fixture.model, fixture.symbols);

    expect(result.alreadyCurrent).toBe(false);
    expect(result.mappings).toHaveLength(22);
    for (const sheetId of ["sheet_39", "sheet_40"]) {
      const before = fixture.model.sheets.find((sheet) => sheet.id === sheetId)!;
      const after = result.model.sheets.find((sheet) => sheet.id === sheetId)!;
      expect(after.connections.map((connection) => connection.id)).toEqual(
        before.connections.map((connection) => connection.id)
      );
      for (const connection of after.connections) {
        expect(connection.from.anchorKey.endsWith(".1")).toBe(true);
        expect(connection.route).toMatchObject({ mode: "manual", locked: true });
        expect(connection.route?.points.some((point) => point.kind === "control")).toBe(
          true
        );
      }
    }
    for (const sheetId of ["sheet_15", "sheet_16"]) {
      const before = fixture.model.sheets.find((sheet) => sheet.id === sheetId)!;
      const after = result.model.sheets.find((sheet) => sheet.id === sheetId)!;
      expect(after.connections).toEqual(before.connections);
      expect(after.connections.every((connection) => connection.to.anchorKey.endsWith(".2"))).toBe(
        true
      );
    }
  });

  it("is idempotent and fails closed on a partial repair", () => {
    const fixture = buildFixture();
    const repaired = buildNorthTerminalSideRepair(fixture.model, fixture.symbols);
    expect(
      buildNorthTerminalSideRepair(repaired.model, fixture.symbols)
    ).toMatchObject({ alreadyCurrent: true, mappings: [] });

    const partial = structuredClone(fixture.model);
    const connection = partial.sheets.find((sheet) => sheet.id === "sheet_39")!
      .connections[0];
    connection.from.anchorKey = connection.from.anchorKey.replace(".2", ".1");
    expect(() => buildNorthTerminalSideRepair(partial, fixture.symbols)).toThrow(
      "repair is partial"
    );
  });

  it("keeps dry-run non-mutating, archives apply, and remains idempotent", async () => {
    const { root, databasePath, prisma } = await buildDatabaseFixture();
    const archiveBasePath = path.join(root, "archives");
    const before = await prisma.$queryRawUnsafe<Array<{ modelJson: string }>>(
      'SELECT "modelJson" FROM "Drawing" WHERE "id" = ?',
      NORTH_DRAWING_ID
    );
    await expect(
      repairNorthTerminalSides({
        prisma,
        databasePath,
        archiveBasePath,
        sourceCommit: "a".repeat(40),
        apply: false
      })
    ).resolves.toMatchObject({ status: "dry-run", mappingCount: 22 });
    const afterDryRun = await prisma.$queryRawUnsafe<Array<{ modelJson: string }>>(
      'SELECT "modelJson" FROM "Drawing" WHERE "id" = ?',
      NORTH_DRAWING_ID
    );
    expect(afterDryRun).toEqual(before);
    expect(existsSync(archiveBasePath)).toBe(false);

    const applied = await repairNorthTerminalSides({
      prisma,
      databasePath,
      archiveBasePath,
      sourceCommit: "b".repeat(40),
      apply: true,
      now: new Date("2026-09-03T12:34:56.000Z")
    });
    expect(applied).toMatchObject({ status: "repaired", mappingCount: 22 });
    expect(existsSync(path.join(applied.archivePath!, "pre-repair-dev.db"))).toBe(
      true
    );
    const manifest = JSON.parse(
      readFileSync(path.join(applied.archivePath!, "manifest.json"), "utf8")
    );
    expect(manifest).toMatchObject({
      state: "repaired-and-verified",
      drawingId: NORTH_DRAWING_ID,
      mappingCount: 22
    });
    await expect(
      repairNorthTerminalSides({
        prisma,
        databasePath,
        archiveBasePath,
        sourceCommit: "c".repeat(40),
        apply: true
      })
    ).resolves.toEqual({
      status: "current",
      mappingCount: 0,
      mappings: []
    });
  });

  it("refuses a locked database before creating an archive", async () => {
    const { root, databasePath, prisma } = await buildDatabaseFixture();
    const archiveBasePath = path.join(root, "archives");
    const locker = new PrismaClient({
      datasourceUrl: toPrismaMaintenanceSqliteFileUrl(databasePath)
    });
    clients.push(locker);
    await locker.$executeRawUnsafe("BEGIN EXCLUSIVE");
    try {
      await expect(
        repairNorthTerminalSides({
          prisma,
          databasePath,
          archiveBasePath,
          sourceCommit: "d".repeat(40),
          apply: true
        })
      ).rejects.toThrow();
      expect(existsSync(archiveBasePath)).toBe(false);
    } finally {
      await locker.$executeRawUnsafe("ROLLBACK");
    }
  });
});
