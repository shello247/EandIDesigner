import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  getExternalTerminationProvenance,
  getPanelConnectivitySnapshot,
  getTerminalByRef,
  validatePanelConnectivitySource
} from "../api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

describe("drawing panel wiring connectivity graph", () => {
  it("deduplicates physical assets and discovers field terminations", () => {
    const graph = buildPackageConnectivityGraph(
      createGenericPanelWiringSource()
    );
    const snapshot = getPanelConnectivitySnapshot(
      graph,
      GENERIC_PANEL_ASSET_ID
    );

    expect(snapshot.assets.map((asset) => asset.id)).toEqual([
      GENERIC_PANEL_ASSET_ID,
      ...GENERIC_TERMINAL_ASSET_IDS
    ]);
    expect(snapshot.terminals).toHaveLength(20);
    expect(snapshot.terminalSides).toHaveLength(40);
    expect(snapshot.externalTerminations).toHaveLength(12);
    expect(
      snapshot.externalTerminations.every(
        (termination) =>
          termination.status === "resolved" &&
          termination.target?.side === "external"
      )
    ).toBe(true);
    expect(snapshot.occurrences.some((item) => item.tag === "DIN Rail")).toBe(
      false
    );
  });

  it("keeps logical terminal identity independent of drawing occurrences", () => {
    const graph = buildPackageConnectivityGraph(
      createGenericPanelWiringSource()
    );
    const terminal = getTerminalByRef(graph, {
      assetId: GENERIC_TERMINAL_ASSET_IDS[0],
      terminalKey: "T1"
    });

    expect(terminal?.supportedSides).toEqual(["external", "internal"]);
    expect(terminal?.occurrenceRefs).toEqual([
      { sheetId: "sheet_field_1", placementId: "strip_1" },
      { sheetId: "sheet_layout", placementId: "layout_strip_1" }
    ]);
  });

  it("preserves source sheet, wire, cable, conductor, and endpoint provenance", () => {
    const graph = buildPackageConnectivityGraph(
      createGenericPanelWiringSource()
    );
    const termination = [...graph.externalTerminationsById.values()].find(
      (candidate) => candidate.wireId === "CBL-001-W1"
    );

    expect(termination).toMatchObject({
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      status: "resolved",
      sourceSheet: {
        id: "sheet_field_1",
        number: 1,
        name: "Field Connection 1"
      },
      cableAssetId: "asset_cable_1",
      cableTag: "CBL-001",
      conductorKey: "W1",
      target: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T1",
        side: "external"
      }
    });
    expect(
      termination
        ? getExternalTerminationProvenance(graph, termination.id)
        : undefined
    ).toMatchObject({
      cablePlacementId: "cable_1",
      source: {
        sheetId: "sheet_field_1",
        connectionId: "connection_1_1",
        endpointRole: "to",
        placementId: "strip_1",
        anchorKey: "T1_BOTTOM"
      }
    });
  });

  it("indexes package-level internal wires, bridges, and bonds", () => {
    const source = createGenericPanelWiringSource();
    const firstTerminal = {
      assetId: GENERIC_TERMINAL_ASSET_IDS[0],
      terminalKey: "T1",
      side: "internal" as const
    };
    const secondTerminal = {
      assetId: GENERIC_TERMINAL_ASSET_IDS[1],
      terminalKey: "T1",
      side: "internal" as const
    };
    const graph = buildPackageConnectivityGraph({
      ...source,
      panelWiring: {
        schemaVersion: 1,
        terminalMappings: [],
        internalWires: [
          {
            id: "internal_wire_1",
            panelAssetId: GENERIC_PANEL_ASSET_ID,
            wireId: "PW-001",
            from: firstTerminal,
            to: secondTerminal,
            origin: "engineer"
          }
        ],
        bridges: [
          {
            id: "bridge_1",
            panelAssetId: GENERIC_PANEL_ASSET_ID,
            kind: "jumper",
            members: [firstTerminal, secondTerminal],
            origin: "engineer"
          }
        ],
        bonds: [
          {
            id: "bond_1",
            panelAssetId: GENERIC_PANEL_ASSET_ID,
            kind: "protective_earth",
            endpoints: [
              { kind: "terminal", terminal: firstTerminal },
              {
                kind: "panel_reference",
                panelAssetId: GENERIC_PANEL_ASSET_ID,
                referenceKind: "protective_earth"
              }
            ],
            origin: "engineer"
          }
        ]
      }
    });
    const snapshot = getPanelConnectivitySnapshot(
      graph,
      GENERIC_PANEL_ASSET_ID
    );

    expect(snapshot.internalWires.map((wire) => wire.id)).toEqual([
      "internal_wire_1"
    ]);
    expect(snapshot.bridges.map((bridge) => bridge.id)).toEqual(["bridge_1"]);
    expect(snapshot.bonds.map((bond) => bond.id)).toEqual(["bond_1"]);
    expect(snapshot.findings.map((finding) => finding.code).sort()).toEqual([
      "legacy_bond_definition",
      "legacy_pattern_definition"
    ]);
  });

  it("returns structured validation findings for malformed source data", () => {
    expect(validatePanelConnectivitySource({ assets: [], sheets: "invalid" })).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "invalid_panel_wiring_source"
      })
    ]);
  });
});
