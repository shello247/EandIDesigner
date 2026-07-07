import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  type DrawingConnection,
  type DrawingModel,
  type DrawingPackageSheet,
  type DrawingPlacement
} from "../data/schema";
import {
  applySheetDuplicatePlan,
  buildSheetDuplicatePlan,
  suggestSheetDuplicateSourceLabel,
  suggestSheetDuplicateTargetLabel,
  updateSheetDuplicateChoice
} from "../logic/services/drawing-sheet-duplication";
import type { ApprovedDrawingSymbol } from "../types";

function symbol(input: {
  id: string;
  key: string;
  name: string;
  category: ApprovedDrawingSymbol["category"];
  model?: string;
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
      viewBox: { x: 0, y: 0, width: 100, height: 40 },
      anchors: [
        { key: "A", x: 0, y: 20, kind: "terminal" },
        { key: "B", x: 100, y: 20, kind: "terminal" }
      ],
      terminals: []
    }
  };
}

const monitorSymbol = symbol({
  id: "sym_monitor",
  key: "nrf81_tank_side_monitor",
  name: "NRF81 Tank Side Monitor",
  category: "monitor",
  model: "NRF81"
});
const cableSymbol = symbol({
  id: "sym_cable",
  key: "clx_cable_1_pair",
  name: "CLX Cable 1 Pair",
  category: "cable_assembly"
});
const temperatureSymbol = symbol({
  id: "sym_temp",
  key: "nmt81_average_temperature_probe",
  name: "NMT81 Average Temperature Probe",
  category: "instrument",
  model: "NMT81"
});
const symbols = [monitorSymbol, cableSymbol, temperatureSymbol];

function placement(overrides: Partial<DrawingPlacement>): DrawingPlacement {
  return {
    id: "pl_default",
    assetId: "asset_default",
    symbolId: temperatureSymbol.symbolId,
    versionId: temperatureSymbol.versionId,
    role: "device",
    tag: "TT-101",
    x: 20,
    y: 30,
    rotation: 0,
    scale: 0.34,
    ...overrides
  };
}

function sheet(
  base: DrawingPackageSheet,
  input: {
    id: string;
    name: string;
    instrumentId: string;
    instrumentAssetId: string;
    instrumentTag: string;
    cableId: string;
    cableAssetId: string;
    cableTag: string;
  }
): DrawingPackageSheet {
  const monitor = placement({
    id: `tsm_${input.id}`,
    assetId: "asset_tsm_101",
    symbolId: monitorSymbol.symbolId,
    versionId: monitorSymbol.versionId,
    tag: "TSM-101"
  });
  const instrument = placement({
    id: input.instrumentId,
    assetId: input.instrumentAssetId,
    symbolId: temperatureSymbol.symbolId,
    versionId: temperatureSymbol.versionId,
    tag: input.instrumentTag
  });
  const cable = placement({
    id: input.cableId,
    assetId: input.cableAssetId,
    symbolId: cableSymbol.symbolId,
    versionId: cableSymbol.versionId,
    role: "cable_assembly",
    tag: input.cableTag
  });
  const connection: DrawingConnection = {
    id: `conn_${input.id}`,
    from: { placementId: instrument.id, anchorKey: "A" },
    to: { placementId: monitor.id, anchorKey: "B" },
    cablePlacementId: cable.id,
    conductorKey: "WHT",
    wireId: `${input.cableTag}-WHT`
  };

  return {
    ...base,
    id: input.id,
    name: input.name,
    placements: [monitor, instrument, cable],
    connections: [connection],
    annotations: []
  };
}

function modelWithTankOneSheets(): DrawingModel {
  const model = createDefaultDrawingModel();
  const base = model.sheets[0];

  return {
    ...model,
    sheets: [
      sheet(base, {
        id: "sheet_1",
        name: "Tank 1 Prothermo to Tank Side Monitor",
        instrumentId: "tt_101",
        instrumentAssetId: "asset_tt_101",
        instrumentTag: "TT-101",
        cableId: "c_101",
        cableAssetId: "asset_c_101",
        cableTag: "C-101"
      }),
      sheet(base, {
        id: "sheet_2",
        name: "Tank 1 Radar to Tank Side Monitor",
        instrumentId: "lit_101",
        instrumentAssetId: "asset_lit_101",
        instrumentTag: "LIT-101",
        cableId: "c_102",
        cableAssetId: "asset_c_102",
        cableTag: "C-102"
      }),
      sheet(base, {
        id: "sheet_3",
        name: "Tank 1 Power Supply to Tank Side Monitor",
        instrumentId: "tt_102",
        instrumentAssetId: "asset_tt_102",
        instrumentTag: "TT-102",
        cableId: "c_103",
        cableAssetId: "asset_c_103",
        cableTag: "C-103"
      }),
      {
        ...base,
        id: "sheet_4",
        name: "Tank 1 Panel Reference",
        placements: [
          placement({
            id: "pdp_101",
            assetId: "asset_pdp_101",
            symbolId: "__generated_panel_enclosure__",
            versionId: "generated_panel_enclosure_v1",
            role: "enclosure",
            tag: "PDP-101",
            enclosure: {
              kind: "power_distribution_panel",
              title: "Power Distribution Panel",
              width: 90,
              height: 60
            }
          })
        ],
        connections: [],
        annotations: []
      }
    ]
  };
}

