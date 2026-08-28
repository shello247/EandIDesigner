import type { PanelWiringSourcePackage } from "@/features/drawing_panel_wiring/api/contracts";
import type { PanelEngineeringSnapshot } from "@/features/drawing_panel_wiring/api/public";

export type DrawingPanelEngineeringSnapshotCache = {
  getOrCreate: (
    source: PanelWiringSourcePackage,
    create: () => PanelEngineeringSnapshot
  ) => PanelEngineeringSnapshot;
};

export function createDrawingPanelEngineeringSnapshotCache():
  DrawingPanelEngineeringSnapshotCache {
  // The current source is the only snapshot that presentation changes need to
  // reuse. Retaining one entry also prevents undo history from indirectly
  // retaining a graph for every historical model.
  let cachedSource: PanelWiringSourcePackage | undefined;
  let cachedSnapshot: PanelEngineeringSnapshot | undefined;
  return {
    getOrCreate(source, create) {
      if (source === cachedSource && cachedSnapshot) return cachedSnapshot;
      const snapshot = create();
      cachedSource = source;
      cachedSnapshot = snapshot;
      return snapshot;
    }
  };
}
