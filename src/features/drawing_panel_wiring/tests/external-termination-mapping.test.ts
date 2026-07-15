import { describe, expect, it } from "vitest";
import type {
  PanelWiringMutation,
  PanelWiringSourcePackage
} from "../api/contracts";
import {
  buildPackageConnectivityGraph,
  mapExternalTerminationToTerminal,
  resetExternalTerminationMapping
} from "../api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

function applyMutations(
  source: PanelWiringSourcePackage,
  mutations: PanelWiringMutation[]
): PanelWiringSourcePackage {
  let mappings = [...(source.panelWiring?.terminalMappings ?? [])];

  mutations.forEach((mutation) => {
    if (mutation.kind === "upsert-terminal-mapping") {
      mappings = [
        ...mappings.filter((mapping) => mapping.id !== mutation.mapping.id),
        mutation.mapping
      ];
    } else if (mutation.kind === "remove-terminal-mapping") {
      mappings = mappings.filter(
        (mapping) => mapping.id !== mutation.mappingId
      );
    }
  });

  return {
    ...source,
    panelWiring:
      mappings.length > 0
        ? {
            schemaVersion: 1,
            terminalMappings: mappings,
            internalWires: source.panelWiring?.internalWires ?? [],
            bridges: source.panelWiring?.bridges ?? [],
            bonds: source.panelWiring?.bonds ?? []
          }
        : undefined
  };
}

function terminationByWire(source: PanelWiringSourcePackage, wireId: string) {
  return [...buildPackageConnectivityGraph(source).externalTerminationsById.values()].find(
    (termination) => termination.wireId === wireId
  )!;
}

describe("external termination mapping", () => {
  it("creates a manual override, preserves inferred target, and resets", () => {
    const source = createGenericPanelWiringSource();
    const automatic = terminationByWire(source, "CBL-001-W1");
    const manualTarget = {
      assetId: GENERIC_TERMINAL_ASSET_IDS[0],
      terminalKey: "T4",
      side: "external" as const
    };
    const command = mapExternalTerminationToTerminal(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      terminationId: automatic.id,
      target: manualTarget
    });
    const withManualMapping = applyMutations(source, command.mutations);
    const manual = terminationByWire(withManualMapping, "CBL-001-W1");
    const reset = resetExternalTerminationMapping(withManualMapping, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      terminationId: manual.id
    });
    const restored = terminationByWire(
      applyMutations(withManualMapping, reset.mutations),
      "CBL-001-W1"
    );

    expect(command.warnings).toEqual([]);
    expect(command.mutations).toEqual([
      expect.objectContaining({
        kind: "upsert-terminal-mapping",
        mapping: expect.objectContaining({ target: manualTarget })
      })
    ]);
    expect(manual).toMatchObject({
      mappingMode: "manual",
      inferredTarget: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T1",
        side: "external"
      },
      target: manualTarget
    });
    expect(restored).toMatchObject({
      mappingMode: "automatic",
      target: automatic.target
    });
  });

  it("allows mapping to a free terminal on another associated asset", () => {
    const source = createGenericPanelWiringSource();
    const termination = terminationByWire(source, "CBL-001-W1");
    const command = mapExternalTerminationToTerminal(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      terminationId: termination.id,
      target: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[1],
        terminalKey: "T4",
        side: "external"
      }
    });

    expect(command.warnings).toEqual([]);
    expect(command.mutations).toHaveLength(1);
  });

  it("removes a redundant override when selecting the inferred target", () => {
    const source = createGenericPanelWiringSource();
    const termination = terminationByWire(source, "CBL-001-W1");
    const manual = mapExternalTerminationToTerminal(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      terminationId: termination.id,
      target: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T4",
        side: "external"
      }
    });
    const withManual = applyMutations(source, manual.mutations);
    const mapped = terminationByWire(withManual, "CBL-001-W1");
    const automatic = mapExternalTerminationToTerminal(withManual, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      terminationId: mapped.id,
      target: termination.inferredTarget!
    });

    expect(automatic.mutations).toEqual([
      expect.objectContaining({ kind: "remove-terminal-mapping" })
    ]);
  });

  it("blocks internal and occupied field terminal sides", () => {
    const source = createGenericPanelWiringSource();
    const termination = terminationByWire(source, "CBL-001-W2");
    const internal = mapExternalTerminationToTerminal(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      terminationId: termination.id,
      target: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T4",
        side: "internal"
      }
    });
    const occupied = mapExternalTerminationToTerminal(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      terminationId: termination.id,
      target: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T1",
        side: "external"
      }
    });

    expect(internal.warnings).toEqual([
      expect.objectContaining({ code: "invalid_field_terminal_side" })
    ]);
    expect(occupied.warnings).toEqual([
      expect.objectContaining({ code: "terminal_side_occupied" })
    ]);
    expect(internal.mutations).toEqual([]);
    expect(occupied.mutations).toEqual([]);
  });
});

