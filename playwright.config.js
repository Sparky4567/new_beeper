import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4173" },
  webServer: {
    command: process.env.SQLITE_E2E
      ? "SQLITE_PATH=/tmp/beeper-e2e.sqlite bun server/index.js"
      : "npm run preview -- --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI && !process.env.SQLITE_E2E,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
