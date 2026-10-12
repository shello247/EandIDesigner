import type { PlaywrightTestConfig } from "@playwright/test";
import auditConfig from "../drawing-performance-pass/playwright.config";
import { resolveAuditConfiguration } from "../drawing-performance-audit/run-config.mjs";
export default {
  ...auditConfig, testMatch: "engineering-attribute-workflow.spec.ts", timeout: 60000,
  use:{...auditConfig.use,actionTimeout:15000},
  webServer: { cwd: resolveAuditConfiguration().root,
    command: "node scripts/drawing-performance-audit/run-command.mjs attribute-server node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",reuseExistingServer: false,timeout: 120000 }
} satisfies PlaywrightTestConfig;
