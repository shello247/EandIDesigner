import { describe, expect, it } from "vitest";
import type { SymbolMetadata } from "@/features/symbol_registry/data/schema";
import {
  createDefaultDrawingModel,
  drawingSheetCanvasModelSchema,
  type DrawingSheetCanvasModel
} from "../data/schema";
import type { ApprovedDrawingSymbol } from "../types";
import { renderDrawingToSvg } from "../logic/services/drawing-svg-renderer";
import { buildDrawingPdfPrintHtml } from "../logic/services/drawing-pdf-export";
import {
  generateDefaultOrthogonalRoute,
  removeRouteControlPoint,
  updateRouteLabelPosition,
  updateRoutePoint
} from "../logic/services/connection-route-geometry";
import {
  getConnectionRouteLabel,
  getRenderableConnectionRoute
} from "../logic/services/connection-route-renderer";
import { createDefaultNoteAnnotation } from "../logic/services/drawing-annotations";
import {
  createConnectionFromEndpoints,
  isDuplicateConnection
} from "../logic/services/drawing-connections";
import { getConnectionTransitionGroups } from "../logic/services/drawing-connection-groups";
import {
  buildCableScheduleRows,
  deriveWireId,
  normalizeCableConductorKey
} from "../logic/services/drawing-identification";
import { toSheetCanvasModel } from "../logic/commands/drawing-sheet-commands";

const metadata: SymbolMetadata = {
  symbolKey: "test_symbol",
  displayName: "Test Symbol",
  category: "instrument",
  viewBox: { x: 0, y: 0, width: 100, height: 80 },
  anchors: [
    { key: "T1", x: 10, y: 20, kind: "terminal" },
    { key: "T2", x: 80, y: 20, kind: "terminal" }
  ],
  terminals: [
    {
      key: "T1",
      label: "T1",
      function: "Signal",
      anchorKey: "T1",
      requiredForWiring: true
    }
  ]
};

const approvedSymbol: ApprovedDrawingSymbol = {
  symbolId: "sym_1",
  symbolKey: "test_symbol",
  displayName: "Test Symbol",
  manufacturer: "Vendor",
  model: "TS1",
  category: "instrument",
  versionId: "ver_1",
  versionNumber: 1,
  svg: '<svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="100" height="80" fill="white" stroke="black"/></svg>',
  metadata
};

function validModel(): DrawingSheetCanvasModel {
  return {
    ...toSheetCanvasModel(createDefaultDrawingModel(), "sheet_1"),
    placements: [
      {
        id: "p1",
        symbolId: "sym_1",
        versionId: "ver_1",
        role: "device",
        tag: "TT-101",
        x: 20,
        y: 30,
        rotation: 0,
        scale: 0.5
      },
      {
        id: "p2",
        symbolId: "sym_1",
        versionId: "ver_1",
        role: "device",
        tag: "TT-102",
        x: 120,
        y: 30,
        rotation: 0,
        scale: 0.5
      }
    ],
    connections: [
      {
        id: "c1",
        from: { placementId: "p1", anchorKey: "T1" },
        to: { placementId: "p2", anchorKey: "T2" },
        label: "Signal"
      },
      {
        id: "c2",
        from: { placementId: "p2", anchorKey: "T1" },
        to: { placementId: "p1", anchorKey: "T2" },
        label: "Return"
      }
    ]
  };
}

