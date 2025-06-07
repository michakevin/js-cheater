import { defineConfig } from 'playwright/test';

export default defineConfig({
  use: {
    headless: true,
  },
  testDir: 'tests/e2e'
});
