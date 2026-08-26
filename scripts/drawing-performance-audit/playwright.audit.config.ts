import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir:".",testMatch:"browser-audit.spec.ts",fullyParallel:false,workers:1,retries:0,
  outputDir:path.resolve("artifacts/drawing-performance/20260826-baseline/browser-"+(process.env.AUDIT_PHASE??"baseline")+"-test-results"),
  timeout:1200000,reporter:[["line"],["json",{outputFile:"artifacts/drawing-performance/20260826-baseline/browser-run-"+(process.env.AUDIT_PHASE??"baseline")+".json"}]],
  use:{...devices["Desktop Chrome"],baseURL:"http://127.0.0.1:3100",viewport:{width:1440,height:900},trace:"off",actionTimeout:15000},
});
