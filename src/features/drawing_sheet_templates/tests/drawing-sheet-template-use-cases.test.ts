import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  type DrawingModel
} from "@/features/drawing_canvas/data/schema";
import {
  DEFAULT_PANEL_ENCLOSURE_KIND,
  DEFAULT_PANEL_ENCLOSURE_HEIGHT,
  DEFAULT_PANEL_ENCLOSURE_WIDTH,
  GENERATED_PANEL_ENCLOSURE_SYMBOL_ID,
  GENERATED_PANEL_ENCLOSURE_VERSION_ID
} from "@/features/drawing_canvas/logic/services/drawing-asset-containment";
import type { ApprovedDrawingSymbol } from "@/features/drawing_canvas/types";
import {
  buildTemplateImportPlan,
  createSheetTemplateModel,
  instantiateTemplateSheet,
  type TemplateAssetResolutionChoice
} from "../logic/use_cases/drawing-sheet-template-use-cases";

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
const symbols = [cableSymbol, monitorSymbol, temperatureSymbol];

function packageModel(): DrawingModel {
  const defaultModel = createDefaultDrawingModel();
  const sheet = defaultModel.sheets[0];

  return {
    ...defaultModel,
    sheets: [
      {
        ...sheet,
        name: "Wiring",
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
          },
          {
            id: "conn_manual",
            from: { placementId: "tt_101", anchorKey: "CH1_T1" },
            to: { placementId: "c_101", anchorKey: "CH1_T1" },
            cablePlacementId: "c_101",
            conductorKey: "custom",
            wireId: "MANUAL-WIRE"
          }
        ]
      }
    ]
  };
}

function choicesFromPlan(
  plan: ReturnType<typeof buildTemplateImportPlan>
): TemplateAssetResolutionChoice[] {
  return plan.assets.map((asset) => ({
    templateAssetId: asset.templateAsset.templateAssetId,
    mode: asset.defaultMode,
    tag: asset.suggestedTag,
    targetAssetId: asset.targetAssetId
  }));
}

