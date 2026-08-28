import { prisma } from "../../src/lib/prisma";
import {
  createDefaultDrawingSheet,
  createDefaultDrawingModel,
  drawingPackageModelSchema,
  parseDrawingModelJson,
  stringifyDrawingModel,
  type DrawingModel
} from "../../src/features/drawing_canvas/data/schema";
import { createTerminalBlockPlacement } from "../../src/features/drawing_canvas/logic/services/drawing-terminal-blocks";
import { createPanelEnclosurePlacement } from "../../src/features/drawing_canvas/logic/services/drawing-asset-containment";
import { createBackplanePlacement } from "../../src/features/drawing_canvas/logic/services/drawing-backplane-layouts";
import {
  GENERATED_WIRE_TRAY_SYMBOL_ID,
  GENERATED_WIRE_TRAY_VERSION_ID,
  WIRE_TRAY_LABEL
} from "../../src/features/drawing_canvas/logic/services/drawing-wire-tray-layouts";
import { stringifyMetadata } from "../../src/features/symbol_registry/data/schema";

type FixtureSymbol = {
  symbolId: string;
  versionId: string;
};

function placementId(value: string): string {
  return value.replace(/[^a-z0-9_]+/gi, "_").toLowerCase();
}

async function requireE2eSymbolCategoryId(): Promise<string> {
  const category = await prisma.symbolCategory.findUnique({
    where: { normalizedName: "other" },
    select: { id: true }
  });
  if (!category) {
    throw new Error("The managed Other symbol category is unavailable.");
  }
  return category.id;
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

export async function createE2eConnectedWireScheduleDrawing(): Promise<{
  drawingId: string;
  symbolId: string;
  sourcePlacementId: string;
}> {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const symbolKey = `e2e_connected_wire_schedule_${unique}`;
  const categoryId = await requireE2eSymbolCategoryId();
  const symbol = await prisma.symbol.create({
    data: {
      symbolKey,
      displayName: `E2E Schedule Device ${unique}`,
      category: "other",
      categoryId,
      status: "approved",
      versions: {
        create: {
          versionNumber: 1,
          status: "approved",
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 50"><rect x=".5" y=".5" width="29" height="49" fill="white" stroke="#334155"/><circle cx="28" cy="12" r="1.5" fill="none" stroke="#0f766e"/><circle cx="28" cy="25" r="1.5" fill="none" stroke="#0f766e"/><circle cx="28" cy="38" r="1.5" fill="none" stroke="#0f766e"/></svg>',
          metadataJson: stringifyMetadata({
            symbolKey,
            displayName: `E2E Schedule Device ${unique}`,
            category: "other",
            layoutUsage: "both",
            physicalWidthMm: 30,
            physicalHeightMm: 50,
            viewBox: { x: 0, y: 0, width: 30, height: 50 },
            anchors: [
              { key: "T1", x: 28, y: 12, kind: "terminal" },
              { key: "T2", x: 28, y: 25, kind: "terminal" },
              { key: "T3", x: 28, y: 38, kind: "terminal" }
            ],
            terminals: ["T1", "T2", "T3"].map((key) => ({
              key,
              label: key,
              anchorKey: key,
              requiredForWiring: true
            }))
          })
        }
      }
    },
    select: {
      id: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { id: true }
      }
    }
  });
  const version = symbol.versions[0];
  if (!version) throw new Error("E2E schedule symbol has no approved version.");

  const sourcePlacementId = `schedule_source_${unique}`;
  const model = createDefaultDrawingModel();
  model.assets = [
    {
      id: "asset_mcb_101",
      tag: "MCB-101",
      type: "breaker",
      title: "Main breaker",
      symbolId: symbol.id,
      versionId: version.id
    },
    ...[1, 2, 3].map((number) => ({
      id: `asset_load_${number}`,
      tag: `LOAD-${number}01`,
      type: "other" as const,
      title: `Load ${number}`,
      symbolId: symbol.id,
      versionId: version.id
    }))
  ];
  model.sheets[0] = {
    ...model.sheets[0],
    name: "Connected Wire Schedule",
    placements: [
      {
        id: sourcePlacementId,
        assetId: "asset_mcb_101",
        symbolId: symbol.id,
        versionId: version.id,
        role: "device",
        tag: "MCB-101",
        title: "Main breaker",
        x: 45,
        y: 75,
        rotation: 0,
        scale: 1
      },
      ...[1, 2, 3].map((number) => ({
        id: `schedule_load_${number}_${unique}`,
        assetId: `asset_load_${number}`,
        symbolId: symbol.id,
        versionId: version.id,
        role: "device" as const,
        tag: `LOAD-${number}01`,
        title: `Load ${number}`,
        x: 315,
        y: 50 + number * 55,
        rotation: 0,
        scale: 0.7
      }))
    ],
    connections: [1, 2, 3].map((number) => ({
      id: `schedule_connection_${number}_${unique}`,
      from: { placementId: sourcePlacementId, anchorKey: `T${number}` },
      to: {
        placementId: `schedule_load_${number}_${unique}`,
        anchorKey: "T1"
      },
      wireId: `FW-${number.toString().padStart(3, "0")}`,
      cableTag: `CBL-${number.toString().padStart(3, "0")}`,
      conductorKey: `${number}`,
      label: `Feeder ${number}`
    })),
    annotations: []
  };
  const row = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_connected_wire_schedule_${unique}`,
      title: "Connected Wire Schedule E2E",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });

  return { drawingId: row.id, symbolId: symbol.id, sourcePlacementId };
}

export async function createE2ePaginatedConnectedWireScheduleDrawing(): Promise<{
  drawingId: string;
}> {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const panelAssetId = `asset_panel_${unique}`;
  const sourceAssetId = `asset_pdb_${unique}`;
  const targetAssetId = `asset_load_${unique}`;
  const detailSheet = createDefaultDrawingSheet({
    id: `sheet_detail_${unique}`,
    name: "PDB-101 Wiring"
  });
  const fieldSheet = createDefaultDrawingSheet({
    id: `sheet_field_${unique}`,
    name: "PDB-101 Distribution Wiring"
  });
  const base = createDefaultDrawingModel();
  const source = createTerminalBlockPlacement({
    model: base,
    activeSheet: fieldSheet,
    assetId: sourceAssetId,
    tag: "PDB-101",
    x: 40,
    y: 45,
    terminalBlock: { count: 25 }
  });
  const target = createTerminalBlockPlacement({
    model: base,
    activeSheet: fieldSheet,
    assetId: targetAssetId,
    tag: "LOAD-101",
    x: 230,
    y: 45,
    terminalBlock: { count: 25 }
  });
  const detailOccurrence = {
    ...source,
    id: `detail_pdb_${unique}`,
    x: 35,
    y: 70,
    containerAssetId: panelAssetId,
    connectionDisplayMode: "all_connected" as const
  };
  const scheduleId = `schedule_${unique}`;
  const model = drawingPackageModelSchema.parse({
    ...base,
    assets: [
      {
        id: panelAssetId,
        tag: "PLC-001",
        type: "panel",
        title: "PLC Panel"
      },
      {
        id: sourceAssetId,
        tag: "PDB-101",
        type: "terminal_block",
        title: "110 VAC Distribution Block",
        symbolId: source.symbolId,
        versionId: source.versionId,
        terminalBlock: source.terminalBlock
      },
      {
        id: targetAssetId,
        tag: "LOAD-101",
        type: "terminal_block",
        title: "Distribution Loads",
        symbolId: target.symbolId,
        versionId: target.versionId,
        terminalBlock: target.terminalBlock
      }
    ],
    sheets: [
      {
        ...detailSheet,
        description: "Detailed wiring for PDB-101",
        panelDrawingContext: {
          kind: "detailed_panel_wiring",
          panelAssetId
        },
        placements: [detailOccurrence],
        annotations: [
          {
            id: scheduleId,
            kind: "connected_wire_schedule",
            x: 165,
            y: 20,
            width: 235,
            schedule: {
              assetId: sourceAssetId,
              sourcePlacementId: detailOccurrence.id,
              scope: "all_connected"
            }
          }
        ]
      },
      {
        ...fieldSheet,
        placements: [
          { ...source, containerAssetId: panelAssetId },
          { ...target, containerAssetId: panelAssetId }
        ],
        connections: Array.from({ length: 25 }, (_, index) => ({
          id: `field_wire_${index + 1}_${unique}`,
          from: {
            placementId: source.id,
            anchorKey: `T${index + 1}_BOTTOM`
          },
          to: {
            placementId: target.id,
            anchorKey: `T${index + 1}_BOTTOM`
          },
          wireId: `FW-${String(index + 1).padStart(3, "0")}`,
          label: `Distribution feeder ${index + 1}`
        }))
      }
    ]
  });
  const row = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_paginated_wire_schedule_${unique}`,
      title: "Paginated Connected Wire Schedule E2E",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });

  return { drawingId: row.id };
}

