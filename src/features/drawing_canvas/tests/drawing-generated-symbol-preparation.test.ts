import { describe, expect, it } from "vitest";
import {
  createDefaultStructuredTerminalStrip,
  type TerminalStripMemberSymbol
} from "@/features/drawing_terminal_blocks/api/public";
import {
  buildRenderableDrawingSymbols,
  createGeneratedStructuredTerminalStripSymbol,
  createGeneratedTerminalBlockSymbol,
  getRenderableSymbolForPlacement,
  structuredTerminalStripSymbolId,
  structuredTerminalStripVersionId
} from "../logic/services/drawing-generated-symbols";
import { createDefaultDrawingModel } from "../data/schema";
import type {
  DrawingAssetRecord,
  DrawingPlacement
} from "../data/schema";
import { createTerminalBlockPlacement } from "../logic/services/drawing-terminal-blocks";
import type { ApprovedDrawingSymbol } from "../types";

function approvedSymbol(input: {
  symbolId: string;
  versionId?: string;
  displayName?: string;
}): ApprovedDrawingSymbol {
  return {
    symbolId: input.symbolId,
    symbolKey: input.symbolId,
    displayName: input.displayName ?? input.symbolId,
    category: "instrument",
    versionId: input.versionId ?? `${input.symbolId}_v1`,
    versionNumber: 1,
    svg: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
    metadata: {
      symbolKey: input.symbolId,
      displayName: input.displayName ?? input.symbolId,
      category: "instrument",
      viewBox: { x: 0, y: 0, width: 10, height: 10 },
      anchors: [],
      terminals: []
    }
  };
}

function placementFor(symbol: ApprovedDrawingSymbol): DrawingPlacement {
  return {
    id: `placement_${symbol.symbolId}`,
    symbolId: symbol.symbolId,
    versionId: symbol.versionId,
    role: "device",
    tag: "X-101",
    x: 10,
    y: 20,
    rotation: 0,
    scale: 1
  };
}

const terminalMember: ApprovedDrawingSymbol = {
  ...approvedSymbol({ symbolId: "terminal_member" }),
  category: "terminal_block",
  technicalKind: "terminal_block",
  metadata: {
    symbolKey: "terminal_member",
    displayName: "Terminal member",
    category: "terminal_block",
    layoutUsage: "panel_layout",
    mountingType: "din_rail",
    physicalWidthMm: 5.2,
    physicalHeightMm: 35.3,
    viewBox: { x: 0, y: 0, width: 10, height: 20 },
    terminalStripCapability: {
      role: "electrical",
      railDatumMm: 22,
      defaultForNewStrips: true
    },
    anchors: [{ key: "1", x: 0, y: 10, kind: "terminal" }],
    terminals: [
      {
        key: "1",
        label: "1",
        anchorKey: "1",
        panelSide: "single",
        requiredForWiring: true
      }
    ]
  }
};

const terminalEndBracket: ApprovedDrawingSymbol = {
  ...approvedSymbol({ symbolId: "terminal_end_bracket" }),
  category: "terminal_block",
  technicalKind: "terminal_block",
  metadata: {
    symbolKey: "terminal_end_bracket",
    displayName: "Terminal end bracket",
    category: "terminal_block",
    layoutUsage: "panel_layout",
    mountingType: "din_rail",
    physicalWidthMm: 8,
    physicalHeightMm: 52.4,
    viewBox: { x: 0, y: 0, width: 10, height: 20 },
    terminalStripCapability: {
      role: "end_bracket",
      railDatumMm: 31,
      defaultForNewStrips: true
    },
    anchors: [],
    terminals: []
  }
};

const terminalStripSymbols = [terminalMember, terminalEndBracket];

function structuredFixture() {
  const asset: DrawingAssetRecord = {
    id: "asset_strip",
    tag: "TB-201",
    type: "terminal_block",
    title: "Structured strip",
    terminalStrip: createDefaultStructuredTerminalStrip(
      terminalStripSymbols as TerminalStripMemberSymbol[],
      2
    )
  };
  const placement: DrawingPlacement = {
    id: "placement_strip_a",
    assetId: asset.id,
    symbolId: structuredTerminalStripSymbolId(asset.id),
    versionId: structuredTerminalStripVersionId(asset.id),
    role: "terminal_block",
    tag: asset.tag,
    x: 10,
    y: 20,
    rotation: 0,
    scale: 1
  };
  return { asset, placement };
}