describe("drawing sheet template use cases", () => {
  it("saves a sheet as a template with template-local asset ids", () => {
    const template = createSheetTemplateModel({
      model: packageModel(),
      sheetId: "sheet_1",
      symbols,
      summary: "Reusable wiring sheet",
      keywords: ["tank", "wiring"]
    });

    expect(template.version).toBe(1);
    expect(template.assets).toHaveLength(3);
    expect(template.sheet.placements[0]).not.toHaveProperty("assetId");
    expect(template.sheet.placements[0].templateAssetId).toMatch(/^ta_/);
    expect(template.metadata.requiredSymbols).toHaveLength(3);
  });

  it("plans cable creation and compatible monitor references", () => {
    const model = packageModel();
    const template = createSheetTemplateModel({
      model,
      sheetId: "sheet_1",
      symbols
    });
    const plan = buildTemplateImportPlan({ model, template, symbols });
    const cable = plan.assets.find(
      (asset) => asset.templateAsset.originalTag === "C-101"
    );
    const monitor = plan.assets.find(
      (asset) => asset.templateAsset.originalTag === "TSM-101"
    );

    expect(cable).toMatchObject({
      defaultMode: "create",
      suggestedTag: "C-102",
      canReference: false
    });
    expect(monitor).toMatchObject({
      defaultMode: "reference",
      targetAssetId: "asset_tsm_101",
      canReference: true
    });
  });

  it("imports a template with mixed new and referenced assets", () => {
    const model = packageModel();
    const template = createSheetTemplateModel({
      model,
      sheetId: "sheet_1",
      symbols
    });
    const plan = buildTemplateImportPlan({ model, template, symbols });
    const imported = instantiateTemplateSheet({
      model,
      template,
      symbols,
      insertAfterSheetId: "sheet_1",
      choices: choicesFromPlan(plan)
    });
    const sheet = imported.model.sheets[1];
    const cable = sheet.placements.find((placement) => placement.tag === "C-102");
    const monitor = sheet.placements.find(
      (placement) => placement.symbolId === monitorSymbol.symbolId
    );

    expect(imported.sheetId).toBe(sheet.id);
    expect(cable?.assetId).not.toBe("asset_c_101");
    expect(monitor).toMatchObject({
      assetId: "asset_tsm_101",
      tag: "TSM-101"
    });
    expect(sheet.connections[0]).toMatchObject({
      wireId: "C-102-WHT",
      cablePlacementId: cable?.id
    });
    expect(sheet.connections[1].wireId).toBe("MANUAL-WIRE");
  });

  it("blocks import when a required approved symbol is missing", () => {
    const model = packageModel();
    const template = createSheetTemplateModel({
      model,
      sheetId: "sheet_1",
      symbols
    });
    const plan = buildTemplateImportPlan({
      model,
      template,
      symbols: [cableSymbol, temperatureSymbol]
    });

    expect(plan.canImport).toBe(false);
    expect(plan.warnings).toEqual([
      expect.objectContaining({ code: "missing_symbol" })
    ]);
    expect(() =>
      instantiateTemplateSheet({
        model,
        template,
        symbols: [cableSymbol, temperatureSymbol],
        choices: []
      })
    ).toThrow(/missing symbols/i);
  });

  it("saves and imports generated panel containment without approved symbols", () => {
    const base = createDefaultDrawingModel();
    const panel = {
      id: "panel_101",
      assetId: "asset_pdp_101",
      symbolId: GENERATED_PANEL_ENCLOSURE_SYMBOL_ID,
      versionId: GENERATED_PANEL_ENCLOSURE_VERSION_ID,
      role: "enclosure" as const,
      tag: "PDP-101",
      x: 20,
      y: 25,
      rotation: 0,
      scale: 1,
      enclosure: {
        kind: DEFAULT_PANEL_ENCLOSURE_KIND,
        width: DEFAULT_PANEL_ENCLOSURE_WIDTH,
        height: DEFAULT_PANEL_ENCLOSURE_HEIGHT
      }
    };
    const model: DrawingModel = {
      ...base,
      sheets: [
        {
          ...base.sheets[0],
          placements: [
            panel,
            {
              id: "tt_101",
              assetId: "asset_tt_101",
              containerAssetId: "asset_pdp_101",
              symbolId: temperatureSymbol.symbolId,
              versionId: temperatureSymbol.versionId,
              role: "device",
              tag: "TT-101",
              x: 40,
              y: 45,
              rotation: 0,
              scale: 0.34
            }
          ]
        }
      ]
    };
    const template = createSheetTemplateModel({
      model,
      sheetId: "sheet_1",
      symbols
    });
    const panelTemplateAsset = template.assets.find(
      (asset) => asset.originalTag === "PDP-101"
    );
    const childTemplatePlacement = template.sheet.placements.find(
      (placement) => placement.tag === "TT-101"
    );
    const plan = buildTemplateImportPlan({ model, template, symbols });
    const imported = instantiateTemplateSheet({
      model,
      template,
      symbols,
      choices: choicesFromPlan(plan),
      insertAfterSheetId: "sheet_1"
    });
    const importedSheet = imported.model.sheets[1];
    const importedPanel = importedSheet.placements.find(
      (placement) => placement.tag === "PDP-101"
    );
    const importedChild = importedSheet.placements.find(
      (placement) => placement.tag === "TT-102"
    );

    expect(template.metadata.requiredSymbols).toHaveLength(1);
    expect(childTemplatePlacement?.containerAssetId).toBe(
      panelTemplateAsset?.templateAssetId
    );
    expect(plan.canImport).toBe(true);
    expect(plan.assets.find((asset) => asset.templateAsset.originalTag === "PDP-101"))
      .toMatchObject({
        defaultMode: "reference",
        targetAssetId: "asset_pdp_101"
      });
    expect(importedPanel?.assetId).toBe("asset_pdp_101");
    expect(importedChild?.containerAssetId).toBe("asset_pdp_101");
  });
});
