import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/meas-compare-units/`;
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

test('fa-IR longer: the ribbon sticks out but starts further along; the pencil is longer', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  await expect(engine(page).locator('.kg-ms-rg')).toHaveCount(0);
  await page.getByRole('radio', { name: '🎀' }).click();
  await check(page, 'fa-IR');
  await no(page, 'جلوتر شروع شده است');
  await page.getByRole('radio', { name: '✏️' }).click();
  await check(page, 'fa-IR');
  await ok(page);
});

test('en heavier: the pan that is up is not the heavier one', async ({ page }) => {
  await open(page, 'en', 1);
  await expect(engine(page).locator('.kg-ms-svg')).toHaveAttribute('aria-label', /melon's pan is lower/);
  await page.getByRole('radio', { name: '🍎🍎🍎' }).click();
  await check(page, 'en');
  await no(page, 'The lighter pan goes up');
  await page.getByRole('radio', { name: '🍉' }).click();
  await check(page, 'en');
  await ok(page);
});

test('fa-IR clips: one clip too many, then 6 clips', async ({ page }) => {
  await open(page, 'fa-IR', 2);
  const more = page.getByRole('button', { name: 'یکی اضافه کن' });
  for (let i = 0; i < 7; i++) await more.click();
  await expect(engine(page).locator('.kg-ms-count')).toHaveText('۷');
  await check(page, 'fa-IR');
  await no(page, 'از تهِ مداد رد شده‌اند');
  await page.getByRole('button', { name: 'یکی کم کن' }).click();
  await check(page, 'fa-IR');
  await ok(page);
});

test('en cups: too few cups, then 4', async ({ page }) => {
  await open(page, 'en', 4);
  const more = page.getByRole('button', { name: 'Add one' });
  for (let i = 0; i < 3; i++) await more.click();
  await check(page, 'en');
  await no(page, 'Not enough water');
  await more.click();
  await expect(page.getByRole('slider', { name: 'Jug' })).toHaveAttribute('aria-valuenow', '4');
  await check(page, 'en');
  await ok(page);
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  await noScroll(page, { 'fa-IR': 5, en: 5 });
});