describe("drawing generated symbol preparation", () => {
  it("indexes exact versions while preserving first-match behavior", () => {
    const first = approvedSymbol({
      symbolId: "duplicate",
      versionId: "version_1",
      displayName: "First"
    });
    const duplicate = approvedSymbol({
      symbolId: "duplicate",
      versionId: "version_1",
      displayName: "Second"
    });

    expect(
      getRenderableSymbolForPlacement(placementFor(first), [first, duplicate])
    ).toBe(first);

    const colonInSymbolId = approvedSymbol({
      symbolId: "symbol:part",
      versionId: "version"
    });
    const colonInVersionId = approvedSymbol({
      symbolId: "symbol",
      versionId: "part:version"
    });
    expect(
      getRenderableSymbolForPlacement(placementFor(colonInVersionId), [
        colonInSymbolId,
        colonInVersionId
      ])
    ).toBe(colonInVersionId);

    expect(
      getRenderableSymbolForPlacement(
        {
          ...placementFor(first),
          versionId: "missing_historical_version"
        },
        [first]
      )
    ).toBeUndefined();
  });

  it("reuses occurrence-specific terminal geometry only for one immutable placement", () => {
    const model = createDefaultDrawingModel();
    const placement = createTerminalBlockPlacement({
      model,
      activeSheet: model.sheets[0],
      terminalBlock: { count: 8, startNumber: 1, orientation: "horizontal" }
    });
    const symbols: ApprovedDrawingSymbol[] = [];
    const first = getRenderableSymbolForPlacement(placement, symbols);
    const repeated = getRenderableSymbolForPlacement(placement, symbols);
    const freshEquivalent = createGeneratedTerminalBlockSymbol(
      { ...placement },
      symbols
    );
    const secondOccurrence = getRenderableSymbolForPlacement(
      { ...placement, id: "second_occurrence", tag: "TB-202" },
      symbols
    );

    expect(repeated).toBe(first);
    expect(freshEquivalent?.svg).toBe(first?.svg);
    expect(freshEquivalent?.metadata).toEqual(first?.metadata);
    expect(secondOccurrence).not.toBe(first);
    expect(secondOccurrence?.metadata).toEqual(first?.metadata);
    expect(
      getRenderableSymbolForPlacement(placement, [...symbols])
    ).not.toBe(first);

    const supersedingRevision = { ...placement, x: placement.x + 10 };
    const supersedingSymbol = getRenderableSymbolForPlacement(
      supersedingRevision,
      symbols
    );
    expect(supersedingSymbol).not.toBe(first);
    expect(getRenderableSymbolForPlacement(placement, symbols)).not.toBe(first);
  });

  it("shares structured geometry by immutable asset and invalidates dependencies", () => {
    const { asset, placement } = structuredFixture();
    const symbols = terminalStripSymbols;
    const first = getRenderableSymbolForPlacement(placement, symbols, [asset]);
    const secondOccurrence = getRenderableSymbolForPlacement(
      { ...placement, id: "placement_strip_b", x: 80 },
      symbols,
      [asset]
    );
    const changedAsset: DrawingAssetRecord = {
      ...asset,
      title: "Changed strip"
    };
    const changed = getRenderableSymbolForPlacement(
      placement,
      symbols,
      [changedAsset]
    );
    const changedSymbolBundle = getRenderableSymbolForPlacement(
      placement,
      [
        { ...terminalMember, displayName: "Changed member" },
        terminalEndBracket
      ],
      [asset]
    );
    const freshEquivalent = createGeneratedStructuredTerminalStripSymbol(
      placement,
      [...symbols],
      [asset]
    );

    expect(secondOccurrence).toBe(first);
    expect(freshEquivalent?.svg).toBe(first?.svg);
    expect(freshEquivalent?.metadata).toEqual(first?.metadata);
    expect(changed).not.toBe(first);
    expect(changed?.displayName).toBe("Changed strip");
    expect(changedSymbolBundle).not.toBe(first);
    expect(
      getRenderableSymbolForPlacement(placement, symbols, [asset])
    ).not.toBe(first);
  });

  it("reuses a prepared renderable bundle for equivalent immutable inputs", () => {
    const { asset, placement } = structuredFixture();
    const symbols = terminalStripSymbols;
    const placements = [placement];
    const assets = [asset];
    const first = buildRenderableDrawingSymbols({
      placements,
      approvedSymbols: symbols,
      assets
    });

    expect(
      buildRenderableDrawingSymbols({
        placements,
        approvedSymbols: symbols,
        assets
      })
    ).toBe(first);
    expect(
      buildRenderableDrawingSymbols({
        placements: [...placements],
        approvedSymbols: symbols,
        assets
      })
    ).toBe(first);
    expect(first).toHaveLength(3);
    expect(first[2].metadata.anchors.length).toBeGreaterThan(0);

    const changedAsset = { ...asset, title: "Changed strip" };
    buildRenderableDrawingSymbols({
      placements,
      approvedSymbols: symbols,
      assets: [changedAsset]
    });
    expect(
      buildRenderableDrawingSymbols({
        placements,
        approvedSymbols: symbols,
        assets
      })
    ).not.toBe(first);
  });
});
