import { expect, test, type Page } from '@playwright/test';

const ID = 'ops-number-line-jumps';
async function tapTick(page: Page, i: number) {
  await page.locator('kg-number-line svg').scrollIntoViewIfNeeded();
  const b = (await page.locator(`kg-number-line [data-tick="${i}"]`).boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const check = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const mission = (page: Page, n: number) => page.locator('.mission-tab').nth(n).click();
const hops = (page: Page) => page.locator('kg-number-line .kg-nl-hop');

test('fa-IR: 3 + 5 from 0; counting the start mark is caught, then cleared and redone', async ({ page }) => {
  await page.goto(`/fa-IR/studio/${ID}/`);
  await tapTick(page, 3);
  await tapTick(page, 7);
  await expect(hops(page)).toHaveText(['+۳', '+۴']);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('+۵');
  await page.getByRole('button', { name: 'پاک کردن نقطه‌ها' }).click();
  await expect(page.locator('kg-number-line .kg-nl-pt')).toHaveCount(0);
  await tapTick(page, 3);
  await tapTick(page, 8);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: 37 + 25 as tens then ones', async ({ page }) => {
  await page.goto(`/en/studio/${ID}/`);
  await mission(page, 2);
  await tapTick(page, 57);
  await tapTick(page, 52);
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('+20');
  await page.locator('kg-number-line .kg-nl-pt').nth(1).focus();
  for (let k = 0; k < 10; k++) await page.keyboard.press('ArrowRight');
  await expect(hops(page)).toHaveText(['+20', '+5']);
  await expect(page.locator('kg-number-line .kg-nl-val')).toHaveText(['57', '62']);
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: 62 − 27 jumps left, with the minus sign on the left of the hop size', async ({ page }) => {
  await page.goto(`/fa-IR/studio/${ID}/`);
  await mission(page, 3);
  await tapTick(page, 42);
  await tapTick(page, 52); // ticks are ~6px apart here: a tap near a point grabs that point instead

  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('۴۵ نیست');
  await page.locator('kg-number-line .kg-nl-pt').nth(1).focus();
  for (let k = 0; k < 17; k++) await page.keyboard.press('ArrowLeft');
  await expect(hops(page)).toHaveText(['−۲۰', '−۷']);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: three-digit line moves in tens', async ({ page }) => {
  await page.goto(`/fa-IR/studio/${ID}/`);
  await mission(page, 4);
  await tapTick(page, 330);
  await tapTick(page, 250);
  await expect(page.locator('kg-number-line .kg-nl-val')).toHaveText(['۳۳۰', '۲۵۰']);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/${ID}/`);
    for (let m = 0; m < 5; m++) {
      await mission(page, m);
      await expect(page.locator('kg-number-line svg')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
