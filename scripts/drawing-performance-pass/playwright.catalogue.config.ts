import type { PlaywrightTestConfig } from "@playwright/test";
import path from "node:path";
import auditConfig from "../drawing-performance-audit/playwright.audit.config";
import { resolveAuditConfiguration } from "../drawing-performance-audit/run-config.mjs";

const configuration = resolveAuditConfiguration();
const phase = process.env.AUDIT_PHASE ?? "catalogue";

export default {
  ...auditConfig,
  testDir: configuration.root,
  testMatch: "scripts/drawing-performance-pass/catalogue-payload.spec.ts",
  outputDir: path.join(
    configuration.output,
    `catalogue-${phase}-test-results`
  ),
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: path.join(
          configuration.output,
          `catalogue-${phase}.json`
        )
      }
    ]
  ]
} satisfies PlaywrightTestConfig;
