import type { PlaywrightTestConfig } from "@playwright/test";
import regression from "../canvas-toolbar/playwright.config";
export default { ...regression, preserveOutput: "always",
  testMatch: [...regression.testMatch, "drawing-panel-labels.spec.ts"]
} satisfies PlaywrightTestConfig;
