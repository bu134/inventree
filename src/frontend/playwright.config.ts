import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  timeout: 90000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'desktop_chromium',
      grepInvert: /.*screenshots.spec.ts/,
      use: {
        ...devices['Desktop Chrome']
      }
    },
    {
      name: 'desktop_firefox',
      grepInvert: /.*screenshots.spec.ts/,
      use: {
        ...devices['Desktop Firefox']
      }
    },
    {
      name: 'screenshot',
      grep: /.*screenshots.spec.ts/,
      use: {
        ...devices['Desktop Firefox']
      }
    }
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'yarn run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120 * 1000
    },
    {
      command: 'invoke dev.server -a 127.0.0.1:8000',
      env: {
        INVENTREE_DEBUG: 'True',
        INVENTREE_PLUGINS_ENABLED: 'True'
      },
      url: 'http://127.0.0.1:8000/api/',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120 * 1000
    }
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry'
  }
});
