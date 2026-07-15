import {
  panelWiringSourcePackageSchema,
  type PanelWiringSourcePackage,
  type PanelWiringSourceTerminal
} from "../data/schema";

export const GENERIC_PANEL_ASSET_ID = "asset_enclosure_alpha";
export const GENERIC_TERMINAL_ASSET_IDS = [
  "asset_strip_a",
  "asset_strip_b",
  "asset_strip_c",
  "asset_strip_d"
];

function terminalSource(number: number): PanelWiringSourceTerminal {
  return {
    terminalKey: `T${number}`,
    label: String(number),
    function: "Feed-through terminal",
    supportedSides: ["external", "internal"],
    status: "resolved",
    anchors: [
      {
        anchorKey: `T${number}_BOTTOM`,
        anchorKind: "terminal",
        sideHint: "external",
        physicalPosition: "bottom"
      },
      {
        anchorKey: `T${number}_TOP`,
        anchorKind: "terminal",
        sideHint: "internal",
        physicalPosition: "top"
      }
    ]
  };
}

const stripTerminals = Array.from({ length: 5 }, (_, index) =>
  terminalSource(index + 1)
);

export function createGenericPanelWiringSource(): PanelWiringSourcePackage {
  const assets = [
    {
      id: GENERIC_PANEL_ASSET_ID,
      tag: "ENC-001",
      type: "panel" as const,
      title: "Field Enclosure"
    },
    ...GENERIC_TERMINAL_ASSET_IDS.map((id, index) => ({
      id,
      tag: `XT-${String(index + 1).padStart(3, "0")}`,
      type: "terminal_block" as const,
      title: `Terminal Strip ${index + 1}`,
      symbolId: "__generated_terminal_block__",
      versionId: "generated_terminal_block_v1"
    })),
    ...GENERIC_TERMINAL_ASSET_IDS.map((_, index) => ({
      id: `asset_cable_${index + 1}`,
      tag: `CBL-${String(index + 1).padStart(3, "0")}`,
      type: "cable" as const,
      title: `Field Cable ${index + 1}`
    }))
  ];
  const wiringSheets = GENERIC_TERMINAL_ASSET_IDS.map((assetId, index) => {
    const sheetId = `sheet_field_${index + 1}`;
    const cablePlacementId = `cable_${index + 1}`;
    const terminalPlacementId = `strip_${index + 1}`;

    return {
      id: sheetId,
      sheetNumber: index + 1,
      name: `Field Connection ${index + 1}`,
      kind: "drawing" as const,
      occurrences: [
        {
          sheetId,
          placementId: `panel_${index + 1}`,
          assetId: GENERIC_PANEL_ASSET_ID,
          tag: "ENC-001",
          role: "enclosure" as const,
          occurrenceKind: "enclosure_reference" as const,
          symbolId: "__generated_panel_enclosure__",
          versionId: "generated_panel_enclosure_v1",
          terminalResolutionStatus: "not_applicable" as const,
          terminals: []
        },
        {
          sheetId,
          placementId: cablePlacementId,
          assetId: `asset_cable_${index + 1}`,
          tag: `CBL-${String(index + 1).padStart(3, "0")}`,
          role: "cable_assembly" as const,
          occurrenceKind: "wiring" as const,
          symbolId: "cable_symbol",
          versionId: "cable_v1",
          terminalResolutionStatus: "not_applicable" as const,
          terminals: []
        },
        {
          sheetId,
          placementId: terminalPlacementId,
          assetId,
          tag: `XT-${String(index + 1).padStart(3, "0")}`,
          role: "terminal_block" as const,
          occurrenceKind: "wiring" as const,
          containerAssetId: GENERIC_PANEL_ASSET_ID,
          symbolId: "__generated_terminal_block__",
          versionId: "generated_terminal_block_v1",
          terminalResolutionStatus: "resolved" as const,
          terminals: stripTerminals
        }
      ],
      connections: Array.from({ length: 3 }, (_, terminalIndex) => ({
        id: `connection_${index + 1}_${terminalIndex + 1}`,
        sheetId,
        from: {
          placementId: cablePlacementId,
          anchorKey: `CH${terminalIndex + 1}`
        },
        to: {
          placementId: terminalPlacementId,
          anchorKey: `T${terminalIndex + 1}_BOTTOM`
        },
        wireId: `CBL-${String(index + 1).padStart(3, "0")}-W${terminalIndex + 1}`,
        cablePlacementId,
        cableAssetId: `asset_cable_${index + 1}`,
        cableTag: `CBL-${String(index + 1).padStart(3, "0")}`,
        conductorKey: `W${terminalIndex + 1}`
      }))
    };
  });
  const layoutSheetId = "sheet_layout";

  return panelWiringSourcePackageSchema.parse({
    assets,
    sheets: [
      ...wiringSheets,
      {
        id: layoutSheetId,
        sheetNumber: wiringSheets.length + 1,
        name: "Enclosure Layout",
        kind: "drawing",
        occurrences: [
          {
            sheetId: layoutSheetId,
            placementId: "layout_panel",
            assetId: GENERIC_PANEL_ASSET_ID,
            tag: "ENC-001",
            role: "enclosure",
            occurrenceKind: "enclosure_reference",
            symbolId: "__generated_panel_enclosure__",
            versionId: "generated_panel_enclosure_v1",
            terminalResolutionStatus: "not_applicable",
            terminals: []
          },
          ...GENERIC_TERMINAL_ASSET_IDS.map((assetId, index) => ({
            sheetId: layoutSheetId,
            placementId: `layout_strip_${index + 1}`,
            assetId,
            tag: `XT-${String(index + 1).padStart(3, "0")}`,
            role: "terminal_block" as const,
            occurrenceKind: "layout" as const,
            containerAssetId: GENERIC_PANEL_ASSET_ID,
            symbolId: "__generated_terminal_block__",
            versionId: "generated_terminal_block_v1",
            terminalResolutionStatus: "resolved" as const,
            terminals: stripTerminals
          })),
          {
            sheetId: layoutSheetId,
            placementId: "layout_rail",
            tag: "DIN Rail",
            role: "other",
            occurrenceKind: "layout",
            containerAssetId: GENERIC_PANEL_ASSET_ID,
            symbolId: "__generated_din_rail__",
            versionId: "generated_din_rail_v1",
            terminalResolutionStatus: "not_applicable",
            terminals: []
          }
        ],
        connections: []
      }
    ]
  });
}
