import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../../tests/e2e",
  testMatch: "standards-assurance.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "line",
  outputDir: "../../artifacts/standards-assurance/browser",
  use: { baseURL: "http://127.0.0.1:3120", actionTimeout: 15000, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: process.env.STANDARDS_EXISTING_TEST_SERVER === "1" ? undefined : {
    cwd: process.cwd(),
    command: "node scripts/standards-assurance/run.mjs server",
    url: "http://127.0.0.1:3120",
    reuseExistingServer: false,
    timeout: 120000
  }
});
