import { describe, expect, it } from "vitest";
import { sidebarPrefetchPolicy } from "../../src/app/app-sidebar";

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
    "/networking",
    "/bom",
    "/bom/items"
  ])("retains the default navigation policy outside an editor at %s", (pathname) => {
    expect(sidebarPrefetchPolicy(pathname)).toBeUndefined();
  });
});
