import type {
  SymbolPanelWiringAssetType,
  SymbolTerminal
} from "@/features/symbol_registry/api/public";
import type { PanelWiringSourcePackage } from "../../data/schema";
import type {
  CompatiblePanelComponentAssetOption,
  PanelComponentPaletteGroup,
  PanelComponentPaletteRow,
  PanelComponentPlacementSummary,
  PanelComponentSymbol,
  PanelComponentTerminalSummary
} from "../../types";

const GROUP_BY_ASSET_TYPE: Record<
  SymbolPanelWiringAssetType,
  PanelComponentPaletteGroup
> = {
  breaker: "circuit_protection",
  fuse: "circuit_protection",
  relay: "relays",
  power_supply: "power",
  controller: "control_io",
  io_module: "control_io",
  network_device: "networking",
  isolator: "isolation_conversion",
  converter: "isolation_conversion",
  terminal_block: "terminal_blocks",
  earth_bar: "earth_ground",
  instrument: "instruments",
  other: "other"
};

function terminalGroups(terminals: SymbolTerminal[]) {
  const groups = new Map<string, SymbolTerminal[]>();
  for (const terminal of terminals) {
    const key = terminal.key.trim();
    groups.set(key, [...(groups.get(key) ?? []), terminal]);
  }
  return groups;
}

export function resolvePanelComponentTerminals(
  symbol: PanelComponentSymbol
): {
  terminals: PanelComponentTerminalSummary[];
  blockingReasons: string[];
} {
  const anchorByKey = new Map(
    symbol.metadata.anchors.map((anchor) => [anchor.key, anchor])
  );
  const blockingReasons: string[] = [];
  const terminals: PanelComponentTerminalSummary[] = [];

  if (symbol.metadata.terminals.length === 0) {
    return {
      terminals: [],
      blockingReasons: ["No electrical terminals are defined."]
    };
  }

  for (const [terminalKey, definitions] of terminalGroups(
    symbol.metadata.terminals
  )) {
    const missingAnchor = definitions.find(
      (terminal) => !anchorByKey.has(terminal.anchorKey)
    );
    if (missingAnchor) {
      blockingReasons.push(
        `Terminal ${terminalKey} references missing anchor ${missingAnchor.anchorKey}.`
      );
      continue;
    }

    const supportedSides = definitions.map(
      (terminal) =>
        terminal.panelSide ??
        (definitions.length === 1 ? ("single" as const) : undefined)
    );
    const uniqueSides = new Set(supportedSides.filter(Boolean));
    const uniqueAnchors = new Set(
      definitions.map((terminal) => terminal.anchorKey)
    );

    if (
      supportedSides.some((side) => !side) ||
      uniqueSides.size !== definitions.length ||
      uniqueAnchors.size !== definitions.length
    ) {
      blockingReasons.push(
        `Terminal ${terminalKey} has ambiguous anchors or panel sides.`
      );
      continue;
    }

    terminals.push({
      terminalKey,
      label: definitions[0].label,
      function: definitions[0].function,
      supportedSides: [...uniqueSides].sort() as PanelComponentTerminalSummary["supportedSides"],
      anchors: definitions.map((terminal) => ({
        anchorKey: terminal.anchorKey,
        side:
          terminal.panelSide ??
          (definitions.length === 1 ? ("single" as const) : undefined)
      }))
    });
  }

  return {
    terminals: terminals.sort((first, second) =>
      first.terminalKey.localeCompare(second.terminalKey, undefined, {
        numeric: true
      })
    ),
    blockingReasons: [...new Set(blockingReasons)]
  };
}

export function validatePanelComponentPlacement(
  symbol: PanelComponentSymbol
): { warnings: string[]; blockingReasons: string[] } {
  const terminalResolution = resolvePanelComponentTerminals(symbol);
  const warnings: string[] = [];

  if (!symbol.metadata.physicalWidthMm || !symbol.metadata.physicalHeightMm) {
    warnings.push(
      "Physical dimensions are missing; physical panel-layout placement is unavailable."
    );
  }

  return {
    warnings,
    blockingReasons: terminalResolution.blockingReasons
  };
}

