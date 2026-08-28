import { describe, expect, it } from "vitest";
import {
  createDefaultStructuredTerminalStrip,
  type TerminalStripMemberSymbol
} from "@/features/drawing_terminal_blocks/api/public";
import {
  createAndPlaceStructuredTerminalStrip
} from "../logic/commands/drawing-structured-terminal-strip-commands";
import { toSheetCanvasModel } from "../logic/commands/drawing-sheet-commands";
import {
  generateDefaultOrthogonalRoute,
  getEndpointWorldPoint
} from "../logic/services/connection-route-geometry";
import {
  createConnectionFromEndpoints,
  getSymbolForPlacement
} from "../logic/services/drawing-connections";
import {
  buildRenderableDrawingSymbols,
  structuredTerminalStripSymbolId
} from "../logic/services/drawing-generated-symbols";
import {
  createDefaultDrawingModel,
  type DrawingPlacement,
  type DrawingSheetCanvasModel
} from "../data/schema";
import type { ApprovedDrawingSymbol } from "../types";

function terminalStripMemberSymbol(input: {
  id: string;
  role: "electrical" | "end_bracket";
  defaultForNewStrips?: boolean;
}): ApprovedDrawingSymbol {
  const electrical = input.role === "electrical";

  return {
    symbolId: input.id,
    symbolKey: input.id,
    displayName: input.id,
    category: "terminal_block",
    versionId: `${input.id}_v1`,
    versionNumber: 1,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"/>',
    metadata: {
      symbolKey: input.id,
      displayName: input.id,
      category: "terminal_block",
      layoutUsage: "panel_layout",
      mountingType: "din_rail",
      physicalWidthMm: electrical ? 5.2 : 8,
      physicalHeightMm: electrical ? 35.3 : 52.4,
      viewBox: { x: 0, y: 0, width: 10, height: 20 },
      terminalStripCapability: {
        role: input.role,
        railDatumMm: electrical ? 22 : 31,
        defaultForNewStrips: input.defaultForNewStrips
      },
      anchors: electrical
        ? [
            { key: "1", x: 0, y: 5, kind: "terminal" },
            { key: "2", x: 10, y: 15, kind: "terminal" }
          ]
        : [],
      terminals: electrical
        ? [
            {
              key: "1",
              label: "1",
              anchorKey: "1",
              panelSide: "single",
              requiredForWiring: true
            },
            {
              key: "2",
              label: "2",
              anchorKey: "2",
              panelSide: "single",
              requiredForWiring: true
            }
          ]
        : []
    }
  };
}

const electricalMember = terminalStripMemberSymbol({
  id: "pt_2_5",
  role: "electrical",
  defaultForNewStrips: true
});
const endBracket = terminalStripMemberSymbol({
  id: "ss2",
  role: "end_bracket",
  defaultForNewStrips: true
});
const memberSymbols = [electricalMember, endBracket];

const cableSymbol: ApprovedDrawingSymbol = {
  symbolId: "cable_symbol",
  symbolKey: "multicore_cable",
  displayName: "Multicore Cable",
  category: "cable_assembly",
  versionId: "cable_symbol_v1",
  versionNumber: 1,
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30"/>',
  metadata: {
    symbolKey: "multicore_cable",
    displayName: "Multicore Cable",
    category: "cable_assembly",
    viewBox: { x: 0, y: 0, width: 100, height: 30 },
    anchors: [
      { key: "CORE01_B", x: 100, y: 8, kind: "terminal" },
      { key: "CORE02_B", x: 100, y: 22, kind: "terminal" }
    ],
    terminals: [
      {
        key: "CORE01_B",
        label: "Core 1 B",
        anchorKey: "CORE01_B",
        requiredForWiring: true
      },
      {
        key: "CORE02_B",
        label: "Core 2 B",
        anchorKey: "CORE02_B",
        requiredForWiring: true
      }
    ]
  }
};

function createStripAndCableModel() {
  const model = createDefaultDrawingModel();
  const sheetId = model.sheets[0].id;
  const strip = createDefaultStructuredTerminalStrip(
    memberSymbols as TerminalStripMemberSymbol[],
    12
  );
  const created = createAndPlaceStructuredTerminalStrip({
    model,
    symbols: memberSymbols,
    input: {
      sheetId,
      assetId: "asset_tb_103",
      placementId: "placement_tb_103",
      name: "JB001 field termination block",
      strip,
      x: 40,
      y: 50
    }
  });
  const cablePlacement: DrawingPlacement = {
    id: "placement_cable_101",
    symbolId: cableSymbol.symbolId,
    versionId: cableSymbol.versionId,
    role: "cable_assembly",
    tag: "C-101",
    x: 220,
    y: 90,
    rotation: 0,
    scale: 0.7
  };
  const canvas: DrawingSheetCanvasModel = {
    ...toSheetCanvasModel(created.model, sheetId),
    placements: [
      ...toSheetCanvasModel(created.model, sheetId).placements,
      cablePlacement
    ],
    connections: []
  };
  const approvedSymbols = [...memberSymbols, cableSymbol];
  const renderableSymbols = buildRenderableDrawingSymbols({
    placements: canvas.placements,
    approvedSymbols,
    assets: created.model.assets
  });

  return {
    assets: created.model.assets,
    canvas,
    cablePlacement,
    approvedSymbols,
    renderableSymbols,
    stripPlacement: created.placement
  };
}

