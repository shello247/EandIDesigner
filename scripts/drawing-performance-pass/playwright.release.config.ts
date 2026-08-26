import type { PlaywrightTestConfig } from "@playwright/test";
import auditConfig from "./playwright.config";
import { drawingGateSpecs } from "./drawing-gate-scope";
import { resolveAuditConfiguration } from "../drawing-performance-audit/run-config.mjs";

// The caller must use the guarded runner, which supplies the isolated DB and mocks.
// Playwright refuses an existing listener; the nested runner also probes port3100.
export default {
  ...auditConfig,
  testMatch: drawingGateSpecs,
  webServer: {
    cwd: resolveAuditConfiguration().root,
    command: "node scripts/drawing-performance-audit/run-command.mjs server node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120000
  }
} satisfies PlaywrightTestConfig;