export async function createE2eWireHitTestingDrawing(): Promise<{
  drawingId: string;
  symbolId: string;
  innerConnectionId: string;
  outerConnectionId: string;
}> {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const symbolKey = `e2e_wire_hit_target_${unique}`;
  const categoryId = await requireE2eSymbolCategoryId();
  const symbol = await prisma.symbol.create({
    data: {
      symbolKey,
      displayName: `E2E Wire Hit Target ${unique}`,
      category: "other",
      categoryId,
      status: "approved",
      versions: {
        create: {
          versionNumber: 1,
          status: "approved",
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="white" stroke="#334155"/><circle cx="5" cy="5" r="1.5" fill="none" stroke="#0f766e"/></svg>',
          metadataJson: stringifyMetadata({
            symbolKey,
            displayName: `E2E Wire Hit Target ${unique}`,
            category: "other",
            layoutUsage: "wiring",
            viewBox: { x: 0, y: 0, width: 10, height: 10 },
            anchors: [{ key: "T", x: 5, y: 5, kind: "terminal" }],
            terminals: [
              {
                key: "T",
                label: "Terminal",
                anchorKey: "T",
                requiredForWiring: true
              }
            ]
          })
        }
      }
    },
    select: {
      id: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { id: true }
      }
    }
  });
  const version = symbol.versions[0];

  if (!version) {
    throw new Error("The E2E wire hit target symbol has no approved version.");
  }

  const innerConnectionId = `connection_inner_${unique}`;
  const outerConnectionId = `connection_outer_${unique}`;
  const placement = (id: string, tag: string, x: number, y: number) => ({
    id,
    symbolId: symbol.id,
    versionId: version.id,
    role: "device" as const,
    tag,
    x,
    y,
    rotation: 0,
    scale: 1
  });
  const model = drawingPackageModelSchema.parse({
    ...createDefaultDrawingModel(),
    sheets: [
      {
        ...createDefaultDrawingModel().sheets[0],
        name: "Nested Wire Hit Testing",
        placements: [
          placement(`placement_outer_source_${unique}`, "OS-101", 40, 40),
          placement(`placement_outer_target_${unique}`, "OT-101", 340, 40),
          placement(`placement_inner_source_${unique}`, "IS-101", 100, 120),
          placement(`placement_inner_target_${unique}`, "IT-101", 280, 120)
        ],
        connections: [
          {
            id: innerConnectionId,
            from: {
              placementId: `placement_inner_source_${unique}`,
              anchorKey: "T"
            },
            to: {
              placementId: `placement_inner_target_${unique}`,
              anchorKey: "T"
            },
            wireId: "INNER-001",
            route: {
              mode: "manual",
              style: "orthogonal",
              points: [
                { id: `${innerConnectionId}_from`, x: 105, y: 125, kind: "endpoint" },
                { id: `${innerConnectionId}_to`, x: 285, y: 125, kind: "endpoint" }
              ]
            }
          },
          {
            id: outerConnectionId,
            from: {
              placementId: `placement_outer_source_${unique}`,
              anchorKey: "T"
            },
            to: {
              placementId: `placement_outer_target_${unique}`,
              anchorKey: "T"
            },
            wireId: "OUTER-001",
            route: {
              mode: "manual",
              style: "orthogonal",
              points: [
                { id: `${outerConnectionId}_from`, x: 45, y: 45, kind: "endpoint" },
                { id: `${outerConnectionId}_left_top`, x: 30, y: 45, kind: "control" },
                { id: `${outerConnectionId}_left_bottom`, x: 30, y: 220, kind: "control" },
                { id: `${outerConnectionId}_right_bottom`, x: 360, y: 220, kind: "control" },
                { id: `${outerConnectionId}_right_top`, x: 360, y: 45, kind: "control" },
                { id: `${outerConnectionId}_to`, x: 345, y: 45, kind: "endpoint" }
              ]
            }
          }
        ]
      }
    ]
  });
  const drawing = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_wire_hit_testing_${unique}`,
      title: "Wire Stroke Hit Testing",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });

  return {
    drawingId: drawing.id,
    symbolId: symbol.id,
    innerConnectionId,
    outerConnectionId
  };
}

export async function createE2ePlacementLabelDrawing(): Promise<{
  drawingId: string;
  symbolId: string;
  placements: Array<{
    id: string;
    bounds: { left: number; top: number; right: number; bottom: number };
  }>;
}> {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const symbolKey = `e2e_placement_label_target_${unique}`;
  const categoryId = await requireE2eSymbolCategoryId();
  const symbol = await prisma.symbol.create({
    data: {
      symbolKey,
      displayName: `E2E Placement Label Target ${unique}`,
      category: "other",
      categoryId,
      status: "approved",
      versions: {
        create: {
          versionNumber: 1,
          status: "approved",
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><rect x="1" y="1" width="98" height="78" fill="white" stroke="#334155"/></svg>',
          metadataJson: stringifyMetadata({
            symbolKey,
            displayName: `E2E Placement Label Target ${unique}`,
            category: "other",
            layoutUsage: "both",
            viewBox: { x: 0, y: 0, width: 100, height: 80 },
            anchors: [],
            terminals: []
          })
        }
      }
    },
    select: {
      id: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { id: true }
      }
    }
  });
  const version = symbol.versions[0];

  if (!version) {
    throw new Error("The E2E placement-label symbol has no approved version.");
  }

  const smallPlacementId = `placement_label_small_${unique}`;
  const largePlacementId = `placement_label_large_${unique}`;
  const model = drawingPackageModelSchema.parse({
    ...createDefaultDrawingModel(),
    sheets: [
      {
        ...createDefaultDrawingModel().sheets[0],
        name: "Placement Label Clearance",
        placements: [
          {
            id: smallPlacementId,
            symbolId: symbol.id,
            versionId: version.id,
            role: "device",
            tag: "PDB-101",
            title: "Small Distribution Block",
            x: 40,
            y: 80,
            rotation: 0,
            scale: 1,
            layoutDimensions: { lengthMm: 20, widthMm: 50 }
          },
          {
            id: largePlacementId,
            symbolId: symbol.id,
            versionId: version.id,
            role: "device",
            tag: "PLC-101",
            title: "Large Controller",
            x: 150,
            y: 110,
            rotation: 0,
            scale: 1,
            layoutDimensions: { lengthMm: 150, widthMm: 100 }
          }
        ],
        connections: [],
        annotations: []
      }
    ]
  });
  const drawing = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_placement_label_clearance_${unique}`,
      title: "Placement Label Clearance",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });

  return {
    drawingId: drawing.id,
    symbolId: symbol.id,
    placements: [
      {
        id: smallPlacementId,
        bounds: { left: 40, top: 80, right: 60, bottom: 130 }
      },
      {
        id: largePlacementId,
        bounds: { left: 150, top: 110, right: 300, bottom: 210 }
      }
    ]
  };
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
  const layoutSheet = createDefaultDrawingSheet({
    id: "sheet_panel_layout",
    name: "JB001 Panel Layout"
  });
  const panelPlacement = createPanelEnclosurePlacement({
    model: base,
    activeSheet: layoutSheet,
    assetId: "asset_jb_001",
    tag: "JB001",
    title: "Field Junction Box",
    x: 30,
    y: 30
  });
  const backplane = {
    ...createBackplanePlacement({
      panelPlacement,
      id: "backplane_jb_001"
    }),
    layoutDimensions: { lengthMm: 300, widthMm: 200 }
  };
  const layoutTerminal = {
    ...terminal,
    id: "layout_terminal_tb_101",
    containerAssetId: "asset_jb_001",
    layoutKind: "layout_helper" as const,
    layoutParentId: backplane.id,
    layoutPosition: { xMm: 30, yMm: 40 },
    layoutDimensions: { lengthMm: 26, widthMm: 50 },
    x: backplane.x + 15,
    y: backplane.y + 20
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
          },
          {
            id: "connection_field_tb_101_unmapped",
            from: {
              placementId: cablePlacement.id,
              anchorKey: "CH2_T1"
            },
            to: {
              placementId: terminal.id,
              anchorKey: "FIELD_TERMINAL_UNRESOLVED"
            },
            wireId: "C-101-P2-BLK",
            cablePlacementId: cablePlacement.id,
            conductorKey: "P2-BLK"
          }
        ]
      },
      detailSheet,
      {
        ...layoutSheet,
        placements: [panelPlacement, backplane, layoutTerminal]
      }
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

