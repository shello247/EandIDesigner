import type { ApprovedDrawingSymbol } from "../../types";

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
