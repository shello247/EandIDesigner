import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { resolveAuditConfiguration } from "./run-config.mjs";
const configuration = resolveAuditConfiguration();
const { output } = configuration;
export default defineConfig({
  testDir:".",testMatch:"browser-audit.spec.ts",fullyParallel:false,workers:1,retries:0,
  outputDir:path.join(output,"browser-"+(process.env.AUDIT_PHASE??"baseline")+"-test-results"),
  timeout:1200000,reporter:[["line"],["json",{outputFile:path.join(output,"browser-run-"+(process.env.AUDIT_PHASE??"baseline")+".json")}]],
  use:{...devices["Desktop Chrome"],baseURL:"http://127.0.0.1:3100",viewport:{width:1440,height:900},trace:"off",actionTimeout:15000},
  webServer:{
    cwd:configuration.root,
    command:"node scripts/drawing-performance-audit/run-command.mjs server node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
    url:"http://127.0.0.1:3100",reuseExistingServer:false,timeout:120000
  }
});
