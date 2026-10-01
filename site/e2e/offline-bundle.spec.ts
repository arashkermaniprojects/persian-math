import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Opens the per-locale zip contents straight from disk (file://), as a phone's file manager would.
// Run `node scripts/offline-bundle.mjs` first; skipped if the bundle hasn't been built.
const root = resolve('bundles/kamangir-fa-IR');

test('offline bundle works from file:// with no server', async ({ page }) => {
  test.skip(!existsSync(root), 'bundle not built');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(`${root}/index.html`).href);
  await expect(page).toHaveURL(/fa-IR\/index\.html$/);
  await page.getByRole('link', { name: 'ایران' }).first().click();
  await page.locator('.card').first().click();
  await expect(page).toHaveURL(/studio\/frac-what-is\/index\.html$/);
  // The engine is interactive (classic-script runtime) and the font loaded from a relative path.
  const cells = page.locator('kg-fraction-bars .kg-fb-cell');
  await expect(cells).toHaveCount(4);
  await cells.first().click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
  expect(await page.evaluate(() => document.fonts.check('16px Vazirmatn'))).toBe(true);
  expect(errors).toEqual([]);
});