export async function createE2ePanelQualityPackage(): Promise<string> {
  const drawingId = await createE2ePanelDiscoveryPackage();
  const row = await prisma.drawing.findUniqueOrThrow({
    where: { id: drawingId },
    select: { modelJson: true }
  });
  const model = parseDrawingModelJson(row.modelJson);
  const nextModel: DrawingModel = {
    ...model,
    sheets: model.sheets.map((sheet) =>
      sheet.id === "sheet_detailed_panel"
        ? {
            ...sheet,
            connections: [
              ...sheet.connections,
              {
                id: "connection_orphan_panel_review",
                from: {
                  placementId: "missing_review_source",
                  anchorKey: "T1"
                },
                to: {
                  placementId: "missing_review_target",
                  anchorKey: "T2"
                },
                panelConnectionId: "missing_internal_wire_review"
              }
            ]
          }
        : sheet
    )
  };
  await prisma.drawing.update({
    where: { id: drawingId },
    data: { modelJson: stringifyDrawingModel(nextModel) }
  });
  return drawingId;
}

export async function createE2eGenericPanelReleasePackage(): Promise<string> {
  const base = createDefaultDrawingModel();
  const fieldSheet = createDefaultDrawingSheet({
    id: "sheet_mcp_201_field",
    name: "MCP-201 Field Terminations"
  });
  const stripCounts = [8, 12, 4];
  const strips = stripCounts.map((count, index) =>
    createTerminalBlockPlacement({
      model: base,
      activeSheet: fieldSheet,
      assetId: `asset_mcp_201_xt_${index + 1}`,
      tag: `MCP201-XT${index + 1}`,
      x: 180 + index * 55,
      y: 65,
      terminalBlock: { count, startNumber: 1, orientation: "horizontal" }
    })
  );
  const cablePlacement = {
    id: "placement_mcp_201_cable",
    assetId: "asset_mcp_201_cable",
    symbolId: "fixture_cable_symbol",
    versionId: "fixture_cable_v1",
    role: "cable_assembly" as const,
    tag: "MCP201-CBL01",
    x: 65,
    y: 75,
    rotation: 0,
    scale: 1
  };
  const detailedSheet = {
    ...createDefaultDrawingSheet({
      id: "sheet_mcp_201_detailed",
      name: "MCP-201 Detailed Panel Drawing"
    }),
    panelDrawingContext: {
      kind: "detailed_panel_wiring" as const,
      panelAssetId: "asset_mcp_201"
    }
  };
  const model: DrawingModel = {
    ...base,
    assets: [
      {
        id: "asset_mcp_201",
        tag: "MCP-201",
        type: "panel",
        title: "Motor Control Panel 201"
      },
      ...strips.map((strip, index) => ({
        id: strip.assetId!,
        tag: strip.tag,
        type: "terminal_block" as const,
        title: `${stripCounts[index]}-way Terminal Strip`,
        symbolId: strip.symbolId,
        versionId: strip.versionId
      })),
      {
        id: cablePlacement.assetId,
        tag: cablePlacement.tag,
        type: "cable",
        title: "MCP-201 Field Cable"
      }
    ],
    sheets: [
      {
        ...fieldSheet,
        placements: [
          cablePlacement,
          ...strips.map((strip) => ({
            ...strip,
            containerAssetId: "asset_mcp_201"
          }))
        ],
        connections: strips.map((strip, index) => ({
          id: `connection_mcp_201_${index + 1}`,
          from: {
            placementId: cablePlacement.id,
            anchorKey: `CH${index + 1}`
          },
          to: { placementId: strip.id, anchorKey: "T1_BOTTOM" },
          wireId: `MCP201-FW${index + 1}`,
          cablePlacementId: cablePlacement.id,
          conductorKey: `C${index + 1}`
        }))
      },
      detailedSheet
    ]
  };
  const row = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_mcp_201_release_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      title: "MCP-201 Generic Panel Release",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });
  return row.id;
}

