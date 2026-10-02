import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/meas-convert/`;
const engine = (page: Page) => page.locator('kg-measure');
const answer = (page: Page) => page.locator('.int-input');
const ok = (page: Page) => expect(page.locator('.feedback.ok')).toBeVisible();
const no = (page: Page, text: string | RegExp) => expect(page.locator('.feedback.no')).toContainText(text);

async function open(page: Page, loc: string, m: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(m).click();
  await expect(engine(page).locator('.kg-ms')).toBeVisible();
}
async function check(page: Page, loc: string) {
  await page.getByRole('button', { name: loc === 'en' ? 'Check' : 'بررسی کن' }).click();
}
async function noScroll(page: Page, counts: Record<string, number>) {
  for (const [loc, n] of Object.entries(counts)) {
    await page.goto(URL(loc));
    await expect(page.locator('.mission-tab')).toHaveCount(n);
    for (let m = 0; m < n; m++) {
      await page.locator('.mission-tab').nth(m).click();
      await expect(engine(page).locator('.kg-ms')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
}

test('fa-IR metres to cm: 3045 (a metre as 1000 cm) is caught, 345 is right', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  await expect(engine(page).locator('.kg-ms-u.from')).toHaveText('متر');
  await expect(engine(page).locator('.kg-ms-f.on')).toHaveText('×۱۰۰');
  await answer(page).fill('۳۰۴۵');
  await check(page, 'fa-IR');
  await no(page, '۱ متر ۱۰۰۰ سانتی‌متر نیست');
  await answer(page).fill('۳۴۵');
  await check(page, 'fa-IR');
  await ok(page);
});

test('fa-IR grams to kg: multiplying is caught, 2/5 with the Iranian decimal mark is right', async ({ page }) => {
  await open(page, 'fa-IR', 1);
  await answer(page).fill('۲۵۰۰۰۰۰');
  await check(page, 'fa-IR');
  await no(page, 'ضرب کردی');
  await answer(page).fill('۲/۵');
  await check(page, 'fa-IR');
  await ok(page);
});

test('en juice: stopping at 1500 ml is caught, 6 glasses is right', async ({ page }) => {
  await open(page, 'en', 2);
  await answer(page).fill('1500');
  await check(page, 'en');
  await no(page, 'asks for the number of glasses');
  await answer(page).fill('6');
  await check(page, 'en');
  await ok(page);
});

test('en square metre: 100 (the length factor) is caught, 10000 is right', async ({ page }) => {
  await open(page, 'en', 3);
  await answer(page).fill('100');
  await check(page, 'en');
  await no(page, 'just one row');
  await answer(page).fill('10000');
  await check(page, 'en');
  await ok(page);
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  await noScroll(page, { 'fa-IR': 4, en: 4 });
});
