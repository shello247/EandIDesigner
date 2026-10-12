import type { PlaywrightTestConfig } from "@playwright/test";
import isolatedConfig from "../symbol-authoring/playwright.config";
export default { ...isolatedConfig, testMatch: ["drawing-title-sheet.spec.ts"], workers: 1 } satisfies PlaywrightTestConfig;
