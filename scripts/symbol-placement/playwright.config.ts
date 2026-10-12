import type { PlaywrightTestConfig } from "@playwright/test";
import base from "../symbol-authoring/playwright.config";
import { resolveAuditConfiguration } from "../drawing-performance-audit/run-config.mjs";

export default {
  ...base,
  testMatch: [
    "drawing-cursor-placement.spec.ts", "drawing-canvas.spec.ts",
    "drawing-existing-panel.spec.ts", "drawing-panel-assignment.spec.ts",
    "drawing-panel-connection-reference.spec.ts", "drawing-terminal-block-group.spec.ts",
    "drawing-terminal-strip-destination-copy.spec.ts", "drawing-terminal-strip-member-attributes.spec.ts",
    "drawing-terminal-strip-reuse.spec.ts", "drawing-connected-wire-schedule.spec.ts",
    "drawing-connected-wire-schedule-pagination.spec.ts", "drawing-panel-equipment-workbench.spec.ts"
  ],
  workers: 1,
  use: { ...base.use, baseURL: "http://127.0.0.1:3121" },
  webServer: {
    cwd: resolveAuditConfiguration().root,
    command: "node scripts/drawing-performance-audit/run-command.mjs placement-server node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3121",
    url: "http://127.0.0.1:3121",
    reuseExistingServer: false,
    timeout: 120000
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } }
  ]
} satisfies PlaywrightTestConfig;
