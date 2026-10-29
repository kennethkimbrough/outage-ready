import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve.mjs 4173",
    url: "http://localhost:4173/",
    reuseExistingServer: true,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], serviceWorkers: "allow" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1200, height: 900 } } },
  ],
});
