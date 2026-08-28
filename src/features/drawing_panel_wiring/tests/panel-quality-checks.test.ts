import { describe, expect, it } from "vitest";
import { panelWiringSourcePackageSchema } from "../data/schema";
import { buildPackageConnectivityGraph } from "../logic/services/connectivity-graph";
import {
  runPackagePanelDrawingQualityChecks,
  runPanelDrawingQualityChecks
} from "../logic/services/panel-quality-checks";
import { buildPanelQualityIndex } from "../logic/services/panel-quality-index";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID
} from "./fixtures";

function sourceWithDetailedPanel() {
  const source = createGenericPanelWiringSource();
  return panelWiringSourcePackageSchema.parse({
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
        occurrences: [],
        connections: []
      }
    ]
  });
}

function report(source = sourceWithDetailedPanel()) {
  const graph = buildPackageConnectivityGraph(source);
  return runPanelDrawingQualityChecks(
    buildPanelQualityIndex({ graph, panelAssetId: GENERIC_PANEL_ASSET_ID })
  );
}

function sourceWithStructuredStripMounts(panelAssetIds: string[]) {
  const source = sourceWithDetailedPanel();
  const stripAssetId = "asset_structured_strip";
  const assets = [
    ...source.assets,
    {
      id: stripAssetId,
      tag: "TB-101",
      type: "terminal_block" as const,
      title: "Structured Terminal Strip",
      isStructuredTerminalStrip: true
    },
    ...panelAssetIds
      .filter((panelAssetId) => panelAssetId !== GENERIC_PANEL_ASSET_ID)
      .map((panelAssetId, index) => ({
        id: panelAssetId,
        tag: `JB00${index + 2}`,
        type: "junction_box" as const,
        title: `Junction Box ${index + 2}`
      }))
  ];
  const mountSheets = panelAssetIds.map((panelAssetId, index) => {
    const sheetId = `sheet_structured_mount_${index + 1}`;
    const backplanePlacementId = `backplane_${index + 1}`;
    return {
      id: sheetId,
      sheetNumber: source.sheets.length + index + 1,
      name: `Structured Strip Mount ${index + 1}`,
      kind: "drawing" as const,
      occurrences: [
        {
          sheetId,
          placementId: `panel_${index + 1}`,
          assetId: panelAssetId,
          tag: assets.find((asset) => asset.id === panelAssetId)?.tag ?? panelAssetId,
          role: "enclosure" as const,
          occurrenceKind: "enclosure_reference" as const,
          symbolId: "__generated_panel_enclosure__",
          versionId: "generated_panel_enclosure_v1",
          terminalResolutionStatus: "not_applicable" as const,
          terminals: []
        },
        {
          sheetId,
          placementId: backplanePlacementId,
          tag: "Backplane",
          role: "other" as const,
          occurrenceKind: "layout" as const,
          containerAssetId: panelAssetId,
          symbolId: "__generated_backplane__",
          versionId: "generated_backplane_v1",
          panelLayout: {
            layoutKind: "backplane" as const,
            backplanePlacementId,
            backplaneSheetX: 20,
            backplaneSheetY: 20,
            xMm: 0,
            yMm: 0,
            widthMm: 300,
            heightMm: 250,
            rotationDeg: 0
          },
          terminalResolutionStatus: "not_applicable" as const,
          terminals: []
        },
        {
          sheetId,
          placementId: `strip_${index + 1}`,
          assetId: stripAssetId,
          tag: "TB-101",
          role: "terminal_block" as const,
          occurrenceKind: "layout" as const,
          containerAssetId: panelAssetId,
          symbolId: `__generated_structured_terminal_strip__:${stripAssetId}`,
          versionId: `generated_structured_terminal_strip_v1:${stripAssetId}`,
          panelLayout: {
            layoutKind: "layout_helper" as const,
            backplanePlacementId,
            backplaneSheetX: 20,
            backplaneSheetY: 20,
            xMm: 40,
            yMm: 50,
            widthMm: 20,
            heightMm: 50,
            rotationDeg: 0
          },
          terminalResolutionStatus: "resolved" as const,
          terminals: []
        }
      ],
      connections: []
    };
  });

  return panelWiringSourcePackageSchema.parse({
    ...source,
    assets,
    sheets: [...source.sheets, ...mountSheets]
  });
}

