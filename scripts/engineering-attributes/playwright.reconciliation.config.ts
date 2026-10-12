import type { PlaywrightTestConfig } from "@playwright/test";
import regression from "./playwright.regression.config";

export default {
  ...regression,
  preserveOutput: "always",
  testMatch: [
    ...(Array.isArray(regression.testMatch) ? regression.testMatch : []),
    "drawing-canvas-toolbar.spec.ts",
    "drawing-settings-dialog.spec.ts",
    "drawing-panel-labels.spec.ts"
  ]
} satisfies PlaywrightTestConfig;
