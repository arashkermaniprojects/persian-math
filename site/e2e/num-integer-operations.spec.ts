import { expect, test, type Page } from '@playwright/test';

const ID = 'num-integer-operations';
async function tapTick(page: Page, i: number) {
  await page.locator('kg-number-line svg').scrollIntoViewIfNeeded();
  const b = (await page.locator(`kg-number-line [data-tick="${i}"]`).boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const check = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const mission = (page: Page, n: number) => page.locator('.mission-tab').nth(n).click();
const clear = (page: Page, name: string) => page.getByRole('button', { name }).click();

test('fa-IR: −3 + (−4) is not 7 (two minuses), lands on −7', async ({ page }) => {
  await page.goto(`/fa-IR/studio/${ID}/`);
  await tapTick(page, 7);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('قاعدهٔ ضرب');
  await clear(page, 'پاک کردن نقطه‌ها');
  await tapTick(page, -7);
  await expect(page.locator('kg-number-line .kg-nl-hop')).toHaveText('−۴');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  // |−7| = 7 in the guide runs left to right, the minus close to its digit
  await expect(page.locator('bdi.alg', { hasText: '|−۷| = ۷' }).first()).toBeAttached();
});

test('fa-IR: the sign pattern carries on past zero', async ({ page }) => {
  await page.goto(`/fa-IR/studio/${ID}/`);
  await mission(page, 2);
  await expect(page.locator('kg-number-line .kg-nl-fixed')).toHaveCount(5); // 4 given + the start dot
  for (const t of [-2, -4, -6]) await tapTick(page, t);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('برنمی‌گردد');
  await clear(page, 'پاک کردن نقطه‌ها');
  for (const t of [2, 4, 6]) await tapTick(page, t);
  await expect(page.locator('kg-number-line .kg-nl-hop')).toHaveText(['+۲', '+۲', '+۲']);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: three hops of −2; (−12) ÷ 3 keeps its sign', async ({ page }) => {
  await page.goto(`/en/studio/${ID}/`);
  await mission(page, 1);
  for (const t of [2, 4, 6]) await tapTick(page, t);
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('hops go to the right');
  await clear(page, 'Clear points');
  for (const t of [-2, -4, -6]) await tapTick(page, t);
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await mission(page, 3);
  await tapTick(page, 4);
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('falling');
  await tapTick(page, -4);
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: |x| = 5 has two answers; order matters for subtraction', async ({ page }) => {
  await page.goto(`/en/studio/${ID}/`);
  await mission(page, 4);
  await tapTick(page, 5);
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('two floors');
  await tapTick(page, -5);
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await mission(page, 5);
  await page.locator('.choice').nth(0).click();
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('opposite answer');
  await page.locator('.choice').nth(2).click();
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/${ID}/`);
    for (let m = 0; m < 6; m++) {
      await mission(page, m);
      await expect(page.locator('kg-number-line svg')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
