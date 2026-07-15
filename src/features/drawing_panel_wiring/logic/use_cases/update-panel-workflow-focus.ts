import { z } from "zod";
import {
  panelWiringSourcePackageSchema,
  type PanelWiringSourcePackage
} from "../../data/schema";
import type {
  PanelConnectivityFinding,
  PanelWiringCommandResult
} from "../../types";
import { buildPackageConnectivityGraph } from "../services/connectivity-graph";

const inputSchema = z.object({
  sheetId: z.string().trim().min(1),
  assetId: z.string().trim().min(1)
});

function errorResult(
  code: string,
  message: string,
  details: Partial<PanelConnectivityFinding> = {}
): PanelWiringCommandResult {
  return {
    mutations: [],
    warnings: [
      {
        id: `workflow-focus:${code}`,
        severity: "error",
        code,
        message,
        ...details
      }
    ],
    affectedIds: []
  };
}

export function updatePanelWorkflowFocus(
  inputSource: PanelWiringSourcePackage,
  input: { sheetId: string; assetId: string }
): PanelWiringCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const parsed = inputSchema.parse(input);
  const sheet = source.sheets.find((candidate) => candidate.id === parsed.sheetId);
  const context = sheet?.panelDrawingContext;

  if (!sheet) {
    return errorResult("missing_sheet", "The Detailed Panel Drawing is not available.");
  }
  if (!context) {
    return errorResult(
      "missing_panel_context",
      "The sheet is not associated with a panel or enclosure."
    );
  }

  const graph = buildPackageConnectivityGraph(source);
  if (!graph.assetsById.has(parsed.assetId)) {
    return errorResult("missing_focus_asset", "The selected panel asset is no longer available.", {
      panelAssetId: context.panelAssetId,
      assetId: parsed.assetId
    });
  }
  if (
    !graph.assetIdsByPanelAssetId
      .get(context.panelAssetId)
      ?.has(parsed.assetId)
  ) {
    return errorResult(
      "focus_asset_outside_panel",
      "The selected asset is not associated with this panel.",
      { panelAssetId: context.panelAssetId, assetId: parsed.assetId }
    );
  }
  if (context.workflowFocusAssetId === parsed.assetId) {
    return { mutations: [], warnings: [], affectedIds: [] };
  }

  return {
    mutations: [
      {
        kind: "set-panel-context",
        sheetId: parsed.sheetId,
        context: {
          ...context,
          workflowFocusAssetId: parsed.assetId
        }
      }
    ],
    warnings: [],
    affectedIds: [parsed.sheetId, context.panelAssetId, parsed.assetId]
  };
}
