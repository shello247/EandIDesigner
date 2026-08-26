import {
  panelWiringMutationSchema,
  type PanelWiringMutation,
  type PanelWiringSourcePackage
} from "@/features/drawing_panel_wiring/api/contracts";
import type { DrawingModel } from "../data/schema";
import { drawingPackageModelSchema } from "../data/schema";
import type { ApprovedDrawingSymbol } from "../types";
import { buildDrawingPanelWiringSource } from "../logic/services/drawing-panel-wiring-source";
import { normalizeNetworkDeviceDrawingAssets } from "../logic/services/drawing-network-device-assets";

function emptyPanelWiringData() {
  return {
    schemaVersion: 1 as const,
    terminalMappings: [],
    internalWires: [],
    bridges: [],
    bonds: [],
    wireNumberSettings: undefined,
    panelSettings: [],
    patternSettings: []
  };
}

function removeEmptyPanelWiringData(model: DrawingModel): DrawingModel {
  const data = model.panelWiring;

  if (
    data &&
    data.terminalMappings.length === 0 &&
    data.internalWires.length === 0 &&
    data.bridges.length === 0 &&
    data.bonds.length === 0 &&
    !data.wireNumberSettings &&
    (data.panelSettings?.length ?? 0) === 0 &&
    (data.patternSettings?.length ?? 0) === 0
  ) {
    return { ...model, panelWiring: undefined };
  }

  return model;
}

export function createPanelWiringSource(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): PanelWiringSourcePackage {
  return buildDrawingPanelWiringSource(
    normalizeNetworkDeviceDrawingAssets(model, symbols),
    symbols
  );
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

    if (mutation.kind === "upsert-internal-wire") {
      next = {
        ...next,
        panelWiring: {
          ...panelWiring,
          internalWires: [
            ...panelWiring.internalWires.filter(
              (wire) => wire.id !== mutation.wire.id
            ),
            mutation.wire
          ].sort((first, second) => first.id.localeCompare(second.id))
        }
      };
      continue;
    }

    if (mutation.kind === "remove-internal-wire") {
      next = {
        ...next,
        panelWiring: {
          ...panelWiring,
          internalWires: panelWiring.internalWires.filter(
            (wire) => wire.id !== mutation.wireId
          )
        }
      };
      continue;
    }

    if (mutation.kind === "upsert-panel-wire-settings") {
      next = {
        ...next,
        panelWiring: {
          ...panelWiring,
          panelSettings: [
            ...(panelWiring.panelSettings ?? []).filter(
              (settings) => settings.panelAssetId !== mutation.settings.panelAssetId
            ),
            mutation.settings
          ].sort((first, second) =>
            first.panelAssetId.localeCompare(second.panelAssetId)
          )
        }
      };
      continue;
    }

    if (mutation.kind === "upsert-wire-number-settings") {
      next = {
        ...next,
        panelWiring: {
          ...panelWiring,
          wireNumberSettings: mutation.settings
        }
      };
      continue;
    }

    if (mutation.kind === "upsert-bridge") {
      next = {
        ...next,
        panelWiring: {
          ...panelWiring,
          bridges: [
            ...panelWiring.bridges.filter(
              (bridge) => bridge.id !== mutation.bridge.id
            ),
            mutation.bridge
          ].sort((first, second) => first.id.localeCompare(second.id))
        }
      };
      continue;
    }

    if (mutation.kind === "remove-bridge") {
      next = {
        ...next,
        panelWiring: {
          ...panelWiring,
          bridges: panelWiring.bridges.filter(
            (bridge) => bridge.id !== mutation.bridgeId
          )
        }
      };
      continue;
    }

    if (mutation.kind === "upsert-bond") {
      next = {
        ...next,
        panelWiring: {
          ...panelWiring,
          bonds: [
            ...panelWiring.bonds.filter((bond) => bond.id !== mutation.bond.id),
            mutation.bond
          ].sort((first, second) => first.id.localeCompare(second.id))
        }
      };
      continue;
    }

    if (mutation.kind === "remove-bond") {
      next = {
        ...next,
        panelWiring: {
          ...panelWiring,
          bonds: panelWiring.bonds.filter((bond) => bond.id !== mutation.bondId)
        }
      };
      continue;
    }

    if (mutation.kind === "upsert-panel-pattern-settings") {
      next = {
        ...next,
        panelWiring: {
          ...panelWiring,
          patternSettings: [
            ...(panelWiring.patternSettings ?? []).filter(
              (settings) => settings.panelAssetId !== mutation.settings.panelAssetId
            ),
            mutation.settings
          ].sort((first, second) =>
            first.panelAssetId.localeCompare(second.panelAssetId)
          )
        }
      };
      continue;
    }

    if (mutation.kind === "remove-terminal-mapping") {
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
