import { panelWiringSourcePackageSchema } from "../../data/schema";
import type { PanelConnectivityFinding } from "../../types";
import { buildPackageConnectivityGraph } from "./connectivity-graph";

export function validatePanelConnectivitySource(
  input: unknown
): PanelConnectivityFinding[] {
  const parsed = panelWiringSourcePackageSchema.safeParse(input);

  if (!parsed.success) {
    return parsed.error.issues.map((issue, index) => ({
      id: `invalid_source:${index}`,
      severity: "error" as const,
      code: "invalid_panel_wiring_source",
      message: `${issue.path.join(".") || "source"}: ${issue.message}`
    }));
  }

  return buildPackageConnectivityGraph(parsed.data).findings;
}
