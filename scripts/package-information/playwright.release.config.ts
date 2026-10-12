import type { PlaywrightTestConfig } from "@playwright/test";
import base from "./playwright.config";
import { drawingGateSpecs } from "../drawing-performance-pass/drawing-gate-scope";

// Retain the existing production gate and add the reconciled feature coverage.
// One worker, no retries, synthetic SQLite and guarded port 3121 in both browsers.
export default {
  ...base,
  testMatch: [...new Set([...base.testMatch, ...drawingGateSpecs])]
} satisfies PlaywrightTestConfig;
