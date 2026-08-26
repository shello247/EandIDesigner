import type {
  PanelDiscoveryBuildContext,
  PanelEquipmentSequence,
  PanelEquipmentSequenceIndex,
  PanelWiringSourceOccurrence
} from "../../types";

const FREE_ROW_TOLERANCE_MM = 10;
const EXCLUDED_ASSET_TYPES = new Set(["cable", "panel", "junction_box"]);
const EXCLUDED_TECHNICAL_KINDS = new Set(["ducting", "label", "rail"]);

type PhysicalBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

type EquipmentCandidate = {
  occurrence: PanelWiringSourceOccurrence;
  bounds: PhysicalBounds;
};

type EquipmentRow = {
  kind: "rail" | "free";
  sourceId: string;
  centerY: number;
  members: EquipmentCandidate[];
};

function naturalCompare(first: string, second: string): number {
  return first.localeCompare(second, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function rotatedBounds(
  occurrence: PanelWiringSourceOccurrence
): PhysicalBounds | undefined {
  const layout = occurrence.panelLayout;

  if (!layout) return undefined;

  const radians = (layout.rotationDeg * Math.PI) / 180;
  const rotatedWidth =
    Math.abs(layout.widthMm * Math.cos(radians)) +
    Math.abs(layout.heightMm * Math.sin(radians));
  const rotatedHeight =
    Math.abs(layout.widthMm * Math.sin(radians)) +
    Math.abs(layout.heightMm * Math.cos(radians));
  const centerX = layout.xMm + layout.widthMm / 2;
  const centerY = layout.yMm + layout.heightMm / 2;

  return {
    left: centerX - rotatedWidth / 2,
    top: centerY - rotatedHeight / 2,
    width: rotatedWidth,
    height: rotatedHeight,
    centerX,
    centerY
  };
}

function comparePhysicalOccurrences(
  context: PanelDiscoveryBuildContext,
  first: PanelWiringSourceOccurrence,
  second: PanelWiringSourceOccurrence
): number {
  const firstSheet = context.graph.sheetsById.get(first.sheetId);
  const secondSheet = context.graph.sheetsById.get(second.sheetId);
  const firstLayout = first.panelLayout;
  const secondLayout = second.panelLayout;

  return (
    (firstSheet?.sheetNumber ?? Number.MAX_SAFE_INTEGER) -
      (secondSheet?.sheetNumber ?? Number.MAX_SAFE_INTEGER) ||
    (firstLayout?.backplaneSheetY ?? Number.MAX_SAFE_INTEGER) -
      (secondLayout?.backplaneSheetY ?? Number.MAX_SAFE_INTEGER) ||
    (firstLayout?.backplaneSheetX ?? Number.MAX_SAFE_INTEGER) -
      (secondLayout?.backplaneSheetX ?? Number.MAX_SAFE_INTEGER) ||
    (firstLayout?.yMm ?? Number.MAX_SAFE_INTEGER) -
      (secondLayout?.yMm ?? Number.MAX_SAFE_INTEGER) ||
    (firstLayout?.xMm ?? Number.MAX_SAFE_INTEGER) -
      (secondLayout?.xMm ?? Number.MAX_SAFE_INTEGER) ||
    first.placementId.localeCompare(second.placementId)
  );
}

function compareEquipment(
  first: EquipmentCandidate,
  second: EquipmentCandidate
): number {
  return (
    first.bounds.left - second.bounds.left ||
    naturalCompare(first.occurrence.tag, second.occurrence.tag) ||
    (first.occurrence.assetId ?? "").localeCompare(
      second.occurrence.assetId ?? ""
    )
  );
}

function backplaneKey(occurrence: PanelWiringSourceOccurrence): string {
  return `${occurrence.sheetId}:${occurrence.panelLayout?.backplanePlacementId ?? ""}`;
}

function isSequencedEquipment(
  context: PanelDiscoveryBuildContext,
  associatedAssetIds: ReadonlySet<string>,
  occurrence: PanelWiringSourceOccurrence
): boolean {
  if (
    occurrence.occurrenceKind !== "layout" ||
    occurrence.panelLayout?.layoutKind !== "layout_helper" ||
    !occurrence.assetId ||
    occurrence.assetId === context.panelAssetId ||
    occurrence.containerAssetId !== context.panelAssetId ||
    !associatedAssetIds.has(occurrence.assetId) ||
    ["cable_assembly", "enclosure", "other"].includes(occurrence.role)
  ) {
    return false;
  }

  const asset = context.graph.assetsById.get(occurrence.assetId);

  return Boolean(
    asset &&
      !EXCLUDED_ASSET_TYPES.has(asset.type) &&
      !EXCLUDED_TECHNICAL_KINDS.has(
        occurrence.panelLayout.technicalKind ?? ""
      )
  );
}

function freeRows(candidates: EquipmentCandidate[]): EquipmentRow[] {
  const rows: Array<EquipmentRow & { centerYTotal: number }> = [];

  [...candidates]
    .sort(
      (first, second) =>
        first.bounds.centerY - second.bounds.centerY ||
        compareEquipment(first, second)
    )
    .forEach((candidate) => {
      const matching = rows
        .filter(
          (row) =>
            Math.abs(row.centerY - candidate.bounds.centerY) <=
            FREE_ROW_TOLERANCE_MM
        )
        .sort(
          (first, second) =>
            Math.abs(first.centerY - candidate.bounds.centerY) -
              Math.abs(second.centerY - candidate.bounds.centerY) ||
            first.sourceId.localeCompare(second.sourceId)
        )[0];

      if (!matching) {
        rows.push({
          kind: "free",
          sourceId: `free:${candidate.occurrence.placementId}`,
          centerY: candidate.bounds.centerY,
          centerYTotal: candidate.bounds.centerY,
          members: [candidate]
        });
        return;
      }

      matching.members.push(candidate);
      matching.centerYTotal += candidate.bounds.centerY;
      matching.centerY = matching.centerYTotal / matching.members.length;
    });

  return rows.map((row) => ({
    kind: row.kind,
    sourceId: row.sourceId,
    centerY: row.centerY,
    members: row.members
  }));
}

export function derivePanelEquipmentSequence(
  context: PanelDiscoveryBuildContext
): PanelEquipmentSequenceIndex {
  const associatedAssetIds =
    context.graph.assetIdsByPanelAssetId.get(context.panelAssetId) ??
    new Set<string>();
  const layoutOccurrences = context.graph.source.sheets.flatMap((sheet) =>
    sheet.occurrences.filter(
      (occurrence) =>
        occurrence.occurrenceKind === "layout" &&
        occurrence.containerAssetId === context.panelAssetId &&
        Boolean(occurrence.panelLayout)
    )
  );
  const candidatesByAssetId = new Map<
    string,
    PanelWiringSourceOccurrence[]
  >();

  layoutOccurrences.forEach((occurrence) => {
    if (!isSequencedEquipment(context, associatedAssetIds, occurrence)) return;
    const assetId = occurrence.assetId!;
    candidatesByAssetId.set(assetId, [
      ...(candidatesByAssetId.get(assetId) ?? []),
      occurrence
    ]);
  });

  const duplicateLayoutAssetIds = new Set<string>();
  const selectedCandidates: EquipmentCandidate[] = [];

  candidatesByAssetId.forEach((occurrences, assetId) => {
    const ordered = [...occurrences].sort((first, second) =>
      comparePhysicalOccurrences(context, first, second)
    );
    if (ordered.length > 1) duplicateLayoutAssetIds.add(assetId);
    const bounds = rotatedBounds(ordered[0]);
    if (bounds) selectedCandidates.push({ occurrence: ordered[0], bounds });
  });

  const candidatesByBackplane = new Map<string, EquipmentCandidate[]>();
  selectedCandidates.forEach((candidate) => {
    const key = backplaneKey(candidate.occurrence);
    candidatesByBackplane.set(key, [
      ...(candidatesByBackplane.get(key) ?? []),
      candidate
    ]);
  });

  const groupOrder = [...candidatesByBackplane.entries()].sort(
    ([, first], [, second]) =>
      comparePhysicalOccurrences(
        context,
        first[0].occurrence,
        second[0].occurrence
      )
  );
  const sequenceByAssetId = new Map<string, PanelEquipmentSequence>();
  let position = 1;
  let rowNumber = 1;

  groupOrder.forEach(([groupKey, candidates]) => {
    const rails = layoutOccurrences
      .filter(
        (occurrence) =>
          backplaneKey(occurrence) === groupKey &&
          occurrence.panelLayout?.technicalKind === "rail"
      )
      .map((occurrence) => ({ occurrence, bounds: rotatedBounds(occurrence) }))
      .filter(
        (rail): rail is EquipmentCandidate =>
          Boolean(rail.bounds && rail.bounds.width >= rail.bounds.height)
      )
      .sort(
        (first, second) =>
          first.bounds.centerY - second.bounds.centerY ||
          first.occurrence.placementId.localeCompare(
            second.occurrence.placementId
          )
      );
    const railRows = new Map<string, EquipmentRow>();
    const unassigned: EquipmentCandidate[] = [];

    candidates.forEach((candidate) => {
      if (
        candidate.occurrence.panelLayout?.mountingType !== "din_rail" ||
        rails.length === 0
      ) {
        unassigned.push(candidate);
        return;
      }

      const rail = [...rails].sort(
        (first, second) =>
          Math.abs(first.bounds.centerY - candidate.bounds.centerY) -
            Math.abs(second.bounds.centerY - candidate.bounds.centerY) ||
          first.occurrence.placementId.localeCompare(
            second.occurrence.placementId
          )
      )[0];
      const sourceId = rail.occurrence.placementId;
      const row = railRows.get(sourceId) ?? {
        kind: "rail" as const,
        sourceId,
        centerY: rail.bounds.centerY,
        members: []
      };
      row.members.push(candidate);
      railRows.set(sourceId, row);
    });

    const rows = [...railRows.values(), ...freeRows(unassigned)].sort(
      (first, second) =>
        first.centerY - second.centerY ||
        (first.kind === second.kind ? 0 : first.kind === "rail" ? -1 : 1) ||
        first.sourceId.localeCompare(second.sourceId)
    );

    rows.forEach((row) => {
      row.members.sort(compareEquipment).forEach((candidate, columnIndex) => {
        const assetId = candidate.occurrence.assetId!;
        sequenceByAssetId.set(assetId, {
          position,
          row: rowNumber,
          column: columnIndex + 1,
          sourceSheetId: candidate.occurrence.sheetId,
          backplanePlacementId:
            candidate.occurrence.panelLayout!.backplanePlacementId
        });
        position += 1;
      });
      rowNumber += 1;
    });
  });

  return { sequenceByAssetId, duplicateLayoutAssetIds };
}
