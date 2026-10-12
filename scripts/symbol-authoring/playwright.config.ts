import type { PlaywrightTestConfig } from "@playwright/test";
import releaseConfig from "../drawing-performance-pass/playwright.release.config";
import { resolveAuditConfiguration } from "../drawing-performance-audit/run-config.mjs";

// Reuse isolated database, source-drift, single-worker and retained-trace guards.
export default {
  ...releaseConfig,
  testMatch: ["symbol-authoring.spec.ts", "network-symbol-authoring.spec.ts"],
  use: { ...releaseConfig.use, baseURL: "http://127.0.0.1:3120" },
  webServer: {
    cwd: resolveAuditConfiguration().root,
    command: "node scripts/drawing-performance-audit/run-command.mjs symbol-server node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3120",
    url: "http://127.0.0.1:3120",
    reuseExistingServer: false,
    timeout: 120000
  }
} satisfies PlaywrightTestConfig;