export async function createE2ePanelComponentPackage(): Promise<{
  drawingId: string;
  symbolId: string;
  symbolName: string;
}> {
  const drawingId = await createE2ePanelDiscoveryPackage();
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const symbolName = `E2E Panel Breaker ${unique}`;
  const categoryId = await requireE2eSymbolCategoryId();
  const symbol = await prisma.symbol.create({
    data: {
      symbolKey: `e2e_panel_breaker_${unique}`,
      displayName: symbolName,
      category: "terminal_block",
      categoryId,
      status: "approved",
      versions: {
        create: {
          versionNumber: 1,
          status: "approved",
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80"><rect x="8" y="8" width="44" height="64" fill="white" stroke="#334155"/><line x1="30" y1="8" x2="30" y2="72" stroke="#334155"/></svg>',
          metadataJson: stringifyMetadata({
            symbolKey: `e2e_panel_breaker_${unique}`,
            displayName: symbolName,
            category: "terminal_block",
            viewBox: { x: 0, y: 0, width: 60, height: 80 },
            anchors: [
              { key: "LINE", x: 30, y: 8, kind: "terminal" },
              { key: "LOAD", x: 30, y: 72, kind: "terminal" }
            ],
            terminals: [
              {
                key: "L",
                label: "Line",
                anchorKey: "LINE",
                panelSide: "single",
                requiredForWiring: true
              },
              {
                key: "T",
                label: "Load",
                anchorKey: "LOAD",
                panelSide: "single",
                requiredForWiring: true
              }
            ],
            panelWiring: {
              assetType: "breaker",
              tagPrefix: "MCB",
              schematicScale: 0.45
            }
          })
        }
      }
    },
    select: {
      id: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { id: true }
      }
    }
  });

  const version = symbol.versions[0];

  if (!version) {
    throw new Error("The E2E panel breaker symbol has no approved version.");
  }

  const drawing = await prisma.drawing.findUniqueOrThrow({
    where: { id: drawingId },
    select: { modelJson: true }
  });
  const model = parseDrawingModelJson(drawing.modelJson);
  const breakerAssetId = `asset_mcb_101_${unique}`;
  const panelLayoutSheet = createDefaultDrawingSheet({
    id: `sheet_panel_layout_${unique}`,
    name: "JB001 Panel Layout Drawing"
  });
  const nextModel: DrawingModel = {
    ...model,
    assets: [
      ...model.assets,
      {
        id: breakerAssetId,
        tag: "MCB-101",
        type: "breaker",
        title: "Main Circuit Breaker",
        symbolId: symbol.id,
        versionId: version.id
      }
    ],
    sheets: [
      ...model.sheets,
      {
        ...panelLayoutSheet,
        placements: [
          {
            id: `placement_mcb_101_${unique}`,
            assetId: breakerAssetId,
            containerAssetId: "asset_jb_001",
            symbolId: symbol.id,
            versionId: version.id,
            role: "device",
            tag: "MCB-101",
            title: "Main Circuit Breaker",
            x: 120,
            y: 70,
            rotation: 0,
            scale: 0.45
          }
        ]
      }
    ]
  };

  await prisma.drawing.update({
    where: { id: drawingId },
    data: { modelJson: stringifyDrawingModel(nextModel) }
  });

  return { drawingId, symbolId: symbol.id, symbolName };
}

