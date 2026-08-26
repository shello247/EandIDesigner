import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AnchorAvailabilityLegend,
  AnchorOverlay,
  AnchorTooltip
} from "../ui/canvas/AnchorOverlay";
import type { AnchorHotspot } from "../ui/canvas/types";
import type { DrawingAnchorAvailability } from "../logic/services/drawing-anchor-availability";
import type { DrawingSheetCanvasModel } from "../data/schema";
import { buildDrawingAnchorInspection } from "../ui/canvas/ConnectionEndpointDetails";
import { ConnectionEndpointInspector } from "../ui/components/connection-endpoint-inspector";

function hotspot(anchorKey: string, x: number): AnchorHotspot {
  return {
    id: `placement_pdb_103:${anchorKey}`,
    placementId: "placement_pdb_103",
    placementTag: "PDB-103",
    symbolName: "+24 VDC Distribution Block",
    anchor: { key: anchorKey, x, y: 20, kind: "terminal" },
    terminal: {
      key: anchorKey,
      label: anchorKey,
      anchorKey,
      panelSide: "internal",
      requiredForWiring: true
    },
    point: { x, y: 20 }
  };
}

const states: Record<string, DrawingAnchorAvailability> = {
  T1: { status: "available", enabled: true, occupants: [] },
  T2: {
    status: "occupied",
    enabled: false,
    reason: "PW-011 already occupies this terminal side.",
    occupants: [{ label: "011", wireId: "PW-011" }]
  },
  T3: {
    status: "conflicting",
    enabled: false,
    reason: "This terminal side has conflicting conductor occupancy.",
    occupants: [{ label: "PW-011" }, { label: "C-102-CORE01-A" }]
  },
  T4: {
    status: "unresolved",
    enabled: false,
    reason: "Terminal occupancy is unavailable for this anchor.",
    occupants: []
  }
};

describe("AnchorOverlay availability markers", () => {
  it("renders non-colour glyphs for occupied, conflicting, and unavailable anchors", () => {
    const markup = renderToStaticMarkup(
      createElement(AnchorOverlay, {
        anchorHotspots: [
          hotspot("T1", 10),
          hotspot("T2", 20),
          hotspot("T3", 30),
          hotspot("T4", 40)
        ],
        activeAnchorId: null,
        connectionMode: "connecting",
        anchorMarkerRadius: 2.8,
        anchorHitRadius: 4,
        anchorGlowRadius: 6.5,
        anchorStrokeWidth: 0.55,
        showAvailability: true,
        onActiveAnchorChange: () => undefined,
        onFocusCanvas: () => undefined,
        onSelectPlacement: () => undefined,
        onConnectionSelect: () => undefined,
        onConnectionAnchorHover: () => undefined,
        onConnectionAnchorInspectionChange: () => undefined,
        onConnectionAnchorClick: () => undefined,
        getConnectionAnchorState: (endpoint) => states[endpoint.anchorKey]
      })
    );

    expect(markup).toContain('data-anchor-status="available"');
    expect(markup).toContain('data-anchor-status="occupied"');
    expect(markup).toContain('data-anchor-status="conflicting"');
    expect(markup).toContain('data-anchor-status="unresolved"');
    expect(markup).toContain('data-anchor-status-glyph="occupied"');
    expect(markup).toContain('data-anchor-status-glyph="conflicting"');
    expect(markup).toContain('data-anchor-status-glyph="unavailable"');
    expect(markup).toContain("Occupied by PW-011");
  });

  it("renders the compact connect-mode legend", () => {
    const markup = renderToStaticMarkup(
      createElement(AnchorAvailabilityLegend)
    );

    expect(markup).toContain("Terminal availability legend");
    expect(markup).toContain("Available");
    expect(markup).toContain("Occupied");
    expect(markup).toContain("Unavailable");
  });

  it("shows status and occupant provenance in the hover card", () => {
    const availability: DrawingAnchorAvailability = {
      status: "occupied",
      enabled: false,
      occupants: [
        {
          label: "C-102-CORE01-A",
          wireId: "C-102-CORE01-A",
          cableTag: "C-102",
          conductorKey: "CORE01_A",
          sourceSheet: "PLC001 to JB002 Wiring"
        }
      ]
    };
    const sheet: DrawingSheetCanvasModel["sheet"] = {
      size: "A3_LANDSCAPE",
      width: 100,
      height: 100,
      gridSize: 5,
      titleBlock: {}
    };
    const markup = renderToStaticMarkup(
      createElement(AnchorTooltip, {
        hotspot: hotspot("T2", 20),
        sheet,
        availability
      })
    );

    expect(markup).toContain("Occupied by C-102-CORE01-A");
    expect(markup).toContain("CORE01_A");
    expect(markup).toContain("PLC001 to JB002 Wiring");
  });

  it("shows complete endpoint data in the fixed Properties inspector", () => {
    const sourceHotspot = hotspot("T1", 10);
    const hoveredHotspot = {
      ...hotspot("T2", 20),
      memberToken: "M02",
      memberPurpose: "+24 V Supply to Level Sensor",
      symbolModel: "PT 2.5"
    };
    const markup = renderToStaticMarkup(
      createElement(ConnectionEndpointInspector, {
        source: buildDrawingAnchorInspection({
          hotspot: sourceHotspot,
          availability: states.T1
        }),
        hovered: buildDrawingAnchorInspection({
          hotspot: hoveredHotspot,
          availability: states.T2
        })
      })
    );

    expect(markup).toContain("Connection endpoint");
    expect(markup).toContain("Selected source");
    expect(markup).toContain("Occupied by PW-011");
    expect(markup).toContain("+24 V Supply to Level Sensor");
    expect(markup).toContain("PT 2.5");
    expect(markup).toContain("Click to add a bend");
  });
});
