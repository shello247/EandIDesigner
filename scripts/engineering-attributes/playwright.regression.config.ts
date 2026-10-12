import type { PlaywrightTestConfig } from "@playwright/test";
import config from "./playwright.config";
export default {...config,testMatch:[
  "engineering-attribute-workflow.spec.ts",
  "drawing-save-acknowledgment.spec.ts",
  "drawing-panel-analysis.spec.ts",
  "drawing-terminal-strip-member-attributes.spec.ts",
  "drawing-terminal-strip-reuse.spec.ts",
  "drawing-panel-component-placement.spec.ts",
  "drawing-pdf-preview.spec.ts",
  "bom-creator-reliability.spec.ts"
]} satisfies PlaywrightTestConfig;
