import type { SymbolStatus } from "../../data/schema";

export function isSymbolVersionEditable(status: SymbolStatus): boolean {
  return status === "draft" || status === "needs_review";
}

export function assertSymbolVersionEditable(status: SymbolStatus): void {
  if (!isSymbolVersionEditable(status)) {
    throw new Error(
      `Symbol versions with status "${status}" have controlled artwork. Re-import the SVG to change its geometry.`
    );
  }
}
