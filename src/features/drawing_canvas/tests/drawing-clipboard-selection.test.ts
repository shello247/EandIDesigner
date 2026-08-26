import { describe, expect, it } from "vitest";
import { updateManagedAsset } from "@/features/drawing_asset_manager/logic/use_cases/drawing-asset-manager-use-cases";
import type { SymbolMetadata } from "@/features/symbol_registry/data/schema";
import type { DrawingModel, DrawingPlacement } from "../data/schema";
import { createDefaultDrawingModel } from "../data/schema";
import type { ApprovedDrawingSymbol } from "../types";
import {
  copySelectionToClipboard,
  pasteClipboardToSheet
} from "../logic/services/drawing-clipboard-commands";
import { createPanelEnclosurePlacement } from "../logic/services/drawing-asset-containment";
import {
  autosizeLayoutHelperToBackplane,
  createBackplanePlacement
} from "../logic/services/drawing-backplane-layouts";
import { createGeneratedWireTrayLibrarySymbol } from "../logic/services/drawing-wire-tray-layouts";
import { createTerminalBlockPlacement } from "../logic/services/drawing-terminal-blocks";
import { moveCanvasSelection } from "../logic/services/drawing-movement";
import {
  createEmptyDrawingHistory,
  pushDrawingHistoryEntry,
  redoDrawingHistory,
  undoDrawingHistory
} from "../logic/services/drawing-model-history";
import {
  createSingleSelection,
  getMarqueeSelection,
  normalizeCanvasSelection,
  toggleCanvasSelection,
  type DrawingCanvasSelection
} from "../logic/services/drawing-selection";
import { toSheetCanvasModel } from "../logic/commands/drawing-sheet-commands";

const metadata: SymbolMetadata = {
  symbolKey: "test_symbol",
  displayName: "Test Symbol",
  category: "instrument",
  viewBox: { x: 0, y: 0, width: 100, height: 80 },
  anchors: [
    { key: "T1", x: 10, y: 20, kind: "terminal" },
    { key: "T2", x: 80, y: 20, kind: "terminal" }
  ],
  terminals: []
};

const instrumentSymbol: ApprovedDrawingSymbol = {
  symbolId: "sym_instrument",
  symbolKey: "nmt81_average_temperature_probe",
  displayName: "NMT81 Average Temperature Probe",
  manufacturer: "Vendor",
  model: "NMT81",
  category: "instrument",
  versionId: "ver_instrument",
  versionNumber: 1,
  svg: '<svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg"></svg>',
  metadata
};

const cableSymbol: ApprovedDrawingSymbol = {
  ...instrumentSymbol,
  symbolId: "sym_cable",
  symbolKey: "clx_cable_1_pair",
  displayName: "CLX Cable 1 Pair",
  category: "cable_assembly",
  versionId: "ver_cable"
};

const monitorSymbol: ApprovedDrawingSymbol = {
  ...instrumentSymbol,
  symbolId: "sym_monitor",
  symbolKey: "nrf81_tank_side_monitor",
  displayName: "NRF81 Tank Side Monitor",
  category: "monitor",
  versionId: "ver_monitor"
};

const distributionBlockSymbol: ApprovedDrawingSymbol = {
  ...instrumentSymbol,
  symbolId: "sym_distribution_block",
  symbolKey: "ptfix_distribution_block",
  displayName: "Power Distribution Block",
  category: "terminal_block",
  versionId: "ver_distribution_block",
  metadata: {
    ...metadata,
    symbolKey: "ptfix_distribution_block",
    displayName: "Power Distribution Block",
    category: "terminal_block",
    panelWiring: {
      assetType: "terminal_block",
      tagPrefix: "PDB"
    }
  }
};

const symbols = [
  instrumentSymbol,
  cableSymbol,
  monitorSymbol,
  distributionBlockSymbol
];
const wireTraySymbol = createGeneratedWireTrayLibrarySymbol();

