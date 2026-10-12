import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'packages/addin/e2e',
  timeout: 30000,
  use: { baseURL: 'http://localhost:3000', launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined } },
  webServer: [
    { command: 'DATA_FILE=data/e2e-history.json npm run dev:server', url: 'http://localhost:4000/api/health', reuseExistingServer: !process.env.CI },
    { command: 'E2E=1 npm run dev:addin', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI },
  ],
});
