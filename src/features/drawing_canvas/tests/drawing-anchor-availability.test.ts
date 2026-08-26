import { describe, expect, it } from "vitest";
import type {
  PanelTerminalCatalog,
  PanelTerminalSideOccupancy,
  PanelTerminalSideRef
} from "@/features/drawing_panel_wiring/api/public";
import {
  drawingTerminalSideKey,
  getDrawingAnchorAvailabilityLabel,
  resolveDrawingAnchorAvailability,
  summarizeDrawingTerminalAvailability
} from "../logic/services/drawing-anchor-availability";

function occupancy(
  ref: PanelTerminalSideRef,
  input: Partial<PanelTerminalSideOccupancy> = {}
): PanelTerminalSideOccupancy {
  return {
    ref,
    status: "available",
    occupants: [],
    conductorStatus: "available",
    conductorOccupants: [],
    structuralStatus: "available",
    structuralOccupants: [],
    ...input
  };
}

function fixtureCatalog(
  entries: Array<[string, PanelTerminalSideOccupancy]>
): PanelTerminalCatalog {
  return {
    panelAssetId: "panel_pdb_103",
    rowsByTerminalId: new Map(),
    occupancyBySideId: new Map(entries),
    findings: []
  };
}

function catalogTerminalSideKey(ref: PanelTerminalSideRef): string {
  return `terminal:${encodeURIComponent(ref.assetId)}:${encodeURIComponent(ref.terminalKey)}:${ref.side}`;
}

const availableRef: PanelTerminalSideRef = {
  assetId: "asset_pdb_103",
  terminalKey: "T1",
  side: "internal"
};
const occupiedRef: PanelTerminalSideRef = {
  assetId: "asset_pdb_103",
  terminalKey: "T2",
  side: "internal"
};
const conflictingRef: PanelTerminalSideRef = {
  assetId: "asset_pdb_103",
  terminalKey: "T3",
  side: "internal"
};

const occupiedWire = {
  id: "wire_1:to",
  kind: "internal_wire" as const,
  label: "011",
  wireId: "PW-011",
  channel: "conductor" as const
};
const fieldTermination = {
  id: "termination_1",
  kind: "external_termination" as const,
  label: "C-102-CORE01-A",
  wireId: "C-102-CORE01-A",
  cableTag: "C-102",
  conductorKey: "CORE01_A",
  channel: "conductor" as const,
  sourceSheet: { id: "sheet_12", number: 12, name: "PLC001 to JB002 Wiring" }
};

const catalog = fixtureCatalog([
  [catalogTerminalSideKey(availableRef), occupancy(availableRef)],
  [
    catalogTerminalSideKey(occupiedRef),
    occupancy(occupiedRef, {
      status: "occupied",
      occupants: [fieldTermination],
      conductorStatus: "occupied",
      conductorOccupants: [fieldTermination]
    })
  ],
  [
    catalogTerminalSideKey(conflictingRef),
    occupancy(conflictingRef, {
      status: "conflicting",
      occupants: [occupiedWire, fieldTermination],
      conductorStatus: "conflicting",
      conductorOccupants: [occupiedWire, fieldTermination]
    })
  ]
]);

const terminalMappings = new Map([
  ["placement_pdb_103:T1", { terminal: availableRef }],
  ["placement_pdb_103:T2", { terminal: occupiedRef }],
  ["placement_pdb_103:T3", { terminal: conflictingRef }]
]);

