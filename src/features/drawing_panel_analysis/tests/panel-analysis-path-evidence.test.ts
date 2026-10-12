import { describe, expect, it } from "vitest";
import { panelWiringSourcePackageSchema } from "@/features/drawing_panel_wiring/api/contracts";
import { buildPackageConnectivityGraph } from "@/features/drawing_panel_wiring/api/public";
import { buildIncompleteCommunicationPathEvidence } from "../logic/services/panel-analysis-path-evidence";

const instrumentTerminal = {
  terminalKey: "1",
  label: "1",
  function: "RS485 B",
  supportedSides: ["single" as const],
  anchors: [
    { anchorKey: "1", anchorKind: "terminal" as const, sideHint: "single" as const }
  ],
  status: "resolved" as const
};

const terminalBlockTerminal = {
  terminalKey: "M10",
  label: "M10",
  function: "RS485 B termination",
  supportedSides: ["internal" as const, "external" as const],
  anchors: [
    {
      anchorKey: "M10.1",
      anchorKind: "terminal" as const,
      sideHint: "internal" as const
    },
    {
      anchorKey: "M10.2",
      anchorKind: "terminal" as const,
      sideHint: "external" as const
    }
  ],
  status: "resolved" as const
};

const cableTerminals = [
  {
    terminalKey: "CORE08_A",
    label: "Core 8 end A",
    supportedSides: ["single" as const],
    anchors: [
      {
        anchorKey: "CORE08_A",
        anchorKind: "terminal" as const,
        sideHint: "single" as const
      }
    ],
    status: "resolved" as const
  },
  {
    terminalKey: "CORE08_B",
    label: "Core 8 end B",
    supportedSides: ["single" as const],
    anchors: [
      {
        anchorKey: "CORE08_B",
        anchorKind: "terminal" as const,
        sideHint: "single" as const
      }
    ],
    status: "resolved" as const
  }
];

