import {
  panelWiringMutationSchema,
  type PanelWiringMutation,
  type PanelWiringSourcePackage
} from "@/features/drawing_panel_wiring/api/contracts";
import type { DrawingModel } from "../data/schema";
import { drawingPackageModelSchema } from "../data/schema";
import type { ApprovedDrawingSymbol } from "../types";
import { buildDrawingPanelWiringSource } from "../logic/services/drawing-panel-wiring-source";

function emptyPanelWiringData() {
  return {
    schemaVersion: 1 as const,
    terminalMappings: [],
    internalWires: [],
    bridges: [],
    bonds: []
  };
}

function removeEmptyPanelWiringData(model: DrawingModel): DrawingModel {
  const data = model.panelWiring;

  if (
    data &&
    data.terminalMappings.length === 0 &&
    data.internalWires.length === 0 &&
    data.bridges.length === 0 &&
    data.bonds.length === 0
  ) {
    return { ...model, panelWiring: undefined };
  }

  return model;
}

export function createPanelWiringSource(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): PanelWiringSourcePackage {
  return buildDrawingPanelWiringSource(model, symbols);
}

export function applyPanelWiringMutations(
  model: DrawingModel,
  inputMutations: PanelWiringMutation | PanelWiringMutation[]
): DrawingModel {
  const mutations = (Array.isArray(inputMutations)
    ? inputMutations
    : [inputMutations]
  ).map((mutation) => panelWiringMutationSchema.parse(mutation));
  let next = model;

  for (const mutation of mutations) {
    if (mutation.kind === "set-panel-context") {
      next = {
        ...next,
        sheets: next.sheets.map((sheet) =>
          sheet.id === mutation.sheetId
            ? { ...sheet, panelDrawingContext: mutation.context }
            : sheet
        )
      };
      continue;
    }

    if (mutation.kind === "clear-panel-context") {
      next = {
        ...next,
        sheets: next.sheets.map((sheet) =>
          sheet.id === mutation.sheetId
            ? { ...sheet, panelDrawingContext: undefined }
            : sheet
        )
      };
      continue;
    }

    const panelWiring = next.panelWiring ?? emptyPanelWiringData();

    if (mutation.kind === "upsert-terminal-mapping") {
      next = {
        ...next,
        panelWiring: {
          ...panelWiring,
          terminalMappings: [
            ...panelWiring.terminalMappings.filter(
              (mapping) => mapping.id !== mutation.mapping.id
            ),
            mutation.mapping
          ].sort((first, second) => first.id.localeCompare(second.id))
        }
      };
      continue;
    }

    next = {
      ...next,
      panelWiring: {
        ...panelWiring,
        terminalMappings: panelWiring.terminalMappings.filter(
          (mapping) => mapping.id !== mutation.mappingId
        )
      }
    };
  }

  return drawingPackageModelSchema.parse(removeEmptyPanelWiringData(next));
}

export type {
  PanelDrawingContext,
  PanelSourceEndpointRef,
  PanelTerminalMapping,
  PanelTerminalRef,
  PanelTerminalSide,
  PanelTerminalSideRef,
  PanelWiringMutation,
  PanelWiringPackageData,
  PanelWiringSourcePackage
} from "@/features/drawing_panel_wiring/api/contracts";
