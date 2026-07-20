import type { SymbolMetadata, ValidationIssue } from "../../data/schema";

export function validateNetworkProfile(
  metadata: SymbolMetadata
): ValidationIssue[] {
  if (metadata.category !== "network_device" || !metadata.networkProfile) {
    return [];
  }

  if (metadata.networkProfile.ports.length > 0) {
    return [];
  }

  return [
    {
      severity: "blocking",
      code: "NETWORK_PORT_REQUIRED",
      message: "Approved network devices require at least one valid network port.",
      path: "metadata.networkProfile.ports"
    }
  ];
}
