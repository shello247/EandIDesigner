import { describe, expect, it } from "vitest";
import { panelWiringSourcePackageSchema } from "../data/schema";
import { buildPackageConnectivityGraph } from "../logic/services/connectivity-graph";
import {
  buildPanelInternalWireEndpointCatalog,
  getPanelInternalWireEndpointPairState
} from "../logic/services/panel-internal-wire-endpoints";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

const DETAIL_SHEET_ID = "sheet_detail";

function endpointSource() {
  const source = createGenericPanelWiringSource();
  const detailOccurrences = GENERIC_TERMINAL_ASSET_IDS.slice(0, 2).map(
    (assetId, index) => {
      const sourceOccurrence = source.sheets[index].occurrences.find(
        (occurrence) => occurrence.assetId === assetId
      )!;
      return {
        ...sourceOccurrence,
        sheetId: DETAIL_SHEET_ID,
        placementId: `detail_strip_${index + 1}`,
        terminals: sourceOccurrence.terminals.map((terminal) => ({
          ...terminal,
          anchors: terminal.anchors.map((anchor) => ({
            ...anchor,
            physicalPosition:
              anchor.sideHint === "internal"
                ? ("top" as const)
                : ("bottom" as const)
          }))
        }))
      };
    }
  );

  return panelWiringSourcePackageSchema.parse({
    ...source,
    sheets: [
      ...source.sheets,
      {
        id: DETAIL_SHEET_ID,
        sheetNumber: source.sheets.length + 1,
        name: "Panel Detail",
        kind: "drawing",
        panelDrawingContext: {
          kind: "detailed_panel_wiring",
          panelAssetId: GENERIC_PANEL_ASSET_ID
        },
        occurrences: detailOccurrences,
        connections: []
      }
    ]
  });
}

describe("Detailed Panel internal-wire endpoint catalog", () => {
  it("lists represented internal endpoints with physical position hints", () => {
    const graph = buildPackageConnectivityGraph(endpointSource());
    const catalog = buildPanelInternalWireEndpointCatalog({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      detailedSheetId: DETAIL_SHEET_ID
    });

    expect(catalog.equipment.map((equipment) => equipment.tag)).toEqual([
      "XT-001",
      "XT-002"
    ]);
    expect(catalog.equipment[0].endpoints).toHaveLength(5);
    expect(catalog.equipment[0].endpoints[0]).toMatchObject({
      terminal: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T1",
        side: "internal"
      },
      anchorKey: "T1_TOP",
      physicalPosition: "top"
    });
    expect(
      catalog.equipment.flatMap((equipment) => equipment.endpoints)
    ).not.toContainEqual(
      expect.objectContaining({ terminal: expect.objectContaining({ side: "external" }) })
    );
  });

  it("excludes panel assets that are not represented on the active detail sheet", () => {
    const graph = buildPackageConnectivityGraph(endpointSource());
    const catalog = buildPanelInternalWireEndpointCatalog({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      detailedSheetId: DETAIL_SHEET_ID
    });

    expect(catalog.equipment.map((equipment) => equipment.assetId)).not.toContain(
      GENERIC_TERMINAL_ASSET_IDS[2]
    );
  });

  it("returns deterministic pair validation for valid and invalid endpoints", () => {
    const graph = buildPackageConnectivityGraph(endpointSource());
    const valid = getPanelInternalWireEndpointPairState({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      from: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T1",
        side: "internal"
      },
      to: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[1],
        terminalKey: "T2",
        side: "internal"
      }
    });
    const invalid = getPanelInternalWireEndpointPairState({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      from: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T1",
        side: "internal"
      },
      to: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T1",
        side: "internal"
      }
    });

    expect(valid).toEqual({ enabled: true });
    expect(invalid).toMatchObject({
      enabled: false,
      disabledReason: expect.stringContaining("same logical terminal")
    });
  });

  it("disables terminal sides occupied by an existing internal wire", () => {
    const source = endpointSource();
    const graph = buildPackageConnectivityGraph(
      panelWiringSourcePackageSchema.parse({
        ...source,
        panelWiring: {
          schemaVersion: 1,
          terminalMappings: [],
          internalWires: [
            {
              id: "internal_wire_1",
              panelAssetId: GENERIC_PANEL_ASSET_ID,
              wireId: "ENC-001-W001",
              from: {
                assetId: GENERIC_TERMINAL_ASSET_IDS[0],
                terminalKey: "T1",
                side: "internal"
              },
              to: {
                assetId: GENERIC_TERMINAL_ASSET_IDS[1],
                terminalKey: "T2",
                side: "internal"
              },
              origin: "engineer"
            }
          ],
          bridges: [],
          bonds: []
        }
      })
    );
    const catalog = buildPanelInternalWireEndpointCatalog({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      detailedSheetId: DETAIL_SHEET_ID
    });
    const occupied = catalog.equipment
      .flatMap((equipment) => equipment.endpoints)
      .filter(
        (endpoint) =>
          (endpoint.terminal.assetId === GENERIC_TERMINAL_ASSET_IDS[0] &&
            endpoint.terminal.terminalKey === "T1") ||
          (endpoint.terminal.assetId === GENERIC_TERMINAL_ASSET_IDS[1] &&
            endpoint.terminal.terminalKey === "T2")
      );

    expect(occupied).toHaveLength(2);
    expect(occupied.every((endpoint) => endpoint.disabledReason)).toBe(true);
  });
});
