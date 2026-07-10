import { prisma } from "../../src/lib/prisma";
import {
  createDefaultDrawingSheet,
  createDefaultDrawingModel,
  stringifyDrawingModel,
  type DrawingModel
} from "../../src/features/drawing_canvas/data/schema";
import { createTerminalBlockPlacement } from "../../src/features/drawing_canvas/logic/services/drawing-terminal-blocks";

type FixtureSymbol = {
  symbolId: string;
  versionId: string;
};

function placementId(value: string): string {
  return value.replace(/[^a-z0-9_]+/gi, "_").toLowerCase();
}

async function requireApprovedSymbol(symbolKey: string): Promise<FixtureSymbol> {
  const symbol = await prisma.symbol.findUnique({
    where: { symbolKey },
    select: {
      id: true,
      versions: {
        where: { status: "approved" },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { id: true }
      }
    }
  });
  const version = symbol?.versions[0];

  if (!symbol || !version) {
    throw new Error(`Approved e2e symbol "${symbolKey}" was not found.`);
  }

  return {
    symbolId: symbol.id,
    versionId: version.id
  };
}

export async function createE2eNmt81ToNrf81Drawing(): Promise<string> {
  const [nmt81, nrf81, cable] = await Promise.all([
    requireApprovedSymbol("nmt81_average_temperature_probe"),
    requireApprovedSymbol("nrf81_tank_side_monitor"),
    requireApprovedSymbol("clx_cable_1_pair")
  ]);
  const defaultModel = createDefaultDrawingModel();
  const defaultSheet = defaultModel.sheets[0];
  const model: DrawingModel = {
    ...defaultModel,
    titleBlock: {
      client: "Enermech",
      project: "Wenika Tank Automation Project",
      drawingNumber: "EI-NMT81-NRF81-001",
      revision: "A",
      preparedBy: "EI Designer",
      date: "2026-01-01"
    },
    sheets: [
      {
        ...defaultSheet,
        name: "Wiring",
        placements: [
          {
            id: placementId("NMT81"),
            symbolId: nmt81.symbolId,
            versionId: nmt81.versionId,
            role: "device",
            tag: "TT-101",
            x: 24,
            y: 36,
            rotation: 0,
            scale: 0.34
          },
          {
            id: placementId("CLX1P"),
            symbolId: cable.symbolId,
            versionId: cable.versionId,
            role: "cable_assembly",
            tag: "C-101",
            x: 110,
            y: 62,
            rotation: 0,
            scale: 0.52
          },
          {
            id: placementId("NRF81"),
            symbolId: nrf81.symbolId,
            versionId: nrf81.versionId,
            role: "device",
            tag: "TSM-101",
            x: 280,
            y: 70,
            rotation: 0,
            scale: 0.38
          }
        ],
        connections: [
          {
            id: "conn_nmt81_1_to_cable_1",
            from: { placementId: placementId("NMT81"), anchorKey: "1" },
            to: { placementId: placementId("CLX1P"), anchorKey: "CH1_T1" },
            label: "White",
            wireId: "C-101-WHT",
            cablePlacementId: placementId("CLX1P"),
            conductorKey: "CH1_T1"
          },
          {
            id: "conn_nmt81_2_to_cable_2",
            from: { placementId: placementId("NMT81"), anchorKey: "2" },
            to: { placementId: placementId("CLX1P"), anchorKey: "CH1_T2" },
            label: "Black",
            wireId: "C-101-BLK",
            cablePlacementId: placementId("CLX1P"),
            conductorKey: "CH1_T2"
          },
          {
            id: "conn_cable_1_to_nrf81_e1",
            from: { placementId: placementId("CLX1P"), anchorKey: "CH2_T1" },
            to: { placementId: placementId("NRF81"), anchorKey: "E1" },
            label: "White",
            wireId: "C-101-WHT",
            cablePlacementId: placementId("CLX1P"),
            conductorKey: "CH2_T1"
          },
          {
            id: "conn_cable_2_to_nrf81_e2",
            from: { placementId: placementId("CLX1P"), anchorKey: "CH2_T2" },
            to: { placementId: placementId("NRF81"), anchorKey: "E2" },
            label: "Black",
            wireId: "C-101-BLK",
            cablePlacementId: placementId("CLX1P"),
            conductorKey: "CH2_T2"
          }
        ],
        annotations: [
          {
            id: "note_title",
            text: "NMT81 Prothermo to NRF81 Tank Side Monitor Wiring",
            x: 126,
            y: 24,
            kind: "title"
          }
        ]
      }
    ]
  };
  const row = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_nmt81_to_nrf81_wiring_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      title: "NMT81 to NRF81 Wiring",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });

  return row.id;
}

