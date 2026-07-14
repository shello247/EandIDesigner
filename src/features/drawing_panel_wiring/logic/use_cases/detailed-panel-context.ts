import { z } from "zod";
import {
  panelWiringSourcePackageSchema,
  type PanelWiringSourcePackage
} from "../../data/schema";
import type {
  PanelConnectivityFinding,
  PanelWiringCommandResult
} from "../../types";
import { setPanelDrawingContext } from "./update-panel-wiring-context";

export type DetailedPanelSourceSheet = {
  sheetId: string;
  sheetNumber: number;
  name: string;
};

export type CompatiblePanelOption = {
  assetId: string;
  tag: string;
  title: string;
  type: "panel" | "junction_box";
  sourceSheets: DetailedPanelSourceSheet[];
};

export type DetailedPanelDrawingContextView = CompatiblePanelOption & {
  sheetId: string;
  panelAssetId: string;
  purpose: "detailed_panel_wiring";
  workflowFocusAssetId?: string;
};

const contextInputSchema = z.object({
  sheetId: z.string().trim().min(1),
  panelAssetId: z.string().trim().min(1)
});

function naturalTagCompare(
  first: CompatiblePanelOption,
  second: CompatiblePanelOption
): number {
  return first.tag.localeCompare(second.tag, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function panelAssetIds(source: PanelWiringSourcePackage): Set<string> {
  const ids = new Set(
    source.assets
      .filter((asset) => ["panel", "junction_box"].includes(asset.type))
      .map((asset) => asset.id)
  );

  source.sheets.forEach((sheet) => {
    sheet.occurrences.forEach((occurrence) => {
      if (occurrence.role === "enclosure" && occurrence.assetId) {
        ids.add(occurrence.assetId);
      }
    });
  });

  return ids;
}

function sourceSheetsForPanel(
  source: PanelWiringSourcePackage,
  panelAssetId: string
): DetailedPanelSourceSheet[] {
  return source.sheets
    .filter(
      (sheet) =>
        !sheet.panelDrawingContext &&
        sheet.occurrences.some(
          (occurrence) =>
            occurrence.assetId === panelAssetId ||
            occurrence.containerAssetId === panelAssetId
        )
    )
    .map((sheet) => ({
      sheetId: sheet.id,
      sheetNumber: sheet.sheetNumber,
      name: sheet.name
    }))
    .sort((first, second) => first.sheetNumber - second.sheetNumber);
}

export function buildCompatiblePanelOptions(
  input: PanelWiringSourcePackage
): CompatiblePanelOption[] {
  const source = panelWiringSourcePackageSchema.parse(input);
  const compatibleIds = panelAssetIds(source);

  return [...compatibleIds]
    .map((assetId) => {
      const asset = source.assets.find((candidate) => candidate.id === assetId);

      if (!asset) {
        return undefined;
      }

      return {
        assetId,
        tag: asset.tag,
        title: asset.title,
        type:
          asset.type === "junction_box"
            ? ("junction_box" as const)
            : ("panel" as const),
        sourceSheets: sourceSheetsForPanel(source, assetId)
      };
    })
    .filter((option): option is CompatiblePanelOption => Boolean(option))
    .sort(naturalTagCompare);
}

export function validatePanelDrawingContext(
  input: PanelWiringSourcePackage,
  sheetId: string
): PanelConnectivityFinding[] {
  const source = panelWiringSourcePackageSchema.parse(input);
  const normalizedSheetId = z.string().trim().min(1).parse(sheetId);
  const sheet = source.sheets.find(
    (candidate) => candidate.id === normalizedSheetId
  );

  if (!sheet) {
    return [
      {
        id: `detailed_panel:missing_sheet:${normalizedSheetId}`,
        severity: "error",
        code: "missing_detailed_panel_sheet",
        message: "The Detailed Panel Drawing sheet is not available."
      }
    ];
  }

  if (!sheet.panelDrawingContext) {
    return [
      {
        id: `detailed_panel:missing_context:${normalizedSheetId}`,
        severity: "error",
        code: "missing_detailed_panel_context",
        message: "The sheet is not associated with a panel or enclosure."
      }
    ];
  }

  const option = buildCompatiblePanelOptions(source).find(
    (candidate) =>
      candidate.assetId === sheet.panelDrawingContext?.panelAssetId
  );

  if (!option) {
    return [
      {
        id: `detailed_panel:invalid_asset:${normalizedSheetId}`,
        severity: "error",
        code: "invalid_detailed_panel_asset",
        message:
          "The sheet references a missing asset or an asset that is not a panel or enclosure.",
        panelAssetId: sheet.panelDrawingContext.panelAssetId
      }
    ];
  }

  return [];
}

export function getDetailedPanelDrawingContext(
  input: PanelWiringSourcePackage,
  sheetId: string
): DetailedPanelDrawingContextView | undefined {
  const source = panelWiringSourcePackageSchema.parse(input);
  const sheet = source.sheets.find((candidate) => candidate.id === sheetId);
  const panelAssetId = sheet?.panelDrawingContext?.panelAssetId;

  if (!sheet || !panelAssetId) {
    return undefined;
  }

  const panel = buildCompatiblePanelOptions(source).find(
    (candidate) => candidate.assetId === panelAssetId
  );

  if (!panel) {
    return undefined;
  }

  return {
    ...panel,
    sheetId,
    panelAssetId,
    purpose: "detailed_panel_wiring",
    workflowFocusAssetId: sheet.panelDrawingContext?.workflowFocusAssetId
  };
}

export function updateDetailedPanelDrawingContext(
  source: PanelWiringSourcePackage,
  input: { sheetId: string; panelAssetId: string }
): PanelWiringCommandResult {
  const parsed = contextInputSchema.parse(input);

  return setPanelDrawingContext(source, parsed);
}
