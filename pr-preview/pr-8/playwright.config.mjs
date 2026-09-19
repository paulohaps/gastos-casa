import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/visual-smoke.spec.mjs',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block'
  },
  reporter: 'list'
});
