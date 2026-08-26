import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  getElectricalNetForTerminalSide,
  listElectricalNetworkConnections,
  traceElectricalPath
} from "../api/public";
import type {
  PanelWiringSourceOccurrence,
  PanelWiringSourcePackage,
  PanelWiringSourceTerminal
} from "../data/schema";
import { terminalSideNodeId } from "../logic/services/terminal-resolution";

function terminal(key: string): PanelWiringSourceTerminal {
  return {
    terminalKey: key,
    label: key,
    supportedSides: ["external", "internal"],
    status: "resolved",
    anchors: [
      { anchorKey: `${key}_OUT`, anchorKind: "terminal", sideHint: "external" },
      { anchorKey: `${key}_IN`, anchorKind: "terminal", sideHint: "internal" }
    ]
  };
}

function occurrence(input: {
  assetId: string;
  placementId: string;
  tag: string;
  terminals: string[];
  groups?: Array<{ key: string; terminalKeys: string[] }>;
}): PanelWiringSourceOccurrence {
  return {
    sheetId: "sheet_1",
    placementId: input.placementId,
    assetId: input.assetId,
    tag: input.tag,
    role: "terminal_block",
    occurrenceKind: "wiring",
    containerAssetId: "panel_1",
    symbolId: `${input.tag}_symbol`,
    versionId: `${input.tag}_v1`,
    electricalTopology: input.groups
      ? {
          version: 1,
          permanentContinuityGroups: input.groups.map((group) => ({
            ...group,
            symbolId: `${input.tag}_symbol`,
            versionId: `${input.tag}_v1`
          }))
        }
      : undefined,
    terminalResolutionStatus: "resolved",
    terminals: input.terminals.map(terminal)
  };
}

function source(): PanelWiringSourcePackage {
  const pdb = occurrence({
    assetId: "pdb_1",
    placementId: "pdb_1_placement",
    tag: "PDB-101",
    terminals: ["a", "b", "c"],
    groups: [{ key: "factory_bus", terminalKeys: ["a", "b", "c"] }]
  });
  const otherPdb = occurrence({
    assetId: "pdb_2",
    placementId: "pdb_2_placement",
    tag: "PDB-102",
    terminals: ["a", "b", "c"],
    groups: [{ key: "factory_bus", terminalKeys: ["a", "b", "c"] }]
  });
  const feedThrough = occurrence({
    assetId: "strip_1",
    placementId: "strip_1_placement",
    tag: "TB-101",
    terminals: ["M02.1", "M02.2"],
    groups: [
      {
        key: "M02.feed_through",
        terminalKeys: ["M02.1", "M02.2"]
      }
    ]
  });
  const cable = occurrence({
    assetId: "cable_1",
    placementId: "cable_1_placement",
    tag: "C-101",
    terminals: ["CORE01_A", "CORE01_B"],
    groups: [
      {
        key: "core_01",
        terminalKeys: ["CORE01_A", "CORE01_B"]
      }
    ]
  });
  const fuse = occurrence({
    assetId: "fuse_1",
    placementId: "fuse_1_placement",
    tag: "F-101",
    terminals: ["M12.1", "M12.2"]
  });

  return {
    assets: [
      { id: "panel_1", tag: "P-001", type: "panel", title: "Panel" },
      ...[
        ["pdb_1", "PDB-101"],
        ["pdb_2", "PDB-102"],
        ["strip_1", "TB-101"],
        ["cable_1", "C-101"],
        ["fuse_1", "F-101"]
      ].map(([id, tag]) => ({
        id,
        tag,
        type: id === "cable_1" ? ("cable" as const) : ("terminal_block" as const),
        title: tag
      }))
    ],
    sheets: [
      {
        id: "sheet_1",
        sheetNumber: 1,
        name: "Network",
        kind: "drawing",
        occurrences: [pdb, otherPdb, feedThrough, cable, fuse],
        connections: [
          {
            id: "connection_1",
            sheetId: "sheet_1",
            from: { placementId: "pdb_1_placement", anchorKey: "b_OUT" },
            to: { placementId: "cable_1_placement", anchorKey: "CORE01_A_OUT" },
            wireId: "C-101-CORE01-A",
            cableTag: "C-101",
            conductorKey: "CORE01"
          },
          {
            id: "connection_2",
            sheetId: "sheet_1",
            from: { placementId: "cable_1_placement", anchorKey: "CORE01_B_OUT" },
            to: { placementId: "strip_1_placement", anchorKey: "M02.1_OUT" },
            wireId: "C-101-CORE01-B",
            cableTag: "C-101",
            conductorKey: "CORE01"
          }
        ]
      }
    ],
    panelWiring: {
      schemaVersion: 1,
      terminalMappings: [],
      internalWires: [
        {
          id: "wire_1",
          panelAssetId: "panel_1",
          wireId: "P-001:001",
          from: { assetId: "strip_1", terminalKey: "M02.2", side: "internal" },
          to: { assetId: "fuse_1", terminalKey: "M12.1", side: "internal" },
          origin: "engineer"
        }
      ],
      bridges: [],
      bonds: []
    }
  };
}

