import { defineConfig } from "@playwright/test";

// This suite only searches/inspects existing pages; it never creates or saves data.
export default defineConfig({
  testDir: "../../tests/e2e",
  testMatch: "search-input.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: "list",
  outputDir: "../../artifacts/item-engineering-storage/search-input-browser",
  use: { baseURL: "http://127.0.0.1:3000", actionTimeout: 10000, trace: "retain-on-failure" }
});
