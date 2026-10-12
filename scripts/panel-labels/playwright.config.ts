import type { PlaywrightTestConfig } from "@playwright/test";
import placement from "../symbol-placement/playwright.config";
export default { ...placement, preserveOutput: "always",
  testMatch: ["drawing-panel-labels.spec.ts"] } satisfies PlaywrightTestConfig;
