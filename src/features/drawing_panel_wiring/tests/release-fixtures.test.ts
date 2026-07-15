import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  buildPanelEngineeringSnapshot,
  buildPanelEngineeringSnapshotFromValidatedSource
} from "../api/public";
import {
  createLargePanelPerformanceSource,
  createMcp201PanelSource
} from "./release-fixtures";

describe("Detailed Panel release fixtures", () => {
  it("reuses an already validated source when building an engineering snapshot", () => {
    const source = createMcp201PanelSource();
    const reused = buildPanelEngineeringSnapshotFromValidatedSource(
      source,
      "mcp-201"
    );
    const validated = buildPanelEngineeringSnapshot(source, "mcp-201");

    expect(reused.source).toBe(source);
    expect(reused.panelAssetIds).toEqual(validated.panelAssetIds);
    expect(reused.graph.terminalsById.size).toBe(
      validated.graph.terminalsById.size
    );
  });

  it("provides a non-JB generic panel with 8, 12, and 4-way terminal strips", () => {
    const source = createMcp201PanelSource();
    const graph = buildPackageConnectivityGraph(source);
    const panel = source.assets.find((asset) => asset.tag === "MCP-201")!;
    const terminalCounts = source.sheets
      .find((sheet) => sheet.panelDrawingContext?.panelAssetId === panel.id)!
      .occurrences.map((occurrence) => occurrence.terminals.length);

    expect(panel.type).toBe("panel");
    expect(terminalCounts).toEqual([8, 12, 4]);
    expect(
      [...graph.terminalsById.values()].filter((terminal) =>
        graph.assetIdsByPanelAssetId.get(panel.id)?.has(terminal.ref.assetId)
      )
    ).toHaveLength(24);
  });

  it("certifies the supported V1 large-package cardinalities", () => {
    const source = createLargePanelPerformanceSource();
    const graph = buildPackageConnectivityGraph(source);

    expect(source.sheets).toHaveLength(120);
    expect(source.assets).toHaveLength(500);
    expect(graph.panelAssetIds).toHaveLength(20);
    expect(graph.terminalsById).toHaveLength(2_000);
    expect(
      source.sheets.reduce((count, sheet) => count + sheet.connections.length, 0)
    ).toBe(2_000);
    expect(source.panelWiring?.internalWires).toHaveLength(1_000);
    expect(source.panelWiring?.bridges).toHaveLength(250);
  });
});
