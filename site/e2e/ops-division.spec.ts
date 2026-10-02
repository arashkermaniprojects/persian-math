import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ops-division/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const boxes = (page: Page) => page.locator('kg-long-division .kg-ld-box');

async function openMission(page: Page, loc: string, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(boxes(page).first()).toBeVisible();
}
const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();

test('fa-IR: 17 ÷ 4 on the gallows, a wrong quotient digit, then 4 remainder 1', async ({ page }) => {
  await openMission(page, 'fa-IR', 0);
  await expect(page.locator('kg-long-division')).toHaveAttribute('data-ld-layout', 'gallows');
  await expect(page.locator('.kg-ld-ask')).toContainText('۱۷'); // the first partial is 17, not 1
  const first = boxes(page).first();
  await first.click();
  await page.keyboard.type('۵'); // 5 × 4 = 20 is too much
  await expect(first).toHaveClass(/\bno\b/);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز چند خانه مانده');
  await page.keyboard.type('۴۱۶۱'); // q 4, product 16, remainder 1
  await expect(page.locator('.kg-ld-status.ok')).toBeVisible();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱ گل باقی می‌ماند');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR: the remainder in context — 7 cars leave 2 children behind, 8 is right', async ({ page }) => {
  await openMission(page, 'fa-IR', 1);
  const input = page.locator('.int-input');
  await input.fill('۷');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۲ نفر دیگر');
  await input.fill('۲');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('باقی‌مانده');
  await input.fill('۸');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۸ ماشین');
});

test('fa-IR: checking 95 ÷ 4 — forgetting the remainder is caught', async ({ page }) => {
  await openMission(page, 'fa-IR', 4);
  await expect(page.locator('.kg-ld-box:not(.given)')).toHaveCount(0); // the whole sheet is given
  await expect(page.locator('.kg-ld-status.ok')).toBeVisible();
  const input = page.locator('.int-input');
  await input.fill('۹۲');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('یادت رفت');
  await input.fill('۹۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: bus stop, 296 ÷ 12 = 24 r 8 with a two-digit divisor', async ({ page }) => {
  await openMission(page, 'en', 3);
  await expect(page.locator('kg-long-division')).toHaveAttribute('data-ld-layout', 'busstop');
  await expect(page.locator('.kg-ld-ask')).toContainText('29');
  await boxes(page).first().click();
  await page.keyboard.type('3'); // 3 × 12 = 36 > 29
  await expect(boxes(page).first()).toHaveClass(/\bno\b/);
  await page.keyboard.type('2245' + '4488'); // 29: 2, 24, 5 | 56: 4, 48, 8
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('8 pencils left over');
});

test('en: cars — typing the remainder gets its own feedback', async ({ page }) => {
  await openMission(page, 'en', 1);
  const input = page.locator('.int-input');
  await input.fill('72');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('next to each other');
  await input.fill('8');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at 390px, every mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    for (let i = 0; i < 5; i++) {
      await openMission(page, loc, i);
      const reveal = page.locator('.kg-ld-reveal');
      while (await reveal.isVisible()) await reveal.click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
