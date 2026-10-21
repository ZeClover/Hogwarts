import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: ['e2e.spec.mjs','workshop.e2e.spec.mjs','npcs.e2e.spec.mjs','items.e2e.spec.mjs','campaign.e2e.spec.mjs'], workers: 1, timeout: 90_000,
  reporter: [['line']],
  use: { browserName: 'chromium', headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium', args: ['--no-sandbox'] },
    trace: 'retain-on-failure' }
});