export async function createE2eSectionedDrawingPackage(): Promise<string> {
  const defaultModel = createDefaultDrawingModel();
  const makeSheet = (id: string, name: string) =>
    createDefaultDrawingSheet({ id, name });
  const model: DrawingModel = {
    ...defaultModel,
    sheets: [
      makeSheet("sheet_cover", "Package Cover"),
      {
        ...makeSheet("sheet_field_title", "Field Drawings"),
        kind: "section_title",
        description: "Field instrumentation and terminations",
        sectionTitlePage: {
          title: "Field Drawings",
          subtitle: "Field instrumentation and terminations",
          sectionNumber: "99"
        }
      },
      makeSheet("sheet_field_1", "Field Loop 1"),
      makeSheet("sheet_field_2", "Field Loop 2"),
      {
        ...makeSheet("sheet_panel_title", "Panel Drawings"),
        kind: "section_title",
        description: "Panel details and layouts",
        sectionTitlePage: {
          title: "Panel Drawings",
          subtitle: "Panel details and layouts",
          sectionNumber: "99"
        }
      },
      makeSheet("sheet_panel_1", "Panel Layout 1")
    ]
  };
  const row = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_sections_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      title: "Drawing Package Sections E2E",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });

  return row.id;
}

export async function createE2eTerminalBlockGroupPackage(): Promise<{
  drawingId: string;
  symbolId: string;
  endBracketSymbolId: string;
}> {
  await prisma.symbol.deleteMany({
    where: { symbolKey: { startsWith: "e2e_terminal_group_module_" } }
  });
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const symbolKey = `e2e_terminal_group_module_${unique}`;
  const categoryId = await requireE2eSymbolCategoryId();
  const symbol = await prisma.symbol.create({
    data: {
      symbolKey,
      displayName: "E2E Feed-through Terminal Module",
      category: "terminal_block",
      categoryId,
      status: "approved",
      versions: {
        create: {
          versionNumber: 1,
          status: "approved",
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 178"><rect x="0.25" y="0.25" width="19.5" height="177.5" fill="white" stroke="#334155"/><circle cx="10" cy="50" r="5" fill="none" stroke="#334155"/><circle cx="10" cy="128" r="5" fill="none" stroke="#334155"/></svg>',
          metadataJson: stringifyMetadata({
            symbolKey,
            displayName: "E2E Feed-through Terminal Module",
            category: "terminal_block",
            layoutUsage: "both",
            panelCategory: "termination",
            mountingType: "din_rail",
            physicalWidthMm: 5.2,
            physicalHeightMm: 50,
            terminalBlockModule: {
              kind: "feed_through",
              defaultForGeneratedGroups: true
            },
            terminalStripCapability: {
              role: "electrical",
              railDatumMm: 25,
              defaultForNewStrips: true
            },
            viewBox: { x: 0, y: 0, width: 20, height: 178 },
            anchors: [
              { key: "left", x: 1, y: 89, kind: "terminal" },
              { key: "right", x: 19, y: 89, kind: "terminal" }
            ],
            terminals: [
              {
                key: "1",
                label: "1",
                anchorKey: "left",
                panelSide: "external",
                requiredForWiring: true
              },
              {
                key: "2",
                label: "2",
                anchorKey: "right",
                panelSide: "internal",
                requiredForWiring: true
              }
            ]
          })
        }
      }
    },
    select: { id: true }
  });
  const endBracket = await prisma.symbol.create({
    data: {
      symbolKey: `e2e_terminal_group_bracket_${unique}`,
      displayName: "E2E DIN Rail End Bracket",
      category: "terminal_block",
      categoryId,
      status: "approved",
      versions: {
        create: {
          versionNumber: 1,
          status: "approved",
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 131"><rect x="0.25" y="0.25" width="19.5" height="130.5" fill="#e2e8f0" stroke="#334155"/></svg>',
          metadataJson: stringifyMetadata({
            symbolKey: `e2e_terminal_group_bracket_${unique}`,
            displayName: "E2E DIN Rail End Bracket",
            category: "terminal_block",
            layoutUsage: "panel_layout",
            mountingType: "din_rail",
            physicalWidthMm: 8,
            physicalHeightMm: 52.4,
            terminalStripCapability: {
              role: "end_bracket",
              railDatumMm: 26.2,
              defaultForNewStrips: true
            },
            viewBox: { x: 0, y: 0, width: 20, height: 131 },
            anchors: [],
            terminals: []
          })
        }
      }
    },
    select: { id: true }
  });
  const base = createDefaultDrawingModel();
  const panel = {
    ...createPanelEnclosurePlacement({
      model: base,
      activeSheet: base.sheets[0],
      assetId: `asset_panel_${unique}`,
      tag: "JB001",
      title: "Terminal Group Test Panel",
      x: 30,
      y: 30
    }),
    id: `panel_${unique}`
  };
  const backplane = {
    ...createBackplanePlacement({
      panelPlacement: panel,
      id: `backplane_${unique}`
    }),
    layoutDimensions: { lengthMm: 300, widthMm: 200 }
  };
  const detailedSheet = {
    ...createDefaultDrawingSheet({
      id: `sheet_terminal_detail_${unique}`,
      name: "JB001 Detailed Panel Drawing"
    }),
    panelDrawingContext: {
      kind: "detailed_panel_wiring" as const,
      panelAssetId: panel.assetId
    }
  };
  const reuseSheet = createDefaultDrawingSheet({
    id: `sheet_terminal_reuse_${unique}`,
    name: "Terminal Strip Reuse Drawing"
  });
  const targetSheet = createDefaultDrawingSheet({
    id: `sheet_terminal_target_${unique}`,
    name: "PLC001 Panel Layout Drawing"
  });
  const targetPanel = {
    ...createPanelEnclosurePlacement({
      model: base,
      activeSheet: targetSheet,
      assetId: `asset_target_panel_${unique}`,
      tag: "PLC001",
      title: "Target PLC Panel",
      x: 30,
      y: 30
    }),
    id: `target_panel_${unique}`
  };
  const targetBackplane = {
    ...createBackplanePlacement({
      panelPlacement: targetPanel,
      id: `target_backplane_${unique}`
    }),
    layoutDimensions: { lengthMm: 300, widthMm: 200 }
  };
  const model = drawingPackageModelSchema.parse({
    ...base,
    assets: [
      {
        id: panel.assetId,
        tag: panel.tag,
        type: "junction_box",
        title: "Terminal Group Test Panel"
      },
      {
        id: targetPanel.assetId,
        tag: targetPanel.tag,
        type: "panel",
        title: "Target PLC Panel"
      }
    ],
    sheets: [
      {
        ...base.sheets[0],
        name: "JB001 Panel Layout Drawing",
        placements: [panel, backplane]
      },
      detailedSheet,
      reuseSheet,
      {
        ...targetSheet,
        placements: [targetPanel, targetBackplane]
      }
    ]
  });
  const drawing = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_terminal_group_${unique}`,
      title: "Terminal Block Group Test",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });

  return {
    drawingId: drawing.id,
    symbolId: symbol.id,
    endBracketSymbolId: endBracket.id
  };
}

export async function addE2eCablePlacementToDrawing({
  drawingId,
  sheetName
}: {
  drawingId: string;
  sheetName: string;
}): Promise<{ placementId: string }> {
  const cable = await requireApprovedSymbol("clx_cable_1_pair");
  const row = await prisma.drawing.findUniqueOrThrow({
    where: { id: drawingId },
    select: { modelJson: true }
  });
  const model = parseDrawingModelJson(row.modelJson);
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const assetId = `asset_connection_cable_${unique}`;
  const placementId = `placement_connection_cable_${unique}`;
  const nextModel = drawingPackageModelSchema.parse({
    ...model,
    assets: [
      ...model.assets,
      {
        id: assetId,
        tag: "C-101",
        type: "cable",
        title: "Connection Test Cable",
        symbolId: cable.symbolId,
        versionId: cable.versionId
      }
    ],
    sheets: model.sheets.map((sheet) =>
      sheet.name === sheetName
        ? {
            ...sheet,
            placements: [
              ...sheet.placements,
              {
                id: placementId,
                assetId,
                symbolId: cable.symbolId,
                versionId: cable.versionId,
                role: "cable_assembly",
                tag: "C-101",
                title: "Connection Test Cable",
                x: 250,
                y: 100,
                rotation: 0,
                scale: 0.45
              }
            ]
          }
        : sheet
    )
  });

  await prisma.drawing.update({
    where: { id: drawingId },
    data: { modelJson: stringifyDrawingModel(nextModel) }
  });

  return { placementId };
}

export async function createE2eWireTrayResizePackage(): Promise<{
  drawingId: string;
  trayId: string;
}> {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const base = createDefaultDrawingModel();
  const panel = {
    ...createPanelEnclosurePlacement({
      model: base,
      activeSheet: base.sheets[0],
      assetId: `asset_tray_panel_${unique}`,
      tag: "JB001",
      title: "Wire Tray Resize Test Panel",
      x: 30,
      y: 30
    }),
    id: `tray_panel_${unique}`
  };
  const backplane = {
    ...createBackplanePlacement({
      panelPlacement: panel,
      id: `tray_backplane_${unique}`
    }),
    layoutDimensions: { lengthMm: 300, widthMm: 200 }
  };
  const trayId = `wire_tray_${unique}`;
  const tray = {
    id: trayId,
    symbolId: GENERATED_WIRE_TRAY_SYMBOL_ID,
    versionId: GENERATED_WIRE_TRAY_VERSION_ID,
    role: "other" as const,
    tag: WIRE_TRAY_LABEL,
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    layoutKind: "layout_helper" as const,
    layoutParentId: backplane.id,
    containerAssetId: panel.assetId,
    layoutPosition: {
      xMm: 40,
      yMm: 55
    },
    layoutDimensions: {
      lengthMm: 150,
      widthMm: 30
    }
  };
  const model = drawingPackageModelSchema.parse({
    ...base,
    assets: [
      {
        id: panel.assetId,
        tag: panel.tag,
        type: "junction_box",
        title: "Wire Tray Resize Test Panel"
      }
    ],
    sheets: [
      {
        ...base.sheets[0],
        name: "JB001 Panel Layout Drawing",
        placements: [panel, backplane, tray]
      }
    ]
  });
  const drawing = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_wire_tray_resize_${unique}`,
      title: "Wire Tray Length Resize Test",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });

  return { drawingId: drawing.id, trayId };
}