describe("Panel Analysis electrical-path evidence", () => {
  it("traces an instrument communication circuit to its unresolved panel-side terminal", () => {
    const source = panelWiringSourcePackageSchema.parse({
      assets: [
        {
          id: "instrument_1",
          tag: "LIT-101",
          type: "instrument",
          title: "Level transmitter",
          symbolId: "instrument_symbol",
          versionId: "instrument_v1"
        },
        {
          id: "field_tb",
          tag: "TB-101",
          type: "terminal_block",
          title: "Field terminal block"
        },
        {
          id: "cable_1",
          tag: "C-101",
          type: "cable",
          title: "Multicore cable",
          symbolId: "cable_symbol",
          versionId: "cable_v1"
        },
        {
          id: "panel_tb",
          tag: "TB-103",
          type: "terminal_block",
          title: "PLC panel terminal block"
        }
      ],
      sheets: [
        {
          id: "sheet_17",
          sheetNumber: 17,
          name: "JB001 to Tank 1 Level Transmitter",
          kind: "drawing",
          occurrences: [
            {
              sheetId: "sheet_17",
              placementId: "lit_placement",
              assetId: "instrument_1",
              tag: "LIT-101",
              role: "device",
              occurrenceKind: "wiring",
              symbolId: "instrument_symbol",
              versionId: "instrument_v1",
              terminalResolutionStatus: "resolved",
              terminals: [instrumentTerminal]
            },
            {
              sheetId: "sheet_17",
              placementId: "field_tb_placement",
              assetId: "field_tb",
              tag: "TB-101",
              role: "terminal_block",
              occurrenceKind: "wiring",
              symbolId: "field_tb_symbol",
              versionId: "field_tb_v1",
              terminalResolutionStatus: "resolved",
              terminals: [terminalBlockTerminal]
            }
          ],
          connections: [
            {
              id: "connection_lit_to_field_tb",
              sheetId: "sheet_17",
              from: { placementId: "lit_placement", anchorKey: "1" },
              to: { placementId: "field_tb_placement", anchorKey: "M10.1" }
            }
          ]
        },
        {
          id: "sheet_19",
          sheetNumber: 19,
          name: "PLC001 to JB001 Wiring",
          kind: "drawing",
          occurrences: [
            {
              sheetId: "sheet_19",
              placementId: "field_tb_cable_placement",
              assetId: "field_tb",
              tag: "TB-101",
              role: "terminal_block",
              occurrenceKind: "wiring",
              symbolId: "field_tb_symbol",
              versionId: "field_tb_v1",
              terminalResolutionStatus: "resolved",
              terminals: [terminalBlockTerminal]
            },
            {
              sheetId: "sheet_19",
              placementId: "cable_placement",
              assetId: "cable_1",
              tag: "C-101",
              role: "cable_assembly",
              occurrenceKind: "wiring",
              symbolId: "cable_symbol",
              versionId: "cable_v1",
              electricalTopology: {
                version: 1,
                permanentContinuityGroups: [
                  {
                    key: "core_08",
                    label: "Core 8",
                    terminalKeys: ["CORE08_A", "CORE08_B"],
                    symbolId: "cable_symbol",
                    versionId: "cable_v1"
                  }
                ]
              },
              terminalResolutionStatus: "resolved",
              terminals: cableTerminals
            },
            {
              sheetId: "sheet_19",
              placementId: "panel_tb_placement",
              assetId: "panel_tb",
              tag: "TB-103",
              role: "terminal_block",
              occurrenceKind: "wiring",
              symbolId: "panel_tb_symbol",
              versionId: "panel_tb_v1",
              terminalResolutionStatus: "resolved",
              terminals: [terminalBlockTerminal]
            }
          ],
          connections: [
            {
              id: "connection_cable_field_end",
              sheetId: "sheet_19",
              from: { placementId: "cable_placement", anchorKey: "CORE08_B" },
              to: { placementId: "field_tb_cable_placement", anchorKey: "M10.2" },
              wireId: "C-101-CORE08-B",
              cableAssetId: "cable_1",
              cablePlacementId: "cable_placement",
              cableTag: "C-101",
              conductorKey: "CORE08_B"
            },
            {
              id: "connection_cable_panel_end",
              sheetId: "sheet_19",
              from: { placementId: "cable_placement", anchorKey: "CORE08_A" },
              to: { placementId: "panel_tb_placement", anchorKey: "M10.2" },
              wireId: "C-101-CORE08-A",
              cableAssetId: "cable_1",
              cablePlacementId: "cable_placement",
              cableTag: "C-101",
              conductorKey: "CORE08_A"
            }
          ]
        }
      ]
    });
    const graph = buildPackageConnectivityGraph(source);

    const result = buildIncompleteCommunicationPathEvidence({
      graph,
      source: {
        assetId: "instrument_1",
        terminalKey: "1",
        roleLabel: "RS485 B"
      }
    });

    expect(result.stoppingTerminalLabel).toBe(
      "TB-103 M10.1 (internal side)"
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        {
          label: "Traced path",
          value:
            "LIT-101 terminal 1 (RS485 B) → TB-101 M10.1 (internal side) → TB-101 M10.2 (external side) → C-101 Core 8 end B → C-101 Core 8 end A → TB-103 M10.2 (external side) → TB-103 M10.1 (internal side)"
        },
        expect.objectContaining({
          label: "Wires and conductors",
          value: expect.stringContaining(
            "C-101-CORE08-A · Cable C-101 · Core 8 end A"
          )
        }),
        {
          label: "Sheets traversed",
          value:
            "Sheet 17 — JB001 to Tank 1 Level Transmitter → Sheet 19 — PLC001 to JB001 Wiring"
        },
        {
          label: "Stops at",
          value:
            "TB-103 M10.1 (internal side) — Sheet 19 — PLC001 to JB001 Wiring"
        }
      ])
    );
    expect(JSON.stringify(result.evidence)).not.toContain("net:");
    expect(result.locations).toEqual([
      {
        sheetId: "sheet_19",
        sheetNumber: 19,
        sheetName: "PLC001 to JB001 Wiring",
        objectKind: "connection",
        objectId: "connection_cable_panel_end"
      }
    ]);
    expect(result.affectedRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "terminal",
          assetId: "panel_tb",
          terminalKey: "M10",
          terminalSide: "internal"
        }),
        expect.objectContaining({
          kind: "connection",
          id: "connection_cable_panel_end",
          label: "C-101-CORE08-A"
        })
      ])
    );
  });
});
