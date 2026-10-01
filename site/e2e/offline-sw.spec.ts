import { expect, test } from '@playwright/test';
import { spawn } from 'node:child_process';

// After one online visit, the service worker downloads the whole locale; then the site must keep working when
// the server is gone (an internet shutdown), including pages the learner never opened.
// Uses its own server so it can really be stopped: Playwright's offline/route emulation fails navigations
// before a service worker can answer them, which real phones don't do.
const PORT = Number(process.env.KG_PORT ?? 4400) + 11;
const DIST = process.env.KG_DIST ?? 'dist';

test('fa-IR works offline after the first visit', async ({ page }) => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', DIST], { stdio: 'ignore' });
  try {
    const origin = `http://localhost:${PORT}`;
    await expect.poll(() => fetch(origin + '/fa-IR/').then((r) => r.status).catch(() => 0)).toBe(200);
    await page.goto(origin + '/fa-IR/');
    // Wait until the whole locale is cached (a page the learner hasn't opened yet is a good marker).
    await expect
      .poll(() => page.evaluate(async () => !!(await caches.match('/fa-IR/studio/frac-what-is/'))), { timeout: 20000 })
      .toBe(true);

    server.kill();
    await expect.poll(() => fetch(origin + '/fa-IR/').then(() => 'up').catch(() => 'down')).toBe('down');

    await page.goto(origin + '/fa-IR/studio/frac-what-is/');
    const cells = page.locator('kg-fraction-bars .kg-fb-cell');
    await expect(cells).toHaveCount(4);
    await cells.first().click();
    await page.getByRole('button', { name: 'بررسی کن' }).click();
    await expect(page.locator('.feedback.ok')).toBeVisible();
  } finally {
    server.kill();
  }
});
