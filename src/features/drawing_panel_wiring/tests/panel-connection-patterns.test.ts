import { describe, expect, it } from "vitest";
import type {
  PanelWiringMutation,
  PanelWiringSourcePackage
} from "../data/schema";
import {
  buildPackageConnectivityGraph,
  buildPanelConnectionPatternCatalog,
  buildPanelTerminalCatalog,
  createDistributionGroup,
  createEarthTermination,
  createTerminalJumper,
  deletePanelConnectionPattern
} from "../api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

const terminal = (assetId: string, number: number) => ({
  assetId,
  terminalKey: `T${number}`,
  side: "internal" as const
});

function applyMutations(
  source: PanelWiringSourcePackage,
  mutations: PanelWiringMutation[]
): PanelWiringSourcePackage {
  const panelWiring = {
    schemaVersion: 1 as const,
    terminalMappings: [...(source.panelWiring?.terminalMappings ?? [])],
    internalWires: [...(source.panelWiring?.internalWires ?? [])],
    bridges: [...(source.panelWiring?.bridges ?? [])],
    bonds: [...(source.panelWiring?.bonds ?? [])],
    panelSettings: [...(source.panelWiring?.panelSettings ?? [])],
    patternSettings: [...(source.panelWiring?.patternSettings ?? [])]
  };
  for (const mutation of mutations) {
    if (mutation.kind === "upsert-internal-wire") {
      panelWiring.internalWires = [
        ...panelWiring.internalWires.filter((wire) => wire.id !== mutation.wire.id),
        mutation.wire
      ];
    } else if (mutation.kind === "remove-internal-wire") {
      panelWiring.internalWires = panelWiring.internalWires.filter(
        (wire) => wire.id !== mutation.wireId
      );
    } else if (mutation.kind === "upsert-bridge") {
      panelWiring.bridges = [
        ...panelWiring.bridges.filter((bridge) => bridge.id !== mutation.bridge.id),
        mutation.bridge
      ];
    } else if (mutation.kind === "remove-bridge") {
      panelWiring.bridges = panelWiring.bridges.filter(
        (bridge) => bridge.id !== mutation.bridgeId
      );
    } else if (mutation.kind === "upsert-bond") {
      panelWiring.bonds = [
        ...panelWiring.bonds.filter((bond) => bond.id !== mutation.bond.id),
        mutation.bond
      ];
    } else if (mutation.kind === "remove-bond") {
      panelWiring.bonds = panelWiring.bonds.filter(
        (bond) => bond.id !== mutation.bondId
      );
    } else if (mutation.kind === "upsert-panel-wire-settings") {
      panelWiring.panelSettings = [
        ...panelWiring.panelSettings.filter(
          (settings) => settings.panelAssetId !== mutation.settings.panelAssetId
        ),
        mutation.settings
      ];
    } else if (mutation.kind === "upsert-panel-pattern-settings") {
      panelWiring.patternSettings = [
        ...panelWiring.patternSettings.filter(
          (settings) => settings.panelAssetId !== mutation.settings.panelAssetId
        ),
        mutation.settings
      ];
    }
  }
  return { ...source, panelWiring };
}

