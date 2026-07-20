import {
  panelWiringSourcePackageSchema,
  type PanelBridgeRecord,
  type PanelInternalWireRecord,
  type PanelWiringSourceAsset,
  type PanelWiringSourceConnection,
  type PanelWiringSourceOccurrence,
  type PanelWiringSourcePackage,
  type PanelWiringSourceSheet,
  type PanelWiringSourceTerminal
} from "../data/schema";

function terminals(count: number): PanelWiringSourceTerminal[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return {
      terminalKey: `T${number}`,
      label: String(number),
      function: "Feed-through terminal",
      supportedSides: ["external", "internal"],
      allowedDomains: ["signal"],
      status: "resolved",
      anchors: [
        {
          anchorKey: `T${number}_BOTTOM`,
          anchorKind: "terminal",
          sideHint: "external"
        },
        {
          anchorKey: `T${number}_TOP`,
          anchorKind: "terminal",
          sideHint: "internal"
        }
      ]
    };
  });
}

function terminalOccurrence(input: {
  sheetId: string;
  placementId: string;
  assetId: string;
  tag: string;
  panelAssetId: string;
  terminalCount: number;
}): PanelWiringSourceOccurrence {
  return {
    sheetId: input.sheetId,
    placementId: input.placementId,
    assetId: input.assetId,
    tag: input.tag,
    role: "terminal_block",
    occurrenceKind: "wiring",
    containerAssetId: input.panelAssetId,
    symbolId: "__generated_terminal_block__",
    versionId: "generated_terminal_block_v1",
    terminalResolutionStatus: "resolved",
    terminals: terminals(input.terminalCount)
  };
}

function enclosureOccurrence(
  sheetId: string,
  placementId: string,
  panelAssetId: string,
  tag: string
): PanelWiringSourceOccurrence {
  return {
    sheetId,
    placementId,
    assetId: panelAssetId,
    tag,
    role: "enclosure",
    occurrenceKind: "enclosure_reference",
    symbolId: "__generated_panel_enclosure__",
    versionId: "generated_panel_enclosure_v1",
    terminalResolutionStatus: "not_applicable",
    terminals: []
  };
}

export function createMcp201PanelSource(): PanelWiringSourcePackage {
  const panelAssetId = "asset_mcp_201";
  const stripCounts = [8, 12, 4];
  const stripAssets = stripCounts.map((count, index) => ({
    id: `asset_mcp_201_xt_${index + 1}`,
    tag: `MCP201-XT${index + 1}`,
    type: "terminal_block" as const,
    title: `${count}-way Terminal Strip`,
    symbolId: "__generated_terminal_block__",
    versionId: "generated_terminal_block_v1"
  }));
  const fieldSheetId = "sheet_mcp_201_field";
  const detailedSheetId = "sheet_mcp_201_detailed";
  const cableAsset = {
    id: "asset_mcp_201_cable",
    tag: "MCP201-CBL01",
    type: "cable" as const,
    title: "MCP-201 Field Cable"
  };
  const cableOccurrence: PanelWiringSourceOccurrence = {
    sheetId: fieldSheetId,
    placementId: "mcp_201_cable",
    assetId: cableAsset.id,
    tag: cableAsset.tag,
    role: "cable_assembly",
    occurrenceKind: "wiring",
    symbolId: "cable_symbol",
    versionId: "cable_v1",
    terminalResolutionStatus: "not_applicable",
    terminals: []
  };
  const fieldOccurrences = stripAssets.map((asset, index) =>
    terminalOccurrence({
      sheetId: fieldSheetId,
      placementId: `mcp_201_field_strip_${index + 1}`,
      assetId: asset.id,
      tag: asset.tag,
      panelAssetId,
      terminalCount: stripCounts[index]
    })
  );
  const fieldConnections: PanelWiringSourceConnection[] = stripAssets.flatMap(
    (asset, stripIndex) =>
      Array.from({ length: Math.min(2, stripCounts[stripIndex]) }, (_, index) => ({
        id: `mcp_201_connection_${stripIndex + 1}_${index + 1}`,
        sheetId: fieldSheetId,
        from: {
          placementId: cableOccurrence.placementId,
          anchorKey: `CH${stripIndex * 2 + index + 1}`
        },
        to: {
          placementId: `mcp_201_field_strip_${stripIndex + 1}`,
          anchorKey: `T${index + 1}_BOTTOM`
        },
        wireId: `MCP201-FW${stripIndex * 2 + index + 1}`,
        cablePlacementId: cableOccurrence.placementId,
        cableAssetId: cableAsset.id,
        cableTag: cableAsset.tag,
        conductorKey: `C${stripIndex * 2 + index + 1}`
      }))
  );
  return panelWiringSourcePackageSchema.parse({
    assets: [
      {
        id: panelAssetId,
        tag: "MCP-201",
        type: "panel",
        title: "Motor Control Panel 201"
      },
      ...stripAssets,
      cableAsset
    ],
    sheets: [
      {
        id: fieldSheetId,
        sheetNumber: 1,
        name: "MCP-201 Field Terminations",
        kind: "drawing",
        occurrences: [
          enclosureOccurrence(fieldSheetId, "mcp_201_panel", panelAssetId, "MCP-201"),
          cableOccurrence,
          ...fieldOccurrences
        ],
        connections: fieldConnections
      },
      {
        id: detailedSheetId,
        sheetNumber: 2,
        name: "MCP-201 Detailed Panel Drawing",
        kind: "drawing",
        panelDrawingContext: {
          kind: "detailed_panel_wiring",
          panelAssetId
        },
        occurrences: stripAssets.map((asset, index) =>
          terminalOccurrence({
            sheetId: detailedSheetId,
            placementId: `mcp_201_detail_strip_${index + 1}`,
            assetId: asset.id,
            tag: asset.tag,
            panelAssetId,
            terminalCount: stripCounts[index]
          })
        ),
        connections: []
      }
    ]
  });
}