describe("structured terminal strip drawing connections", () => {
  it("builds one deterministic generated symbol for repeated representations", () => {
    const fixture = createStripAndCableModel();
    const duplicateRepresentation = {
      ...fixture.stripPlacement,
      id: "placement_tb_103_reference",
      x: 120
    };
    const symbols = buildRenderableDrawingSymbols({
      placements: [
        ...fixture.canvas.placements,
        duplicateRepresentation
      ],
      approvedSymbols: fixture.approvedSymbols,
      assets: fixture.assets
    });
    const generated = symbols.filter(
      (symbol) =>
        symbol.symbolId === structuredTerminalStripSymbolId("asset_tb_103")
    );

    expect(generated).toHaveLength(1);
    expect(generated[0].metadata.anchors.map((anchor) => anchor.key)).toEqual(
      expect.arrayContaining(["M02.1", "M12.2", "M13.1"])
    );
    expect(fixture.assets[0].terminalStrip?.members).toHaveLength(14);
  });

  it("connects a generated strip terminal to a cable conductor in either order", () => {
    const fixture = createStripAndCableModel();
    const stripEndpoint = {
      placementId: fixture.stripPlacement.id,
      anchorKey: "M12.2"
    };
    const cableEndpoint = {
      placementId: fixture.cablePlacement.id,
      anchorKey: "CORE01_B"
    };
    const forward = createConnectionFromEndpoints({
      model: fixture.canvas,
      symbols: fixture.renderableSymbols,
      from: stripEndpoint,
      to: cableEndpoint
    });
    const reverse = createConnectionFromEndpoints({
      model: fixture.canvas,
      symbols: fixture.renderableSymbols,
      from: cableEndpoint,
      to: stripEndpoint
    });

    expect(forward.ok).toBe(true);
    expect(reverse.ok).toBe(true);

    if (!forward.ok) return;
    const route = generateDefaultOrthogonalRoute({
      model: fixture.canvas,
      symbols: fixture.renderableSymbols,
      connection: forward.connection,
      mode: "auto"
    });
    const fromPoint = getEndpointWorldPoint(
      fixture.canvas,
      fixture.renderableSymbols,
      stripEndpoint
    );
    const toPoint = getEndpointWorldPoint(
      fixture.canvas,
      fixture.renderableSymbols,
      cableEndpoint
    );

    expect(route).not.toBeNull();
    expect(route?.points[0]).toMatchObject(fromPoint ?? {});
    expect(route?.points.at(-1)).toMatchObject(toPoint ?? {});
    expect(forward.connection.cablePlacementId).toBe(
      fixture.cablePlacement.id
    );
    expect(forward.connection.conductorKey).toBe("CORE01_B");
  });

  it("connects independently generated structured terminal strips", () => {
    const first = createStripAndCableModel();
    const strip = first.assets[0].terminalStrip;
    expect(strip).toBeDefined();
    if (!strip) return;

    const packageModel = createDefaultDrawingModel();
    packageModel.assets = first.assets;
    packageModel.sheets[0] = {
      ...packageModel.sheets[0],
      placements: [first.stripPlacement]
    };
    const second = createAndPlaceStructuredTerminalStrip({
      model: packageModel,
      symbols: memberSymbols,
      input: {
        sheetId: packageModel.sheets[0].id,
        assetId: "asset_tb_104",
        placementId: "placement_tb_104",
        name: "Second terminal strip",
        strip,
        x: 220,
        y: 50
      }
    });
    const canvas = toSheetCanvasModel(
      second.model,
      packageModel.sheets[0].id
    );
    const renderableSymbols = buildRenderableDrawingSymbols({
      placements: canvas.placements,
      approvedSymbols: memberSymbols,
      assets: second.model.assets
    });
    const result = createConnectionFromEndpoints({
      model: canvas,
      symbols: renderableSymbols,
      from: {
        placementId: first.stripPlacement.id,
        anchorKey: "M02.1"
      },
      to: {
        placementId: second.placement.id,
        anchorKey: "M13.2"
      }
    });

    expect(result.ok).toBe(true);
    expect(
      result.ok
        ? generateDefaultOrthogonalRoute({
            model: canvas,
            symbols: renderableSymbols,
            connection: result.connection
          })
        : null
    ).not.toBeNull();
  });

  it("preserves stale, same-endpoint, and duplicate-pair rejection", () => {
    const fixture = createStripAndCableModel();
    const stripEndpoint = {
      placementId: fixture.stripPlacement.id,
      anchorKey: "M02.1"
    };
    const cableEndpoint = {
      placementId: fixture.cablePlacement.id,
      anchorKey: "CORE02_B"
    };
    const valid = createConnectionFromEndpoints({
      model: fixture.canvas,
      symbols: fixture.renderableSymbols,
      from: stripEndpoint,
      to: cableEndpoint
    });
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;

    expect(
      createConnectionFromEndpoints({
        model: fixture.canvas,
        symbols: fixture.renderableSymbols,
        from: stripEndpoint,
        to: stripEndpoint
      })
    ).toMatchObject({ ok: false, error: "Choose a different destination anchor." });
    expect(
      createConnectionFromEndpoints({
        model: { ...fixture.canvas, connections: [valid.connection] },
        symbols: fixture.renderableSymbols,
        from: cableEndpoint,
        to: stripEndpoint
      })
    ).toMatchObject({ ok: false, error: "Those anchors are already connected." });
    expect(
      createConnectionFromEndpoints({
        model: fixture.canvas,
        symbols: fixture.renderableSymbols,
        from: { ...stripEndpoint, anchorKey: "M99.9" },
        to: cableEndpoint
      })
    ).toMatchObject({
      ok: false,
      error: "Connection endpoint is no longer available."
    });
    expect(
      getSymbolForPlacement(
        fixture.cablePlacement,
        fixture.renderableSymbols
      )
    ).toBe(cableSymbol);
  });
});
