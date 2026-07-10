import { describe, expect, it } from "vitest";
import {
  applyPanelWiringMutations,
  createPanelWiringSource
} from "@/features/drawing_canvas/api/panel-wiring-contracts";
import {
  createDefaultDrawingModel,
  parseDrawingModelJson,
  stringifyDrawingModel,
  type DrawingModel
} from "@/features/drawing_canvas/data/schema";
import type { ApprovedDrawingSymbol } from "@/features/drawing_canvas/types";
import {
  clearPanelDrawingContext,
  inspectPanelConnectivity,
  removeExternalTerminationMapping,
  setPanelDrawingContext,
  upsertExternalTerminationMapping
} from "../api/public";

const PANEL_ASSET_ID = "asset_panel_fixture";
const TERMINAL_ASSET_ID = "asset_terminal_fixture";

function createCanvasFixture(): DrawingModel {
  const model = createDefaultDrawingModel();

  return {
    ...model,
    assets: [
      {
        id: PANEL_ASSET_ID,
        tag: "ENC-900",
        type: "panel",
        title: "Test Enclosure",
        symbolId: "__generated_panel_enclosure__",
        versionId: "generated_panel_enclosure_v1"
      },
      {
        id: TERMINAL_ASSET_ID,
        tag: "XT-900",
        type: "terminal_block",
        title: "Test Terminal Strip",
        symbolId: "__generated_terminal_block__",
        versionId: "generated_terminal_block_v1"
      },
      {
        id: "asset_cable_fixture",
        tag: "CBL-900",
        type: "cable",
        title: "Test Field Cable",
        symbolId: "cable_symbol",
        versionId: "cable_v1"
      }
    ],
    sheets: [
      {
        ...model.sheets[0],
        placements: [
          {
            id: "panel_occurrence",
            assetId: PANEL_ASSET_ID,
            symbolId: "__generated_panel_enclosure__",
            versionId: "generated_panel_enclosure_v1",
            role: "enclosure",
            tag: "ENC-900",
            x: 10,
            y: 10,
            rotation: 0,
            scale: 1,
            enclosure: {
              kind: "generic_enclosure",
              width: 100,
              height: 80
            }
          },
          {
            id: "terminal_occurrence",
            assetId: TERMINAL_ASSET_ID,
            containerAssetId: PANEL_ASSET_ID,
            symbolId: "__generated_terminal_block__",
            versionId: "generated_terminal_block_v1",
            role: "terminal_block",
            tag: "XT-900",
            x: 60,
            y: 40,
            rotation: 0,
            scale: 0.34,
            terminalBlock: {
              kind: "modular_terminal_strip",
              count: 5,
              startNumber: 1,
              orientation: "horizontal",
              modulePitch: 20,
              moduleWidth: 20,
              moduleHeight: 178
            }
          },
          {
            id: "cable_occurrence",
            assetId: "asset_cable_fixture",
            symbolId: "cable_symbol",
            versionId: "cable_v1",
            role: "cable_assembly",
            tag: "CBL-900",
            x: 20,
            y: 40,
            rotation: 0,
            scale: 1
          }
        ],
        connections: [
          {
            id: "field_connection",
            from: {
              placementId: "cable_occurrence",
              anchorKey: "CH1"
            },
            to: {
              placementId: "terminal_occurrence",
              anchorKey: "T1_BOTTOM"
            },
            cablePlacementId: "cable_occurrence",
            conductorKey: "W1",
            wireId: "CBL-900-W1"
          }
        ]
      }
    ]
  };
}

function approvedDeviceSymbol(): ApprovedDrawingSymbol {
  return {
    symbolId: "device_symbol",
    symbolKey: "device_symbol",
    displayName: "Device",
    category: "instrument",
    versionId: "device_v1",
    versionNumber: 1,
    svg: '<svg viewBox="0 0 20 20"></svg>',
    metadata: {
      symbolKey: "device_symbol",
      displayName: "Device",
      category: "instrument",
      viewBox: { x: 0, y: 0, width: 20, height: 20 },
      anchors: [{ key: "A1", x: 10, y: 20, kind: "terminal" }],
      terminals: [
        {
          key: "1",
          label: "1",
          anchorKey: "A1",
          requiredForWiring: true
        }
      ]
    }
  };
}

