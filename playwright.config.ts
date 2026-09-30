import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4318);

// End-to-end tests run the production build through the real Node server.
// CHROMIUM_PATH lets you point at a preinstalled Chromium instead of `playwright install`.
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
  webServer: {
    // A build with a (test) checkout link, so the paid plan is on: free workouts, then the paywall.
    command: 'npx vite build && npx tsx server/index.ts',
    port: PORT,
    env: {
      PORT: String(PORT),
      ANTHROPIC_API_KEY: '',
      VITE_CHECKOUT_URL: 'https://track-ai-test.lemonsqueezy.com/buy/test',
      LEMONSQUEEZY_STORE_ID: '1',
      LEMONSQUEEZY_PRODUCT_ID: '1',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
