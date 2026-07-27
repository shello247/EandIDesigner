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
  const symbol = await prisma.symbol.create({
    data: {
      symbolKey: `e2e_panel_breaker_${unique}`,
      displayName: symbolName,
      category: "terminal_block",
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
}> {
  await prisma.symbol.deleteMany({
    where: { symbolKey: { startsWith: "e2e_terminal_group_module_" } }
  });
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const symbolKey = `e2e_terminal_group_module_${unique}`;
  const symbol = await prisma.symbol.create({
    data: {
      symbolKey,
      displayName: "E2E Feed-through Terminal Module",
      category: "terminal_block",
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
            viewBox: { x: 0, y: 0, width: 20, height: 178 },
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
  const model = drawingPackageModelSchema.parse({
    ...base,
    assets: [
      {
        id: panel.assetId,
        tag: panel.tag,
        type: "junction_box",
        title: "Terminal Group Test Panel"
      }
    ],
    sheets: [
      {
        ...base.sheets[0],
        name: "JB001 Panel Layout Drawing",
        placements: [panel, backplane]
      },
      detailedSheet
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

  return { drawingId: drawing.id, symbolId: symbol.id };
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

export async function deleteE2eSymbol(symbolId: string | undefined) {
  if (!symbolId) {
    return;
  }
  await prisma.symbol.deleteMany({ where: { id: symbolId } });
}

export async function deleteE2eDrawing(drawingId: string | undefined) {
  if (!drawingId) {
    return;
  }

  await prisma.drawing.deleteMany({
    where: { id: drawingId }
  });
}
