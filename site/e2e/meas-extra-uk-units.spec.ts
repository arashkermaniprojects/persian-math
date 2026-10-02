import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/meas-extra-uk-units/`;
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

test('fa-IR thermometer: counting each mark as 1 degree is caught, 26 is right', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  await answer(page).fill('۲۳');
  await check(page, 'fa-IR');
  await no(page, 'هر خطِ کوچک را ۱ درجه شمردی');
  await answer(page).fill('۲۶');
  await check(page, 'fa-IR');
  await ok(page);
});

test('fa-IR below zero: +6 is the wrong side of zero; set −6', async ({ page }) => {
  await open(page, 'fa-IR', 1);
  const colder = page.getByRole('button', { name: 'سردتر' });
  await colder.click();
  await colder.click();
  const level = page.getByRole('slider', { name: 'دماسنج' });
  await expect(level).toHaveAttribute('aria-valuenow', '6');
  await check(page, 'fa-IR');
  await no(page, 'این ۶ درجه بالای صفر است');
  for (let i = 0; i < 6; i++) await colder.click();
  await expect(level).toHaveAttribute('aria-valuenow', '-6');
  await check(page, 'fa-IR');
  await ok(page);
});

test('en feet and inches: 46 (tens and ones) is caught, 54 is right', async ({ page }) => {
  await open(page, 'en', 3);
  await expect(engine(page).locator('.kg-ms-u')).toHaveText(['miles', 'yards', 'feet', 'in']);
  await answer(page).fill('46');
  await check(page, 'en');
  await no(page, 'do not work like tens and ones');
  await answer(page).fill('54');
  await check(page, 'en');
  await ok(page);
});

test('en pint: half a litre is not enough, the 550 ml mark is closest', async ({ page }) => {
  await open(page, 'en', 5);
  const more = page.getByRole('button', { name: 'Warmer / more' });
  for (let i = 0; i < 10; i++) await more.click();
  await check(page, 'en');
  await no(page, 'That is half a litre');
  await more.click();
  await expect(page.getByRole('slider', { name: 'Measuring jug' })).toHaveAttribute('aria-valuenow', '550');
  await check(page, 'en');
  await ok(page);
});

test('imperial missions are UK-only; temperature is for everyone', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('.mission-tab')).toHaveCount(2);
  await page.goto(URL('en'));
  await expect(page.locator('.mission-tab')).toHaveCount(6);
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  await noScroll(page, { 'fa-IR': 2, en: 6 });
});
