import type { PlaywrightTestConfig } from "@playwright/test";
import placement from "../symbol-placement/playwright.config";

// Inherit fail-closed synthetic SQLite, source-drift receipts, one worker,
// Chromium/Firefox, and occupied-port protection on 127.0.0.1:3121.
export default {
  ...placement,
  testMatch: [
    "drawing-settings-dialog.spec.ts", "drawing-projects.spec.ts",
    "drawing-canvas-toolbar.spec.ts", "drawing-canvas.spec.ts",
    "drawing-guides.spec.ts", "drawing-cursor-placement.spec.ts",
    "drawing-title-sheet.spec.ts", "drawing-connected-wire-schedule.spec.ts",
    "drawing-sections.spec.ts", "drawing-panel-sheet.spec.ts"
  ]
} satisfies PlaywrightTestConfig;
