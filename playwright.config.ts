import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
  webServer: {
    command: 'node tests/server.ts',
    url: 'http://localhost:4173/blank.html',
    reuseExistingServer: true,
  },
});