export async function createE2eDinRailResizePackage(): Promise<{
  drawingId: string;
  railId: string;
  symbolId: string;
}> {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const symbolKey = `e2e_din_rail_${unique}`;
  const categoryId = await requireE2eSymbolCategoryId();
  const symbol = await prisma.symbol.create({
    data: {
      symbolKey,
      displayName: "E2E Standard TH35 DIN Rail",
      category: "terminal_block",
      categoryId,
      status: "approved",
      versions: {
        create: {
          versionNumber: 1,
          status: "approved",
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 35"><rect x="0.5" y="0.5" width="299" height="34" fill="#f8fafc" stroke="#475569"/><path d="M20 17.5h260" stroke="#94a3b8" stroke-dasharray="8 6"/></svg>',
          metadataJson: stringifyMetadata({
            symbolKey,
            displayName: "E2E Standard TH35 DIN Rail",
            category: "terminal_block",
            layoutUsage: "panel_layout",
            panelCategory: "rail",
            mountingType: "backplate",
            resizable: true,
            physicalWidthMm: 300,
            physicalHeightMm: 35,
            viewBox: { x: 0, y: 0, width: 300, height: 35 },
            anchors: [],
            terminals: []
          })
        }
      }
    },
    select: {
      id: true,
      versions: {
        select: { id: true },
        take: 1
      }
    }
  });
  const version = symbol.versions[0];

  if (!version) {
    throw new Error("Expected the E2E DIN rail version to be created.");
  }

  const base = createDefaultDrawingModel();
  const panel = {
    ...createPanelEnclosurePlacement({
      model: base,
      activeSheet: base.sheets[0],
      assetId: `asset_rail_panel_${unique}`,
      tag: "JB001",
      title: "DIN Rail Resize Test Panel",
      x: 30,
      y: 30
    }),
    id: `rail_panel_${unique}`
  };
  const backplane = {
    ...createBackplanePlacement({
      panelPlacement: panel,
      id: `rail_backplane_${unique}`
    }),
    layoutDimensions: { lengthMm: 300, widthMm: 200 }
  };
  const railId = `din_rail_${unique}`;
  const rail = {
    id: railId,
    symbolId: symbol.id,
    versionId: version.id,
    role: "other" as const,
    tag: "DIN Rail",
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    layoutKind: "layout_helper" as const,
    layoutParentId: backplane.id,
    containerAssetId: panel.assetId,
    layoutPosition: {
      xMm: 35,
      yMm: 60
    },
    layoutDimensions: {
      lengthMm: 170,
      widthMm: 35
    }
  };
  const model = drawingPackageModelSchema.parse({
    ...base,
    assets: [
      {
        id: panel.assetId,
        tag: panel.tag,
        type: "junction_box",
        title: "DIN Rail Resize Test Panel"
      }
    ],
    sheets: [
      {
        ...base.sheets[0],
        name: "JB001 Panel Layout Drawing",
        placements: [panel, backplane, rail]
      }
    ]
  });
  const drawing = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_din_rail_resize_${unique}`,
      title: "DIN Rail Length Resize Test",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });

  return { drawingId: drawing.id, railId, symbolId: symbol.id };
}

export async function deleteE2eSymbol(symbolId: string | undefined) {
  if (!symbolId) {
    return;
  }
  await prisma.symbol.deleteMany({ where: { id: symbolId } });
}

export async function createE2eSelectionArrangementDrawing(): Promise<{
  drawingId: string;
  placementIds: string[];
}> {
  const equipment = await requireApprovedSymbol(
    "nmt81_average_temperature_probe"
  );
  const base = createDefaultDrawingModel();
  const placementIds = ["arrange_1", "arrange_2", "arrange_3", "arrange_4"];
  const positions = [
    { x: 30, y: 58 },
    { x: 105, y: 42 },
    { x: 205, y: 66 },
    { x: 320, y: 50 }
  ];
  const assets = placementIds.map((id, index) => ({
    id: `asset_${id}`,
    tag: `TT-${index + 101}`,
    type: "instrument" as const,
    title: `Arrangement Instrument ${index + 1}`,
    symbolId: equipment.symbolId,
    versionId: equipment.versionId
  }));
  const model: DrawingModel = drawingPackageModelSchema.parse({
    ...base,
    assets,
    sheets: [
      {
        ...base.sheets[0],
        name: "Arrangement",
        placements: placementIds.map((id, index) => ({
          id,
          assetId: assets[index].id,
          symbolId: equipment.symbolId,
          versionId: equipment.versionId,
          role: "device" as const,
          tag: assets[index].tag,
          title: assets[index].title,
          x: positions[index].x,
          y: positions[index].y,
          rotation: 0,
          scale: 0.24
        }))
      }
    ]
  });
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const drawing = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_selection_arrangement_${unique}`,
      title: "Equipment Arrangement Test",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });

  return { drawingId: drawing.id, placementIds };
}

