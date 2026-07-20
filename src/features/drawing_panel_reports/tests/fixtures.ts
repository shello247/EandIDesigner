import {
  buildPackageConnectivityGraph,
  runPackagePanelDrawingQualityChecks,
  type PanelWiringSourcePackage
} from "@/features/drawing_panel_wiring/api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "@/features/drawing_panel_wiring/tests/fixtures";
import { buildPanelDeliverableBundle } from "../logic/services/panel-deliverable-bundle";

export function createPanelReportSource(): PanelWiringSourcePackage {
  const source = createGenericPanelWiringSource();
  const detailedSheetId = "sheet_detailed";
  const terminalOccurrences = GENERIC_TERMINAL_ASSET_IDS.map((assetId, index) => {
    const sourceOccurrence = source.sheets[index].occurrences.find(
      (occurrence) => occurrence.assetId === assetId
    )!;
    return {
      ...sourceOccurrence,
      sheetId: detailedSheetId,
      placementId: `detail_strip_${index + 1}`,
      occurrenceKind: "wiring" as const
    };
  });
  return {
    ...source,
    sheets: [
      ...source.sheets,
      {
        id: detailedSheetId,
        sheetNumber: source.sheets.length + 1,
        name: "ENC-001 Detailed Panel Drawing",
        kind: "drawing",
        panelDrawingContext: {
          kind: "detailed_panel_wiring",
          panelAssetId: GENERIC_PANEL_ASSET_ID
        },
        occurrences: terminalOccurrences,
        connections: [
          {
            id: "detail_wire_route",
            sheetId: detailedSheetId,
            from: { placementId: "detail_strip_1", anchorKey: "T4_TOP" },
            to: { placementId: "detail_strip_2", anchorKey: "T4_TOP" },
            panelConnectionId: "internal_wire_1",
            routeMode: "manual",
            routePointCount: 4
          }
        ]
      }
    ],
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
            terminalKey: "T4",
            side: "internal"
          },
          to: {
            assetId: GENERIC_TERMINAL_ASSET_IDS[1],
            terminalKey: "T4",
            side: "internal"
          },
          domain: "signal",
          attributes: { color: "Blue", size: "1.5 mm2", wireType: "Panel wire" },
          origin: "engineer"
        }
      ],
      bridges: [
        {
          id: "bridge_1",
          patternCode: "JMP-001",
          panelAssetId: GENERIC_PANEL_ASSET_ID,
          kind: "jumper",
          members: [
            { assetId: GENERIC_TERMINAL_ASSET_IDS[0], terminalKey: "T5", side: "internal" },
            { assetId: GENERIC_TERMINAL_ASSET_IDS[1], terminalKey: "T5", side: "internal" }
          ],
          domain: "signal",
          definition: {
            topology: "terminal_jumper",
            orderedMembers: [
              { assetId: GENERIC_TERMINAL_ASSET_IDS[0], terminalKey: "T5", side: "internal" },
              { assetId: GENERIC_TERMINAL_ASSET_IDS[1], terminalKey: "T5", side: "internal" }
            ]
          },
          origin: "engineer"
        }
      ],
      bonds: []
    }
  };
}

export function createPanelReportBundle() {
  const graph = buildPackageConnectivityGraph(createPanelReportSource());
  const quality = runPackagePanelDrawingQualityChecks(graph);
  return buildPanelDeliverableBundle({
    drawingId: "drawing_reports",
    drawingKey: "DRW-REPORTS",
    drawingTitle: "Panel Reports Test",
    drawingStatus: "needs_review",
    issueMode: "draft",
    reports: ["terminal_schedule", "internal_wire_schedule", "panel_asset_schedule", "bom"],
    scope: { kind: "active_panel", panelAssetId: GENERIC_PANEL_ASSET_ID },
    graph,
    quality
  });
}
