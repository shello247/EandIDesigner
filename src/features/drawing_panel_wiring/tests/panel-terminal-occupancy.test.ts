import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  buildPanelDiscoveryIndex,
  buildPanelTerminalCatalog,
  getTerminalSideOccupancy
} from "../api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

describe("panel terminal side occupancy", () => {
  it("loads existing duplicate field occupancy and reports a repair conflict", () => {
    const source = createGenericPanelWiringSource();
    const target = {
      assetId: GENERIC_TERMINAL_ASSET_IDS[0],
      terminalKey: "T4",
      side: "external" as const
    };
    const graph = buildPackageConnectivityGraph({
      ...source,
      panelWiring: {
        schemaVersion: 1,
        terminalMappings: [
          {
            id: "mapping_1",
            panelAssetId: GENERIC_PANEL_ASSET_ID,
            source: {
              sheetId: "sheet_field_1",
              connectionId: "connection_1_1",
              endpointRole: "to",
              placementId: "strip_1",
              anchorKey: "T1_BOTTOM"
            },
            target,
            origin: "engineer"
          },
          {
            id: "mapping_2",
            panelAssetId: GENERIC_PANEL_ASSET_ID,
            source: {
              sheetId: "sheet_field_1",
              connectionId: "connection_1_2",
              endpointRole: "to",
              placementId: "strip_1",
              anchorKey: "T2_BOTTOM"
            },
            target,
            origin: "engineer"
          }
        ],
        internalWires: [],
        bridges: [],
        bonds: []
      }
    });
    const catalog = buildPanelTerminalCatalog({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID
    });
    const occupancy = getTerminalSideOccupancy(catalog, target);

    expect(occupancy?.status).toBe("conflicting");
    expect(occupancy?.occupants).toHaveLength(2);
    expect(catalog.findings).toEqual([
      expect.objectContaining({
        code: "duplicate_terminal_conductor_occupancy",
        terminal: target
      })
    ]);
    const discovery = buildPanelDiscoveryIndex({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      detailedSheetId: "sheet_detail"
    });
    expect(
      [...discovery.mappingRowsByTerminationId.values()]
        .filter((row) => row.target?.terminalKey === "T4")
        .map((row) => row.mappingMode)
    ).toEqual(["conflicting", "conflicting"]);
  });
});
