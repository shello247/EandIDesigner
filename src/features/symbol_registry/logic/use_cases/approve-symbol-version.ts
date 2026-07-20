import { validateSymbol } from "./validate-symbol";

export function canApproveSymbolVersion(svg: string, metadata: unknown) {
  const result = validateSymbol(svg, metadata);

  return {
    ok: result.blockingIssueCount === 0,
    result
  };
}
