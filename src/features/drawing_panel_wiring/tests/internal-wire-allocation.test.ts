import { describe, expect, it } from "vitest";
import {
  allocateInternalWireId,
  createInternalPanelWire,
  updateInternalPanelWire
} from "../api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

describe("internal panel wire allocation", () => {
  it("allocates panel-scoped IDs and advances settings", () => {
    const source = createGenericPanelWiringSource();
    const first = allocateInternalWireId({ source, panelAssetId: GENERIC_PANEL_ASSET_ID });
    expect(first.wireId).toBe("ENC-001-W001");

    const created = createInternalPanelWire(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      from: { assetId: GENERIC_TERMINAL_ASSET_IDS[0], terminalKey: "T4", side: "internal" },
      to: { assetId: GENERIC_TERMINAL_ASSET_IDS[1], terminalKey: "T4", side: "internal" }
    });
    expect(created.wire?.wireId).toBe("ENC-001-W001");
    expect(created.mutations).toHaveLength(2);
  });

  it("prevents duplicate IDs and accepts attribute updates", () => {
    const source = createGenericPanelWiringSource();
    const created = createInternalPanelWire(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      from: { assetId: GENERIC_TERMINAL_ASSET_IDS[0], terminalKey: "T4", side: "internal" },
      to: { assetId: GENERIC_TERMINAL_ASSET_IDS[1], terminalKey: "T4", side: "internal" }
    });
    const withWire = {
      ...source,
      panelWiring: {
        schemaVersion: 1 as const,
        terminalMappings: [],
        internalWires: [created.wire!],
        bridges: [],
        bonds: []
      }
    };
    expect(() =>
      updateInternalPanelWire(withWire, {
        id: created.wire!.id,
        wireId: "ENC-001-W001",
        attributes: { color: "Blue", size: "1.5 mm2" }
      })
    ).not.toThrow();
    expect(() =>
      createInternalPanelWire(withWire, {
        panelAssetId: GENERIC_PANEL_ASSET_ID,
        from: { assetId: GENERIC_TERMINAL_ASSET_IDS[2], terminalKey: "T4", side: "internal" },
        to: { assetId: GENERIC_TERMINAL_ASSET_IDS[3], terminalKey: "T4", side: "internal" },
        wireId: "ENC-001-W001"
      })
    ).toThrow("already used");
  });
});
