import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  timeout: 30000,
  webServer: {
    command: 'python3 -m http.server 4173 --directory dist',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
    screenshot: 'only-on-failure',
    serviceWorkers: 'block'
  },
  reporter: 'list'
});
