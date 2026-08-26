import { describe, expect, it, vi } from "vitest";
import { createGenericPanelWiringSource } from "@/features/drawing_panel_wiring/tests/fixtures";
import { buildPanelEngineeringSnapshotFromValidatedSource } from "@/features/drawing_panel_wiring/api/public";
import { createDrawingPanelEngineeringSnapshotCache } from "../logic/services/drawing-panel-engineering-snapshot-cache";

describe("editor panel engineering snapshot cache", () => {
  it("is lazy, reuses source identity, and invalidates a new source identity", () => {
    const cache = createDrawingPanelEngineeringSnapshotCache();
    const firstSource = createGenericPanelWiringSource();
    const secondSource = { ...firstSource };
    const build = vi.fn((source: typeof firstSource) =>
      buildPanelEngineeringSnapshotFromValidatedSource(source, "test")
    );
    expect(build).not.toHaveBeenCalled();
    const first = cache.getOrCreate(firstSource, () => build(firstSource));
    expect(cache.getOrCreate(firstSource, () => build(firstSource))).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);
    const second = cache.getOrCreate(secondSource, () => build(secondSource));
    expect(second).not.toBe(first);
    expect(build).toHaveBeenCalledTimes(2);
  });
});
