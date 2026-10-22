import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: ['e2e.spec.mjs','workshop.e2e.spec.mjs','npcs.e2e.spec.mjs','items.e2e.spec.mjs','campaign.e2e.spec.mjs','quest-operations.e2e.spec.mjs','documents.e2e.spec.mjs','world.e2e.spec.mjs','commerce.e2e.spec.mjs','library.e2e.spec.mjs','school.e2e.spec.mjs','boards.e2e.spec.mjs','cup.e2e.spec.mjs','collections.e2e.spec.mjs','chocolate.e2e.spec.mjs','mail.e2e.spec.mjs','journal.e2e.spec.mjs','yearbooks.e2e.spec.mjs','investigations.e2e.spec.mjs','archives.e2e.spec.mjs'], workers: 1, timeout: 90_000,
  reporter: [['line']],
  use: { browserName: 'chromium', headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium', args: ['--no-sandbox'] },
    trace: 'retain-on-failure' }
});
