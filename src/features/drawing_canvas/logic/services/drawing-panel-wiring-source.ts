import {
  panelWiringSourcePackageSchema,
  type PanelWiringSourceOccurrence,
  type PanelWiringSourcePackage,
  type PanelWiringSourceTerminal
} from "@/features/drawing_panel_wiring/api/contracts";
import { terminalBlockTerminals } from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import type {
  DrawingConnection,
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { placementAssetId } from "./drawing-asset-identity";
import {
  getRenderableSymbolForPlacement,
  isGeneratedTerminalBlockPlacement
} from "./drawing-generated-symbols";
import { getConnectionWireId } from "./drawing-identification";

function occurrenceAssetId(placement: DrawingPlacement): string | undefined {
  if (
    (placement.layoutKind && placement.role === "other") ||
    placement.panelReference ||
    placement.panelPatternLegend
  ) {
    return undefined;
  }

  return placementAssetId(placement);
}

function occurrenceKind(
  placement: DrawingPlacement
): PanelWiringSourceOccurrence["occurrenceKind"] {
  if (placement.layoutKind) {
    return "layout";
  }

  return placement.role === "enclosure" ? "enclosure_reference" : "wiring";
}

type PhysicalPosition = "top" | "right" | "bottom" | "left";

function rotatePhysicalPosition(
  position: PhysicalPosition,
  rotation: number
): PhysicalPosition | undefined {
  const normalized = ((rotation % 360) + 360) % 360;
  const quarterTurns = Math.round(normalized / 90) % 4;

  if (Math.abs(normalized - quarterTurns * 90) > 0.001) {
    return undefined;
  }

  const positions: PhysicalPosition[] = ["top", "right", "bottom", "left"];
  return positions[(positions.indexOf(position) + quarterTurns) % positions.length];
}

function anchorPhysicalPosition(
  anchor: ApprovedDrawingSymbol["metadata"]["anchors"][number],
  symbol: ApprovedDrawingSymbol,
  rotation: number
): PhysicalPosition | undefined {
  const viewBox = symbol.metadata.viewBox;
  const tolerance = Math.max(0.5, Math.min(viewBox.width, viewBox.height) * 0.15);
  const distances: Array<{ position: PhysicalPosition; distance: number }> = [
    { position: "top", distance: Math.abs(anchor.y - viewBox.y) },
    {
      position: "right",
      distance: Math.abs(anchor.x - (viewBox.x + viewBox.width))
    },
    {
      position: "bottom",
      distance: Math.abs(anchor.y - (viewBox.y + viewBox.height))
    },
    { position: "left", distance: Math.abs(anchor.x - viewBox.x) }
  ];
  distances.sort((first, second) => first.distance - second.distance);

  if (
    distances[0].distance > tolerance ||
    Math.abs(distances[0].distance - distances[1].distance) < 0.001
  ) {
    return undefined;
  }

  return rotatePhysicalPosition(distances[0].position, rotation);
}

function generatedTerminalBlockSourceTerminals(
  placement: DrawingPlacement
): PanelWiringSourceTerminal[] {
  if (!isGeneratedTerminalBlockPlacement(placement)) {
    return [];
  }

  return terminalBlockTerminals(placement.terminalBlock).map((terminal) => ({
    terminalKey: terminal.key,
    label: terminal.label,
    function: "Feed-through terminal",
    supportedSides: ["external", "internal"],
    status: "resolved",
    anchors: [
      {
        anchorKey: terminal.bottomAnchorKey,
        anchorKind: "terminal",
        sideHint: "external",
        physicalPosition: rotatePhysicalPosition("bottom", placement.rotation)
      },
      {
        anchorKey: terminal.topAnchorKey,
        anchorKind: "terminal",
        sideHint: "internal",
        physicalPosition: rotatePhysicalPosition("top", placement.rotation)
      }
    ]
  }));
}

function approvedSymbolSourceTerminals(
  symbol: ApprovedDrawingSymbol,
  rotation: number
): PanelWiringSourceTerminal[] {
  const anchorByKey = new Map(
    symbol.metadata.anchors.map((anchor) => [anchor.key, anchor])
  );
  const groups = new Map<
    string,
    ApprovedDrawingSymbol["metadata"]["terminals"]
  >();

  for (const terminal of symbol.metadata.terminals) {
    groups.set(terminal.key, [...(groups.get(terminal.key) ?? []), terminal]);
  }

  return [...groups.entries()]
    .map(([terminalKey, terminals]) => {
      const anchors = terminals.flatMap((terminal) => {
        const anchor = anchorByKey.get(terminal.anchorKey);

        return anchor
          ? [
              {
                anchorKey: anchor.key,
                anchorKind: anchor.kind,
                sideHint:
                  terminal.panelSide ??
                  (terminals.length === 1 ? ("single" as const) : undefined),
                physicalPosition: anchorPhysicalPosition(anchor, symbol, rotation)
              }
            ]
          : [];
      });
      const first = terminals[0];
      const explicitSides = terminals.map((terminal) => terminal.panelSide);
      const uniqueSides = new Set(explicitSides.filter(Boolean));
      const uniqueAnchors = new Set(anchors.map((anchor) => anchor.anchorKey));
      const isLegacySingle =
        terminals.length === 1 && anchors.length === 1 && !terminals[0].panelSide;
      const isExplicitSingle =
        terminals.length === 1 &&
        anchors.length === 1 &&
        terminals[0].panelSide === "single";
      const isExplicitSided =
        terminals.length > 0 &&
        terminals.every(
          (terminal) =>
            terminal.panelSide === "external" ||
            terminal.panelSide === "internal"
        ) &&
        uniqueSides.size === terminals.length &&
        uniqueAnchors.size === terminals.length &&
        anchors.length === terminals.length;
      const isResolved =
        isLegacySingle || isExplicitSingle || isExplicitSided;
      const supportedSides: PanelWiringSourceTerminal["supportedSides"] =
        isLegacySingle || isExplicitSingle
          ? ["single"]
          : isExplicitSided
            ? ([...uniqueSides].sort() as PanelWiringSourceTerminal["supportedSides"])
            : [];
      const requiredSides = [
        ...new Set(
          terminals.flatMap((terminal) => {
            if (!terminal.requiredForWiring) return [];
            if (terminal.panelSide) return [terminal.panelSide];
            return terminals.length === 1 ? (["single"] as const) : [];
          })
        )
      ].sort() as NonNullable<PanelWiringSourceTerminal["requiredSides"]>;

      return {
        terminalKey,
        label: first.label,
        function: first.function,
        supportedSides,
        requiredSides: requiredSides.length > 0 ? requiredSides : undefined,
        allowedDomains: [
          ...new Set(terminals.flatMap((terminal) => terminal.electricalDomains ?? []))
        ].sort(),
        anchors,
        status: isResolved ? ("resolved" as const) : ("ambiguous" as const)
      };
    })
    .filter((terminal) => terminal.anchors.length > 0)
    .sort((first, second) =>
      first.terminalKey.localeCompare(second.terminalKey, undefined, {
        numeric: true
      })
    );
}

function terminalSourceForPlacement(
  placement: DrawingPlacement,
  symbols: ApprovedDrawingSymbol[]
): Pick<
  PanelWiringSourceOccurrence,
  | "terminalResolutionStatus"
  | "terminalResolutionMessage"
  | "terminals"
> {
  const generatedTerminals = generatedTerminalBlockSourceTerminals(placement);

  if (generatedTerminals.length > 0) {
    return {
      terminalResolutionStatus: "resolved",
      terminals: generatedTerminals
    };
  }

  const expectsTerminals = ["device", "terminal_block"].includes(placement.role);

  if (!expectsTerminals) {
    return {
      terminalResolutionStatus: "not_applicable",
      terminals: []
    };
  }

  const symbol = getRenderableSymbolForPlacement(placement, symbols);

  if (!symbol) {
    return {
      terminalResolutionStatus: "missing_symbol",
      terminalResolutionMessage: `${placement.tag} has no resolvable symbol version.`,
      terminals: []
    };
  }

  if (symbol.metadata.terminals.length === 0) {
    return {
      terminalResolutionStatus: "missing_metadata",
      terminalResolutionMessage: `${placement.tag} has no terminal metadata.`,
      terminals: []
    };
  }

  const terminals = approvedSymbolSourceTerminals(symbol, placement.rotation);

  if (terminals.length === 0) {
    return {
      terminalResolutionStatus: "missing_metadata",
      terminalResolutionMessage: `${placement.tag} terminal metadata does not resolve to available anchors.`,
      terminals: []
    };
  }

  const ambiguous = terminals.some((terminal) => terminal.status === "ambiguous");

  return {
    terminalResolutionStatus: ambiguous ? "ambiguous" : "resolved",
    terminalResolutionMessage: ambiguous
      ? `${placement.tag} has logical terminals with ambiguous anchor mappings.`
      : undefined,
    terminals
  };
}

function sourceOccurrence(
  sheet: DrawingPackageSheet,
  placement: DrawingPlacement,
  symbols: ApprovedDrawingSymbol[]
): PanelWiringSourceOccurrence {
  const renderableSymbol = getRenderableSymbolForPlacement(placement, symbols);
  return {
    sheetId: sheet.id,
    placementId: placement.id,
    assetId: occurrenceAssetId(placement),
    tag: placement.tag,
    role: placement.role,
    occurrenceKind: occurrenceKind(placement),
    containerAssetId: placement.containerAssetId,
    symbolId: placement.symbolId,
    versionId: placement.versionId,
    availableAnchorKeys: renderableSymbol?.metadata.anchors.map(
      (anchor) => anchor.key
    ),
    ...terminalSourceForPlacement(placement, symbols)
  };
}

function cablePlacementForConnection(
  sheet: DrawingPackageSheet,
  connection: DrawingConnection
): DrawingPlacement | undefined {
  const placementsById = new Map(
    sheet.placements.map((placement) => [placement.id, placement])
  );
  const assigned = connection.cablePlacementId
    ? placementsById.get(connection.cablePlacementId)
    : undefined;

  if (assigned?.role === "cable_assembly") {
    return assigned;
  }

  return [connection.from.placementId, connection.to.placementId]
    .map((placementId) => placementsById.get(placementId))
    .find((placement) => placement?.role === "cable_assembly");
}

export function buildDrawingPanelWiringSource(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): PanelWiringSourcePackage {
  return panelWiringSourcePackageSchema.parse({
    assets: (model.assets ?? []).map((asset) => ({
      id: asset.id,
      tag: asset.tag,
      type: asset.type,
      title: asset.title,
      symbolId: asset.symbolId,
      versionId: asset.versionId
    })),
    sheets: model.sheets.map((sheet, sheetIndex) => {
      const canvasModel = {
        sheet: {
          ...sheet.page,
          titleBlock: model.titleBlock
        },
        placements: sheet.placements,
        connections: sheet.connections,
        annotations: sheet.annotations
      };

      return {
        id: sheet.id,
        sheetNumber: sheetIndex + 1,
        name: sheet.name,
        kind: sheet.kind,
        description: sheet.description,
        panelDrawingContext: sheet.panelDrawingContext,
        occurrences: sheet.placements.map((placement) =>
          sourceOccurrence(sheet, placement, symbols)
        ),
        connections: sheet.connections.map((connection) => {
          const cablePlacement = cablePlacementForConnection(sheet, connection);

          return {
            id: connection.id,
            sheetId: sheet.id,
            from: connection.from,
            to: connection.to,
            wireId: getConnectionWireId(canvasModel, symbols, connection),
            cablePlacementId: cablePlacement?.id,
            cableAssetId: cablePlacement
              ? occurrenceAssetId(cablePlacement)
              : undefined,
            cableTag: cablePlacement?.tag,
            conductorKey: connection.conductorKey,
            panelConnectionId: connection.panelConnectionId,
            panelPatternId: connection.panelPatternId,
            panelPatternSegmentId: connection.panelPatternSegmentId,
            routeMode: connection.route?.mode,
            routePointCount: connection.route?.points.length
          };
        })
      };
    }),
    panelWiring: model.panelWiring
  });
}
