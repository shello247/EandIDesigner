import { listComponentAlternativeCandidates } from "../data/queries";
import type { SymbolMetadata } from "@/features/symbol_registry/api/public";
import { validateSymbolComponentDefinitions } from "../logic/services/component-definition-validator";

export { listComponentAlternativeCandidates };

export async function validateRegisteredSymbolComponents(
  parentSymbolId: string,
  metadata: SymbolMetadata
) {
  return validateSymbolComponentDefinitions({
    parentSymbolId,
    metadata,
    candidates: await listComponentAlternativeCandidates()
  });
}
