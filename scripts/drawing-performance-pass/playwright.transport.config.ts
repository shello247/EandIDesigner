import type { PlaywrightTestConfig } from "@playwright/test";
import path from "node:path";
import auditConfig from "../drawing-performance-audit/playwright.audit.config";
import { resolveAuditConfiguration } from "../drawing-performance-audit/run-config.mjs";

const configuration = resolveAuditConfiguration();
const phase = process.env.AUDIT_PHASE ?? "transport";

export default {
  ...auditConfig,
  testDir: configuration.root,
  testMatch: "scripts/drawing-performance-pass/save-transport.spec.ts",
  outputDir: path.join(configuration.output, `transport-${phase}-test-results`),
  reporter: "line"
} satisfies PlaywrightTestConfig;
