import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  drawingPackageModelSchema,
  drawingSettingsDraftSchema,
  sheetSettingsDraftSchema,
  type DrawingModel
} from "../data/schema";
import {
  updatePackageTitleBlock,
  updateSheetMetadata
} from "../logic/commands/drawing-sheet-commands";
import { updateManagedAsset } from "@/features/drawing_asset_manager/logic/use_cases/drawing-asset-manager-use-cases";

describe("drawing and sheet settings", () => {
  it("rejects blank drawing and sheet names", () => {
    expect(
      drawingSettingsDraftSchema.safeParse({
        title: " ",
        titleBlock: {},
        measurementUnit: "mm"
      }).success
    ).toBe(false);
    expect(
      sheetSettingsDraftSchema.safeParse({
        name: " "
      }).success
    ).toBe(false);
  });

  it("updates drawing title-block and sheet metadata without changing geometry", () => {
    const model = createDefaultDrawingModel();
    const sheet = model.sheets[0];
    const withTitleBlock = updatePackageTitleBlock(model, {
      client: "Enermach",
      drawingNumber: "EI-101"
    });
    const updated = updateSheetMetadata(withTitleBlock, sheet.id, {
      name: "Panel Layout",
      description: "PLC panel physical arrangement"
    });

    expect(updated.titleBlock).toMatchObject({
      client: "Enermach",
      drawingNumber: "EI-101"
    });
    expect(updated.sheets[0]).toMatchObject({
      name: "Panel Layout",
      description: "PLC panel physical arrangement",
      placements: sheet.placements,
      connections: sheet.connections,
      annotations: sheet.annotations
    });
  });

  it("defaults legacy package models to millimetres", () => {
    const model = createDefaultDrawingModel();
    const legacyPackage = { ...model } as Partial<DrawingModel>;
    delete legacyPackage.measurementUnit;

    expect(drawingPackageModelSchema.parse(legacyPackage).measurementUnit).toBe(
      "mm"
    );
  });

  it("synchronizes a shared title across every asset occurrence", () => {
    const base = createDefaultDrawingModel();
    const placement = {
      id: "pl_relay",
      assetId: "asset_relay",
      symbolId: "sym_relay",
      versionId: "ver_relay",
      role: "device" as const,
      tag: "K-101",
      title: "Legacy placement title",
      x: 20,
      y: 20,
      rotation: 0,
      scale: 1
    };
    const secondSheet = {
      ...base.sheets[0],
      id: "sheet_2",
      name: "Sheet 2",
      placements: [{ ...placement, id: "pl_relay_2" }]
    };
    const model: DrawingModel = {
      ...base,
      assets: [
        {
          id: "asset_relay",
          tag: "K-101",
          type: "relay",
          title: "Shared relay",
          description: "Control relay",
          symbolId: "sym_relay",
          versionId: "ver_relay"
        }
      ],
      sheets: [
        { ...base.sheets[0], placements: [placement] },
        secondSheet
      ]
    };

    const updated = updateManagedAsset(
      model,
      "asset_relay",
      { title: "Main pump relay", description: undefined },
      []
    );

    expect(updated.assets[0]).toMatchObject({
      title: "Main pump relay",
      description: undefined
    });
    expect(
      updated.sheets.flatMap((sheet) =>
        sheet.placements.map((candidate) => candidate.title)
      )
    ).toEqual(["Main pump relay", "Main pump relay"]);
  });
});
