import { realpathSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { standardsTestDirectory } from "./test-database";

describe("Standards synthetic database boundary", () => {
  const root = realpathSync(process.cwd());
  const ci = {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "shello247/EandIDesigner",
    GITHUB_WORKSPACE: root,
    GITHUB_RUN_ID: "123",
    GITHUB_RUN_ATTEMPT: "1"
  };
  it("accepts the exact guarded checkout and retains its artifact directory", () => {
    expect(standardsTestDirectory(root, ci)).toBe(path.join(root, "artifacts", "standards-assurance", "tests"));
  });
  it("rejects a bare CI flag", () => {
    expect(() => standardsTestDirectory(root, { GITHUB_ACTIONS: "true" })).toThrow("Explicit GitHub checkout");
  });
  it("rejects another repository or workspace", () => {
    expect(() => standardsTestDirectory(root, { ...ci, GITHUB_REPOSITORY: "unrelated/repository" })).toThrow("Explicit GitHub checkout");
    expect(() => standardsTestDirectory(root, { ...ci, GITHUB_WORKSPACE: path.dirname(root) })).toThrow("Explicit GitHub checkout");
  });
  it("requires numeric run identity", () => {
    expect(() => standardsTestDirectory(root, { ...ci, GITHUB_RUN_ID: "" })).toThrow("numeric run identity");
  });
});
