import { describe, expect, it } from "vitest";

describe("repository protection acceptance", () => {
  it("deliberately fails so protected main rejects this pull request", () => {
    expect("failing-check").toBe("passing-check");
  });
});