export async function createE2eDetailedPanelDrawingPackage(): Promise<string> {
  const model: DrawingModel = {
    ...createDefaultDrawingModel(),
    assets: [
      {
        id: "asset_jb_001",
        tag: "JB001",
        type: "junction_box",
        title: "Field Junction Box"
      }
    ]
  };
  const row = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_detailed_panel_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      title: "Detailed Panel Drawing Test",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });

  return row.id;
}

export async function createE2ePanelDiscoveryPackage(): Promise<string> {
  const base = createDefaultDrawingModel();
  const fieldSheet = createDefaultDrawingSheet({
    id: "sheet_field",
    name: "JB001 Field Terminations"
  });
  const terminal = createTerminalBlockPlacement({
    model: base,
    activeSheet: fieldSheet,
    assetId: "asset_tb_101",
    tag: "TB-101",
    x: 250,
    y: 70
  });
  const cablePlacement = {
    id: "placement_cable_101",
    assetId: "asset_cable_101",
    symbolId: "fixture_cable_symbol",
    versionId: "fixture_cable_v1",
    role: "cable_assembly" as const,
    tag: "C-101",
    x: 80,
    y: 80,
    rotation: 0,
    scale: 1
  };
  const detailSheet = {
    ...createDefaultDrawingSheet({
      id: "sheet_detailed_panel",
      name: "JB001 Detailed Panel Drawing"
    }),
    description: "Detailed electrical connectivity for JB001",
    panelDrawingContext: {
      kind: "detailed_panel_wiring" as const,
      panelAssetId: "asset_jb_001"
    }
  };
  const model: DrawingModel = {
    ...base,
    assets: [
      {
        id: "asset_jb_001",
        tag: "JB001",
        type: "junction_box",
        title: "Field Junction Box"
      },
      {
        id: "asset_tb_101",
        tag: "TB-101",
        type: "terminal_block",
        title: "Terminal Strip 1",
        symbolId: terminal.symbolId,
        versionId: terminal.versionId
      },
      {
        id: "asset_cable_101",
        tag: "C-101",
        type: "cable",
        title: "Field Cable 101"
      }
    ],
    sheets: [
      {
        ...fieldSheet,
        placements: [
          cablePlacement,
          { ...terminal, containerAssetId: "asset_jb_001" }
        ],
        connections: [
          {
            id: "connection_field_tb_101_1",
            from: {
              placementId: cablePlacement.id,
              anchorKey: "CH1_T1"
            },
            to: {
              placementId: terminal.id,
              anchorKey: "T1_BOTTOM"
            },
            wireId: "C-101-P1-WHT",
            cablePlacementId: cablePlacement.id,
            conductorKey: "P1-WHT"
          }
        ]
      },
      detailSheet
    ]
  };
  const row = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_panel_discovery_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      title: "Panel Discovery Test",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });

  return row.id;
}

export async function deleteE2eDrawing(drawingId: string | undefined) {
  if (!drawingId) {
    return;
  }

  await prisma.drawing.deleteMany({
    where: { id: drawingId }
  });
}
