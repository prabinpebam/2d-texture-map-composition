import { defineConfig } from '@playwright/test'

const publishedUrl = process.env.PAGES_URL
const localUrl = 'http://127.0.0.1:4175/2d-texture-map-composition/'

export default defineConfig({
  testDir: './tests/pages',
  fullyParallel: false,
  outputDir: './test-results/pages',
  preserveOutput: 'always',
  reporter: 'line',
  use: {
    baseURL: publishedUrl ?? localUrl,
    browserName: 'chromium',
    channel: process.env.CI ? undefined : 'msedge',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  webServer: publishedUrl
    ? undefined
    : {
        command:
          'npm run preview -- --host 127.0.0.1 --port 4175 --strictPort --base=/2d-texture-map-composition/',
        url: localUrl,
        reuseExistingServer: false,
      },
})
