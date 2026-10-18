import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  webServer: [
    {
      command: "pnpm dev --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      env: { VITE_API_URL: "ws://127.0.0.1:65531/rpc" },
      reuseExistingServer: false,
    },
    {
      command: "tsx tests/support/sync-server.ts 65533",
      port: 65533,
      reuseExistingServer: false,
    },
  ],
})
