import { defineConfig } from '@playwright/test';

// Runs against a built site served as plain static files, using the locally installed Chrome.
// Parallel workers (people or agents) isolate themselves with KG_DIST/KG_PORT, e.g.
//   npx astro build --outDir dist-anna && KG_DIST=dist-anna KG_PORT=4501 npx playwright test
const dist = process.env.KG_DIST ?? 'dist';
const port = Number(process.env.KG_PORT ?? 4400);

export default defineConfig({
  testDir: 'e2e',
  outputDir: `test-results/${dist}`,
  use: { baseURL: `http://localhost:${port}`, channel: 'chrome', viewport: { width: 390, height: 844 } },
  webServer: {
    command: `python3 -m http.server ${port} --bind 127.0.0.1 --directory ${dist}`,
    url: `http://localhost:${port}/fa-IR/`,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
