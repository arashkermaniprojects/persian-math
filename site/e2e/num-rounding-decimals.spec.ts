import { expect, test, type Page } from '@playwright/test';

const ID = 'num-rounding-decimals';
/** Tap tick i (tick i = i / denominator). */
async function tapTick(page: Page, i: number) {
  await page.locator('kg-number-line svg').scrollIntoViewIfNeeded();
  const b = (await page.locator(`kg-number-line [data-tick="${i}"]`).boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const check = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const mission = (page: Page, n: number) => page.locator('.mission-tab').nth(n).click();

test('fa-IR: 3.7 to the nearest whole number; cutting off is caught', async ({ page }) => {
  await page.goto(`/fa-IR/studio/${ID}/`);
  await expect(page.locator('kg-number-line .kg-nl-fixed')).toHaveCount(1);
  await page.locator('.int-input').fill('۳');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('قطع کردن');
  await page.locator('.int-input').fill('۴');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: 2.46 to one decimal place on the zoomed line', async ({ page }) => {
  await page.goto(`/fa-IR/studio/${ID}/`);
  await mission(page, 1);
  await tapTick(page, 240);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('قطع کردن');
  await tapTick(page, 250);
  await expect(page.locator('kg-number-line .kg-nl-pt')).toHaveAttribute('aria-valuetext', '۲/۵');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: 0.367 to two decimal places, typed with the Iranian mark', async ({ page }) => {
  await page.goto(`/fa-IR/studio/${ID}/`);
  await mission(page, 3);
  await page.locator('.int-input').fill('۰/۳۶');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('قطع کردن');
  await page.locator('.int-input').fill('۰/۳۷');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: the bounds of 3.5', async ({ page }) => {
  await page.goto(`/en/studio/${ID}/`);
  await mission(page, 2);
  await tapTick(page, 345);
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('two points');
  await tapTick(page, 355);
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toContainText('3.45 ≤ x < 3.55');
});

test('en: significant figures (en only)', async ({ page }) => {
  await page.goto(`/en/studio/${ID}/`);
  await expect(page.locator('.mission-tab')).toHaveCount(5);
  await mission(page, 4);
  await page.locator('.int-input').fill('0.05');
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText("zeros at the front don't count");
  await page.locator('.int-input').fill('0.047');
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  for (const [loc, n] of [['fa-IR', 4], ['en', 5]] as const) {
    await page.goto(`/${loc}/studio/${ID}/`);
    await expect(page.locator('.mission-tab')).toHaveCount(n);
    for (let m = 0; m < n; m++) {
      await mission(page, m);
      await expect(page.locator('kg-number-line svg')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
