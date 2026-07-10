import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  buildPanelDiscoveryIndex,
  getExternalTerminationProvenance
} from "../api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID
} from "./fixtures";

describe("external termination catalog", () => {
  it("preserves all source and cable provenance for field terminations", () => {
    const graph = buildPackageConnectivityGraph(
      createGenericPanelWiringSource()
    );
    const index = buildPanelDiscoveryIndex({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      detailedSheetId: "sheet_detail"
    });
    const rows = [...index.terminationsById.values()];
    const first = rows.find(
      (row) =>
        row.source.sheetId === "sheet_field_1" &&
        row.source.connectionId === "connection_1_1"
    );

    expect(rows).toHaveLength(12);
    expect(first).toMatchObject({
      status: "available",
      target: {
        assetId: "asset_strip_a",
        terminalKey: "T1",
        side: "external"
      },
      wireId: "CBL-001-W1",
      cableAssetId: "asset_cable_1",
      cablePlacementId: "cable_1",
      cableTag: "CBL-001",
      conductorKey: "W1",
      source: {
        sheetId: "sheet_field_1",
        connectionId: "connection_1_1",
        endpointRole: "to",
        placementId: "strip_1",
        anchorKey: "T1_BOTTOM"
      },
      sourceSheet: {
        id: "sheet_field_1",
        number: 1,
        name: "Field Connection 1"
      }
    });
    expect(
      first
        ? getExternalTerminationProvenance(graph, first.terminationId)
        : undefined
    ).toMatchObject({
      id: first?.terminationId,
      cablePlacementId: "cable_1",
      wireId: "CBL-001-W1"
    });
  });

  it("does not expose canonical internal wires as external terminations", () => {
    const source = createGenericPanelWiringSource();
    const graph = buildPackageConnectivityGraph({
      ...source,
      panelWiring: {
        schemaVersion: 1,
        terminalMappings: [],
        internalWires: [
          {
            id: "wire_internal_1",
            panelAssetId: GENERIC_PANEL_ASSET_ID,
            wireId: "W-1",
            from: {
              assetId: "asset_strip_a",
              terminalKey: "T1",
              side: "internal"
            },
            to: {
              assetId: "asset_strip_b",
              terminalKey: "T1",
              side: "internal"
            },
            origin: "engineer"
          }
        ],
        bridges: [],
        bonds: []
      }
    });
    const index = buildPanelDiscoveryIndex({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      detailedSheetId: "sheet_detail"
    });

    expect(index.terminationsById.size).toBe(12);
    expect(
      [...index.terminationsById.values()].some(
        (termination) => termination.wireId === "W-1"
      )
    ).toBe(false);
  });
});
