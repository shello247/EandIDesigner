import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  buildPackageTerminalOccupancyIndex,
  connectionEndpointSourceKey,
  resolveConnectionEndpointAvailability,
  validateTerminalConflictDelta
} from "../api/public";
import type { PanelWiringSourcePackage } from "../data/schema";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

function withSecondLanding(input: {
  source?: PanelWiringSourcePackage;
  sheetId?: string;
  connectionId?: string;
  anchorKey?: string;
} = {}): PanelWiringSourcePackage {
  const source = structuredClone(
    input.source ?? createGenericPanelWiringSource()
  );
  const sheetId = input.sheetId ?? "sheet_second_occurrence";
  const connectionId = input.connectionId ?? "connection_second_landing";
  const terminalAssetId = GENERIC_TERMINAL_ASSET_IDS[0];
  source.assets.push({
    id: `asset_field_${connectionId}`,
    tag: `FIELD-${connectionId}`,
    type: "instrument",
    title: "Field instrument"
  });
  source.sheets.push({
    id: sheetId,
    sheetNumber: 20 + source.sheets.length,
    name: `Second occurrence ${connectionId}`,
    kind: "drawing",
    occurrences: [
      {
        sheetId,
        placementId: `field_${connectionId}`,
        assetId: `asset_field_${connectionId}`,
        tag: `FIELD-${connectionId}`,
        role: "device",
        occurrenceKind: "wiring",
        symbolId: "field_symbol",
        versionId: "field_v1",
        terminalResolutionStatus: "not_applicable",
        availableAnchorKeys: ["OUT"],
        terminals: []
      },
      {
        sheetId,
        placementId: `strip_${connectionId}`,
        assetId: terminalAssetId,
        tag: "XT-001",
        role: "terminal_block",
        occurrenceKind: "wiring",
        containerAssetId: GENERIC_PANEL_ASSET_ID,
        symbolId: "__generated_terminal_block__",
        versionId: "generated_terminal_block_v1",
        terminalResolutionStatus: "resolved",
        terminals: source.sheets[0].occurrences.find(
          (occurrence) => occurrence.assetId === terminalAssetId
        )!.terminals
      }
    ],
    connections: [
      {
        id: connectionId,
        sheetId,
        from: {
          placementId: `field_${connectionId}`,
          anchorKey: "OUT"
        },
        to: {
          placementId: `strip_${connectionId}`,
          anchorKey: input.anchorKey ?? "T1_BOTTOM"
        },
        wireId: `WIRE-${connectionId}`
      }
    ]
  });
  return source;
}

function occupancy(source: PanelWiringSourcePackage) {
  return buildPackageTerminalOccupancyIndex(
    buildPackageConnectivityGraph(source)
  );
}

