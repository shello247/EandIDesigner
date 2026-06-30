import { validateSymbol } from "./validate-symbol";
import type { SymbolMetadata } from "../../data/schema";

export function canApproveSymbolVersion(svg: string, metadata: SymbolMetadata) {
  const result = validateSymbol(svg, metadata);

  return {
    ok: result.blockingIssueCount === 0,
    result
  };
}
