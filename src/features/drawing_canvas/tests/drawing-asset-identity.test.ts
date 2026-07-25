import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  parseDrawingModelJson,
  stringifyDrawingModel,
  type DrawingModel
} from "../data/schema";
import { duplicateSheet } from "../logic/commands/drawing-sheet-commands";
import {
  allocateNextPackageTag,
  buildDrawingAssetCatalog,
  defaultPlacementScale,
  detectDuplicatePlacementTags,
  getCompatibleReferenceAssets,
  renameDrawingAssetTag,
  roleFromSymbol,
  tagPrefixForSymbol
} from "../logic/services/drawing-asset-identity";
import {
  createNewAssetFromPlacement,
  relinkPlacementsToExistingAsset
} from "../logic/services/drawing-asset-resolution";
import type { ApprovedDrawingSymbol } from "../types";

function symbol(input: {
  id: string;
  key: string;
  name: string;
  category: ApprovedDrawingSymbol["category"];
  model?: string;
  panelWiring?: ApprovedDrawingSymbol["metadata"]["panelWiring"];
}): ApprovedDrawingSymbol {
  return {
    symbolId: input.id,
    symbolKey: input.key,
    displayName: input.name,
    model: input.model,
    category: input.category,
    versionId: `${input.id}_v1`,
    versionNumber: 1,
    svg: '<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="40"/></svg>',
    metadata: {
      symbolKey: input.key,
      displayName: input.name,
      model: input.model,
      category: input.category,
      panelWiring: input.panelWiring,
      viewBox: { x: 0, y: 0, width: 100, height: 40 },
      anchors: [
        { key: "CH1_T1", x: 0, y: 20, kind: "terminal" },
        { key: "E1", x: 100, y: 20, kind: "terminal" }
      ],
      terminals: []
    }
  };
}

const cableSymbol = symbol({
  id: "sym_cable",
  key: "clx_cable_1_pair",
  name: "CLX Cable 1 Pair",
  category: "cable_assembly"
});
const monitorSymbol = symbol({
  id: "sym_monitor",
  key: "nrf81_tank_side_monitor",
  name: "NRF81 Tank Side Monitor",
  category: "monitor"
});
const temperatureSymbol = symbol({
  id: "sym_temp",
  key: "nmt81_average_temperature_probe",
  name: "NMT81 Average Temperature Probe",
  category: "instrument",
  model: "NMT81"
});
const radarSymbol = symbol({
  id: "sym_radar",
  key: "fmp51_guided_wave_radar",
  name: "FMP51 Guided Wave Radar",
  category: "instrument",
  model: "FMP51"
});
const breakerSymbol = symbol({
  id: "sym_mcb",
  key: "miniature_circuit_breaker_3_pole",
  name: "Miniature Circuit Breaker 3 Pole",
  category: "terminal_block",
  model: "3 Pole"
});
const ioModuleSymbol = symbol({
  id: "sym_2085_if4",
  key: "allen_bradley_2085_if4",
  name: "2085-IF4 4-Channel Analog Input Module",
  category: "other",
  model: "2085-IF4",
  panelWiring: {
    assetType: "io_module",
    tagPrefix: "AI",
    schematicScale: 0.176
  }
});
const symbols = [cableSymbol, monitorSymbol, temperatureSymbol, radarSymbol];

function packageModel(): DrawingModel {
  const defaultModel = createDefaultDrawingModel();
  const sheet = defaultModel.sheets[0];

  return {
    ...defaultModel,
    sheets: [
      {
        ...sheet,
        placements: [
          {
            id: "tt_101",
            assetId: "asset_tt_101",
            symbolId: temperatureSymbol.symbolId,
            versionId: temperatureSymbol.versionId,
            role: "device",
            tag: "TT-101",
            x: 20,
            y: 30,
            rotation: 0,
            scale: 0.34
          },
          {
            id: "c_101",
            assetId: "asset_c_101",
            symbolId: cableSymbol.symbolId,
            versionId: cableSymbol.versionId,
            role: "cable_assembly",
            tag: "C-101",
            x: 80,
            y: 40,
            rotation: 0,
            scale: 0.5
          },
          {
            id: "tsm_101",
            assetId: "asset_tsm_101",
            symbolId: monitorSymbol.symbolId,
            versionId: monitorSymbol.versionId,
            role: "device",
            tag: "TSM-101",
            x: 180,
            y: 45,
            rotation: 0,
            scale: 0.36
          }
        ],
        connections: [
          {
            id: "conn_cable_monitor",
            from: { placementId: "c_101", anchorKey: "CH1_T1" },
            to: { placementId: "tsm_101", anchorKey: "E1" },
            cablePlacementId: "c_101",
            conductorKey: "CH1_T1",
            wireId: "C-101-WHT"
          }
        ]
      }
    ]
  };
}