export function buildPanelComponentPalette(
  symbols: PanelComponentSymbol[]
): PanelComponentPaletteRow[] {
  return symbols
    .flatMap((symbol) => {
      const capability = symbol.metadata.panelWiring;
      if (!capability) {
        return [];
      }
      const terminals = resolvePanelComponentTerminals(symbol);
      const validation = validatePanelComponentPlacement(symbol);
      return [
        {
          symbolId: symbol.symbolId,
          versionId: symbol.versionId,
          symbolKey: symbol.symbolKey,
          displayName: symbol.displayName,
          assetType: capability.assetType,
          tagPrefix: capability.tagPrefix,
          schematicScale: capability.schematicScale,
          group: GROUP_BY_ASSET_TYPE[capability.assetType],
          status:
            validation.blockingReasons.length > 0
              ? ("blocked" as const)
              : ("ready" as const),
          terminals: terminals.terminals,
          warnings: validation.warnings,
          blockingReasons: validation.blockingReasons
        }
      ];
    })
    .sort(
      (first, second) =>
        first.group.localeCompare(second.group) ||
        first.displayName.localeCompare(second.displayName, undefined, {
          numeric: true
        })
    );
}

export function buildCompatiblePanelAssetOptions({
  source,
  panelAssetId,
  detailedSheetId,
  symbol
}: {
  source: PanelWiringSourcePackage;
  panelAssetId: string;
  detailedSheetId: string;
  symbol: PanelComponentSymbol;
}): CompatiblePanelComponentAssetOption[] {
  const representedAssetIds = new Set(
    source.sheets
      .find((sheet) => sheet.id === detailedSheetId)
      ?.occurrences.flatMap((occurrence) =>
        occurrence.assetId ? [occurrence.assetId] : []
      ) ?? []
  );
  const associatedAssetIds = new Set(
    source.sheets.flatMap((sheet) =>
      sheet.occurrences.flatMap((occurrence) =>
        occurrence.containerAssetId === panelAssetId && occurrence.assetId
          ? [occurrence.assetId]
          : []
      )
    )
  );

  return source.assets
    .filter(
      (asset) =>
        associatedAssetIds.has(asset.id) &&
        !representedAssetIds.has(asset.id) &&
        asset.symbolId === symbol.symbolId &&
        asset.versionId === symbol.versionId
    )
    .map((asset) => ({
      assetId: asset.id,
      tag: asset.tag,
      title: asset.title,
      type: asset.type,
      symbolId: asset.symbolId!,
      versionId: asset.versionId!,
      sourceSheets: source.sheets
        .filter((sheet) =>
          sheet.occurrences.some(
            (occurrence) => occurrence.assetId === asset.id
          )
        )
        .map((sheet) => ({
          id: sheet.id,
          number: sheet.sheetNumber,
          name: sheet.name
        }))
    }))
    .sort((first, second) =>
      first.tag.localeCompare(second.tag, undefined, { numeric: true })
    );
}

export function getPanelComponentPlacementSummary({
  symbol,
  placement,
  asset
}: {
  symbol: PanelComponentSymbol;
  placement: {
    assetId?: string;
    tag: string;
    title?: string;
    symbolId: string;
    versionId: string;
    containerAssetId?: string;
  };
  asset?: { type: PanelWiringSourcePackage["assets"][number]["type"] };
}): PanelComponentPlacementSummary {
  const terminalResolution = resolvePanelComponentTerminals(symbol);
  const validation = validatePanelComponentPlacement(symbol);
  return {
    assetId: placement.assetId,
    tag: placement.tag,
    title: placement.title,
    assetType: asset?.type,
    symbolId: placement.symbolId,
    versionId: placement.versionId,
    panelAssetId: placement.containerAssetId,
    terminals: terminalResolution.terminals,
    warnings: validation.warnings,
    blockingReasons: validation.blockingReasons
  };
}