export async function createE2eDrawingGuidesDrawing(): Promise<{
  drawingId: string;
  placementId: string;
  primarySheetName: string;
  secondarySheetName: string;
}> {
  const equipment = await requireApprovedSymbol(
    "nmt81_average_temperature_probe"
  );
  const base = createDefaultDrawingModel();
  const placementId = "guide_equipment";
  const primarySheetName = "Guide Primary";
  const secondarySheetName = "Guide Secondary";
  const asset = {
    id: "asset_guide_equipment",
    tag: "LT-101",
    type: "instrument" as const,
    title: "Guide Test Instrument",
    symbolId: equipment.symbolId,
    versionId: equipment.versionId
  };
  const model: DrawingModel = drawingPackageModelSchema.parse({
    ...base,
    assets: [asset],
    sheets: [
      {
        ...base.sheets[0],
        name: primarySheetName,
        placements: [
          {
            id: placementId,
            assetId: asset.id,
            symbolId: equipment.symbolId,
            versionId: equipment.versionId,
            role: "device" as const,
            tag: asset.tag,
            title: asset.title,
            x: 45,
            y: 55,
            rotation: 0,
            scale: 0.24
          }
        ]
      },
      {
        ...base.sheets[0],
        id: "guide_secondary_sheet",
        name: secondarySheetName,
        placements: []
      }
    ]
  });
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const drawing = await prisma.drawing.create({
    data: {
      drawingKey: `e2e_drawing_guides_${unique}`,
      title: "Drawing Guides Test",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    },
    select: { id: true }
  });

  return {
    drawingId: drawing.id,
    placementId,
    primarySheetName,
    secondarySheetName
  };
}

export async function deleteE2eDrawing(drawingId: string | undefined) {
  if (!drawingId) {
    return;
  }

  await prisma.drawing.deleteMany({
    where: { id: drawingId }
  });
}