describe("panel drawing quality checks", () => {
  it("is deterministic and requires the internal side of field-occupied feed-through terminals", () => {
    const first = report();
    const second = report();

    expect(second).toEqual(first);
    expect(
      first.findings.filter(
        (finding) => finding.code === "required_terminal_unconnected"
      )
    ).toHaveLength(12);
    expect(first.canApprove).toBe(false);
  });

  it("blocks duplicate asset tags associated with the panel", () => {
    const source = sourceWithDetailedPanel();
    source.assets[2] = { ...source.assets[2], tag: source.assets[1].tag };

    expect(report(source).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "duplicate_asset_tag",
          severity: "blocking_error"
        })
      ])
    );
  });

  it("blocks one structured terminal strip mounted in different physical panels", () => {
    const otherPanelId = "asset_jb_002";
    const source = sourceWithStructuredStripMounts([
      GENERIC_PANEL_ASSET_ID,
      otherPanelId
    ]);
    const graph = buildPackageConnectivityGraph(source);
    const quality = runPackagePanelDrawingQualityChecks(graph);

    expect(quality.canApprove).toBe(false);
    expect(quality.reports.flatMap((report) => report.findings)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "structured_terminal_strip_multiple_physical_mounts",
          severity: "blocking_error",
          assetId: "asset_structured_strip"
        })
      ])
    );
  });

  it("allows same-panel mounted representations of one structured terminal strip", () => {
    const source = sourceWithStructuredStripMounts([
      GENERIC_PANEL_ASSET_ID,
      GENERIC_PANEL_ASSET_ID
    ]);
    const graph = buildPackageConnectivityGraph(source);
    const quality = runPanelDrawingQualityChecks(
      buildPanelQualityIndex({ graph, panelAssetId: GENERIC_PANEL_ASSET_ID })
    );

    expect(
      quality.findings.some(
        (finding) =>
          finding.code === "structured_terminal_strip_multiple_physical_mounts"
      )
    ).toBe(false);
  });

  it("blocks a structured strip whose container disagrees with its backplane", () => {
    const source = sourceWithStructuredStripMounts([GENERIC_PANEL_ASSET_ID]);
    const mountSheet = source.sheets.find(
      (sheet) => sheet.id === "sheet_structured_mount_1"
    )!;
    const stripOccurrence = mountSheet.occurrences.find(
      (occurrence) => occurrence.assetId === "asset_structured_strip"
    )!;
    stripOccurrence.containerAssetId = "asset_wrong_panel";
    const graph = buildPackageConnectivityGraph(source);
    const quality = runPanelDrawingQualityChecks(
      buildPanelQualityIndex({ graph, panelAssetId: GENERIC_PANEL_ASSET_ID })
    );

    expect(quality.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "structured_terminal_strip_mount_context_mismatch",
          severity: "blocking_error",
          assetId: "asset_structured_strip"
        })
      ])
    );
  });

  it("uses strict duplicate wire IDs across external termination records", () => {
    const source = sourceWithDetailedPanel();
    source.sheets[1].connections[0].wireId =
      source.sheets[0].connections[0].wireId;

    expect(report(source).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "duplicate_wire_id",
          wireId: source.sheets[0].connections[0].wireId
        })
      ])
    );
  });

  it("promotes unresolved terminations to one authoritative blocking finding", () => {
    const source = sourceWithDetailedPanel();
    source.sheets[0].connections[0].to.anchorKey = "MISSING_TERMINAL";
    const findings = report(source).findings.filter(
      (finding) => finding.code === "unresolved_external_termination"
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("blocking_error");
  });

  it("does not gate legacy packages without a Detailed Panel context", () => {
    const graph = buildPackageConnectivityGraph(createGenericPanelWiringSource());
    const packageReport = runPackagePanelDrawingQualityChecks(graph);

    expect(packageReport.reports).toEqual([]);
    expect(packageReport.canApprove).toBe(true);
  });
});
