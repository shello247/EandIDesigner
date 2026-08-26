import type { PlaywrightTestConfig } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { resolveAuditConfiguration, assertAuditDatabase } from "../drawing-performance-audit/run-config.mjs";

const configuration = resolveAuditConfiguration();
assertAuditDatabase(configuration);
// Resolve the selected checkout's device profile without loading a second test
// runner instance when this reusable config is invoked from a recovery checkout.
const selectedRequire = createRequire(path.join(configuration.root, "package.json"));
const { devices } = selectedRequire("playwright-core") as typeof import("playwright-core");
// Workers re-import configuration after the parent creates its output directory.
if (process.env.TEST_WORKER_INDEX === undefined &&
    (fs.existsSync(path.join(configuration.output, "correctness.json")) ||
     fs.existsSync(path.join(configuration.output, "correctness-traces")))) {
  throw new Error("Browser evidence already exists; choose a unique AUDIT_PHASE");
}
export default {
  testDir: path.join(configuration.root, "tests/e2e"),
  testMatch: "drawing-*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.join(configuration.output, "correctness-traces"),
  reporter: [["line"], ["json", { outputFile: path.join(configuration.output, "correctness.json") }]],
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" }
} satisfies PlaywrightTestConfig;
