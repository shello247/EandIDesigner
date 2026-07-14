import {
  panelWiringSourcePackageSchema,
  type PanelWiringSourcePackage
} from "../../data/schema";
import type { PanelEngineeringSnapshot } from "../../types";
import { buildPackageConnectivityGraphFromValidatedSource } from "./connectivity-graph";

export function buildPanelEngineeringSnapshot(
  input: PanelWiringSourcePackage,
  revision = "unversioned"
): PanelEngineeringSnapshot {
  const source = panelWiringSourcePackageSchema.parse(input);

  return buildPanelEngineeringSnapshotFromValidatedSource(source, revision);
}

export function buildPanelEngineeringSnapshotFromValidatedSource(
  source: PanelWiringSourcePackage,
  revision = "unversioned"
): PanelEngineeringSnapshot {
  const graph = buildPackageConnectivityGraphFromValidatedSource(source);

  return {
    revision,
    source,
    graph,
    panelAssetIds: [...graph.panelAssetIds].sort()
  };
}