describe("drawing anchor availability", () => {
  it("projects available and occupied PDB terminal sides simultaneously", () => {
    const available = resolveDrawingAnchorAvailability({
      endpoint: { placementId: "placement_pdb_103", anchorKey: "T1" },
      terminalMappings,
      terminalCatalog: catalog
    });
    const occupied = resolveDrawingAnchorAvailability({
      endpoint: { placementId: "placement_pdb_103", anchorKey: "T2" },
      terminalMappings,
      terminalCatalog: catalog
    });

    expect(available).toEqual({
      status: "available",
      enabled: true,
      occupants: []
    });
    expect(occupied).toMatchObject({
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
    });
    expect(getDrawingAnchorAvailabilityLabel(occupied)).toBe(
      "Occupied by C-102-CORE01-A"
    );
  });

  it("projects conflicts, unresolved mappings, and source restrictions", () => {
    const conflicting = resolveDrawingAnchorAvailability({
      endpoint: { placementId: "placement_pdb_103", anchorKey: "T3" },
      terminalMappings,
      terminalCatalog: catalog
    });
    const unresolved = resolveDrawingAnchorAvailability({
      endpoint: { placementId: "placement_pdb_103", anchorKey: "UNKNOWN" },
      terminalMappings,
      terminalCatalog: catalog
    });
    const incompatible = resolveDrawingAnchorAvailability({
      endpoint: { placementId: "placement_pdb_103", anchorKey: "T1" },
      terminalMappings,
      terminalCatalog: catalog,
      incompatibleReason: "A wire cannot connect both ends of the same logical terminal."
    });

    expect(conflicting).toMatchObject({
      status: "conflicting",
      enabled: false
    });
    expect(unresolved).toMatchObject({
      status: "unresolved",
      enabled: false
    });
    expect(incompatible).toEqual({
      status: "incompatible",
      enabled: false,
      reason: "A wire cannot connect both ends of the same logical terminal.",
      occupants: []
    });
  });

  it("keeps conductor and structural occupancy channels independent", () => {
    const structuralRef: PanelTerminalSideRef = {
      assetId: "asset_pdb_103",
      terminalKey: "T4",
      side: "internal"
    };
    const bridge = {
      id: "bridge_1:0",
      kind: "bridge" as const,
      label: "jumper BR-001",
      channel: "structural" as const
    };
    const structuralCatalog = fixtureCatalog([
      [
        catalogTerminalSideKey(structuralRef),
        occupancy(structuralRef, {
          status: "occupied",
          occupants: [bridge],
          structuralStatus: "occupied",
          structuralOccupants: [bridge]
        })
      ]
    ]);
    const mappings = new Map([
      ["placement_pdb_103:T4", { terminal: structuralRef }]
    ]);

    expect(
      resolveDrawingAnchorAvailability({
        endpoint: { placementId: "placement_pdb_103", anchorKey: "T4" },
        terminalMappings: mappings,
        terminalCatalog: structuralCatalog,
        channel: "conductor"
      }).status
    ).toBe("available");
    expect(
      resolveDrawingAnchorAvailability({
        endpoint: { placementId: "placement_pdb_103", anchorKey: "T4" },
        terminalMappings: mappings,
        terminalCatalog: structuralCatalog,
        channel: "structural"
      }).status
    ).toBe("occupied");
  });

  it("counts unique canonical terminal sides for the selected device", () => {
    const available = resolveDrawingAnchorAvailability({
      endpoint: { placementId: "placement_pdb_103", anchorKey: "T1" },
      terminalMappings,
      terminalCatalog: catalog
    });
    const occupied = resolveDrawingAnchorAvailability({
      endpoint: { placementId: "placement_pdb_103", anchorKey: "T2" },
      terminalMappings,
      terminalCatalog: catalog
    });
    const unresolved = resolveDrawingAnchorAvailability({
      endpoint: { placementId: "placement_pdb_103", anchorKey: "UNKNOWN" },
      terminalMappings,
      terminalCatalog: catalog
    });

    expect(
      summarizeDrawingTerminalAvailability([
        {
          canonicalTerminalSideKey: drawingTerminalSideKey(availableRef),
          fallbackKey: "T1",
          terminal: availableRef,
          terminalLabel: "Terminal 1",
          availability: available
        },
        {
          canonicalTerminalSideKey: drawingTerminalSideKey(availableRef),
          fallbackKey: "T1_DUPLICATE",
          availability: available
        },
        {
          canonicalTerminalSideKey: drawingTerminalSideKey(occupiedRef),
          fallbackKey: "T2",
          terminal: occupiedRef,
          terminalLabel: "Terminal 2",
          availability: occupied
        },
        {
          fallbackKey: "UNKNOWN",
          availability: unresolved
        }
      ])
    ).toEqual({
      available: 1,
      occupied: 1,
      conflicting: 0,
      unresolved: 1,
      terminals: [
        {
          id: drawingTerminalSideKey(availableRef),
          terminalKey: "T1",
          terminalLabel: "Terminal 1",
          side: "internal",
          status: "available",
          reason: undefined,
          occupants: []
        },
        {
          id: drawingTerminalSideKey(occupiedRef),
          terminalKey: "T2",
          terminalLabel: "Terminal 2",
          side: "internal",
          status: "occupied",
          reason: "C-102-CORE01-A already occupies this terminal side.",
          occupants: [
            {
              label: "C-102-CORE01-A",
              wireId: "C-102-CORE01-A",
              cableTag: "C-102",
              conductorKey: "CORE01_A",
              sourceSheet: "PLC001 to JB002 Wiring"
            }
          ]
        },
        {
          id: "unresolved:UNKNOWN",
          terminalKey: "UNKNOWN",
          terminalLabel: "UNKNOWN",
          side: undefined,
          status: "unresolved",
          reason:
            "This anchor does not resolve to one authoritative terminal side.",
          occupants: []
        }
      ]
    });
  });
});
