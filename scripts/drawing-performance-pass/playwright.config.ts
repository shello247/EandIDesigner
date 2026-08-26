import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { resolveAuditConfiguration, assertAuditDatabase } from "../drawing-performance-audit/run-config.mjs";

const configuration = resolveAuditConfiguration();
assertAuditDatabase(configuration);
export default defineConfig({
  testDir: "../../tests/e2e",
  testMatch: "drawing-*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.join(configuration.output, "correctness-traces"),
  reporter: [["line"], ["json", { outputFile: path.join(configuration.output, "correctness.json") }]],
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" }
});
