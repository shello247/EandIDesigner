import type { PlaywrightTestConfig } from "@playwright/test";
import itemConfig from "../item-engineering/playwright.config";

// The existing isolated Item/Symbol harness binds only 3120, never live 3000.
export default {
  ...itemConfig,
  testMatch: [...itemConfig.testMatch,
    "drawing-save-acknowledgment.spec.ts", "drawing-pdf-preview.spec.ts"]
} satisfies PlaywrightTestConfig;
