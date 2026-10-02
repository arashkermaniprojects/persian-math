import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/meas-volume/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const MISSIONS = 4;

const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const answer = (page: Page) => page.locator('.int-input');
async function tab(page: Page, i: number) {
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('kg-shape-board svg.kg-sb-3d')).toBeVisible();
}
/** Tap plan square (row j from the back, column i) n times: each tap stacks one more cube there. */
async function stack(page: Page, j: number, i: number, n = 1) {
  for (let k = 0; k < n; k++) await page.locator(`kg-shape-board [data-c="${j}-${i}"]`).click();
}
const cubes = (page: Page) => page.locator('kg-shape-board polygon.kg-sb-cube.top');

test('fa-IR build a box: one layer is too few, one flat layer of 12 is the wrong box, 3 × 2 × 2 is right', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('kg-shape-board .kg-sb-hint')).toContainText('روی خانه‌های نقشه');
  for (const j of [0, 1]) for (const i of [0, 1, 2]) await stack(page, j, i);
  await expect(cubes(page)).toHaveCount(6);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('مکعب کم داری');

  // finish the 4 × 3 floor: 12 cubes, but only one layer
  await stack(page, 2, 0); await stack(page, 2, 1); await stack(page, 2, 2);
  for (const j of [0, 1, 2]) await stack(page, j, 3);
  await expect(page.locator('kg-shape-board [data-c="2-3"]')).toHaveText('۱');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ارتفاع داشته باشد');

  // take the extra squares back off (they wrap 1 → 2 → 3 → 0) and add a second layer
  for (const [j, i] of [[2, 0], [2, 1], [2, 2], [0, 3], [1, 3], [2, 3]]) await stack(page, j, i, 3);
  for (const j of [0, 1]) for (const i of [0, 1, 2]) await stack(page, j, i);
  await expect(cubes(page)).toHaveCount(12);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱۲');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR count the box: counting faces is caught, then 24', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await expect(cubes(page)).toHaveCount(24);
  // no plan to tap: the box is only to look at
  await expect(page.locator('kg-shape-board .kg-sb-plan')).toHaveCount(0);
  await answer(page).fill('۲۶');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('مربع‌های رو');
  await answer(page).fill('۱۸');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('دیده می‌شوند');
  await answer(page).fill('۲۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: layers and same volume, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await tab(page, 2);
  await answer(page).fill('15');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('just one layer');
  await answer(page).fill('12');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('You added');
  await answer(page).fill('60');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 3);
  // Sara's own 3 × 2 × 2 box again
  for (const j of [0, 1]) for (const i of [0, 1, 2]) await stack(page, j, i, 2);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText("Sara's");
  // back to empty (2 → 3 → 4 → 0), then 11 of the 4 × 3 floor
  for (const j of [0, 1]) for (const i of [0, 1, 2]) await stack(page, j, i, 3);
  await expect(cubes(page)).toHaveCount(0);
  for (const j of [0, 1, 2]) for (const i of [0, 1, 2, 3]) if (j * 4 + i < 11) await stack(page, j, i);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('fewer than 12');
  await stack(page, 2, 3);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

for (const loc of ['fa-IR', 'en']) {
  test(`${loc}: no horizontal scroll at 390px on any mission`, async ({ page }) => {
    await page.goto(URL(loc));
    for (let i = 0; i < MISSIONS; i++) {
      await tab(page, i);
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(sw, `mission ${i + 1}`).toBeLessThanOrEqual(cw);
    }
  });
}
