import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 1,
  workers: 1,  // Sequential — shares test DB
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 720 },
        browserName: 'chromium',
      },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 375, height: 667 },
        browserName: 'chromium',
        isMobile: true,
      },
    },
  ],
});
