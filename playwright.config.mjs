import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: ['visual-discoveries.e2e.spec.mjs','notices-simplicity.e2e.spec.mjs','rewards-simplicity.e2e.spec.mjs','brief-completo.e2e.spec.mjs','simplicidade.e2e.spec.mjs','restoration-school.e2e.spec.mjs','creations.e2e.spec.mjs','npc-publication.e2e.spec.mjs','restoration.e2e.spec.mjs','auth-origin.e2e.spec.mjs','visual-media.e2e.spec.mjs','office-quick.e2e.spec.mjs','collection-drafts.e2e.spec.mjs','publication-drafts.e2e.spec.mjs','content-drafts.e2e.spec.mjs','quick-create.e2e.spec.mjs','player-navigation.e2e.spec.mjs','cloud.e2e.spec.mjs','e2e.spec.mjs','workshop.e2e.spec.mjs','npcs.e2e.spec.mjs','items.e2e.spec.mjs','campaign.e2e.spec.mjs','quest-operations.e2e.spec.mjs','documents.e2e.spec.mjs','world.e2e.spec.mjs','commerce.e2e.spec.mjs','library.e2e.spec.mjs','school.e2e.spec.mjs','boards.e2e.spec.mjs','cup.e2e.spec.mjs','collections.e2e.spec.mjs','chocolate.e2e.spec.mjs','mail.e2e.spec.mjs','journal.e2e.spec.mjs','yearbooks.e2e.spec.mjs','investigations.e2e.spec.mjs','archives.e2e.spec.mjs'], workers: 1, timeout: 90_000,
  reporter: [['line']],
  use: { actionTimeout:15_000, browserName: 'chromium', headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium', args: ['--no-sandbox'] },
    trace: 'retain-on-failure' }
});
