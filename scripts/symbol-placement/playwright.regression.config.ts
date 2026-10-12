import type { PlaywrightTestConfig } from "@playwright/test";
import placement from "./playwright.config";

// Focused cross-feature guard: catalogue details/documents, attributes and BOM.
// Inherits synthetic storage, port3121, one worker and both browser engines.
export default {
  ...placement,
  testMatch: ["bom-creator.spec.ts", "item-engineering.spec.ts", "item-attributes.spec.ts"],
  grep: /creates symbol mini BOM items|tabs, draft preservation, section saves|conditional ratings and terminal conductor limits/
} satisfies PlaywrightTestConfig;
