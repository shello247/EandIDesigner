import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  buildPanelTerminalCatalog,
  createPanelTerminalRef,
  getTerminalSideOccupancy
} from "../api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

describe("panel terminal catalog", () => {
  it("builds stable logical terminal rows with side occupancy", () => {
    const graph = buildPackageConnectivityGraph(
      createGenericPanelWiringSource()
    );
    const catalog = buildPanelTerminalCatalog({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID
    });
    const firstTerminal = createPanelTerminalRef({
      assetId: GENERIC_TERMINAL_ASSET_IDS[0],
      terminalKey: "T1"
    });

    expect(catalog.rowsByTerminalId.size).toBe(20);
    expect(
      getTerminalSideOccupancy(catalog, {
        ...firstTerminal,
        side: "external"
      })
    ).toMatchObject({
      status: "occupied",
      occupants: [
        expect.objectContaining({
          kind: "external_termination",
          wireId: "CBL-001-W1"
        })
      ]
    });
    expect(
      getTerminalSideOccupancy(catalog, {
        ...firstTerminal,
        side: "internal"
      })
    ).toEqual({
      ref: { ...firstTerminal, side: "internal" },
      status: "available",
      occupants: [],
      conductorStatus: "available",
      conductorOccupants: [],
      structuralStatus: "available",
      structuralOccupants: []
    });
  });

  it("includes internal wires, bridges, and bonds in side occupancy", () => {
    const source = createGenericPanelWiringSource();
    const target = {
      assetId: GENERIC_TERMINAL_ASSET_IDS[0],
      terminalKey: "T4",
      side: "internal" as const
    };
    const graph = buildPackageConnectivityGraph({
      ...source,
      panelWiring: {
        schemaVersion: 1,
        terminalMappings: [],
        internalWires: [
          {
            id: "internal_wire_fixture",
            panelAssetId: GENERIC_PANEL_ASSET_ID,
            wireId: "PW-001",
            from: target,
            to: {
              assetId: GENERIC_TERMINAL_ASSET_IDS[1],
              terminalKey: "T4",
              side: "internal"
            },
            origin: "engineer"
          }
        ],
        bridges: [
          {
            id: "bridge_fixture",
            panelAssetId: GENERIC_PANEL_ASSET_ID,
            kind: "jumper",
            members: [
              target,
              {
                assetId: GENERIC_TERMINAL_ASSET_IDS[1],
                terminalKey: "T5",
                side: "internal"
              }
            ],
            origin: "engineer"
          }
        ],
        bonds: [
          {
            id: "bond_fixture",
            panelAssetId: GENERIC_PANEL_ASSET_ID,
            kind: "signal_ground",
            endpoints: [{ kind: "terminal", terminal: target }],
            origin: "engineer"
          }
        ]
      }
    });
    const catalog = buildPanelTerminalCatalog({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID
    });
    const occupancy = getTerminalSideOccupancy(catalog, target);

    expect(occupancy?.status).toBe("conflicting");
    expect(occupancy?.conductorStatus).toBe("occupied");
    expect(occupancy?.structuralStatus).toBe("conflicting");
    expect(occupancy?.occupants.map((occupant) => occupant.kind).sort()).toEqual(
      ["bond", "bridge", "internal_wire"]
    );
    expect(catalog.findings).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "duplicate_terminal_structural_occupancy",
        terminal: target
      })
    ]);
  });
});
