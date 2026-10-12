import type { PlaywrightTestConfig } from "@playwright/test";
import base from "../device-classification/playwright.config";

// Inherit synthetic SQLite, source-drift receipts, one worker and guarded port 3121.
export default {
  ...base,
  testMatch: [
    ...base.testMatch,
    "drawing-package-information.spec.ts", "drawing-sections.spec.ts", "drawing-sheet-management.spec.ts",
    "drawing-panel-sheet.spec.ts", "drawing-title-sheet.spec.ts",
    "drawing-panel-assignment.spec.ts",
    "drawing-panel-connection-patterns.spec.ts", "drawing-panel-equipment-workbench.spec.ts",
    "drawing-panel-internal-wiring.spec.ts", "drawing-panel-terminal-mapping.spec.ts", "drawing-terminal-block-group.spec.ts"
  ]
} satisfies PlaywrightTestConfig;
