import {
  panelInternalWireRecordSchema,
  panelWiringSourcePackageSchema,
  type PanelInternalWireRecord,
  type PanelWiringMutation,
  type PanelWiringSourcePackage
} from "../../data/schema";
import {
  allocateInternalWireNumber,
  assertUniqueInternalWireIdentity,
  deriveInternalWireIdFromSource,
  formatWireNumber
} from "./internal-wire-identity";

export type LegacyWireIdentityUpgradeRow = {
  wireRecordId: string;
  oldWireId: string;
  wireNumber?: number;
  wireNumberLabel?: string;
  newWireId?: string;
  blockingReason?: string;
};

export type LegacyWireIdentityUpgradePreview = {
  rows: LegacyWireIdentityUpgradeRow[];
  canApply: boolean;
};

function naturalCompare(first: string, second: string): number {
  return first.localeCompare(second, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function withCandidate(
  source: PanelWiringSourcePackage,
  candidate: PanelInternalWireRecord,
  nextNumber: number
): PanelWiringSourcePackage {
  return panelWiringSourcePackageSchema.parse({
    ...source,
    panelWiring: {
      schemaVersion: 1,
      terminalMappings: source.panelWiring?.terminalMappings ?? [],
      internalWires: [
        ...(source.panelWiring?.internalWires ?? []).filter(
          (wire) => wire.id !== candidate.id
        ),
        candidate
      ],
      bridges: source.panelWiring?.bridges ?? [],
      bonds: source.panelWiring?.bonds ?? [],
      wireNumberSettings: { nextNumber },
      panelSettings: source.panelWiring?.panelSettings,
      patternSettings: source.panelWiring?.patternSettings
    }
  });
}

export function buildLegacyWireIdentityUpgradePreview(
  inputSource: PanelWiringSourcePackage
): LegacyWireIdentityUpgradePreview {
  let source = panelWiringSourcePackageSchema.parse(inputSource);
  const legacyWires = [...(source.panelWiring?.internalWires ?? [])]
    .filter((wire) => !wire.wireNumber)
    .sort(
      (first, second) =>
        naturalCompare(first.wireId, second.wireId) ||
        first.id.localeCompare(second.id)
    );
  const rows: LegacyWireIdentityUpgradeRow[] = [];

  for (const wire of legacyWires) {
    try {
      const allocation = allocateInternalWireNumber(source);
      const wireId = deriveInternalWireIdFromSource(
        source,
        wire.from,
        allocation.wireNumber
      );
      assertUniqueInternalWireIdentity({
        source,
        wireNumber: allocation.wireNumber,
        wireId,
        ignoreRecordId: wire.id
      });
      const upgraded = panelInternalWireRecordSchema.parse({
        ...wire,
        wireNumber: allocation.wireNumber,
        wireId
      });
      rows.push({
        wireRecordId: wire.id,
        oldWireId: wire.wireId,
        wireNumber: allocation.wireNumber,
        wireNumberLabel: formatWireNumber(allocation.wireNumber),
        newWireId: wireId
      });
      source = withCandidate(
        source,
        upgraded,
        allocation.settings.nextNumber
      );
    } catch (error) {
      rows.push({
        wireRecordId: wire.id,
        oldWireId: wire.wireId,
        blockingReason:
          error instanceof Error ? error.message : "Wire identity could not be resolved."
      });
    }
  }

  return {
    rows,
    canApply: rows.length > 0 && rows.every((row) => !row.blockingReason)
  };
}

export function upgradeLegacyWireIdentities(
  inputSource: PanelWiringSourcePackage
): PanelWiringMutation[] {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const preview = buildLegacyWireIdentityUpgradePreview(source);
  if (!preview.canApply) {
    throw new Error(
      preview.rows.find((row) => row.blockingReason)?.blockingReason ??
        "There are no legacy internal wires to upgrade."
    );
  }
  const byId = new Map(
    (source.panelWiring?.internalWires ?? []).map((wire) => [wire.id, wire])
  );
  const wireMutations: PanelWiringMutation[] = preview.rows.map((row) => {
    const current = byId.get(row.wireRecordId);
    if (!current || !row.wireNumber || !row.newWireId) {
      throw new Error("The wire upgrade preview is stale.");
    }
    return {
      kind: "upsert-internal-wire",
      wire: panelInternalWireRecordSchema.parse({
        ...current,
        wireNumber: row.wireNumber,
        wireId: row.newWireId
      })
    };
  });
  const nextNumber =
    Math.max(...preview.rows.map((row) => row.wireNumber ?? 0)) + 1;
  return [
    ...wireMutations,
    {
      kind: "upsert-wire-number-settings",
      settings: { nextNumber }
    }
  ];
}
