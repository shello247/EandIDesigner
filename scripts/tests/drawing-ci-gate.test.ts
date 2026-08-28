import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAuditConfiguration } from "../drawing-performance-audit/run-config.mjs";
import { drawingGateSpecs } from "../drawing-performance-pass/drawing-gate-scope";

const ciEnvironment = {
  GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "shello247/EandIDesigner",
  GITHUB_WORKSPACE: process.cwd(), GITHUB_RUN_ID: "12345", GITHUB_RUN_ATTEMPT: "2"
};

describe("production drawing CI gate boundaries", () => {
  it("resolves only a run-specific synthetic SQLite file inside the checkout", () => {
    const config = resolveAuditConfiguration(process.cwd(), "ci-contract", ciEnvironment);
    expect(config.database).toBe(path.join(process.cwd(), "prisma/test-drawing-ci-12345-2.db"));
    expect(config.output).toBe(path.join(process.cwd(), "artifacts/drawing-performance/ci/12345-2/ci-contract"));
    expect(config.databaseUrl).toBe(`file:${config.database.replaceAll("\\", "/")}`);
    expect(resolveAuditConfiguration(process.cwd(), "ci-contract", {
      ...ciEnvironment, GITHUB_RUN_ATTEMPT: "3"
    }).database).not.toBe(config.database);
  });

  it.each([
    { GITHUB_REPOSITORY: "other/repository" },
    { GITHUB_WORKSPACE: path.resolve(process.cwd(), "..") },
    { GITHUB_RUN_ID: "../escape" },
    { GITHUB_RUN_ATTEMPT: "0" },
    { GITHUB_RUN_ID: "" }
  ])("rejects invalid CI identity %j before database access", (invalid) => {
    expect(() => resolveAuditConfiguration(process.cwd(), "ci-contract", {
      ...ciEnvironment, ...invalid
    })).toThrow("Explicit GitHub checkout and numeric run identity required");
  });

  it("rejects an escaped output phase even on an approved CI checkout", () => {
    expect(() => resolveAuditConfiguration(process.cwd(), "../escape", ciEnvironment)).toThrow("Invalid audit phase");
  });

  it("retains every audited workflow as a distinct existing spec", () => {
    expect(drawingGateSpecs).toHaveLength(26);
    expect(new Set(drawingGateSpecs).size).toBe(drawingGateSpecs.length);
    for (const spec of drawingGateSpecs) {
      expect(spec).toMatch(/^drawing-[a-z-]+\.spec\.ts$/);
      expect(fs.existsSync(path.join(process.cwd(), "tests/e2e", spec))).toBe(true);
      expect(fs.readFileSync(path.join(process.cwd(), "tests/e2e", spec), "utf8"))
        .toContain('from "./drawing-test"');
    }
    expect(drawingGateSpecs).toContain("drawing-panel-assignment.spec.ts");
    expect(drawingGateSpecs).toContain("drawing-panel-internal-wiring.spec.ts");
    expect(drawingGateSpecs).toContain("drawing-wire-hit-testing.spec.ts");
  });
});
