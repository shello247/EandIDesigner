import type { ApprovedDrawingSymbol } from "../../types";
import type { DrawingSymbolCatalogSummary } from "@/features/symbol_registry/api/public";

export type DrawingSymbolVersionActionResult =
  | { ok: true; data: ApprovedDrawingSymbol }
  | { ok: false; error: string };

export type DrawingSymbolCatalogLoadResult =
  | { ok: true; symbol: ApprovedDrawingSymbol }
  | { ok: false; error: string };

export type DrawingSymbolCatalogLoader = {
  peek: (versionId: string) => ApprovedDrawingSymbol | undefined;
  load: (versionId: string) => Promise<DrawingSymbolCatalogLoadResult>;
  retry: (versionId: string) => Promise<DrawingSymbolCatalogLoadResult>;
  loadForInsertion: (
    versionId: string,
    insert: (symbol: ApprovedDrawingSymbol) => void
  ) => Promise<DrawingSymbolCatalogLoadResult>;
};

export type DrawingSymbolDependencyClosureResult =
  | { ok: true; symbols: ApprovedDrawingSymbol[] }
  | { ok: false; error: string };

const UNAVAILABLE_SYMBOL_MESSAGE =
  "The requested symbol version could not be loaded.";

export function createDrawingSymbolCatalogLoader({
  loadVersion
}: {
  loadVersion: (
    versionId: string
  ) => Promise<DrawingSymbolVersionActionResult>;
}): DrawingSymbolCatalogLoader {
  const resolved = new Map<string, ApprovedDrawingSymbol>();
  const inFlight = new Map<
    string,
    Promise<DrawingSymbolCatalogLoadResult>
  >();

  const load = (
    versionId: string
  ): Promise<DrawingSymbolCatalogLoadResult> => {
    const cached = resolved.get(versionId);
    if (cached) return Promise.resolve({ ok: true, symbol: cached });

    const pending = inFlight.get(versionId);
    if (pending) return pending;

    const request: Promise<DrawingSymbolCatalogLoadResult> = loadVersion(
      versionId
    )
      .then((result): DrawingSymbolCatalogLoadResult => {
        if (!result.ok) return result;
        if (result.data.versionId !== versionId) {
          return { ok: false, error: UNAVAILABLE_SYMBOL_MESSAGE };
        }

        resolved.set(versionId, result.data);
        return { ok: true, symbol: result.data };
      })
      .catch(
        (): DrawingSymbolCatalogLoadResult => ({
          ok: false,
          error: "Unable to load the symbol version. Try again."
        })
      );

    inFlight.set(versionId, request);
    void request.finally(() => {
      if (inFlight.get(versionId) === request) {
        inFlight.delete(versionId);
      }
    });
    return request;
  };

  const retry = (versionId: string) => {
    resolved.delete(versionId);
    return load(versionId);
  };

  return {
    peek: (versionId) => resolved.get(versionId),
    load,
    retry,
    loadForInsertion: async (versionId, insert) => {
      const result = await load(versionId);
      if (result.ok) insert(result.symbol);
      return result;
    }
  };
}

function allowedComponentSymbolIds(symbol: ApprovedDrawingSymbol): string[] {
  return [
    ...new Set(
      (symbol.metadata.componentPositions ?? []).flatMap((position) =>
        position.components.flatMap((component) => component.allowedSymbolIds)
      )
    )
  ];
}

export async function loadDrawingSymbolDependencyClosure({
  versionIds,
  existingSymbols,
  catalogueSummaries,
  loader
}: {
  versionIds: readonly string[];
  existingSymbols: readonly ApprovedDrawingSymbol[];
  catalogueSummaries: readonly DrawingSymbolCatalogSummary[];
  loader: DrawingSymbolCatalogLoader;
}): Promise<DrawingSymbolDependencyClosureResult> {
  const existingByVersionId = new Map(
    existingSymbols.map((symbol) => [symbol.versionId, symbol])
  );
  const catalogueVersionBySymbolId = new Map(
    catalogueSummaries.map((summary) => [summary.symbolId, summary.versionId])
  );
  const queuedVersionIds = new Set<string>();
  const resolved: ApprovedDrawingSymbol[] = [];
  let wave = [...new Set(versionIds)];

  for (const versionId of wave) queuedVersionIds.add(versionId);

  while (wave.length > 0) {
    const results = await Promise.all(
      wave.map(async (versionId) => {
        const existing = existingByVersionId.get(versionId);
        return existing
          ? ({ ok: true, symbol: existing } as const)
          : loader.load(versionId);
      })
    );
    const failed = results.find((result) => !result.ok);
    if (failed && !failed.ok) return failed;

    const nextWave: string[] = [];
    for (const result of results) {
      if (!result.ok) continue;
      resolved.push(result.symbol);
      existingByVersionId.set(result.symbol.versionId, result.symbol);

      for (const symbolId of allowedComponentSymbolIds(result.symbol)) {
        const versionId = catalogueVersionBySymbolId.get(symbolId);
        if (!versionId || queuedVersionIds.has(versionId)) continue;
        queuedVersionIds.add(versionId);
        nextWave.push(versionId);
      }
    }
    wave = nextWave;
  }

  return { ok: true, symbols: resolved };
}