describe("panel connection patterns", () => {
  it("never rediscovers pattern routes as external field terminations", () => {
    const source = createGenericPanelWiringSource();
    const firstSheet = source.sheets[0];
    const route = {
      ...firstSheet.connections[0],
      id: "pattern_route_fixture",
      wireId: undefined,
      panelPatternId: "pattern_fixture",
      panelPatternSegmentId: "pattern_fixture:segment:1"
    };
    const graph = buildPackageConnectivityGraph({
      ...source,
      sheets: source.sheets.map((sheet) =>
        sheet.id === firstSheet.id
          ? { ...sheet, connections: [...sheet.connections, route] }
          : sheet
      )
    });

    expect(graph.externalTerminationsById.size).toBe(12);
  });

  it("creates a structural jumper without fake internal wires", () => {
    const source = createGenericPanelWiringSource();
    const result = createTerminalJumper(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      topology: "terminal_jumper",
      domain: "signal",
      members: [
        terminal(GENERIC_TERMINAL_ASSET_IDS[0], 4),
        terminal(GENERIC_TERMINAL_ASSET_IDS[0], 5)
      ]
    });

    expect(result.pattern?.record.patternCode).toBe("JMP-001");
    expect(result.wires).toEqual([]);
    expect(result.mutations.some((mutation) => mutation.kind === "upsert-bridge")).toBe(true);
    expect(result.mutations.some((mutation) => mutation.kind === "upsert-internal-wire")).toBe(false);
  });

  it("creates a daisy chain with one exclusively owned wire per adjacent pair", () => {
    const source = createGenericPanelWiringSource();
    const result = createDistributionGroup(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      topology: "daisy_chain",
      domain: "power",
      members: [
        terminal(GENERIC_TERMINAL_ASSET_IDS[0], 4),
        terminal(GENERIC_TERMINAL_ASSET_IDS[1], 4),
        terminal(GENERIC_TERMINAL_ASSET_IDS[2], 4)
      ]
    });

    expect(result.pattern?.record.patternCode).toBe("DC-001");
    expect(result.wires).toHaveLength(2);
    expect(result.wires?.every((wire) => wire.ownerPatternId === result.pattern?.record.id)).toBe(true);
    expect(result.wires?.map((wire) => wire.wireId)).toEqual([
      "ENC-001-W001",
      "ENC-001-W002"
    ]);

    const nextSource = applyMutations(source, result.mutations);
    const graph = buildPackageConnectivityGraph(nextSource);
    const catalog = buildPanelTerminalCatalog({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID
    });
    const middle = [...catalog.occupancyBySideId.values()].find(
      (occupancy) =>
        occupancy.ref.assetId === GENERIC_TERMINAL_ASSET_IDS[1] &&
        occupancy.ref.terminalKey === "T4" &&
        occupancy.ref.side === "internal"
    );
    expect(middle?.conductorOccupants).toHaveLength(2);
    expect(middle?.conductorStatus).toBe("occupied");
  });

  it("keeps counters monotonic after physical pattern deletion", () => {
    const source = createGenericPanelWiringSource();
    const first = createTerminalJumper(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      topology: "terminal_jumper",
      domain: "signal",
      members: [
        terminal(GENERIC_TERMINAL_ASSET_IDS[0], 4),
        terminal(GENERIC_TERMINAL_ASSET_IDS[0], 5)
      ]
    });
    const withFirst = applyMutations(source, first.mutations);
    const deleted = deletePanelConnectionPattern(
      withFirst,
      first.pattern!.record.id
    );
    const afterDelete = applyMutations(withFirst, deleted.mutations);
    const second = createTerminalJumper(afterDelete, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      topology: "terminal_jumper",
      domain: "signal",
      members: [
        terminal(GENERIC_TERMINAL_ASSET_IDS[1], 4),
        terminal(GENERIC_TERMINAL_ASSET_IDS[1], 5)
      ]
    });

    expect(second.pattern?.record.patternCode).toBe("JMP-002");
  });

  it("deletes a conductor pattern and every wire it owns", () => {
    const source = createGenericPanelWiringSource();
    const created = createDistributionGroup(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      topology: "distribution",
      domain: "neutral",
      source: terminal(GENERIC_TERMINAL_ASSET_IDS[0], 4),
      targets: [
        terminal(GENERIC_TERMINAL_ASSET_IDS[1], 4),
        terminal(GENERIC_TERMINAL_ASSET_IDS[2], 4)
      ]
    });
    const withPattern = applyMutations(source, created.mutations);
    const deleted = deletePanelConnectionPattern(
      withPattern,
      created.pattern!.record.id
    );

    expect(
      deleted.mutations.filter((mutation) => mutation.kind === "remove-internal-wire")
    ).toHaveLength(2);
    expect(deleted.mutations.some((mutation) => mutation.kind === "remove-bridge")).toBe(true);
  });

  it("catalogs bonds and represented routes without treating references as assets", () => {
    const source = createGenericPanelWiringSource();
    const created = createEarthTermination(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      kind: "protective_earth",
      source: terminal(GENERIC_TERMINAL_ASSET_IDS[0], 5),
      target: {
        kind: "panel_reference",
        panelAssetId: GENERIC_PANEL_ASSET_ID,
        referenceKind: "protective_earth"
      },
      targetDomain: "protective_earth"
    });
    const next = applyMutations(source, created.mutations);
    const rows = buildPanelConnectionPatternCatalog({
      graph: buildPackageConnectivityGraph(next),
      panelAssetId: GENERIC_PANEL_ASSET_ID
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].topology).toBe("protective_earth");
    expect(rows[0].ownedWireIds).toEqual([]);
    expect(rows[0].represented).toBe(false);
  });
});