describe("drawing canvas domain", () => {
  it("creates semantic connections with cable defaults", () => {
    const model = validModel();
    model.placements.push({
      id: "cable_1",
      symbolId: "sym_1",
      versionId: "ver_1",
      role: "cable_assembly",
      tag: "CBL-1",
      x: 220,
      y: 30,
      rotation: 0,
      scale: 0.5
    });
    const result = createConnectionFromEndpoints({
      model,
      symbols: [approvedSymbol],
      from: { placementId: "cable_1", anchorKey: "T1" },
      to: { placementId: "p1", anchorKey: "T2" }
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.connection.cablePlacementId : undefined).toBe(
      "cable_1"
    );
    expect(result.ok ? result.connection.conductorKey : undefined).toBe("T1");
    expect(result.ok ? result.connection.wireId : undefined).toBe("CBL-1-WHT");
    expect(result.ok ? result.connection.label : undefined).toBeUndefined();
  });

  it("detects same-endpoint and duplicate connection pairs", () => {
    const model = validModel();

    expect(
      createConnectionFromEndpoints({
        model,
        symbols: [approvedSymbol],
        from: { placementId: "p1", anchorKey: "T1" },
        to: { placementId: "p1", anchorKey: "T1" }
      }).ok
    ).toBe(false);
    expect(
      isDuplicateConnection(model.connections, {
        placementId: "p2",
        anchorKey: "T2"
      }, {
        placementId: "p1",
        anchorKey: "T1"
      })
    ).toBe(true);

    model.connections[0].to = { placementId: "p1", anchorKey: "T1" };
    expect(
      createConnectionFromEndpoints({
        model,
        symbols: [approvedSymbol],
        from: { placementId: "p1", anchorKey: "T1" },
        to: { placementId: "p1", anchorKey: "T1" }
      }).ok
    ).toBe(false);
  });

  it("renders a deterministic SVG with embedded placements", () => {
    const model = validModel();
    model.sheet.titleBlock = {
      ...model.sheet.titleBlock,
      date: "2026-06-30",
      preparedBy: "Sheldon Bowman",
      checkedBy: "Suresh Singh"
    };
    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [approvedSymbol],
      drawingTitle: "TT-123 Loop Diagram",
      sheetTitle: "Sheet Loop Wiring Detail",
      sheetNumber: 1,
      sheetCount: 2
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain('data-placement-id="p1"');
    expect(svg).toContain('data-connection-id="c1"');
    expect(svg).toContain('data-route-style="orthogonal"');
    expect(svg).toContain('data-placement-title="p1"');
    expect(svg).toContain("<path");
    expect(svg).not.toContain("canvas-connection-preview");
    expect(svg).toContain("Signal");
    expect(svg).toContain("Test Symbol");
    expect(svg).toContain('data-title-block="technical-full-width"');
    expect(svg).toContain('data-title-block-section="revisions"');
    expect(svg).toContain('data-title-block-section="approval"');
    expect(svg).toContain('data-title-block-section="drawing-title"');
    expect(svg).toContain('data-title-block-section="metadata"');
    expect(svg).toContain("Sheet Loop Wiring Detail");
    expect(svg).not.toContain("TT-123 Loop Diagram");
    expect(svg).toContain("S.B.");
    expect(svg).toContain("S.S.");
    expect(svg).toContain("Sheldon Bowman (S.B.)");
    expect(svg).toContain("Suresh Singh (S.S.)");
    expect(svg).toContain("DRAWING NO.");
    expect(svg).toContain("SHEET NO.");
    expect(svg).toContain("1 OF 2");
    expect(svg.indexOf('data-placement-id="p1"')).toBeLessThan(
      svg.indexOf('data-connection-id="c1"')
    );
    expect((svg.match(/<svg/g) ?? []).length).toBe(1);
  });

  it("moves the placement tag with the placement title label group", () => {
    const model = validModel();
    model.placements[0].labelPosition = { x: 55, y: 66 };

    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [approvedSymbol]
    });

    expect(svg).toContain(
      'data-placement-tag="p1" x="55" y="60.8"'
    );
    expect(svg).toContain(
      'data-placement-title="p1" x="55" y="66"'
    );
  });

  it("renders movable title labels for cable assembly placements", () => {
    const model = validModel();
    model.placements[1] = {
      ...model.placements[1],
      role: "cable_assembly",
      tag: "C-101",
      labelPosition: { x: 88, y: 77 }
    };

    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [approvedSymbol]
    });

    expect(svg).toContain(
      'data-placement-tag="p2" x="88" y="71.8"'
    );
    expect(svg).toContain(
      'data-placement-title="p2" x="88" y="77"'
    );
  });

  it("renders custom symbol titles per placement", () => {
    const model = validModel();
    model.placements[0] = {
      ...model.placements[0],
      title: "Temperature Transmitter"
    };

    const parsed = drawingSheetCanvasModelSchema.parse({
      ...model,
      placements: [
        {
          ...model.placements[0],
          title: "  Temperature Transmitter  "
        },
        model.placements[1]
      ]
    });
    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [approvedSymbol]
    });

    expect(parsed.placements[0].title).toBe("Temperature Transmitter");
    expect(svg).toContain("Temperature Transmitter");
    expect(svg).not.toContain(
      'data-placement-title="p1" x="20" y="32.2" font-family="Arial, Helvetica, sans-serif" font-size="3.1" font-weight="600" fill="#64748b">Test Symbol</text>'
    );
  });

  it("renders section title pages from sheet metadata", () => {
    const model = {
      ...validModel(),
      placements: [],
      connections: [],
      annotations: []
    };
    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [approvedSymbol],
      sheetKind: "section_title",
      sectionTitlePage: {
        title: "Power Distribution",
        subtitle: "Panel and breaker drawings",
        sectionNumber: "Section 2"
      },
      sheetTitle: "Power Section"
    });

    expect(svg).toContain('data-section-title-page="true"');
    expect(svg).toContain("POWER DISTRIBUTION");
    expect(svg).toContain("Panel and breaker drawings");
    expect(svg).toContain("SECTION 2");
    expect(svg).not.toContain('fill="url(#ei-grid)"');
  });

  it("wraps long technical title block sheet titles", () => {
    const model = validModel();
    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [approvedSymbol],
      sheetTitle: "Tank1 Prothermo to Tank Side Monitor Wiring Details"
    });

    expect(svg).toContain('data-title-block-section="drawing-title"');
    expect(svg).toContain("Tank1 Prothermo to Tank Side");
    expect(svg).toContain("Monitor Wiring Details");
    expect(svg).not.toContain("...");
  });

  it("does not create or render fallback note titles", () => {
    const model = validModel();
    const note = createDefaultNoteAnnotation({
      id: "note_blank_title",
      point: { x: 60, y: 70 },
      sheet: model.sheet
    });

    model.annotations = [
      {
        ...note,
        text: "Plain note text"
      }
    ];

    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [approvedSymbol]
    });

    expect(note.title).toBeUndefined();
    expect(svg).toContain("Plain note text");
    expect(svg).not.toContain(">Note<");
  });

  it("builds print-ready HTML for single page PDF export", () => {
    const model = validModel();
    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [approvedSymbol],
      showAnchors: false,
      showConnections: true
    });
    const html = buildDrawingPdfPrintHtml({
      title: "Test Drawing",
      pages: [{ sheet: model.sheet, svg }]
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Test Drawing</title>");
    expect(html).toContain("size: 420mm 297mm");
    expect(html).not.toContain("window.print()");
    expect(html).toContain('data-placement-id="p1"');
    expect(html).not.toContain('stroke="#0f766e"');

    const printHtml = buildDrawingPdfPrintHtml({
      title: "Test Drawing",
      pages: [{ sheet: model.sheet, svg }],
      drawingUrl: "/drawings/example"
    });

    expect(printHtml).toContain("window.print()");
    expect(printHtml).toContain("requestPrint");
    expect(printHtml).toContain("Back to drawing");
  });

  it("builds print-ready HTML for multi-page drawing packages", () => {
    const model = validModel();
    const firstSvg = renderDrawingToSvg({
      model,
      approvedSymbols: [approvedSymbol],
      showAnchors: false,
      showConnections: true,
      sheetNumber: 1,
      sheetCount: 2
    });
    const secondSvg = renderDrawingToSvg({
      model: { ...model, placements: [], connections: [], annotations: [] },
      approvedSymbols: [approvedSymbol],
      showAnchors: false,
      showConnections: true,
      sheetNumber: 2,
      sheetCount: 2
    });
    const html = buildDrawingPdfPrintHtml({
      title: "Package Drawing",
      pages: [
        { sheet: model.sheet, svg: firstSvg },
        { sheet: model.sheet, svg: secondSvg }
      ],
      drawingUrl: "/drawings/example"
    });

    expect(html.match(/class="drawing-page"/g)).toHaveLength(2);
    expect(html).toContain("1 OF 2");
    expect(html).toContain("2 OF 2");
    expect(html).toContain("page-break-after: always");
  });

  it("keeps old drawing models without routes compatible", () => {
    const model = validModel();

    expect(
      drawingSheetCanvasModelSchema.parse(model).connections[0].route
    ).toBeUndefined();
    expect(
      drawingSheetCanvasModelSchema.parse(model).connections[0].wireId
    ).toBeUndefined();
    expect(
      drawingSheetCanvasModelSchema.parse(model).placements[0].labelPosition
    ).toBeUndefined();
    expect(
      drawingSheetCanvasModelSchema.parse(model).placements[0].deviceTitlePosition
    ).toBeUndefined();
  });

  it("parses old simple annotations and new note leaders", () => {
    const model = validModel();
    model.annotations = [
      {
        id: "old_note",
        text: "Existing note",
        x: 20,
        y: 30,
        kind: "note"
      },
      {
        id: "leader_note",
        title: "Installation Instructions",
        text: "Seal fitting required",
        x: 40,
        y: 50,
        width: 70,
        height: 24,
        kind: "note",
        leader: {
          enabled: true,
          targetX: 100,
          targetY: 90
        }
      }
    ];

    const parsed = drawingSheetCanvasModelSchema.parse(model);
    expect(parsed.annotations[0].width).toBeUndefined();
    expect(parsed.annotations[0].title).toBeUndefined();
    expect(parsed.annotations[1].title).toBe("Installation Instructions");
    expect(parsed.annotations[1].leader?.enabled).toBe(true);
  });

  it("renders note blocks with wrapped text and leader arrows", () => {
    const model = validModel();
    model.annotations = [
      {
        id: "note_1",
        title: "Installation Instructions",
        text: "Install Class I Division 1 seal fitting",
        x: 60,
        y: 70,
        width: 58,
        height: 24,
        kind: "note",
        leader: {
          enabled: true,
          targetX: 130,
          targetY: 95
        }
      }
    ];

    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [approvedSymbol]
    });

    expect(svg).toContain('data-annotation-id="note_1"');
    expect(svg).toContain('data-annotation-leader="note_1"');
    expect(svg).toContain("Installation Instructions");
    expect(svg).not.toContain('stroke="#cbd5e1"');
    expect(svg).toContain('marker-end="url(#ei-note-arrow)"');
    expect(svg).toContain("<tspan");
    expect(svg).not.toContain("<foreignObject");
  });

  it("groups six conductor connections by transition pair", () => {
    const model = validModel();
    model.placements = [
      { ...model.placements[0], id: "fmp51", tag: "LIT-101" },
      {
        ...model.placements[1],
        id: "clx1p",
        role: "cable_assembly",
        tag: "C-101"
      },
      {
        ...model.placements[0],
        id: "nrf81",
        tag: "TSM-101",
        x: 220
      }
    ];
    model.connections = [
      ["fmp51", "T1", "clx1p", "T1", "C-101-WHT"],
      ["fmp51", "T2", "clx1p", "T2", "C-101-BLK"],
      ["fmp51", "T1", "clx1p", "T2", "C-101-SHLD"],
      ["clx1p", "T1", "nrf81", "T1", "C-101-WHT"],
      ["clx1p", "T2", "nrf81", "T2", "C-101-BLK"],
      ["clx1p", "T1", "nrf81", "T2", "C-101-SHLD"]
    ].map(([fromPlacementId, fromAnchor, toPlacementId, toAnchor, wireId], index) => ({
      id: `c${index + 1}`,
      from: { placementId: fromPlacementId, anchorKey: fromAnchor },
      to: { placementId: toPlacementId, anchorKey: toAnchor },
      cablePlacementId: "clx1p",
      conductorKey: fromPlacementId === "clx1p" ? fromAnchor : toAnchor,
      wireId
    }));

    const groups = getConnectionTransitionGroups(model, [approvedSymbol]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.title)).toEqual([
      "LIT-101 ↔ C-101",
      "C-101 ↔ TSM-101"
    ]);
    expect(groups.map((group) => group.connectionCount)).toEqual([3, 3]);
  });

  it("normalizes opposite cable end anchors to the same wire ID", () => {
    const model = validModel();
    model.placements[1] = {
      ...model.placements[1],
      role: "cable_assembly",
      tag: "C-101"
    };
    const firstEnd = {
      ...model.connections[0],
      cablePlacementId: "p2",
      conductorKey: "CH1_T1"
    };
    const secondEnd = {
      ...model.connections[0],
      cablePlacementId: "p2",
      conductorKey: "CH2_T1"
    };

    expect(normalizeCableConductorKey("CH1_T1")).toBe("WHT");
    expect(normalizeCableConductorKey("CH2_T1")).toBe("WHT");
    expect(deriveWireId(model, [approvedSymbol], firstEnd)).toBe("C-101-WHT");
    expect(deriveWireId(model, [approvedSymbol], secondEnd)).toBe("C-101-WHT");
  });

  it("builds schedule-ready cable rows from drawing model data", () => {
    const model = validModel();
    model.placements[0].tag = "LIT-101";
    model.placements[1] = {
      ...model.placements[1],
      role: "cable_assembly",
      tag: "C-101"
    };
    model.connections = [
      {
        id: "c1",
        from: { placementId: "p1", anchorKey: "T1" },
        to: { placementId: "p2", anchorKey: "T1" },
        cablePlacementId: "p2",
        conductorKey: "T1",
        wireId: "C-101-WHT"
      }
    ];

    expect(buildCableScheduleRows(model, [approvedSymbol])[0]).toMatchObject({
      cableId: "C-101",
      cablePlacementId: "p2",
      fromTag: "LIT-101",
      wireIds: ["C-101-WHT"],
      conductorKeys: ["WHT"]
    });
  });

  it("strips legacy bundle data from old drawing models", () => {
    const legacyModel = {
      ...validModel(),
      bundles: []
    };
    const parsed = drawingSheetCanvasModelSchema.parse(legacyModel);

    expect("bundles" in parsed).toBe(false);
  });

  it("generates and updates orthogonal connection routes", () => {
    const model = validModel();
    const route = generateDefaultOrthogonalRoute({
      model,
      symbols: [approvedSymbol],
      connection: model.connections[0]
    });

    expect(route?.style).toBe("orthogonal");
    expect(route?.points[0]).toMatchObject({ kind: "endpoint", x: 25, y: 40 });
    expect(route?.points.at(-1)).toMatchObject({
      kind: "endpoint",
      x: 160,
      y: 40
    });

    const updated = updateRoutePoint({
      route: route!,
      pointId: route!.points[1].id,
      point: { x: 50.37, y: 95.64 },
      sheet: model.sheet
    });

    expect(updated.mode).toBe("manual");
    expect(updated.points[1]).toMatchObject({ x: 50.37, y: 95.64 });
  });

  it("removes intermediate route control points without removing endpoints", () => {
    const model = validModel();
    const route = generateDefaultOrthogonalRoute({
      model,
      symbols: [approvedSymbol],
      connection: model.connections[0]
    });
    const pointToRemove = route!.points.find((point) => point.kind !== "endpoint");
    const nextRoute = removeRouteControlPoint(route!, pointToRemove!.id);

    expect(nextRoute.mode).toBe("manual");
    expect(nextRoute.points).toHaveLength(route!.points.length - 1);
    expect(nextRoute.points[0].kind).toBe("endpoint");
    expect(nextRoute.points.at(-1)?.kind).toBe("endpoint");
  });

  it("stores manual route label positions for export and canvas rendering", () => {
    const model = validModel();
    const route = generateDefaultOrthogonalRoute({
      model,
      symbols: [approvedSymbol],
      connection: model.connections[0]
    });

    model.connections[0].route = updateRouteLabelPosition({
      route: route!,
      point: { x: 72.42, y: 88.77 },
      sheet: model.sheet
    });

    const rendered = getRenderableConnectionRoute({
      model,
      symbols: [approvedSymbol],
      connection: model.connections[0]
    });
    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [approvedSymbol]
    });

    expect(rendered?.labelPoint).toMatchObject({
      x: 72.42,
      y: 88.77,
      anchor: "middle"
    });
    expect(svg).toContain('x="72.42"');
    expect(svg).toContain('y="88.77"');
  });

  it("offsets parallel cable-assigned routes without moving endpoints", () => {
    const model = validModel();
    model.placements.push({
      id: "cable_1",
      symbolId: "sym_1",
      versionId: "ver_1",
      role: "cable_assembly",
      tag: "CBL-1",
      x: 220,
      y: 30,
      rotation: 0,
      scale: 0.5
    });
    model.connections = model.connections.map((connection) => ({
      ...connection,
      cablePlacementId: "cable_1"
    }));

    const firstRoute = generateDefaultOrthogonalRoute({
      model,
      symbols: [approvedSymbol],
      connection: model.connections[0]
    });
    const secondRoute = generateDefaultOrthogonalRoute({
      model,
      symbols: [approvedSymbol],
      connection: model.connections[1]
    });

    expect(firstRoute?.points[0]).toEqual(
      expect.objectContaining({ x: 25, y: 40 })
    );
    expect(secondRoute?.points[0]).toEqual(
      expect.objectContaining({ x: 125, y: 40 })
    );
    expect(firstRoute?.points[1].y).not.toBe(secondRoute?.points[1].y);
  });

  it("suppresses generic route labels and renders useful labels with backing", () => {
    const model = validModel();

    expect(
      getConnectionRouteLabel({
        ...model.connections[0],
        label: "Connection",
        conductorKey: "White"
      })
    ).toBe("White");
    expect(
      getConnectionRouteLabel({
        ...model.connections[0],
        label: "Connection",
        conductorKey: "CH1_T1"
      })
    ).toBeNull();

    const rendered = getRenderableConnectionRoute({
      model,
      symbols: [approvedSymbol],
      connection: model.connections[0]
    });
    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [approvedSymbol]
    });

    expect(rendered?.label).toBe("Signal");
    expect(svg).toContain("<rect");
    expect(svg).toContain("Signal");
  });

  it("preserves safe inherited root SVG paint attributes for embedded symbols", () => {
    const cableSymbol: ApprovedDrawingSymbol = {
      ...approvedSymbol,
      symbolId: "cable_sym",
      versionId: "cable_ver",
      symbolKey: "root_fill_none_symbol",
      category: "cable_assembly",
      svg: '<svg viewBox="0 0 100 80" fill="none" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><path d="M 10 10 C 20 70 80 70 90 10 Z" stroke="black"/></svg>'
    };
    const model = validModel();
    model.placements = [
      {
        id: "cable_1",
        symbolId: "cable_sym",
        versionId: "cable_ver",
        role: "cable_assembly",
        tag: "CBL-1",
        x: 20,
        y: 30,
        rotation: 0,
        scale: 0.5
      }
    ];
    model.connections = [];

    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [cableSymbol]
    });

    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('data-symbol-key="root_fill_none_symbol"');
  });
});