function placement(
  overrides: Partial<DrawingPlacement> & Pick<DrawingPlacement, "id" | "tag">
): DrawingPlacement {
  return {
    id: overrides.id,
    assetId: overrides.assetId,
    symbolId: overrides.symbolId ?? instrumentSymbol.symbolId,
    versionId: overrides.versionId ?? instrumentSymbol.versionId,
    role: overrides.role ?? "device",
    tag: overrides.tag,
    x: overrides.x ?? 20,
    y: overrides.y ?? 20,
    rotation: overrides.rotation ?? 0,
    scale: overrides.scale ?? 0.4,
    containerAssetId: overrides.containerAssetId
  };
}

function modelWithTwoSheets(): DrawingModel {
  const model = createDefaultDrawingModel();

  return {
    ...model,
    sheets: [
      {
        ...model.sheets[0],
        id: "sheet_1",
        name: "Sheet 1",
        placements: [
          placement({
            id: "tt101",
            assetId: "asset_tt101",
            tag: "TT-101",
            x: 20,
            y: 20
          }),
          placement({
            id: "c101",
            assetId: "asset_c101",
            symbolId: cableSymbol.symbolId,
            versionId: cableSymbol.versionId,
            role: "cable_assembly",
            tag: "C-101",
            x: 95,
            y: 20
          }),
          placement({
            id: "tsm101",
            assetId: "asset_tsm101",
            symbolId: monitorSymbol.symbolId,
            versionId: monitorSymbol.versionId,
            tag: "TSM-101",
            x: 170,
            y: 20
          })
        ],
        connections: [
          {
            id: "conn_1",
            from: { placementId: "tt101", anchorKey: "T1" },
            to: { placementId: "tsm101", anchorKey: "T2" },
            cablePlacementId: "c101",
            conductorKey: "WHT",
            wireId: "C-101-WHT"
          }
        ],
        annotations: [
          {
            id: "note_1",
            kind: "note",
            title: "Install",
            text: "Seal fitting required",
            x: 260,
            y: 30,
            width: 42,
            height: 18
          }
        ]
      },
      {
        id: "sheet_2",
        name: "Sheet 2",
        page: { ...model.sheets[0].page },
        placements: [],
        connections: [],
        annotations: []
      }
    ]
  };
}

function modelWithPanelDistributionBlocks(
  placements: Array<Pick<DrawingPlacement, "id" | "assetId" | "tag">> = [
    { id: "pdb101", assetId: "asset_pdb101", tag: "PDB-101" }
  ]
): DrawingModel {
  const model = createDefaultDrawingModel();
  const panel = createPanelEnclosurePlacement({
    model,
    activeSheet: model.sheets[0],
    assetId: "asset_panel_1",
    tag: "PLC-001",
    x: 20,
    y: 20,
    width: 180,
    height: 140,
    kind: "power_distribution_panel"
  });
  const distributionBlocks = placements.map((item, index) =>
    placement({
      ...item,
      symbolId: distributionBlockSymbol.symbolId,
      versionId: distributionBlockSymbol.versionId,
      role: "terminal_block",
      containerAssetId: "asset_panel_1",
      x: 50 + index * 30,
      y: 60
    })
  );

  return {
    ...model,
    assets: [
      {
        id: "asset_pdb101",
        tag: "PDB-101",
        type: "terminal_block",
        title: "110 VAC L1 Power distribution block",
        description: "Panel power distribution",
        symbolId: distributionBlockSymbol.symbolId,
        versionId: distributionBlockSymbol.versionId,
        componentSelections: [
          {
            positionKey: "position-1",
            componentKey: "fuse",
            symbolId: "sym_fuse",
            versionId: "ver_fuse"
          }
        ]
      }
    ],
    sheets: [
      {
        ...model.sheets[0],
        id: "sheet_panel",
        name: "Panel Layout",
        placements: [panel, ...distributionBlocks]
      },
      {
        id: "sheet_other",
        name: "Other Sheet",
        page: { ...model.sheets[0].page },
        placements: [],
        connections: [],
        annotations: []
      }
    ]
  };
}

