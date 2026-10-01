import { defineConfig } from '@playwright/test';

// Runs against the built site (npm run build), served as plain static files. Uses the locally installed Chrome.
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4400', channel: 'chrome', viewport: { width: 390, height: 844 } },
  webServer: { command: 'python3 -m http.server 4400 --bind 127.0.0.1 --directory dist', url: 'http://localhost:4400/fa-IR/', reuseExistingServer: true, stdout: 'ignore', stderr: 'ignore' },
});
