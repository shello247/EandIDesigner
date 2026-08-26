import { describe, expect, it, vi } from "vitest";
import type { ApprovedDrawingSymbol } from "../types";
import { createDrawingSymbolCatalogLoader } from "../logic/services/drawing-symbol-catalog-loader";

function symbol(versionId: string): ApprovedDrawingSymbol {
  return {
    symbolId: `symbol_${versionId}`,
    symbolKey: `key_${versionId}`,
    displayName: `Symbol ${versionId}`,
    category: "instrument",
    versionId,
    versionNumber: 1,
    svg: `<svg data-version="${versionId}"></svg>`,
    metadata: {
      symbolKey: `key_${versionId}`,
      displayName: `Symbol ${versionId}`,
      category: "instrument",
      viewBox: { x: 0, y: 0, width: 10, height: 10 },
      anchors: [],
      terminals: []
    }
  };
}

describe("drawing symbol catalogue loader", () => {
  it("deduplicates in-flight loads and caches immutable successes", async () => {
    let resolveLoad: ((value: { ok: true; data: ApprovedDrawingSymbol }) => void) | undefined;
    const loadVersion = vi.fn(
      () =>
        new Promise<{ ok: true; data: ApprovedDrawingSymbol }>((resolve) => {
          resolveLoad = resolve;
        })
    );
    const loader = createDrawingSymbolCatalogLoader({ loadVersion });

    const first = loader.load("version_1");
    const duplicate = loader.load("version_1");

    expect(duplicate).toBe(first);
    expect(loadVersion).toHaveBeenCalledTimes(1);
    resolveLoad?.({ ok: true, data: symbol("version_1") });
    await expect(first).resolves.toEqual({
      ok: true,
      symbol: symbol("version_1")
    });
    expect(loader.peek("version_1")).toEqual(symbol("version_1"));

    await expect(loader.load("version_1")).resolves.toEqual({
      ok: true,
      symbol: symbol("version_1")
    });
    expect(loadVersion).toHaveBeenCalledTimes(1);
  });

  it("does not cache errors and performs an explicit retry", async () => {
    const loadVersion = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "Temporary failure." })
      .mockResolvedValueOnce({ ok: true, data: symbol("version_2") });
    const loader = createDrawingSymbolCatalogLoader({ loadVersion });

    await expect(loader.load("version_2")).resolves.toEqual({
      ok: false,
      error: "Temporary failure."
    });
    expect(loader.peek("version_2")).toBeUndefined();
    await expect(loader.retry("version_2")).resolves.toEqual({
      ok: true,
      symbol: symbol("version_2")
    });
    expect(loadVersion).toHaveBeenCalledTimes(2);
  });

  it("rejects mismatched records instead of caching the wrong version", async () => {
    const loader = createDrawingSymbolCatalogLoader({
      loadVersion: vi.fn().mockResolvedValue({
        ok: true,
        data: symbol("different_version")
      })
    });

    await expect(loader.load("requested_version")).resolves.toEqual({
      ok: false,
      error: "The requested symbol version could not be loaded."
    });
    expect(loader.peek("requested_version")).toBeUndefined();
  });

  it("never invokes insertion after a failed load", async () => {
    const insert = vi.fn();
    const loader = createDrawingSymbolCatalogLoader({
      loadVersion: vi.fn().mockResolvedValue({
        ok: false,
        error: "Symbol version was not found."
      })
    });

    await expect(
      loader.loadForInsertion("missing_version", insert)
    ).resolves.toEqual({
      ok: false,
      error: "Symbol version was not found."
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts only the fully resolved exact symbol", async () => {
    const resolved = symbol("version_3");
    const insert = vi.fn();
    const loader = createDrawingSymbolCatalogLoader({
      loadVersion: vi.fn().mockResolvedValue({ ok: true, data: resolved })
    });

    await expect(
      loader.loadForInsertion("version_3", insert)
    ).resolves.toEqual({ ok: true, symbol: resolved });
    expect(insert).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledWith(resolved);
  });

  it("keeps caches scoped to one editor loader", async () => {
    const loadVersion = vi
      .fn()
      .mockResolvedValue({ ok: true, data: symbol("version_4") });
    const firstEditor = createDrawingSymbolCatalogLoader({ loadVersion });
    const secondEditor = createDrawingSymbolCatalogLoader({ loadVersion });

    await firstEditor.load("version_4");
    await secondEditor.load("version_4");

    expect(loadVersion).toHaveBeenCalledTimes(2);
  });
});
