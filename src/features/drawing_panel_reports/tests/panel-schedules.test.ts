import { describe, expect, it } from "vitest";
import { buildPackageConnectivityGraph } from "@/features/drawing_panel_wiring/api/public";
import {
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "@/features/drawing_panel_wiring/tests/fixtures";
import { buildPanelTerminalSchedule } from "../logic/services/panel-terminal-schedule";
import { buildPanelWireSchedule } from "../logic/services/panel-wire-schedule";
import { buildPanelAssetSchedule } from "../logic/services/panel-asset-schedule";
import { buildPanelBomProjection } from "../logic/services/panel-bom-projection";
import { buildPanelReportIndex } from "../logic/services/panel-report-index";
import { createPanelReportSource } from "./fixtures";

describe("panel schedules", () => {
  it("builds deterministic logical-terminal rows with field and internal connectivity", () => {
    const graph = buildPackageConnectivityGraph(createPanelReportSource());
    const first = buildPanelTerminalSchedule({ graph, panelAssetId: GENERIC_PANEL_ASSET_ID });
    const second = buildPanelTerminalSchedule({ graph, panelAssetId: GENERIC_PANEL_ASSET_ID });

    expect(second).toEqual(first);
    expect(first).toHaveLength(20);
    expect(first.flatMap((row) => row.external.occupants)).toHaveLength(12);
    const terminal = first.find(
      (row) => row.assetId === GENERIC_TERMINAL_ASSET_IDS[0] && row.terminalKey === "T4"
    );
    expect(terminal?.internal.occupants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          wireId: "ENC-001-W001",
          connectedAssetId: GENERIC_TERMINAL_ASSET_IDS[1]
        })
      ])
    );
    expect(
      first.find((row) => row.terminalKey === "T5")?.patterns[0]?.patternCode
    ).toBe("JMP-001");
  });

  it("includes every physical wire and canonical route metadata once", () => {
    const graph = buildPackageConnectivityGraph(createPanelReportSource());
    const rows = buildPanelWireSchedule({ graph, panelAssetId: GENERIC_PANEL_ASSET_ID });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      wireId: "ENC-001-W001",
      represented: true,
      routes: [{ routeMode: "manual", pointCount: 4 }]
    });
  });

  it("deduplicates physical assets and excludes field cables and layout helpers", () => {
    const graph = buildPackageConnectivityGraph(createPanelReportSource());
    const rows = buildPanelAssetSchedule({ graph, panelAssetId: GENERIC_PANEL_ASSET_ID });
    expect(rows.map((row) => row.assetTag)).toEqual([
      "ENC-001",
      "XT-001",
      "XT-002",
      "XT-003",
      "XT-004"
    ]);
    const projection = buildPanelBomProjection({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      assetSchedule: rows
    });
    expect(projection.assemblies).toHaveLength(5);
    expect(projection.information).toContain(
      "Generated DIN rail and wire duct layout materials are not BOM-linked in Phase 9."
    );
  });

  it("produces equivalent reports from the shared linear report index", () => {
    const graph = buildPackageConnectivityGraph(createPanelReportSource());
    const index = buildPanelReportIndex({ graph });

    expect(
      buildPanelTerminalSchedule({
        graph,
        panelAssetId: GENERIC_PANEL_ASSET_ID,
        index
      })
    ).toEqual(
      buildPanelTerminalSchedule({ graph, panelAssetId: GENERIC_PANEL_ASSET_ID })
    );
    expect(
      buildPanelWireSchedule({
        graph,
        panelAssetId: GENERIC_PANEL_ASSET_ID,
        index
      })
    ).toEqual(
      buildPanelWireSchedule({ graph, panelAssetId: GENERIC_PANEL_ASSET_ID })
    );
    expect(
      buildPanelAssetSchedule({
        graph,
        panelAssetId: GENERIC_PANEL_ASSET_ID,
        index
      })
    ).toEqual(
      buildPanelAssetSchedule({ graph, panelAssetId: GENERIC_PANEL_ASSET_ID })
    );
  });
});
