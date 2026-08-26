import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearDrawingPerformanceSamples,
  getDrawingPerformanceInvocations,
  getDrawingPerformanceSamples,
  measureDrawingOperation,
  updateDrawingPerformanceContext
} from "../logic/services/drawing-performance-diagnostics";

describe("drawing performance diagnostics", () => {
  afterEach(() => {
    globalThis.__EI_DRAWING_PERFORMANCE_ENABLED__ = undefined;
    globalThis.__EI_DRAWING_PERFORMANCE_CONTEXT__ = undefined;
    clearDrawingPerformanceSamples();
    vi.restoreAllMocks();
  });
  it("has no timing or allocation work while disabled", () => {
    const now = vi.spyOn(performance, "now");
    expect(measureDrawingOperation("panel.graph", () => "same")).toBe("same");
    expect(now).not.toHaveBeenCalled();
    expect(globalThis.__EI_DRAWING_PERFORMANCE_SAMPLES__).toBeUndefined();
    expect(globalThis.__EI_DRAWING_PERFORMANCE_COUNTS__).toBeUndefined();
    updateDrawingPerformanceContext({ revision: "edit:1" });
    expect(globalThis.__EI_DRAWING_PERFORMANCE_CONTEXT__).toBeUndefined();
  });
  it("bounds samples and aggregates invocations with action correlation", () => {
    globalThis.__EI_DRAWING_PERFORMANCE_ENABLED__ = true;
    globalThis.__EI_DRAWING_PERFORMANCE_CONTEXT__ = {
      actionId: "select:1", revision: "edit:4"
    };
    updateDrawingPerformanceContext({ revision: "edit:5" });
    for (let index = 0; index < 405; index += 1) {
      measureDrawingOperation("panel.graph", () => index, { sheets: 40 });
    }
    const samples = getDrawingPerformanceSamples();
    expect(samples).toHaveLength(400);
    expect(samples.at(-1)?.attributes).toMatchObject({
      actionId: "select:1", revision: "edit:5", sheets: 40
    });
    expect(getDrawingPerformanceInvocations()["panel.graph"]?.count).toBe(405);
    const copy = getDrawingPerformanceInvocations();
    copy["panel.graph"]!.count = 0;
    expect(getDrawingPerformanceInvocations()["panel.graph"]?.count).toBe(405);
  });
});
