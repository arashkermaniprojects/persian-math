import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/geo-circle-constructions/`;
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

test('fa-IR radius: giving the diameter is caught; slide the ruler to 0 and halve it', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  await expect(engine(page).locator('circle.kg-ms-obj')).toHaveCount(1);
  await answer(page).fill('۴');
  await check(page, 'fa-IR');
  await no(page, '۴ سانتی‌متر قطر است');
  const ruler = page.getByRole('slider', { name: /خط‌کش/ });
  await ruler.focus();
  await page.keyboard.press('PageUp');
  await expect(ruler).toHaveAttribute('aria-valuenow', '0');
  await answer(page).fill('۲');
  await check(page, 'fa-IR');
  await ok(page);
});

test('en tape: the diameter is not the circumference; 9.4 cm is right', async ({ page }) => {
  await open(page, 'en', 1);
  await answer(page).fill('3');
  await check(page, 'en');
  await no(page, "the tin's diameter");
  await answer(page).fill('9.4');
  await check(page, 'en');
  await ok(page);
});

test('en circumference ÷ diameter: dividing the wrong way is caught, 3.14 is right', async ({ page }) => {
  await open(page, 'en', 2);
  await answer(page).fill('0.32');
  await check(page, 'en');
  await no(page, 'You divided the diameter by the circumference');
  await answer(page).fill('3.14');
  await check(page, 'en');
  await ok(page);
});

test('fa-IR circumference from the radius: π × radius is caught, 18/84 is right', async ({ page }) => {
  await open(page, 'fa-IR', 3);
  await answer(page).fill('۹/۴۲');
  await check(page, 'fa-IR');
  await no(page, 'شعاع را در');
  await answer(page).fill('۱۸/۸۴');
  await check(page, 'fa-IR');
  await ok(page);
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  await noScroll(page, { 'fa-IR': 4, en: 4 });
});
