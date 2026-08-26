import {
  panelWireNumberSettingsSchema,
  panelWiringSourcePackageSchema,
  type PanelInternalWireRecord,
  type PanelTerminalSideRef,
  type PanelWireNumberSettings,
  type PanelWiringMutation,
  type PanelWiringSourcePackage
} from "../../data/schema";

function normalized(value: string): string {
  return value.trim().toLocaleUpperCase("en-US");
}

export function formatWireNumber(wireNumber: number): string {
  if (!Number.isInteger(wireNumber) || wireNumber < 1) {
    throw new Error("Wire number must be a positive integer.");
  }
  return String(wireNumber).padStart(3, "0");
}

export function deriveInternalWireId({
  sourceTag,
  terminalKey,
  wireNumber
}: {
  sourceTag: string;
  terminalKey: string;
  wireNumber: number;
}): string {
  const tag = sourceTag.trim();
  const terminal = terminalKey.trim();
  if (!tag || !terminal) {
    throw new Error("Wire ID requires a source equipment tag and terminal.");
  }
  return `${tag}:${terminal}(${formatWireNumber(wireNumber)})`;
}

export function resolveInternalWireSourceTag(
  source: PanelWiringSourcePackage,
  from: PanelTerminalSideRef
): string {
  const asset = source.assets.find((candidate) => candidate.id === from.assetId);
  if (!asset?.tag.trim()) {
    throw new Error("The source equipment tag could not be resolved.");
  }
  return asset.tag.trim();
}

export function deriveInternalWireIdFromSource(
  source: PanelWiringSourcePackage,
  from: PanelTerminalSideRef,
  wireNumber: number
): string {
  return deriveInternalWireId({
    sourceTag: resolveInternalWireSourceTag(source, from),
    terminalKey: from.terminalKey,
    wireNumber
  });
}

export function getEffectiveInternalWireId(
  source: PanelWiringSourcePackage,
  wire: PanelInternalWireRecord
): string {
  return wire.wireNumber
    ? deriveInternalWireIdFromSource(source, wire.from, wire.wireNumber)
    : wire.wireId;
}

export function getInternalWireDisplayNumber(
  wire: PanelInternalWireRecord
): string | undefined {
  return wire.wireNumber ? formatWireNumber(wire.wireNumber) : undefined;
}

function usedWireNumbers(source: PanelWiringSourcePackage): Set<number> {
  return new Set(
    (source.panelWiring?.internalWires ?? []).flatMap((wire) =>
      wire.wireNumber ? [wire.wireNumber] : []
    )
  );
}

function maximumWireNumber(source: PanelWiringSourcePackage): number {
  let maximum = 0;
  for (const wire of source.panelWiring?.internalWires ?? []) {
    if (wire.wireNumber && wire.wireNumber > maximum) maximum = wire.wireNumber;
  }
  return maximum;
}

export function getWireNumberSettings(
  source: PanelWiringSourcePackage
): PanelWireNumberSettings {
  return panelWireNumberSettingsSchema.parse(
    source.panelWiring?.wireNumberSettings ?? {
      nextNumber: maximumWireNumber(source) + 1
    }
  );
}

export function allocateInternalWireNumber(
  inputSource: PanelWiringSourcePackage
): { wireNumber: number; settings: PanelWireNumberSettings } {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const used = usedWireNumbers(source);
  const current = getWireNumberSettings(source);
  let wireNumber = current.nextNumber;
  while (used.has(wireNumber)) wireNumber += 1;
  return {
    wireNumber,
    settings: { nextNumber: wireNumber + 1 }
  };
}

export function assertUniqueInternalWireIdentity({
  source,
  wireNumber,
  wireId,
  ignoreRecordId
}: {
  source: PanelWiringSourcePackage;
  wireNumber: number;
  wireId: string;
  ignoreRecordId?: string;
}) {
  const duplicateNumber = (source.panelWiring?.internalWires ?? []).find(
    (wire) => wire.id !== ignoreRecordId && wire.wireNumber === wireNumber
  );
  if (duplicateNumber) {
    throw new Error(
      `Wire # ${formatWireNumber(wireNumber)} is already used by another internal wire.`
    );
  }

  const target = normalized(wireId);
  const duplicateInternal = (source.panelWiring?.internalWires ?? []).find(
    (wire) =>
      wire.id !== ignoreRecordId &&
      normalized(getEffectiveInternalWireId(source, wire)) === target
  );
  const duplicateField = source.sheets.some((sheet) =>
    sheet.connections.some(
      (connection) =>
        !connection.panelConnectionId &&
        connection.wireId &&
        normalized(connection.wireId) === target
    )
  );
  if (duplicateInternal || duplicateField) {
    throw new Error(`${wireId} is already used by another package wire.`);
  }
}

export function createInternalWireRecordId(wireNumber: number): string {
  return `internal_wire:${formatWireNumber(wireNumber)}`;
}

export function reconcileDerivedInternalWireIds(
  source: PanelWiringSourcePackage
): PanelWiringMutation[] {
  return (source.panelWiring?.internalWires ?? []).flatMap((wire) => {
    if (!wire.wireNumber) return [];
    const wireId = deriveInternalWireIdFromSource(
      source,
      wire.from,
      wire.wireNumber
    );
    if (wireId === wire.wireId) return [];
    return [{
      kind: "upsert-internal-wire" as const,
      wire: { ...wire, wireId }
    }];
  });
}
