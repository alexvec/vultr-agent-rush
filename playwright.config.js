import { defineConfig } from '@playwright/test';

const external = process.env.DEMO_BASE_URL;
const slowMo = Number(process.env.DEMO_SLOW_MS || 0);

export default defineConfig({
  testDir: 'e2e',
  timeout: 240_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: external || 'http://127.0.0.1:8099',
    viewport: { width: 1280, height: 800 },
    launchOptions: { slowMo },
    video: process.env.DEMO_VIDEO ? 'on' : 'off',
  },
  webServer: external ? undefined : {
    command: 'node src/serve.js',
    url: 'http://127.0.0.1:8099/healthz',
    reuseExistingServer: false,
    env: { PORT: '8099', PADDED_CELL_POSTS_PER_MINUTE: '60' },
  },
});
