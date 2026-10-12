import type { PlaywrightTestConfig } from "@playwright/test";
import path from "node:path";
import base from "../symbol-placement/playwright.config";
import { resolveAuditConfiguration } from "../drawing-performance-audit/run-config.mjs";
export default {
  ...base,
  globalSetup: path.join(resolveAuditConfiguration().root, "scripts/device-classification/prepare-fixtures.ts"),
  testMatch: [
    "device-classification.spec.ts", "drawing-settings-dialog.spec.ts", "drawing-panel-labels.spec.ts",
    "drawing-cursor-placement.spec.ts", "drawing-canvas.spec.ts", "drawing-canvas-toolbar.spec.ts",
    "drawing-panel-component-placement.spec.ts", "drawing-terminal-strip-member-attributes.spec.ts",
    "drawing-terminal-strip-reuse.spec.ts", "drawing-save-acknowledgment.spec.ts",
    "drawing-panel-analysis.spec.ts", "drawing-pdf-preview.spec.ts",
    "bom-creator-reliability.spec.ts", "engineering-attribute-workflow.spec.ts"
  ],
  use: { ...base.use, launchOptions: {
    // Keep browser-native temporary downloads below Windows path-length limits.
    // Retained receipts are still copied into each guarded test evidence folder.
    downloadsPath: path.join(resolveAuditConfiguration().root, "artifacts/device-classification-tests/downloads")
  } }
} satisfies PlaywrightTestConfig;