describe("drawing panel wiring compatibility", () => {
  it("keeps panel wiring fields absent for legacy drawing packages", () => {
    const serialized = stringifyDrawingModel(createDefaultDrawingModel());
    const raw = JSON.parse(serialized) as Record<string, unknown>;
    const parsed = parseDrawingModelJson(serialized);

    expect(raw).not.toHaveProperty("panelWiring");
    expect(raw.sheets).toEqual([
      expect.not.objectContaining({ panelDrawingContext: expect.anything() })
    ]);
    expect(parsed.panelWiring).toBeUndefined();
    expect(parsed.sheets[0].panelDrawingContext).toBeUndefined();
  });

  it("normalizes generated terminal blocks and preserves field provenance", () => {
    const source = createPanelWiringSource(createCanvasFixture(), []);
    const snapshot = inspectPanelConnectivity(source, PANEL_ASSET_ID);

    expect(snapshot.terminals).toHaveLength(5);
    expect(snapshot.externalTerminations).toEqual([
      expect.objectContaining({
        status: "resolved",
        wireId: "CBL-900-W1",
        cableAssetId: "asset_cable_fixture",
        conductorKey: "W1",
        target: {
          assetId: TERMINAL_ASSET_ID,
          terminalKey: "T1",
          side: "external"
        },
        source: {
          sheetId: "sheet_1",
          connectionId: "field_connection",
          endpointRole: "to",
          placementId: "terminal_occurrence",
          anchorKey: "T1_BOTTOM"
        }
      })
    ]);
  });

  it("applies validated panel context and mapping commands without changing field connections", () => {
    const original = createCanvasFixture();
    const source = createPanelWiringSource(original, []);
    const contextCommand = setPanelDrawingContext(source, {
      sheetId: "sheet_1",
      panelAssetId: PANEL_ASSET_ID
    });
    const withContext = applyPanelWiringMutations(
      original,
      contextCommand.mutations
    );
    const mapping = {
      id: "mapping_fixture",
      panelAssetId: PANEL_ASSET_ID,
      source: {
        sheetId: "sheet_1",
        connectionId: "field_connection",
        endpointRole: "to" as const,
        placementId: "terminal_occurrence",
        anchorKey: "T1_BOTTOM"
      },
      target: {
        assetId: TERMINAL_ASSET_ID,
        terminalKey: "T1",
        side: "external" as const
      },
      origin: "engineer" as const
    };
    const mappingCommand = upsertExternalTerminationMapping(
      createPanelWiringSource(withContext, []),
      mapping
    );
    const withMapping = applyPanelWiringMutations(
      withContext,
      mappingCommand.mutations
    );
    const removeCommand = removeExternalTerminationMapping(
      createPanelWiringSource(withMapping, []),
      { mappingId: mapping.id }
    );
    const withoutMapping = applyPanelWiringMutations(
      withMapping,
      removeCommand.mutations
    );
    const clearContextCommand = clearPanelDrawingContext(
      createPanelWiringSource(withoutMapping, []),
      { sheetId: "sheet_1" }
    );
    const withoutContext = applyPanelWiringMutations(
      withoutMapping,
      clearContextCommand.mutations
    );

    expect(contextCommand.warnings).toEqual([]);
    expect(mappingCommand.warnings).toEqual([]);
    expect(withMapping.sheets[0].panelDrawingContext).toEqual({
      kind: "detailed_panel_wiring",
      panelAssetId: PANEL_ASSET_ID
    });
    expect(withMapping.panelWiring?.terminalMappings).toEqual([mapping]);
    expect(withMapping.sheets[0].connections).toEqual(
      original.sheets[0].connections
    );
    expect(removeCommand.warnings).toEqual([]);
    expect(withoutMapping.panelWiring).toBeUndefined();
    expect(clearContextCommand.warnings).toEqual([]);
    expect(withoutContext.sheets[0].panelDrawingContext).toBeUndefined();
  });

  it("resolves a normal approved-symbol terminal as single-sided", () => {
    const model = createCanvasFixture();
    const symbol = approvedDeviceSymbol();
    const deviceAssetId = "asset_device_fixture";
    const next: DrawingModel = {
      ...model,
      assets: [
        ...model.assets,
        {
          id: deviceAssetId,
          tag: "DEV-900",
          type: "instrument",
          title: "Device",
          symbolId: symbol.symbolId,
          versionId: symbol.versionId
        }
      ],
      sheets: model.sheets.map((sheet) => ({
        ...sheet,
        placements: [
          ...sheet.placements,
          {
            id: "device_occurrence",
            assetId: deviceAssetId,
            containerAssetId: PANEL_ASSET_ID,
            symbolId: symbol.symbolId,
            versionId: symbol.versionId,
            role: "device",
            tag: "DEV-900",
            x: 100,
            y: 60,
            rotation: 0,
            scale: 1
          }
        ]
      }))
    };
    const source = createPanelWiringSource(next, [symbol]);
    const deviceOccurrence = source.sheets[0].occurrences.find(
      (occurrence) => occurrence.assetId === deviceAssetId
    );

    expect(deviceOccurrence?.terminalResolutionStatus).toBe("resolved");
    expect(deviceOccurrence?.terminals).toEqual([
      expect.objectContaining({
        terminalKey: "1",
        supportedSides: ["single"],
        status: "resolved"
      })
    ]);
  });

  it("reports ambiguous approved-symbol terminal metadata instead of guessing sides", () => {
    const model = createCanvasFixture();
    const base = approvedDeviceSymbol();
    const symbol: ApprovedDrawingSymbol = {
      ...base,
      symbolId: "ambiguous_device_symbol",
      symbolKey: "ambiguous_device_symbol",
      versionId: "ambiguous_device_v1",
      metadata: {
        ...base.metadata,
        symbolKey: "ambiguous_device_symbol",
        anchors: [
          { key: "A1", x: 10, y: 0, kind: "terminal" },
          { key: "A2", x: 10, y: 20, kind: "terminal" }
        ],
        terminals: [
          {
            key: "1",
            label: "1",
            anchorKey: "A1",
            requiredForWiring: true
          },
          {
            key: "1",
            label: "1",
            anchorKey: "A2",
            requiredForWiring: true
          }
        ]
      }
    };
    const assetId = "asset_ambiguous_device";
    const next: DrawingModel = {
      ...model,
      assets: [
        ...model.assets,
        {
          id: assetId,
          tag: "DEV-901",
          type: "instrument",
          title: "Ambiguous Device",
          symbolId: symbol.symbolId,
          versionId: symbol.versionId
        }
      ],
      sheets: model.sheets.map((sheet) => ({
        ...sheet,
        placements: [
          ...sheet.placements,
          {
            id: "ambiguous_device_occurrence",
            assetId,
            containerAssetId: PANEL_ASSET_ID,
            symbolId: symbol.symbolId,
            versionId: symbol.versionId,
            role: "device",
            tag: "DEV-901",
            x: 110,
            y: 70,
            rotation: 0,
            scale: 1
          }
        ]
      }))
    };
    const source = createPanelWiringSource(next, [symbol]);
    const occurrence = source.sheets[0].occurrences.find(
      (candidate) => candidate.assetId === assetId
    );
    const snapshot = inspectPanelConnectivity(source, PANEL_ASSET_ID);

    expect(occurrence?.terminalResolutionStatus).toBe("ambiguous");
    expect(occurrence?.terminals[0]).toMatchObject({
      terminalKey: "1",
      supportedSides: [],
      status: "ambiguous"
    });
    expect(snapshot.findings).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "ambiguous",
        assetId
      })
    ]);
  });
});