describe("package terminal-side occupancy", () => {
  it("resolves repeated occurrences to one physical terminal side", () => {
    const index = occupancy(withSecondLanding());
    const side = index.occupancyBySideId.get(
      "terminal:asset_strip_a:T1:external"
    );

    expect(side?.conductorStatus).toBe("conflicting");
    expect(side?.conductorOccupants).toHaveLength(2);
    expect(
      side?.conductorOccupants.map((occupant) => occupant.sourceSheet?.id)
    ).toEqual(["sheet_field_1", "sheet_second_occurrence"]);
  });

  it("allows the opposite end of a feed-through terminal", () => {
    const index = occupancy(createGenericPanelWiringSource());

    expect(
      resolveConnectionEndpointAvailability({
        index,
        sheetId: "sheet_field_1",
        placementId: "strip_1",
        anchorKey: "T1_BOTTOM"
      }).status
    ).toBe("occupied");
    expect(
      resolveConnectionEndpointAvailability({
        index,
        sheetId: "sheet_field_1",
        placementId: "strip_1",
        anchorKey: "T1_TOP"
      })
    ).toMatchObject({ status: "available", enabled: true });
  });

  it("keeps field-record identity separate from the selected physical side", () => {
    const source = createGenericPanelWiringSource();
    source.sheets[0].connections[0].to.anchorKey = "T1_TOP";
    const index = occupancy(source);
    const internal = index.occupancyBySideId.get(
      "terminal:asset_strip_a:T1:internal"
    );

    expect(internal?.conductorStatus).toBe("occupied");
    expect(internal?.conductorOccupants).toHaveLength(1);
    expect(internal?.conductorOccupants[0]).toMatchObject({
      recordKind: "field_connection",
      anchorKey: "T1_TOP"
    });
    expect(
      index.occupancyBySideId.get("terminal:asset_strip_a:T1:external")
        ?.conductorStatus
    ).toBe("available");
  });

  it("indexes single-sided terminals and deduplicates graph projections", () => {
    const source = createGenericPanelWiringSource();
    const strip = source.sheets[0].occurrences.find(
      (occurrence) => occurrence.placementId === "strip_1"
    )!;
    strip.terminals[0] = {
      ...strip.terminals[0],
      supportedSides: ["single"],
      anchors: [
        {
          anchorKey: "T1_SINGLE",
          anchorKind: "terminal",
          sideHint: "single",
          physicalPosition: "right"
        }
      ]
    };
    source.sheets[0].connections[0].to.anchorKey = "T1_SINGLE";
    const index = occupancy(source);

    expect(
      index.occupancyBySideId.get("terminal:asset_strip_a:T1:single")
        ?.conductorOccupants
    ).toHaveLength(1);
  });

  it("excludes the connection endpoint currently being edited", () => {
    const index = occupancy(createGenericPanelWiringSource());
    const sourceKey = connectionEndpointSourceKey({
      sheetId: "sheet_field_1",
      connectionId: "connection_1_1",
      endpointRole: "to",
      placementId: "strip_1",
      anchorKey: "T1_BOTTOM"
    });

    expect(
      resolveConnectionEndpointAvailability({
        index,
        sheetId: "sheet_field_1",
        placementId: "strip_1",
        anchorKey: "T1_BOTTOM",
        excludeSourceKey: sourceKey
      })
    ).toMatchObject({ status: "available", enabled: true });
  });

  it("allows unchanged and reduced legacy conflicts", () => {
    const conflicted = withSecondLanding();
    const unchanged = validateTerminalConflictDelta({
      baseline: occupancy(conflicted),
      candidate: occupancy(structuredClone(conflicted))
    });
    const reduced = structuredClone(conflicted);
    reduced.sheets = reduced.sheets.filter(
      (sheet) => sheet.id !== "sheet_second_occurrence"
    );

    expect(unchanged.ok).toBe(true);
    expect(
      validateTerminalConflictDelta({
        baseline: occupancy(conflicted),
        candidate: occupancy(reduced)
      }).ok
    ).toBe(true);
  });

  it("rejects new, enlarged, and substituted conflicts", () => {
    const clean = createGenericPanelWiringSource();
    const conflicted = withSecondLanding({ source: clean });
    expect(
      validateTerminalConflictDelta({
        baseline: occupancy(clean),
        candidate: occupancy(conflicted)
      }).ok
    ).toBe(false);

    const enlarged = withSecondLanding({
      source: conflicted,
      sheetId: "sheet_third_occurrence",
      connectionId: "connection_third_landing"
    });
    expect(
      validateTerminalConflictDelta({
        baseline: occupancy(conflicted),
        candidate: occupancy(enlarged)
      }).ok
    ).toBe(false);

    const substituted = structuredClone(conflicted);
    substituted.sheets.find(
      (sheet) => sheet.id === "sheet_second_occurrence"
    )!.connections[0].id = "replacement_connection";
    expect(
      validateTerminalConflictDelta({
        baseline: occupancy(conflicted),
        candidate: occupancy(substituted)
      }).ok
    ).toBe(false);
  });

  it("permits non-terminal graphical anchors", () => {
    const index = occupancy(createGenericPanelWiringSource());
    expect(
      resolveConnectionEndpointAvailability({
        index,
        sheetId: "sheet_field_1",
        placementId: "cable_1",
        anchorKey: "CH1"
      })
    ).toEqual({ status: "graphical", enabled: true, occupants: [] });
  });

  it("rejects newly unresolved managed-terminal endpoints", () => {
    const clean = createGenericPanelWiringSource();
    const unresolved = structuredClone(clean);
    unresolved.sheets[0].connections[0].to.anchorKey = "UNKNOWN_TERMINAL";
    const result = validateTerminalConflictDelta({
      baseline: occupancy(clean),
      candidate: occupancy(unresolved)
    });

    expect(result.ok).toBe(false);
    expect(result.unresolvedManagedEndpoints).toHaveLength(1);
    expect(result.unresolvedManagedEndpoints[0]).toMatchObject({
      anchorKey: "UNKNOWN_TERMINAL",
      connectionId: "connection_1_1",
      endpointRole: "to"
    });
  });
});
