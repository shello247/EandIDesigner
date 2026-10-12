import type { PlaywrightTestConfig } from "@playwright/test";
import symbolConfig from "../symbol-authoring/playwright.config";
export default {
  ...symbolConfig,
  workers: 1,
  testMatch: ["item-attributes.spec.ts", "item-engineering.spec.ts", "bom-creator.spec.ts", "bom-creator-reliability.spec.ts", "bom-creator-scalability.spec.ts", "bom-creator-image-transport.spec.ts", "bom-item-ai-enrichment.spec.ts", "symbol-authoring.spec.ts", "network-symbol-authoring.spec.ts"]
} satisfies PlaywrightTestConfig;
