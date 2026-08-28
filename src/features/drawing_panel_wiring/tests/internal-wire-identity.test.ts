import { describe, expect, it } from "vitest";
import {
  allocateInternalWireNumber,
  buildLegacyWireIdentityUpgradePreview,
  createInternalPanelWire,
  deriveInternalWireId,
  formatWireNumber,
  getEffectiveInternalWireId,
  getPreviousInternalWireDescription,
  upgradeLegacyWireIdentities
} from "../api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

const specification = {
  catalogEntryId: "catalog-blue",
  catalogEntryName: "Panel Blue 1.5",
  wireType: "H07V-K",
  size: "1.5 mm²",
  color: "Blue"
};

describe("internal wire identity", () => {
  it("formats three digits and continues after 999", () => {
    expect(formatWireNumber(1)).toBe("001");
    expect(formatWireNumber(999)).toBe("999");
    expect(formatWireNumber(1000)).toBe("1000");
  });

  it("preserves tag and terminal punctuation in the derived ID", () => {
    expect(
      deriveInternalWireId({
        sourceTag: "MCB-101",
        terminalKey: "1",
        wireNumber: 1
      })
    ).toBe("MCB-101:1(001)");
    expect(
      deriveInternalWireId({
        sourceTag: "PS-101",
        terminalKey: "2.1",
        wireNumber: 2
      })
    ).toBe("PS-101:2.1(002)");
  });

  it("creates a stable numbered record with a catalog snapshot", () => {
    const source = createGenericPanelWiringSource();
    const result = createInternalPanelWire(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      from: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T4",
        side: "internal"
      },
      to: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[1],
        terminalKey: "T4",
        side: "internal"
      },
      specification
    });

    expect(result.wire).toMatchObject({
      id: "internal_wire:001",
      wireNumber: 1,
      wireId: "XT-001:T4(001)",
      specification
    });
    expect(result.mutations).toContainEqual({
      kind: "upsert-wire-number-settings",
      settings: { nextNumber: 2 }
    });
  });

  it("does not reuse deleted or lower wire numbers when sequence state exists", () => {
    const source = createGenericPanelWiringSource();
    const withSequence = {
      ...source,
      panelWiring: {
        schemaVersion: 1 as const,
        terminalMappings: [],
        internalWires: [],
        bridges: [],
        bonds: [],
        wireNumberSettings: { nextNumber: 12 }
      }
    };

    expect(allocateInternalWireNumber(withSequence)).toEqual({
      wireNumber: 12,
      settings: { nextNumber: 13 }
    });
  });

  it("copies the exact description from the immediately preceding numbered wire", () => {
    expect(
      getPreviousInternalWireDescription(
        [
          {
            wireNumber: 1,
            attributes: { description: "Control power to relay 1" }
          },
          {
            wireNumber: 3,
            attributes: { description: "Control power to relay 3" }
          },
          {
            wireNumber: 8,
            attributes: { description: "Later wire" }
          }
        ],
        4
      )
    ).toBe("Control power to relay 3");
  });

  it("keeps the new description blank when the immediate predecessor is blank", () => {
    expect(
      getPreviousInternalWireDescription(
        [
          {
            wireNumber: 2,
            attributes: { description: "Older description" }
          },
          {
            wireNumber: 3
          }
        ],
        4
      )
    ).toBe("");
  });

  it("changes the effective ID after a source tag rename without changing the number", () => {
    const source = createGenericPanelWiringSource();
    const wire = createInternalPanelWire(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      from: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T4",
        side: "internal"
      },
      to: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[1],
        terminalKey: "T4",
        side: "internal"
      },
      specification
    }).wire!;
    const renamed = {
      ...source,
      assets: source.assets.map((asset) =>
        asset.id === GENERIC_TERMINAL_ASSET_IDS[0]
          ? { ...asset, tag: "TB-A" }
          : asset
      )
    };

    expect(wire.wireNumber).toBe(1);
    expect(getEffectiveInternalWireId(renamed, wire)).toBe("TB-A:T4(001)");
  });

  it("previews and upgrades legacy records without replacing record IDs", () => {
    const source = createGenericPanelWiringSource();
    const legacy = createInternalPanelWire(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      from: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T4",
        side: "internal"
      },
      to: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[1],
        terminalKey: "T4",
        side: "internal"
      }
    }).wire!;
    const withLegacy = {
      ...source,
      panelWiring: {
        schemaVersion: 1 as const,
        terminalMappings: [],
        internalWires: [legacy],
        bridges: [],
        bonds: []
      }
    };

    const preview = buildLegacyWireIdentityUpgradePreview(withLegacy);
    expect(preview).toMatchObject({
      canApply: true,
      rows: [
        {
          wireRecordId: legacy.id,
          oldWireId: legacy.wireId,
          wireNumberLabel: "001",
          newWireId: "XT-001:T4(001)"
        }
      ]
    });
    const mutations = upgradeLegacyWireIdentities(withLegacy);
    expect(mutations[0]).toMatchObject({
      kind: "upsert-internal-wire",
      wire: {
        id: legacy.id,
        wireNumber: 1,
        wireId: "XT-001:T4(001)"
      }
    });
  });
});