function buildTankTwoPlan(model: DrawingModel, sourceSheetId = "sheet_1") {
  return buildSheetDuplicatePlan({
    model,
    symbols,
    sourceSheetId,
    sourceLabel: "Tank 1",
    targetLabel: "Tank 2"
  });
}

describe("drawing sheet duplication", () => {
  it("suggests replacement labels from sheet names", () => {
    expect(suggestSheetDuplicateSourceLabel("Tank1 Prothermo")).toBe("Tank1");
    expect(suggestSheetDuplicateTargetLabel("Tank 1")).toBe("Tank 2");
  });

  it("duplicates only the active sheet and renames it", () => {
    const model = modelWithTankOneSheets();
    const plan = buildTankTwoPlan(model);
    const result = applySheetDuplicatePlan({ model, symbols, plan });

    expect(result.model.sheets).toHaveLength(model.sheets.length + 1);
    expect(result.model.sheets.find((item) => item.id === result.sheetId)?.name).toBe(
      "Tank 2 Prothermo to Tank Side Monitor"
    );
  });

  it("creates the first target controller asset when no target exists", () => {
    const model = modelWithTankOneSheets();
    const plan = buildTankTwoPlan(model);
    const tsmRow = plan.assetRows.find((row) => row.sourceTag === "TSM-101");

    expect(tsmRow).toMatchObject({
      action: "create",
      targetTag: "TSM-102"
    });
  });

  it("references an existing target controller on later duplicates", () => {
    const model = modelWithTankOneSheets();
    const firstPlan = buildTankTwoPlan(model);
    const firstResult = applySheetDuplicatePlan({ model, symbols, plan: firstPlan });
    const secondPlan = buildTankTwoPlan(firstResult.model, "sheet_2");
    const tsmRow = secondPlan.assetRows.find((row) => row.sourceTag === "TSM-101");

    expect(tsmRow).toMatchObject({
      action: "reference",
      targetTag: "TSM-102"
    });
  });

  it("creates new cable assets with package-wide tags", () => {
    const model = modelWithTankOneSheets();
    const firstPlan = buildTankTwoPlan(model);
    const firstResult = applySheetDuplicatePlan({ model, symbols, plan: firstPlan });
    const secondPlan = buildTankTwoPlan(firstResult.model, "sheet_2");

    expect(
      secondPlan.assetRows.find((row) => row.sourceTag === "C-102")
    ).toMatchObject({
      action: "create",
      targetTag: "C-105"
    });
  });

  it("defaults panel enclosures to referencing the existing asset", () => {
    const model = modelWithTankOneSheets();
    const plan = buildTankTwoPlan(model, "sheet_4");
    const panelRow = plan.assetRows.find((row) => row.sourceTag === "PDP-101");
    const result = applySheetDuplicatePlan({ model, symbols, plan });
    const duplicatedSheet = result.model.sheets.find(
      (sheetItem) => sheetItem.id === result.sheetId
    );

    expect(panelRow).toMatchObject({
      action: "reference",
      targetAssetId: "asset_pdp_101"
    });
    expect(duplicatedSheet?.placements[0]).toMatchObject({
      assetId: "asset_pdp_101",
      tag: "PDP-101"
    });
  });

  it("blocks target tags that already exist", () => {
    const model = modelWithTankOneSheets();
    const plan = buildTankTwoPlan(model);
    const tsmRow = plan.assetRows.find((row) => row.sourceTag === "TSM-101");
    const invalidPlan = updateSheetDuplicateChoice(plan, {
      sourceAssetId: tsmRow?.sourceAssetId ?? "",
      action: "create",
      targetTag: "TSM-101"
    });

    expect(invalidPlan.blockingErrors.join(" ")).toMatch(/already used/);
    expect(() =>
      applySheetDuplicatePlan({ model, symbols, plan: invalidPlan })
    ).toThrow(/already used/);
  });

  it("regenerates derived cable wire ids for duplicated sheets", () => {
    const model = modelWithTankOneSheets();
    const plan = buildTankTwoPlan(model);
    const result = applySheetDuplicatePlan({ model, symbols, plan });
    const duplicatedSheet = result.model.sheets.find(
      (sheetItem) => sheetItem.id === result.sheetId
    );

    expect(duplicatedSheet?.connections[0]?.wireId).toBe("C-104-WHT");
  });

  it("preserves manual wire ids and warns about them", () => {
    const model = modelWithTankOneSheets();
    const manualWireModel: DrawingModel = {
      ...model,
      sheets: model.sheets.map((sheetItem) =>
        sheetItem.id === "sheet_1"
          ? {
              ...sheetItem,
              connections: sheetItem.connections.map((connection) => ({
                ...connection,
                wireId: "FIELD-WIRE-1"
              }))
            }
          : sheetItem
      )
    };
    const plan = buildTankTwoPlan(manualWireModel);
    const result = applySheetDuplicatePlan({
      model: manualWireModel,
      symbols,
      plan
    });
    const duplicatedSheet = result.model.sheets.find(
      (sheetItem) => sheetItem.id === result.sheetId
    );

    expect(plan.warnings.join(" ")).toMatch(/manual wire ID/);
    expect(duplicatedSheet?.connections[0]?.wireId).toBe("FIELD-WIRE-1");
  });
});