describe("electrical network index", () => {
  it("builds transitive nets from terminal bodies, Registry groups, wires, and cables", () => {
    const graph = buildPackageConnectivityGraph(source());
    const pdbNet = getElectricalNetForTerminalSide(graph, {
      assetId: "pdb_1",
      terminalKey: "a",
      side: "external"
    });
    expect(pdbNet?.assetIds).toEqual(
      expect.arrayContaining(["pdb_1", "cable_1", "strip_1", "fuse_1"])
    );
    expect(pdbNet?.assetIds).not.toContain("pdb_2");
    expect(pdbNet?.terminalSideIds).toContain(
      terminalSideNodeId({
        assetId: "fuse_1",
        terminalKey: "M12.1",
        side: "internal"
      })
    );
    expect(pdbNet?.terminalSideIds).not.toContain(
      terminalSideNodeId({
        assetId: "fuse_1",
        terminalKey: "M12.2",
        side: "internal"
      })
    );
  });

  it("keeps separate assets separate even when they use equivalent topology", () => {
    const graph = buildPackageConnectivityGraph(source());
    const first = getElectricalNetForTerminalSide(graph, {
      assetId: "pdb_1",
      terminalKey: "a",
      side: "external"
    });
    const second = getElectricalNetForTerminalSide(graph, {
      assetId: "pdb_2",
      terminalKey: "a",
      side: "external"
    });
    expect(first?.id).not.toBe(second?.id);
  });

  it("returns deterministic relationship provenance and a traceable path", () => {
    const graph = buildPackageConnectivityGraph(source());
    const fromNodeId = terminalSideNodeId({
      assetId: "pdb_1",
      terminalKey: "a",
      side: "external"
    });
    const toNodeId = terminalSideNodeId({
      assetId: "fuse_1",
      terminalKey: "M12.1",
      side: "internal"
    });
    const path = traceElectricalPath(graph, { fromNodeId, toNodeId });
    expect(path?.steps.map((step) => step.relationship.kind)).toEqual(
      expect.arrayContaining([
        "registry_continuity",
        "drawing_connection",
        "internal_wire"
      ])
    );
    expect(
      listElectricalNetworkConnections(graph, path!.netId).map(
        (candidate) => candidate.provenance.label
      )
    ).toEqual(
      expect.arrayContaining(["Permanent continuity factory_bus", "P-001:001"])
    );
  });

  it("fails closed when linked representations disagree about topology", () => {
    const input = source();
    input.sheets[0].occurrences.push({
      ...input.sheets[0].occurrences[0],
      placementId: "pdb_1_conflict",
      electricalTopology: undefined
    });
    const graph = buildPackageConnectivityGraph(input);
    expect(graph.findings).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "linked_internal_topology_mismatch",
        assetId: "pdb_1"
      })
    );
    const first = getElectricalNetForTerminalSide(graph, {
      assetId: "pdb_1",
      terminalKey: "a",
      side: "external"
    });
    const second = getElectricalNetForTerminalSide(graph, {
      assetId: "pdb_1",
      terminalKey: "c",
      side: "external"
    });
    expect(first?.id).not.toBe(second?.id);
  });

  it("attributes unresolved drawing endpoints to their physical panel", () => {
    const input = source();
    input.sheets[0].connections[1] = {
      ...input.sheets[0].connections[1],
      to: {
        placementId: "strip_1_placement",
        anchorKey: "M02.missing"
      }
    };

    const graph = buildPackageConnectivityGraph(input);

    expect(graph.findings).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "unresolved_electrical_network_endpoint",
        panelAssetId: "panel_1",
        assetId: "strip_1"
      })
    );
  });
});
