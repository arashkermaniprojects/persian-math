import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/geo-angles-measure/`;
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

test('fa-IR read an angle: line the protractor up first, the other scale is caught, 65 is right', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  await answer(page).fill('۶۵');
  await check(page, 'fa-IR');
  await no(page, 'با نقاله اندازه بگیر');
  const prot = page.getByRole('slider', { name: /نقاله/ });
  await prot.focus();
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
  await expect(prot).toHaveAttribute('aria-valuenow', '20');
  await answer(page).fill('۱۱۵');
  await check(page, 'fa-IR');
  await no(page, 'از ردیفِ دیگرِ نقاله');
  await answer(page).fill('۶۵');
  await check(page, 'fa-IR');
  await ok(page);
});

test('en draw 130°: a 50° arm (other scale) is caught, then 130°', async ({ page }) => {
  await open(page, 'en', 1);
  const arm = page.getByRole('slider', { name: /Arm of the angle/ });
  await arm.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowUp');
  await expect(arm).toHaveAttribute('aria-valuenow', '50');
  await check(page, 'en');
  await no(page, 'you used the other scale');
  for (let i = 0; i < 8; i++) await page.keyboard.press('PageUp');
  await expect(arm).toHaveAttribute('aria-valuenow', '130');
  await check(page, 'en');
  await ok(page);
});

test('en angles on a line: 70 is caught, 110 is right', async ({ page }) => {
  await open(page, 'en', 2);
  await expect(engine(page).locator('.kg-ms-prot')).toHaveCount(0);
  await answer(page).fill('70');
  await check(page, 'en');
  await no(page, 'it is not 70°');
  await answer(page).fill('110');
  await check(page, 'en');
  await ok(page);
});

test('fa-IR bisector: a right angle is not the middle, 50 is', async ({ page }) => {
  await open(page, 'fa-IR', 4);
  const arm = page.getByRole('slider', { name: /ضلعِ زاویه/ });
  await arm.focus();
  for (let i = 0; i < 18; i++) await page.keyboard.press('ArrowUp');
  await expect(arm).toHaveAttribute('aria-valuetext', '۹۰°');
  await check(page, 'fa-IR');
  await no(page, 'این زاویهٔ قائمه است');
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowDown');
  await check(page, 'fa-IR');
  await ok(page);
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  await noScroll(page, { 'fa-IR': 5, en: 5 });
});
