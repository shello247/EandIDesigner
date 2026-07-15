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
