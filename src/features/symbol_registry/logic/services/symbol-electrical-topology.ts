import {
  symbolMetadataSchema,
  type SymbolElectricalTopology,
  type SymbolMetadata
} from "../../data/schema";

export type SymbolElectricalTopologyValidation = {
  valid: boolean;
  issues: string[];
  topology?: SymbolElectricalTopology;
};

export function validateSymbolElectricalTopology(
  metadata: SymbolMetadata
): SymbolElectricalTopologyValidation {
  const parsed = symbolMetadataSchema.safeParse(metadata);
  if (parsed.success) {
    return {
      valid: true,
      issues: [],
      topology: parsed.data.electricalTopology
    };
  }

  const issues = parsed.error.issues
    .filter((issue) => issue.path[0] === "electricalTopology")
    .map((issue) => issue.message);
  return {
    valid: issues.length === 0,
    issues,
    topology: issues.length === 0 ? metadata.electricalTopology : undefined
  };
}

export function symbolElectricalTopologySignature(
  topology: SymbolElectricalTopology | undefined
): string {
  if (!topology) return "none";
  return JSON.stringify({
    version: topology.version,
    permanentContinuityGroups: topology.permanentContinuityGroups
      .map((group) => ({
        key: group.key,
        label: group.label,
        terminalKeys: [...group.terminalKeys].sort((first, second) =>
          first.localeCompare(second, undefined, { numeric: true })
        )
      }))
      .sort((first, second) => first.key.localeCompare(second.key))
  });
}
