import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  buildPanelDiscoveryIndex,
  buildPanelExternalTerminationDisplayIndex,
  getExternalTerminationProvenance
} from "../api/public";
import { panelWiringSourcePackageSchema } from "../data/schema";
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

  it("builds straight-stub display records for represented detailed-panel assets", () => {
    const source = createGenericPanelWiringSource();
    const sourceOccurrence = source.sheets[0].occurrences.find(
      (occurrence) => occurrence.assetId === "asset_strip_a"
    );

    expect(sourceOccurrence).toBeDefined();

    const withDetailedSheet = panelWiringSourcePackageSchema.parse({
      ...source,
      sheets: [
        ...source.sheets,
        {
          id: "sheet_detail",
          sheetNumber: source.sheets.length + 1,
          name: "ENC-001 Detailed Panel Drawing",
          kind: "drawing",
          panelDrawingContext: {
            kind: "detailed_panel_wiring",
            panelAssetId: GENERIC_PANEL_ASSET_ID
          },
          occurrences: [
            {
              ...sourceOccurrence,
              sheetId: "sheet_detail",
              placementId: "detail_strip_a"
            }
          ],
          connections: []
        }
      ]
    });
    const displayIndex = buildPanelExternalTerminationDisplayIndex(
      buildPackageConnectivityGraph(withDetailedSheet)
    );
    const rows = displayIndex.get("sheet_detail") ?? [];

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      placementId: "detail_strip_a",
      anchorKey: "T1_BOTTOM",
      physicalPosition: "bottom",
      target: {
        assetId: "asset_strip_a",
        terminalKey: "T1",
        side: "external"
      },
      wireId: "CBL-001-W1",
      source: {
        connectionId: "connection_1_1"
      }
    });
  });
});