describe("drawing canvas selection and clipboard", () => {
  it("toggles and normalizes mixed selections", () => {
    const model = modelWithTwoSheets();
    const sheetModel = toSheetCanvasModel(model, "sheet_1");
    const selection = toggleCanvasSelection(
      toggleCanvasSelection(
        createSingleSelection("placement", "tsm101"),
        "annotation",
        "note_1"
      ),
      "placement",
      "missing"
    );

    expect(normalizeCanvasSelection(selection, sheetModel)).toEqual({
      placementIds: ["tsm101"],
      annotationIds: ["note_1"]
    });
  });

  it("selects placements and notes intersecting a marquee", () => {
    const model = modelWithTwoSheets();
    const sheetModel = toSheetCanvasModel(model, "sheet_1");

    expect(
      getMarqueeSelection({
        model: sheetModel,
        symbols,
        start: { x: 10, y: 10 },
        end: { x: 310, y: 70 }
      })
    ).toEqual({
      placementIds: ["tt101", "c101", "tsm101"],
      annotationIds: ["note_1"]
    });
  });

  it("copies selected layout objects without copying connections", () => {
    const model = modelWithTwoSheets();
    const clipboard = copySelectionToClipboard({
      model,
      sheetId: "sheet_1",
      selection: {
        placementIds: ["tt101", "c101", "tsm101"],
        annotationIds: ["note_1"]
      }
    });

    expect(clipboard?.placements).toHaveLength(3);
    expect(clipboard?.annotations.map((annotation) => annotation.id)).toEqual([
      "note_1"
    ]);
    expect(clipboard).not.toHaveProperty("connections");
  });

  it("pastes layout with remapped ids and global tags but no wiring", () => {
    const model = modelWithTwoSheets();
    const clipboard = copySelectionToClipboard({
      model,
      sheetId: "sheet_1",
      selection: {
        placementIds: ["tt101", "c101", "tsm101"],
        annotationIds: ["note_1"]
      }
    });

    expect(clipboard).not.toBeNull();

    const result = pasteClipboardToSheet({
      model,
      sheetId: "sheet_2",
      clipboard: clipboard!,
      symbols,
      idPrefix: "unit"
    });
    const pastedSheet = result.model.sheets[1];

    expect(result.selection).toEqual({
      placementIds: ["pl_unit_1", "pl_unit_2", "pl_unit_3"],
      annotationIds: ["ann_unit_1"]
    });
    expect(pastedSheet.placements.map((item) => item.tag)).toEqual([
      "TT-102",
      "C-102",
      "TSM-101"
    ]);
    expect(pastedSheet.placements[0].assetId).not.toBe("asset_tt101");
    expect(pastedSheet.placements[1].assetId).not.toBe("asset_c101");
    expect(pastedSheet.placements[2].assetId).toBe("asset_tsm101");
    expect(pastedSheet.connections).toEqual([]);
    expect(pastedSheet.annotations[0].id).toBe("ann_unit_1");
  });

  it("pastes as a new system with new monitor assets", () => {
    const model = modelWithTwoSheets();
    model.assets = [
      {
        id: "asset_tsm101",
        tag: "TSM-101",
        type: "controller",
        title: "Tank monitor",
        symbolId: monitorSymbol.symbolId,
        versionId: monitorSymbol.versionId,
        componentSelections: [
          {
            positionKey: "position-1",
            componentKey: "relay",
            symbolId: "relay_symbol",
            versionId: "relay_version"
          }
        ]
      }
    ];
    const clipboard = copySelectionToClipboard({
      model,
      sheetId: "sheet_1",
      selection: {
        placementIds: ["tt101", "c101", "tsm101"],
        annotationIds: []
      }
    });

    expect(clipboard).not.toBeNull();

    const result = pasteClipboardToSheet({
      model,
      sheetId: "sheet_2",
      clipboard: clipboard!,
      symbols,
      idPrefix: "new_system",
      duplicateMode: "new-system"
    });
    const pastedSheet = result.model.sheets[1];

    expect(pastedSheet.placements.map((item) => item.tag)).toEqual([
      "TT-102",
      "C-102",
      "TSM-102"
    ]);
    expect(pastedSheet.placements[2].assetId).not.toBe("asset_tsm101");
    expect(pastedSheet.connections).toEqual([]);
    expect(
      result.model.assets.find(
        (asset) => asset.id === pastedSheet.placements[2].assetId
      )?.componentSelections
    ).toEqual(model.assets[0].componentSelections);
  });

  it("creates a new physical asset when equipment is pasted on the same panel", () => {
    const model = modelWithPanelDistributionBlocks();
    const clipboard = copySelectionToClipboard({
      model,
      sheetId: "sheet_panel",
      selection: { placementIds: ["pdb101"], annotationIds: [] }
    });

    const result = pasteClipboardToSheet({
      model,
      sheetId: "sheet_panel",
      clipboard: clipboard!,
      symbols,
      idPrefix: "same_panel"
    });
    const pasted = result.model.sheets[0].placements.find(
      (candidate) => candidate.id === "pl_same_panel_1"
    );
    const pastedAsset = result.model.assets?.find(
      (candidate) => candidate.id === pasted?.assetId
    );

    expect(pasted).toMatchObject({
      tag: "PDB-102",
      containerAssetId: "asset_panel_1"
    });
    expect(pasted?.assetId).not.toBe("asset_pdb101");
    expect(pastedAsset).toMatchObject({
      tag: "PDB-102",
      title: "110 VAC L1 Power distribution block",
      description: "Panel power distribution",
      symbolId: distributionBlockSymbol.symbolId,
      versionId: distributionBlockSymbol.versionId,
      componentSelections: [
        {
          positionKey: "position-1",
          componentKey: "fuse",
          symbolId: "sym_fuse",
          versionId: "ver_fuse"
        }
      ]
    });
  });

  it("keeps four repeated same-panel copies independently identifiable", () => {
    const original = modelWithPanelDistributionBlocks();
    const clipboard = copySelectionToClipboard({
      model: original,
      sheetId: "sheet_panel",
      selection: { placementIds: ["pdb101"], annotationIds: [] }
    });
    let current = original;

    for (let index = 2; index <= 4; index += 1) {
      current = pasteClipboardToSheet({
        model: current,
        sheetId: "sheet_panel",
        clipboard: clipboard!,
        symbols,
        idPrefix: `pdb_copy_${index}`
      }).model;
    }

    const distributionBlocks = current.sheets[0].placements.filter(
      (candidate) => candidate.symbolId === distributionBlockSymbol.symbolId
    );
    expect(distributionBlocks.map((candidate) => candidate.tag)).toEqual([
      "PDB-101",
      "PDB-102",
      "PDB-103",
      "PDB-104"
    ]);
    expect(
      new Set(distributionBlocks.map((candidate) => candidate.assetId)).size
    ).toBe(4);

    const copiedAssetId = distributionBlocks[1].assetId!;
    const renamed = updateManagedAsset(
      current,
      copiedAssetId,
      { tag: "PDB-110" },
      symbols
    );
    const renamedBlocks = renamed.sheets[0].placements.filter(
      (candidate) => candidate.symbolId === distributionBlockSymbol.symbolId
    );

    expect(renamedBlocks.map((candidate) => candidate.tag)).toEqual([
      "PDB-101",
      "PDB-110",
      "PDB-103",
      "PDB-104"
    ]);
  });

  it("creates one unique asset per same-panel occurrence when linked placements are copied together", () => {
    const model = modelWithPanelDistributionBlocks([
      { id: "pdb_a", assetId: "asset_pdb101", tag: "PDB-101" },
      { id: "pdb_b", assetId: "asset_pdb101", tag: "PDB-101" }
    ]);
    const clipboard = copySelectionToClipboard({
      model,
      sheetId: "sheet_panel",
      selection: { placementIds: ["pdb_a", "pdb_b"], annotationIds: [] }
    });

    const result = pasteClipboardToSheet({
      model,
      sheetId: "sheet_panel",
      clipboard: clipboard!,
      symbols,
      idPrefix: "linked_panel"
    });
    const pasted = result.model.sheets[0].placements.filter((candidate) =>
      candidate.id.startsWith("pl_linked_panel_")
    );

    expect(pasted.map((candidate) => candidate.tag)).toEqual([
      "PDB-102",
      "PDB-103"
    ]);
    expect(new Set(pasted.map((candidate) => candidate.assetId)).size).toBe(2);
    expect(
      pasted.map((candidate) =>
        result.model.assets?.find((asset) => asset.id === candidate.assetId)?.title
      )
    ).toEqual([
      "110 VAC L1 Power distribution block",
      "110 VAC L1 Power distribution block"
    ]);
  });

  it("retains current linking rules for cross-sheet and uncontained copies", () => {
    const panelModel = modelWithPanelDistributionBlocks();
    const panelClipboard = copySelectionToClipboard({
      model: panelModel,
      sheetId: "sheet_panel",
      selection: { placementIds: ["pdb101"], annotationIds: [] }
    });
    const crossSheet = pasteClipboardToSheet({
      model: panelModel,
      sheetId: "sheet_other",
      clipboard: panelClipboard!,
      symbols,
      idPrefix: "cross_sheet"
    });
    const crossSheetPaste = crossSheet.model.sheets[1].placements[0];
    const uncontainedModel: DrawingModel = {
      ...panelModel,
      sheets: [
        {
          ...panelModel.sheets[0],
          placements: panelModel.sheets[0].placements.map((candidate) =>
            candidate.id === "pdb101"
              ? { ...candidate, containerAssetId: undefined }
              : candidate
          )
        },
        panelModel.sheets[1]
      ]
    };
    const uncontainedClipboard = copySelectionToClipboard({
      model: uncontainedModel,
      sheetId: "sheet_panel",
      selection: { placementIds: ["pdb101"], annotationIds: [] }
    });
    const uncontained = pasteClipboardToSheet({
      model: uncontainedModel,
      sheetId: "sheet_panel",
      clipboard: uncontainedClipboard!,
      symbols,
      idPrefix: "uncontained"
    });
    const uncontainedPaste = uncontained.model.sheets[0].placements.find(
      (candidate) => candidate.id === "pl_uncontained_1"
    );

    expect(crossSheetPaste).toMatchObject({
      assetId: "asset_pdb101",
      tag: "PDB-101"
    });
    expect(uncontainedPaste).toMatchObject({
      assetId: "asset_pdb101",
      tag: "PDB-101"
    });
  });

  it("pastes generated terminal blocks as new globally numbered assets", () => {
    const model = modelWithTwoSheets();
    const terminalBlock = createTerminalBlockPlacement({
      model,
      activeSheet: model.sheets[0],
      assetId: "asset_tb101",
      tag: "TB-101"
    });
    const modelWithTerminalBlock: DrawingModel = {
      ...model,
      sheets: [
        {
          ...model.sheets[0],
          placements: [...model.sheets[0].placements, terminalBlock]
        },
        model.sheets[1]
      ]
    };
    const clipboard = copySelectionToClipboard({
      model: modelWithTerminalBlock,
      sheetId: "sheet_1",
      selection: {
        placementIds: [terminalBlock.id],
        annotationIds: []
      }
    });

    expect(clipboard).not.toBeNull();

    const result = pasteClipboardToSheet({
      model: modelWithTerminalBlock,
      sheetId: "sheet_2",
      clipboard: clipboard!,
      symbols,
      idPrefix: "tb"
    });
    const pastedTerminalBlock = result.model.sheets[1].placements[0];

    expect(pastedTerminalBlock).toMatchObject({
      tag: "TB-102",
      role: "terminal_block"
    });
    expect(pastedTerminalBlock.assetId).not.toBe("asset_tb101");
  });

  it("preserves an existing backplane parent when pasting a copied layout helper", () => {
    const model = modelWithTwoSheets();
    const panel = createPanelEnclosurePlacement({
      model,
      activeSheet: model.sheets[0],
      assetId: "asset_jb_001",
      tag: "JB001",
      x: 20,
      y: 22,
      width: 118,
      height: 92,
      kind: "junction_box"
    });
    const backplane = createBackplanePlacement({ panelPlacement: panel });
    const tray = autosizeLayoutHelperToBackplane({
      backplane,
      symbol: wireTraySymbol,
      sheet: {
        ...model.sheets[0].page,
        titleBlock: model.titleBlock
      },
      placement: {
        id: "wire_tray_1",
        symbolId: wireTraySymbol.symbolId,
        versionId: wireTraySymbol.versionId,
        role: "other",
        tag: wireTraySymbol.displayName,
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        layoutKind: "layout_helper",
        layoutDimensions: {
          lengthMm: 200,
          widthMm: 40
        }
      }
    });
    const modelWithLayoutHelper: DrawingModel = {
      ...model,
      sheets: [
        {
          ...model.sheets[0],
          placements: [panel, backplane, tray]
        },
        model.sheets[1]
      ]
    };
    const clipboard = copySelectionToClipboard({
      model: modelWithLayoutHelper,
      sheetId: "sheet_1",
      selection: {
        placementIds: [tray.id],
        annotationIds: []
      }
    });

    expect(clipboard).not.toBeNull();

    const result = pasteClipboardToSheet({
      model: modelWithLayoutHelper,
      sheetId: "sheet_1",
      clipboard: clipboard!,
      symbols: [wireTraySymbol],
      idPrefix: "tray"
    });
    const pastedTray = result.model.sheets[0].placements.find(
      (placement) => placement.id === "pl_tray_1"
    );

    expect(pastedTray).toMatchObject({
      layoutKind: "layout_helper",
      layoutParentId: backplane.id,
      containerAssetId: "asset_jb_001",
      layoutPosition: tray.layoutPosition,
      layoutDimensions: tray.layoutDimensions
    });
  });

  it("moves a selected placement and its custom title label together", () => {
    const model = modelWithTwoSheets();
    const sheetModel = toSheetCanvasModel(model, "sheet_1");
    sheetModel.placements[0] = {
      ...sheetModel.placements[0],
      labelPosition: { x: 28, y: 14 }
    };

    const moved = moveCanvasSelection({
      model: sheetModel,
      selection: { placementIds: ["tt101"], annotationIds: [] },
      delta: { x: 8, y: 6 },
      symbols
    });

    expect(moved.placements[0]).toMatchObject({
      x: 28,
      y: 26,
      labelPosition: { x: 36, y: 20 }
    });
  });

  it("keeps derived placement title labels unset when moving placements", () => {
    const model = modelWithTwoSheets();
    const sheetModel = toSheetCanvasModel(model, "sheet_1");

    const moved = moveCanvasSelection({
      model: sheetModel,
      selection: { placementIds: ["tt101"], annotationIds: [] },
      delta: { x: 8, y: 6 },
      symbols
    });

    expect(moved.placements[0]).toMatchObject({ x: 28, y: 26 });
    expect(moved.placements[0].labelPosition).toBeUndefined();
  });

  it("moves full selected loop route controls and label with placements", () => {
    const model = modelWithTwoSheets();
    const sheetModel = toSheetCanvasModel(model, "sheet_1");
    sheetModel.connections[0] = {
      ...sheetModel.connections[0],
      route: {
        mode: "manual",
        style: "orthogonal",
        labelPosition: { x: 110, y: 35 },
        points: [
          { id: "start", kind: "endpoint", x: 25, y: 28 },
          { id: "control_1", kind: "control", x: 80, y: 60 },
          { id: "control_2", kind: "control", x: 150, y: 60 },
          { id: "end", kind: "endpoint", x: 178, y: 28 }
        ]
      }
    };

    const moved = moveCanvasSelection({
      model: sheetModel,
      selection: {
        placementIds: ["tt101", "c101", "tsm101"],
        annotationIds: []
      },
      delta: { x: 12, y: 9 },
      symbols
    });
    const route = moved.connections[0].route;

    expect(moved.placements.map((placement) => placement.x)).toEqual([
      32,
      107,
      182
    ]);
    expect(route?.mode).toBe("manual");
    expect(route?.labelPosition).toEqual({ x: 122, y: 44 });
    expect(route?.points).toEqual([
      { id: "start", kind: "endpoint", x: 25, y: 28 },
      { id: "control_1", kind: "control", x: 92, y: 69 },
      { id: "control_2", kind: "control", x: 162, y: 69 },
      { id: "end", kind: "endpoint", x: 178, y: 28 }
    ]);
  });

  it("leaves partial selection route controls in place", () => {
    const model = modelWithTwoSheets();
    const sheetModel = toSheetCanvasModel(model, "sheet_1");
    sheetModel.connections[0] = {
      ...sheetModel.connections[0],
      route: {
        mode: "manual",
        style: "orthogonal",
        labelPosition: { x: 110, y: 35 },
        points: [
          { id: "start", kind: "endpoint", x: 25, y: 28 },
          { id: "control_1", kind: "control", x: 80, y: 60 },
          { id: "end", kind: "endpoint", x: 178, y: 28 }
        ]
      }
    };

    const moved = moveCanvasSelection({
      model: sheetModel,
      selection: { placementIds: ["tt101", "c101"], annotationIds: [] },
      delta: { x: 12, y: 9 },
      symbols
    });

    expect(moved.placements[0]).toMatchObject({ x: 32, y: 29 });
    expect(moved.connections[0].route).toEqual(sheetModel.connections[0].route);
  });

  it("moves selected note leaders with selected notes", () => {
    const model = modelWithTwoSheets();
    const sheetModel = toSheetCanvasModel(model, "sheet_1");
    sheetModel.annotations[0] = {
      ...sheetModel.annotations[0],
      leader: {
        enabled: true,
        targetX: 250,
        targetY: 40
      }
    };

    const moved = moveCanvasSelection({
      model: sheetModel,
      selection: { placementIds: [], annotationIds: ["note_1"] },
      delta: { x: -10, y: 12 },
      symbols
    });

    expect(moved.annotations[0]).toMatchObject({
      x: 250,
      y: 42,
      leader: {
        enabled: true,
        targetX: 240,
        targetY: 52
      }
    });
  });
});

describe("drawing model history", () => {
  it("undoes and redoes model entries with sheet and selection metadata", () => {
    const model = modelWithTwoSheets();
    const initialSelection: DrawingCanvasSelection = {
      placementIds: ["tt101"],
      annotationIds: []
    };
    const nextSelection: DrawingCanvasSelection = {
      placementIds: ["pl_unit_1"],
      annotationIds: []
    };
    const initialEntry = {
      model,
      activeSheetId: "sheet_1",
      selection: initialSelection
    };
    const nextEntry = {
      model: {
        ...model,
        sheets: model.sheets.map((sheet) =>
          sheet.id === "sheet_2"
            ? { ...sheet, placements: [placement({ id: "pl_unit_1", tag: "TT-102" })] }
            : sheet
        )
      },
      activeSheetId: "sheet_2",
      selection: nextSelection
    };
    const history = pushDrawingHistoryEntry(
      createEmptyDrawingHistory(),
      initialEntry
    );
    const undoResult = undoDrawingHistory(history, nextEntry);

    expect(undoResult.entry).toEqual(initialEntry);

    const redoResult = redoDrawingHistory(undoResult.history, initialEntry);

    expect(redoResult.entry).toEqual(nextEntry);
  });
});
