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
  const snapshots = new WeakMap<PanelWiringSourcePackage, PanelEngineeringSnapshot>();
  return {
    getOrCreate(source, create) {
      const existing = snapshots.get(source);
      if (existing) return existing;
      const snapshot = create();
      snapshots.set(source, snapshot);
      return snapshot;
    }
  };
}
