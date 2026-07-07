import { defineConfig, devices } from "@playwright/test";

process.env.DATABASE_URL ??= "file:./test-e2e.db";
process.env.OPENAI_TERMINAL_MAP_MOCK ??= "true";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev:e2e",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_URL: "file:./test-e2e.db",
      OPENAI_TERMINAL_MAP_MOCK: "true"
    }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
