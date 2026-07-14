import { describe, expect, it } from "vitest";
import type { SymbolMetadata } from "@/features/symbol_registry/api/public";
import {
  buildCompatiblePanelAssetOptions,
  buildPanelComponentPalette,
  resolvePanelComponentTerminals
} from "../api/public";
import { createGenericPanelWiringSource, GENERIC_PANEL_ASSET_ID } from "./fixtures";

function componentSymbol(
  overrides: Partial<SymbolMetadata> = {}
) {
  const metadata: SymbolMetadata = {
    symbolKey: "breaker_symbol",
    displayName: "Miniature Circuit Breaker",
    category: "terminal_block",
    viewBox: { x: 0, y: 0, width: 100, height: 80 },
    anchors: [
      { key: "LINE", x: 10, y: 5, kind: "terminal" },
      { key: "LOAD", x: 10, y: 75, kind: "terminal" }
    ],
    terminals: [
      {
        key: "L",
        label: "Line",
        anchorKey: "LINE",
        panelSide: "single",
        requiredForWiring: true
      },
      {
        key: "T",
        label: "Load",
        anchorKey: "LOAD",
        panelSide: "single",
        requiredForWiring: true
      }
    ],
    panelWiring: {
      assetType: "breaker",
      tagPrefix: "MCB",
      schematicScale: 0.45
    },
    ...overrides
  };

  return {
    symbolId: "symbol_breaker",
    versionId: "version_breaker",
    symbolKey: metadata.symbolKey,
    displayName: metadata.displayName,
    metadata
  };
}

describe("Detailed Panel component palette", () => {
  it("strictly excludes legacy symbols without the capability", () => {
    const symbol = componentSymbol({ panelWiring: undefined });

    expect(buildPanelComponentPalette([symbol])).toEqual([]);
  });

  it("uses declared capability values and warns without physical dimensions", () => {
    const [row] = buildPanelComponentPalette([componentSymbol()]);

    expect(row).toMatchObject({
      status: "ready",
      assetType: "breaker",
      tagPrefix: "MCB",
      schematicScale: 0.45,
      group: "circuit_protection"
    });
    expect(row.warnings[0]).toContain("Physical dimensions");
    expect(row.terminals.map((terminal) => terminal.terminalKey)).toEqual([
      "L",
      "T"
    ]);
  });

  it("blocks missing and ambiguous terminal metadata", () => {
    const missing = componentSymbol({ terminals: [] });
    const ambiguous = componentSymbol({
      terminals: [
        {
          key: "1",
          label: "1 external",
          anchorKey: "LINE",
          requiredForWiring: true
        },
        {
          key: "1",
          label: "1 internal",
          anchorKey: "LOAD",
          requiredForWiring: true
        }
      ]
    });

    expect(buildPanelComponentPalette([missing])[0].status).toBe("blocked");
    expect(resolvePanelComponentTerminals(ambiguous).blockingReasons[0]).toContain(
      "ambiguous"
    );
  });

  it("offers only exact compatible, panel-associated, unrepresented assets", () => {
    const symbol = componentSymbol();
    const source = createGenericPanelWiringSource();
    const detailSheet = source.sheets.find((sheet) => sheet.id === "sheet_detail");
    const withComponent = {
      ...source,
      assets: [
        ...source.assets,
        {
          id: "asset_breaker",
          tag: "MCB-101",
          type: "breaker" as const,
          title: "Panel breaker",
          symbolId: symbol.symbolId,
          versionId: symbol.versionId
        },
        {
          id: "asset_unassigned",
          tag: "MCB-102",
          type: "breaker" as const,
          title: "Unassigned breaker",
          symbolId: symbol.symbolId,
          versionId: symbol.versionId
        }
      ],
      sheets: source.sheets.map((sheet, index) =>
        index === 0
          ? {
              ...sheet,
              occurrences: [
                ...sheet.occurrences,
                {
                  sheetId: sheet.id,
                  placementId: "breaker_source",
                  assetId: "asset_breaker",
                  tag: "MCB-101",
                  role: "device" as const,
                  occurrenceKind: "wiring" as const,
                  containerAssetId: GENERIC_PANEL_ASSET_ID,
                  symbolId: symbol.symbolId,
                  versionId: symbol.versionId,
                  terminalResolutionStatus: "resolved" as const,
                  terminals: []
                }
              ]
            }
          : sheet
      )
    };

    expect(
      buildCompatiblePanelAssetOptions({
        source: withComponent,
        panelAssetId: GENERIC_PANEL_ASSET_ID,
        detailedSheetId: detailSheet?.id ?? "sheet_detail",
        symbol
      }).map((asset) => asset.assetId)
    ).toEqual(["asset_breaker"]);
  });
});
