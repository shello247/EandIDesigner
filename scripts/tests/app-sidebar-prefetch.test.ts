import { describe, expect, it } from "vitest";
import {
  panelAnalysisSidebarHref,
  sidebarPrefetchPolicy
} from "../../src/app/app-sidebar";

describe("drawing-scoped sidebar prefetch", () => {
  it.each([
    "/drawings/drawing_1",
    "/drawings/cmrp7wbpx000buoqojvnguwqk"
  ])("disables automatic sidebar prefetch in editor path %s", (pathname) => {
    expect(sidebarPrefetchPolicy(pathname)).toBe(false);
  });

  it.each([
    "/drawings",
    "/drawings/new",
    "/symbols",
    "/bom",
    "/bom/items"
  ])("retains the default navigation policy outside an editor at %s", (pathname) => {
    expect(sidebarPrefetchPolicy(pathname)).toBeUndefined();
  });
});

describe("Panel Analysis sidebar destination", () => {
  it("links an exact drawing editor route to that drawing's analysis", () => {
    expect(panelAnalysisSidebarHref("/drawings/drawing_1")).toBe(
      "/panel-analysis/drawing_1"
    );
  });

  it.each([
    "/drawings",
    "/drawings/new",
    "/projects/project_1",
    "/panel-analysis/drawing_1"
  ])("links non-editor route %s to the bounded selector", (pathname) => {
    expect(panelAnalysisSidebarHref(pathname)).toBe("/panel-analysis");
  });
});