describe("drawing asset identity", () => {
  it("lazily assigns stable asset IDs to older drawing models", () => {
    const legacy = {
      version: 1,
      sheet: {
        size: "A3_LANDSCAPE",
        width: 420,
        height: 297,
        gridSize: 10,
        titleBlock: {}
      },
      placements: [
        {
          id: "device_1",
          symbolId: "sym_1",
          versionId: "ver_1",
          role: "device",
          tag: "TT-101",
          x: 10,
          y: 20,
          rotation: 0,
          scale: 1
        }
      ],
      connections: [],
      annotations: []
    };

    const parsed = parseDrawingModelJson(JSON.stringify(legacy));
    const serialized = JSON.parse(stringifyDrawingModel(parsed)) as DrawingModel;

    expect(parsed.sheets[0].placements[0].assetId).toBe("asset_device_1");
    expect(serialized.sheets[0].placements[0].assetId).toBe("asset_device_1");
  });

  it("allocates cable tags across the whole package", () => {
    expect(allocateNextPackageTag(packageModel(), cableSymbol)).toBe("C-102");
  });

  it("uses an MCB tag prefix for miniature circuit breakers", () => {
    expect(tagPrefixForSymbol(breakerSymbol)).toBe("MCB");
    expect(allocateNextPackageTag(createDefaultDrawingModel(), breakerSymbol)).toBe(
      "MCB-101"
    );
  });

  it("honors panel-wiring identity metadata for physical components", () => {
    expect(roleFromSymbol(ioModuleSymbol)).toBe("device");
    expect(tagPrefixForSymbol(ioModuleSymbol)).toBe("AI");
    expect(defaultPlacementScale(ioModuleSymbol)).toBe(0.176);
    expect(
      allocateNextPackageTag(createDefaultDrawingModel(), ioModuleSymbol)
    ).toBe("AI-101");
  });

  it("finds compatible existing assets for reference placement", () => {
    const references = getCompatibleReferenceAssets(
      packageModel(),
      symbols,
      monitorSymbol
    );

    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({
      assetId: "asset_tsm_101",
      tag: "TSM-101"
    });
  });

  it("renames linked assets across every placement", () => {
    const model = packageModel();
    const secondSheet = {
      ...model.sheets[0],
      id: "sheet_2",
      name: "Sheet 2",
      placements: [
        {
          ...model.sheets[0].placements[2],
          id: "tsm_101_ref",
          x: 210
        }
      ],
      connections: []
    };
    const linkedModel = { ...model, sheets: [...model.sheets, secondSheet] };
    const renamed = renameDrawingAssetTag(
      linkedModel,
      "asset_tsm_101",
      "TSM-201",
      symbols
    );

    expect(
      renamed.sheets.flatMap((sheet) =>
        sheet.placements
          .filter((placement) => placement.assetId === "asset_tsm_101")
          .map((placement) => placement.tag)
      )
    ).toEqual(["TSM-201", "TSM-201"]);
  });

  it("updates generated wire IDs when a cable asset is renamed", () => {
    const renamed = renameDrawingAssetTag(
      packageModel(),
      "asset_c_101",
      "C-201",
      symbols
    );
    const customWireModel = packageModel();
    const customWireRenamed = renameDrawingAssetTag(
      {
        ...customWireModel,
        sheets: [
          {
            ...customWireModel.sheets[0],
            connections: [
              {
                ...customWireModel.sheets[0].connections[0],
                wireId: "CUSTOM-WIRE"
              }
            ]
          }
        ]
      },
      "asset_c_101",
      "C-202",
      symbols
    );

    expect(renamed.sheets[0].connections[0].wireId).toBe("C-201-WHT");
    expect(customWireRenamed.sheets[0].connections[0].wireId).toBe(
      "CUSTOM-WIRE"
    );
  });

  it("warns when the same tag is used by different assets", () => {
    const model = packageModel();
    const conflicting: DrawingModel = {
      ...model,
      sheets: [
        {
          ...model.sheets[0],
          placements: [
            ...model.sheets[0].placements,
            {
              ...model.sheets[0].placements[2],
              id: "tsm_conflict",
              assetId: "asset_tsm_other"
            }
          ]
        }
      ]
    };

    expect(detectDuplicatePlacementTags(conflicting)).toEqual([
      expect.objectContaining({
        tag: "TSM-101",
        assetIds: ["asset_tsm_101", "asset_tsm_other"]
      })
    ]);
  });

  it("relinks one monitor occurrence to a new asset", () => {
    const model = packageModel();
    const linkedModel: DrawingModel = {
      ...model,
      sheets: [
        model.sheets[0],
        {
          ...model.sheets[0],
          id: "sheet_2",
          name: "Tank 2",
          placements: [
            {
              ...model.sheets[0].placements[2],
              id: "tsm_101_ref",
              x: 210
            }
          ],
          connections: []
        }
      ]
    };
    const relinked = createNewAssetFromPlacement(linkedModel, "tsm_101_ref", {
      symbols,
      tag: "TSM-102",
      placementTargets: [{ sheetId: "sheet_2", placementId: "tsm_101_ref" }]
    });
    const original = relinked.sheets[0].placements.find(
      (placement) => placement.id === "tsm_101"
    );
    const newReference = relinked.sheets[1].placements[0];

    expect(original).toMatchObject({
      assetId: "asset_tsm_101",
      tag: "TSM-101"
    });
    expect(newReference).toMatchObject({
      tag: "TSM-102"
    });
    expect(newReference.assetId).not.toBe("asset_tsm_101");
  });

  it("relinks multiple occurrences to one shared new asset", () => {
    const model = packageModel();
    const linkedModel: DrawingModel = {
      ...model,
      sheets: [
        model.sheets[0],
        {
          ...model.sheets[0],
          id: "sheet_2",
          name: "Tank 2 - A",
          placements: [{ ...model.sheets[0].placements[2], id: "tsm_a" }],
          connections: []
        },
        {
          ...model.sheets[0],
          id: "sheet_3",
          name: "Tank 2 - B",
          placements: [{ ...model.sheets[0].placements[2], id: "tsm_b" }],
          connections: []
        }
      ]
    };
    const relinked = createNewAssetFromPlacement(linkedModel, "tsm_a", {
      symbols,
      tag: "TSM-102",
      placementTargets: [
        { sheetId: "sheet_2", placementId: "tsm_a" },
        { sheetId: "sheet_3", placementId: "tsm_b" }
      ]
    });
    const newRefs = relinked.sheets
      .flatMap((sheet) => sheet.placements)
      .filter((placement) => placement.tag === "TSM-102");

    expect(newRefs).toHaveLength(2);
    expect(new Set(newRefs.map((placement) => placement.assetId)).size).toBe(1);
    expect(newRefs[0].assetId).not.toBe("asset_tsm_101");
  });

  it("relinks a placement to an existing compatible asset", () => {
    const model = packageModel();
    const linkedModel: DrawingModel = {
      ...model,
      sheets: [
        model.sheets[0],
        {
          ...model.sheets[0],
          id: "sheet_2",
          name: "Tank 2",
          placements: [
            {
              ...model.sheets[0].placements[2],
              id: "tsm_102",
              assetId: "asset_tsm_102",
              tag: "TSM-102"
            }
          ],
          connections: []
        }
      ]
    };
    const relinked = relinkPlacementsToExistingAsset(
      linkedModel,
      [{ sheetId: "sheet_1", placementId: "tsm_101" }],
      "asset_tsm_102",
      symbols
    );
    const relinkedPlacement = relinked.sheets[0].placements.find(
      (placement) => placement.id === "tsm_101"
    );

    expect(relinkedPlacement).toMatchObject({
      assetId: "asset_tsm_102",
      tag: "TSM-102"
    });
  });

  it("duplicates sheets with new cable/instrument assets and linked monitor assets by default", () => {
    const result = duplicateSheet(packageModel(), "sheet_1", symbols);
    const duplicate = result.model.sheets[1];
    const duplicatedTemperature = duplicate.placements.find(
      (placement) => placement.symbolId === temperatureSymbol.symbolId
    );
    const duplicatedCable = duplicate.placements.find(
      (placement) => placement.symbolId === cableSymbol.symbolId
    );
    const duplicatedMonitor = duplicate.placements.find(
      (placement) => placement.symbolId === monitorSymbol.symbolId
    );

    expect(duplicatedTemperature).toMatchObject({
      tag: "TT-102"
    });
    expect(duplicatedTemperature?.assetId).not.toBe("asset_tt_101");
    expect(duplicatedCable).toMatchObject({
      tag: "C-102"
    });
    expect(duplicatedCable?.assetId).not.toBe("asset_c_101");
    expect(duplicatedMonitor).toMatchObject({
      assetId: "asset_tsm_101",
      tag: "TSM-101"
    });
    expect(duplicate.connections[0].wireId).toBe("C-102-WHT");

    const catalog = buildDrawingAssetCatalog(result.model, symbols);
    expect(catalog.find((asset) => asset.assetId === "asset_tsm_101"))
      .toMatchObject({
        tag: "TSM-101",
        placementRefs: expect.arrayContaining([
          expect.objectContaining({ sheetNumber: 1 }),
          expect.objectContaining({ sheetNumber: 2 })
        ])
      });
  });

  it("duplicates sheets as a new system with new monitor assets", () => {
    const model = packageModel();
    model.assets = [
      {
        id: "asset_tsm_101",
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
    const result = duplicateSheet(model, "sheet_1", symbols, {
      duplicateMode: "new-system"
    });
    const duplicate = result.model.sheets[1];
    const duplicatedMonitor = duplicate.placements.find(
      (placement) => placement.symbolId === monitorSymbol.symbolId
    );

    expect(duplicatedMonitor).toMatchObject({
      tag: "TSM-102"
    });
    expect(duplicatedMonitor?.assetId).not.toBe("asset_tsm_101");
    expect(duplicate.connections[0].wireId).toBe("C-102-WHT");
    expect(
      result.model.assets.find((asset) => asset.id === duplicatedMonitor?.assetId)
        ?.componentSelections
    ).toEqual(model.assets[0].componentSelections);
  });
});
