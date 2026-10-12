import type { PlaywrightTestConfig } from "@playwright/test";
import isolated from "../symbol-authoring/playwright.config";
export default { ...isolated, testMatch: ["symbol-artwork.spec.ts"], workers: 1 } satisfies PlaywrightTestConfig;
