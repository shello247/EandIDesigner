import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  buildPlacementWireContextDisplayIndex,
  placementWireContextKey
} from "../api/public";
import { panelWiringSourcePackageSchema } from "../data/schema";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID
} from "./fixtures";

function terminal(
  terminalKey: string,
  side: "single" | "internal" = "single"
) {
  return {
    terminalKey,
    label: terminalKey,
    supportedSides: [side],
    anchors: [
      {
        anchorKey: `${terminalKey}_${side}`,
        anchorKind: "terminal" as const,
        sideHint: side,
        physicalPosition: "right" as const
      }
    ],
    status: "resolved" as const
  };
}

function occurrence(input: {
  sheetId: string;
  placementId: string;
  assetId: string;
  tag: string;
}) {
  return {
    ...input,
    role: "device" as const,
    occurrenceKind: "wiring" as const,
    symbolId: `symbol_${input.assetId}`,
    versionId: `version_${input.assetId}`,
    terminalResolutionStatus: "resolved" as const,
    terminals: [terminal("T1"), terminal("T2", "internal")]
  };
}

function createSource() {
  return panelWiringSourcePackageSchema.parse({
    assets: [
      {
        id: "asset_a",
        tag: "A-101",
        type: "controller",
        title: "Asset A"
      },
      {
        id: "asset_b",
        tag: "B-101",
        type: "instrument",
        title: "Asset B"
      },
      {
        id: "panel_1",
        tag: "PLC-001",
        type: "panel",
        title: "Panel"
      }
    ],
    sheets: [
      {
        id: "sheet_field",
        sheetNumber: 1,
        name: "Field Wiring",
        kind: "drawing",
        occurrences: [
          occurrence({
            sheetId: "sheet_field",
            placementId: "field_a",
            assetId: "asset_a",
            tag: "A-101"
          }),
          occurrence({
            sheetId: "sheet_field",
            placementId: "field_b",
            assetId: "asset_b",
            tag: "B-101"
          })
        ],
        connections: [
          {
            id: "field_1",
            sheetId: "sheet_field",
            from: { placementId: "field_a", anchorKey: "T1_single" },
            to: { placementId: "field_b", anchorKey: "T1_single" },
            wireId: "FIELD-101"
          }
        ]
      },
      {
        id: "sheet_overview",
        sheetNumber: 2,
        name: "Overview",
        kind: "drawing",
        occurrences: [
          occurrence({
            sheetId: "sheet_overview",
            placementId: "overview_a",
            assetId: "asset_a",
            tag: "A-101"
          }),
          occurrence({
            sheetId: "sheet_overview",
            placementId: "overview_b",
            assetId: "asset_b",
            tag: "B-101"
          })
        ],
        connections: []
      },
      {
        id: "sheet_internal",
        sheetNumber: 3,
        name: "Internal Wiring",
        kind: "drawing",
        occurrences: [
          occurrence({
            sheetId: "sheet_internal",
            placementId: "internal_a",
            assetId: "asset_a",
            tag: "A-101"
          }),
          occurrence({
            sheetId: "sheet_internal",
            placementId: "internal_b",
            assetId: "asset_b",
            tag: "B-101"
          })
        ],
        connections: [
          {
            id: "internal_route_1",
            sheetId: "sheet_internal",
            from: { placementId: "internal_a", anchorKey: "T2_internal" },
            to: { placementId: "internal_b", anchorKey: "T2_internal" },
            panelConnectionId: "wire_1"
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
          wireNumber: 1,
          wireId: "legacy-wire-id",
          from: { assetId: "asset_a", terminalKey: "T2", side: "internal" },
          to: { assetId: "asset_b", terminalKey: "T2", side: "internal" },
          origin: "engineer"
        }
      ],
      bridges: [],
      bonds: []
    }
  });
}

describe("placement wire context", () => {
  it("filters candidate indexes by canonical internal and external wire kind", () => {
    const graph = buildPackageConnectivityGraph(createSource());
    const request = (mode: "internal_connected" | "external_connected" | "all_connected") =>
      buildPlacementWireContextDisplayIndex({
        graph,
        requests: [
          {
            sheetId: "sheet_overview",
            placementId: "overview_a",
            mode
          }
        ]
      }).rowsBySheetId.get("sheet_overview") ?? [];

    expect(request("internal_connected").map((row) => row.canonicalKind)).toEqual([
      "internal_wire"
    ]);
    expect(request("external_connected").map((row) => row.canonicalKind)).toEqual([
      "field_connection"
    ]);
    expect(request("all_connected").map((row) => row.canonicalKind).sort()).toEqual([
      "field_connection",
      "internal_wire"
    ]);
  });

  it("projects incoming and outgoing field and internal wires onto one occurrence", () => {
    const index = buildPlacementWireContextDisplayIndex({
      graph: buildPackageConnectivityGraph(createSource()),
      requests: [
        {
          sheetId: "sheet_overview",
          placementId: "overview_a",
          mode: "all_connected"
        }
      ]
    });
    const rows = index.rowsBySheetId.get("sheet_overview") ?? [];

    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalKind: "field_connection",
          canonicalId: "sheet_field:field_1",
          direction: "outgoing",
          wireId: "FIELD-101",
          anchorKey: "T1_single",
          oppositeEndpoint: { assetTag: "B-101", terminalKey: "T1" }
        }),
        expect.objectContaining({
          canonicalKind: "internal_wire",
          canonicalId: "wire_1",
          direction: "outgoing",
          wireId: "A-101:T2(001)",
          anchorKey: "T2_internal",
          oppositeEndpoint: { assetTag: "B-101", terminalKey: "T2" }
        })
      ])
    );
    expect(
      index.summariesBySheetPlacement.get(
        placementWireContextKey("sheet_overview", "overview_a")
      )
    ).toEqual({
      placementId: "overview_a",
      visibleCount: 2,
      internalVisibleCount: 1,
      externalVisibleCount: 1,
      unresolvedCount: 0
    });
  });

  it("does not duplicate a route already touching the requested occurrence", () => {
    const source = createSource();
    const overview = source.sheets.find(
      (sheet) => sheet.id === "sheet_overview"
    )!;
    overview.connections.push({
      id: "overview_internal_route",
      sheetId: overview.id,
      from: { placementId: "overview_a", anchorKey: "T2_internal" },
      to: { placementId: "overview_b", anchorKey: "T2_internal" },
      panelConnectionId: "wire_1"
    });
    const index = buildPlacementWireContextDisplayIndex({
      graph: buildPackageConnectivityGraph(source),
      requests: [
        {
          sheetId: "sheet_overview",
          placementId: "overview_a",
          mode: "all_connected"
        }
      ]
    });
    const rows = index.rowsBySheetId.get("sheet_overview") ?? [];

    expect(rows.map((row) => row.canonicalKind)).toEqual([
      "field_connection"
    ]);
  });

  it("keeps separate requests occurrence-specific", () => {
    const index = buildPlacementWireContextDisplayIndex({
      graph: buildPackageConnectivityGraph(createSource()),
      requests: [
        {
          sheetId: "sheet_overview",
          placementId: "overview_a",
          mode: "all_connected"
        },
        {
          sheetId: "sheet_overview",
          placementId: "overview_b",
          mode: "all_connected"
        }
      ]
    });
    const rows = index.rowsBySheetId.get("sheet_overview") ?? [];

    expect(rows.filter((row) => row.placementId === "overview_a")).toHaveLength(2);
    expect(rows.filter((row) => row.placementId === "overview_b")).toHaveLength(2);
    expect(
      rows.find(
        (row) =>
          row.placementId === "overview_b" &&
          row.canonicalKind === "field_connection"
      )
    ).toMatchObject({ direction: "incoming" });
  });

  it("counts unresolved target anchor mappings without guessing", () => {
    const source = createSource();
    const occurrence = source.sheets
      .find((sheet) => sheet.id === "sheet_overview")!
      .occurrences.find((candidate) => candidate.placementId === "overview_a")!;
    occurrence.terminals = occurrence.terminals.filter(
      (candidate) => candidate.terminalKey !== "T2"
    );
    const index = buildPlacementWireContextDisplayIndex({
      graph: buildPackageConnectivityGraph(source),
      requests: [
        {
          sheetId: "sheet_overview",
          placementId: "overview_a",
          mode: "all_connected"
        }
      ]
    });
    const summary = index.summariesBySheetPlacement.get(
      placementWireContextKey("sheet_overview", "overview_a")
    );

    expect(index.rowsBySheetId.get("sheet_overview")).toHaveLength(1);
    expect(summary).toMatchObject({ visibleCount: 1, unresolvedCount: 1 });
  });

  it("does not duplicate existing Detailed Panel external termination stubs", () => {
    const source = createGenericPanelWiringSource();
    const representedOccurrence = source.sheets[0].occurrences.find(
      (occurrence) => occurrence.assetId === "asset_strip_a"
    )!;
    const detailedSource = panelWiringSourcePackageSchema.parse({
      ...source,
      sheets: [
        ...source.sheets,
        {
          id: "sheet_detail",
          sheetNumber: source.sheets.length + 1,
          name: "Detailed Panel",
          kind: "drawing",
          panelDrawingContext: {
            kind: "detailed_panel_wiring",
            panelAssetId: GENERIC_PANEL_ASSET_ID
          },
          occurrences: [
            {
              ...representedOccurrence,
              sheetId: "sheet_detail",
              placementId: "detail_strip_a"
            }
          ],
          connections: []
        }
      ]
    });
    const index = buildPlacementWireContextDisplayIndex({
      graph: buildPackageConnectivityGraph(detailedSource),
      requests: [
        {
          sheetId: "sheet_detail",
          placementId: "detail_strip_a",
          mode: "external_connected"
        }
      ]
    });

    const rows = index.rowsBySheetId.get("sheet_detail") ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((row) => row.canonicalKind === "field_connection")
    ).toBe(true);
    expect(
      new Set(rows.map((row) => row.canonicalId)).size
    ).toBe(rows.length);
    expect(
      index.summariesBySheetPlacement.get(
        placementWireContextKey("sheet_detail", "detail_strip_a")
      )
    ).toMatchObject({
      placementId: "detail_strip_a",
      visibleCount: rows.length,
      internalVisibleCount: 0,
      externalVisibleCount: rows.length,
      unresolvedCount: 0
    });
  });
});