export function createLargePanelPerformanceSource(): PanelWiringSourcePackage {
  const assets: PanelWiringSourceAsset[] = [];
  const sheets: PanelWiringSourceSheet[] = [];
  const internalWires: PanelInternalWireRecord[] = [];
  const bridges: PanelBridgeRecord[] = [];
  const panelCount = 20;
  const terminalAssetsPerPanel = 20;
  const terminalsPerAsset = 5;
  const fieldSheetsPerPanel = 5;

  for (let panelIndex = 0; panelIndex < panelCount; panelIndex += 1) {
    const panelNumber = panelIndex + 1;
    const panelAssetId = `perf_panel_${panelNumber}`;
    const panelTag = `P-${String(panelNumber).padStart(3, "0")}`;
    assets.push({
      id: panelAssetId,
      tag: panelTag,
      type: "panel",
      title: `Performance Panel ${panelNumber}`
    });
    const terminalAssets = Array.from(
      { length: terminalAssetsPerPanel },
      (_, terminalAssetIndex) => {
        const number = terminalAssetIndex + 1;
        const asset = {
          id: `perf_panel_${panelNumber}_strip_${number}`,
          tag: `${panelTag}-XT${String(number).padStart(2, "0")}`,
          type: "terminal_block" as const,
          title: `Terminal Strip ${number}`,
          symbolId: "__generated_terminal_block__",
          versionId: "generated_terminal_block_v1"
        };
        assets.push(asset);
        return asset;
      }
    );
    const cableAssets = Array.from({ length: 4 }, (_, cableIndex) => {
      const asset = {
        id: `perf_panel_${panelNumber}_cable_${cableIndex + 1}`,
        tag: `${panelTag}-CBL${cableIndex + 1}`,
        type: "cable" as const,
        title: `Field Cable ${cableIndex + 1}`
      };
      assets.push(asset);
      return asset;
    });

    for (let fieldIndex = 0; fieldIndex < fieldSheetsPerPanel; fieldIndex += 1) {
      const sheetId = `perf_panel_${panelNumber}_field_${fieldIndex + 1}`;
      const cable = cableAssets[fieldIndex % cableAssets.length];
      const cablePlacementId = `${sheetId}_cable`;
      const firstAssetIndex = fieldIndex * 4;
      const visibleTerminalAssets = terminalAssets.slice(
        firstAssetIndex,
        firstAssetIndex + 4
      );
      const occurrences: PanelWiringSourceOccurrence[] = [
        enclosureOccurrence(
          sheetId,
          `${sheetId}_panel`,
          panelAssetId,
          panelTag
        ),
        {
          sheetId,
          placementId: cablePlacementId,
          assetId: cable.id,
          tag: cable.tag,
          role: "cable_assembly",
          occurrenceKind: "wiring",
          symbolId: "cable_symbol",
          versionId: "cable_v1",
          terminalResolutionStatus: "not_applicable",
          terminals: []
        },
        ...visibleTerminalAssets.map((asset, index) =>
          terminalOccurrence({
            sheetId,
            placementId: `${sheetId}_strip_${firstAssetIndex + index + 1}`,
            assetId: asset.id,
            tag: asset.tag,
            panelAssetId,
            terminalCount: terminalsPerAsset
          })
        )
      ];
      const connections: PanelWiringSourceConnection[] = visibleTerminalAssets
        .slice(0, 2)
        .flatMap((asset, assetOffset) =>
          Array.from({ length: terminalsPerAsset }, (_, terminalIndex) => {
            const terminalNumber = terminalIndex + 1;
            const conductorNumber = assetOffset * terminalsPerAsset + terminalNumber;
            return {
              id: `${sheetId}_connection_${conductorNumber}`,
              sheetId,
              from: {
                placementId: cablePlacementId,
                anchorKey: `CH${conductorNumber}`
              },
              to: {
                placementId: `${sheetId}_strip_${firstAssetIndex + assetOffset + 1}`,
                anchorKey: `T${terminalNumber}_BOTTOM`
              },
              wireId: `${panelTag}-FW${String(
                fieldIndex * 10 + conductorNumber
              ).padStart(3, "0")}`,
              cablePlacementId,
              cableAssetId: cable.id,
              cableTag: cable.tag,
              conductorKey: `C${conductorNumber}`
            };
          })
        );
      sheets.push({
        id: sheetId,
        sheetNumber: sheets.length + 1,
        name: `${panelTag} Field Sheet ${fieldIndex + 1}`,
        kind: "drawing",
        occurrences,
        connections
      });
    }

    const detailedSheetId = `perf_panel_${panelNumber}_detailed`;
    const detailedOccurrences = terminalAssets.map((asset, index) =>
      terminalOccurrence({
        sheetId: detailedSheetId,
        placementId: `${detailedSheetId}_strip_${index + 1}`,
        assetId: asset.id,
        tag: asset.tag,
        panelAssetId,
        terminalCount: terminalsPerAsset
      })
    );
    const terminalRefs = terminalAssets.flatMap((asset) =>
      Array.from({ length: terminalsPerAsset }, (_, terminalIndex) => ({
        assetId: asset.id,
        terminalKey: `T${terminalIndex + 1}`,
        side: "internal" as const
      }))
    );
    const detailedConnections: PanelWiringSourceConnection[] = [];
    for (let wireIndex = 0; wireIndex < terminalRefs.length / 2; wireIndex += 1) {
      const from = terminalRefs[wireIndex * 2];
      const to = terminalRefs[wireIndex * 2 + 1];
      const wireId = `${panelTag}-W${String(wireIndex + 1).padStart(3, "0")}`;
      const recordId = `perf_wire_${panelNumber}_${wireIndex + 1}`;
      internalWires.push({
        id: recordId,
        panelAssetId,
        wireId,
        from,
        to,
        domain: "signal",
        origin: "imported"
      });
      detailedConnections.push({
        id: `perf_route_${panelNumber}_${wireIndex + 1}`,
        sheetId: detailedSheetId,
        from: {
          placementId: `${detailedSheetId}_strip_${
            terminalAssets.findIndex((asset) => asset.id === from.assetId) + 1
          }`,
          anchorKey: `${from.terminalKey}_TOP`
        },
        to: {
          placementId: `${detailedSheetId}_strip_${
            terminalAssets.findIndex((asset) => asset.id === to.assetId) + 1
          }`,
          anchorKey: `${to.terminalKey}_TOP`
        },
        panelConnectionId: recordId,
        routeMode: "auto",
        routePointCount: 4
      });
    }
    const patternCount = panelIndex < 10 ? 13 : 12;
    for (let patternIndex = 0; patternIndex < patternCount; patternIndex += 1) {
      const members = [
        terminalRefs[patternIndex * 2],
        terminalRefs[patternIndex * 2 + 1]
      ];
      bridges.push({
        id: `perf_pattern_${panelNumber}_${patternIndex + 1}`,
        patternCode: `${panelTag}-JMP${String(patternIndex + 1).padStart(3, "0")}`,
        panelAssetId,
        kind: "jumper",
        members,
        domain: "signal",
        definition: { topology: "terminal_jumper", orderedMembers: members },
        createdOnSheetId: detailedSheetId,
        origin: "imported"
      });
    }
    sheets.push({
      id: detailedSheetId,
      sheetNumber: sheets.length + 1,
      name: `${panelTag} Detailed Panel Drawing`,
      kind: "drawing",
      panelDrawingContext: {
        kind: "detailed_panel_wiring",
        panelAssetId
      },
      occurrences: detailedOccurrences,
      connections: detailedConnections
    });
  }

  return panelWiringSourcePackageSchema.parse({
    assets,
    sheets,
    panelWiring: {
      schemaVersion: 1,
      terminalMappings: [],
      internalWires,
      bridges,
      bonds: []
    }
  });
}
