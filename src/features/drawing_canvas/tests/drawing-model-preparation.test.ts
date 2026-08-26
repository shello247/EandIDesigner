import { describe, expect, it, vi } from "vitest";
import { createPanelWiringSource } from "../api/panel-wiring-contracts";
import {
  createDefaultDrawingModel,
  drawingPackageModelSchema,
  type DrawingModel
} from "../data/schema";
import {
  createDrawingModelPreparationCache,
  createDrawingModelPreparationSymbolKey
} from "../logic/services/drawing-model-preparation";
import type { ApprovedDrawingSymbol } from "../types";

const symbol: ApprovedDrawingSymbol = {
  symbolId: "symbol_relay",
  versionId: "version_relay",
  versionNumber: 1,
  symbolKey: "relay",
  displayName: "Relay",
  category: "instrument",
  svg: '<svg viewBox="0 0 100 40"><rect width="100" height="40"/></svg>',
  metadata: {
    symbolKey: "relay",
    displayName: "Relay",
    category: "instrument",
    viewBox: { x: 0, y: 0, width: 100, height: 40 },
    anchors: [
      { key: "IN", x: 0, y: 20, kind: "terminal" },
      { key: "OUT", x: 100, y: 20, kind: "terminal" }
    ],
    terminals: [
      {
        key: "IN",
        label: "Input",
        anchorKey: "IN",
        panelSide: "single",
        requiredForWiring: true
      },
      {
        key: "OUT",
        label: "Output",
        anchorKey: "OUT",
        panelSide: "single",
        requiredForWiring: true
      }
    ],
    panelWiring: { assetType: "relay", tagPrefix: "K" }
  }
};

function numberedWireModel(): DrawingModel {
  const base = createDefaultDrawingModel();
  return drawingPackageModelSchema.parse({
    ...base,
    assets: [
      { id: "panel", tag: "P-001", type: "panel", title: "Panel" },
      {
        id: "relay_a",
        tag: "K-900",
        type: "relay",
        title: "Relay A",
        symbolId: symbol.symbolId,
        versionId: symbol.versionId
      },
      {
        id: "relay_b",
        tag: "K-901",
        type: "relay",
        title: "Relay B",
        symbolId: symbol.symbolId,
        versionId: symbol.versionId
      }
    ],
    sheets: [
      {
        ...base.sheets[0],
        placements: [
          {
            id: "placement_a",
            assetId: "relay_a",
            containerAssetId: "panel",
            symbolId: symbol.symbolId,
            versionId: symbol.versionId,
            role: "device",
            tag: "K-900",
            x: 20,
            y: 20,
            rotation: 0,
            scale: 1
          },
          {
            id: "placement_b",
            assetId: "relay_b",
            containerAssetId: "panel",
            symbolId: symbol.symbolId,
            versionId: symbol.versionId,
            role: "device",
            tag: "K-901",
            x: 80,
            y: 20,
            rotation: 0,
            scale: 1
          }
        ]
      }
    ],
    panelWiring: {
      schemaVersion: 1,
      terminalMappings: [],
      internalWires: [
        {
          id: "internal_wire:001",
          panelAssetId: "panel",
          wireNumber: 1,
          wireId: "STALE-ID",
          from: { assetId: "relay_a", terminalKey: "OUT", side: "single" },
          to: { assetId: "relay_b", terminalKey: "IN", side: "single" },
          origin: "engineer"
        }
      ],
      bridges: [],
      bonds: []
    }
  });
}

describe("drawing model preparation", () => {
  it("uses semantic symbol dependencies instead of array identity", () => {
    const copiedSymbol = structuredClone(symbol);

    expect(createDrawingModelPreparationSymbolKey([symbol])).toBe(
      createDrawingModelPreparationSymbolKey([copiedSymbol])
    );
    expect(createDrawingModelPreparationSymbolKey([symbol, copiedSymbol])).toBe(
      createDrawingModelPreparationSymbolKey([copiedSymbol, symbol])
    );
    expect(
      createDrawingModelPreparationSymbolKey([
        {
          ...copiedSymbol,
          metadata: {
            ...copiedSymbol.metadata,
            category: "network_device"
          }
        }
      ])
    ).not.toBe(createDrawingModelPreparationSymbolKey([symbol]));
  });

  it("builds one source and reuses the prepared final model", () => {
    const createSource = vi.fn((model: DrawingModel) =>
      createPanelWiringSource(model, [symbol])
    );
    const cache = createDrawingModelPreparationCache({
      symbols: [symbol],
      createSource
    });
    const input = createDefaultDrawingModel();

    const prepared = cache.prepare(input);

    expect(createSource).toHaveBeenCalledTimes(1);
    expect(cache.prepare(input)).toBe(prepared);
    expect(cache.prepare(prepared.model)).toBe(prepared);
    expect(createSource).toHaveBeenCalledTimes(1);
  });

  it("rebuilds the source from the final wire-ID-reconciled model", () => {
    const createSource = vi.fn((model: DrawingModel) =>
      createPanelWiringSource(model, [symbol])
    );
    const cache = createDrawingModelPreparationCache({
      symbols: [symbol],
      createSource
    });
    const input = numberedWireModel();

    const prepared = cache.prepare(input);
    const finalWire = prepared.model.panelWiring?.internalWires[0];
    const sourceWire = prepared.panelWiringSource.panelWiring?.internalWires[0];

    expect(createSource).toHaveBeenCalledTimes(2);
    expect(finalWire?.wireId).toBe("K-900:OUT(001)");
    expect(sourceWire?.wireId).toBe(finalWire?.wireId);
    expect(prepared.panelWiringSource.assets).toContainEqual(
      expect.objectContaining({ id: "relay_a", tag: "K-900" })
    );
    expect(cache.prepare(prepared.model)).toBe(prepared);
    expect(createSource).toHaveBeenCalledTimes(2);
  });
});
