import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ops-column-mul/`;
const status = (page: Page) => page.locator('.kg-ca-status');
const box = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });
const check = (page: Page, loc: string) => page.getByRole('button', { name: loc === 'en' ? 'Check' : 'بررسی کن', exact: true }).click();

async function openMission(page: Page, loc: string, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('.kg-ca-sheet').first()).toBeVisible();
}

test('fa-IR short multiplication 47 × 6: tens digit and forgotten carry are caught', async ({ page }) => {
  await openMission(page, 'fa-IR', 0);
  await expect(page.locator('.kg-ca-h')).toHaveText(['ی', 'د', 'ص']);
  const ones = box(page, 'حاصل، ستون یکان');
  await ones.click();
  await page.keyboard.type('۴'); // 7 × 6 = 42: wrote the tens
  await expect(status(page)).toContainText('فقط یک رقم');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز چند خانه');
  await page.keyboard.type('۲۴'); // the 2, then the carry 4
  await page.keyboard.type('۴'); // 4 × 6 = 24, forgot to add the carry
  await expect(status(page)).toContainText('عدد کوچک بالای این ستون');
  await page.keyboard.type('۸۲');
  await expect(status(page)).toContainText('تمام شد');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۲۸۲');
});

test('fa-IR long multiplication 67 × 32 writes the 0 of 67 × 30 (Iran G4)', async ({ page }) => {
  await openMission(page, 'fa-IR', 2);
  await box(page, 'سطر ۱، ستون یکان').click();
  await page.keyboard.type('۴۱۳۱'); // 67 × 2 = 134 (carry 1)
  const zero = box(page, 'سطر ۲، ستون یکان');
  await expect(zero).toBeFocused();
  await expect(page.locator('.kg-ca-ask')).toContainText('۰ بنویس');
  await page.keyboard.type('۵');
  await expect(status(page)).toContainText('ستون یکان ۰ بنویس');
  await page.keyboard.type('۰۱۲۰۲'); // 0, then 67 × 3 = 201 (carry 2)
  await page.keyboard.type('۴۴۱۲'); // 134 + 2010
  await expect(status(page)).toContainText('تمام شد');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۲۱۴۴');
});

test('en: 238 × 4, adding the carry before multiplying is caught; carries below the line', async ({ page }) => {
  await openMission(page, 'en', 1);
  await expect(page.locator('kg-column-arithmetic')).toHaveAttribute('data-ca-carry', 'below');
  await box(page, 'answer, ones column').click();
  await page.keyboard.type('23'); // 8 × 4 = 32
  await page.keyboard.type('4'); // (3 + 3) × 4 = 24
  await expect(status(page)).toContainText('Multiply first');
  await page.keyboard.type('519');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('952');
});

test('en: decimal 2.45 × 3, the point placed by counting (wrong: 73.5)', async ({ page }) => {
  await openMission(page, 'en', 3);
  const reveal = page.locator('.kg-ca-reveal');
  while (await reveal.isVisible()) await reveal.click();
  await page.locator('.int-input').fill('73.5');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('far too big');
  await page.locator('.int-input').fill('7.35');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  // The shifted-row mission is Afghan only.
  await expect(page.locator('.mission-tab')).toHaveCount(4);
});

test('fa-IR: decimal answer with the Iranian mark «/»', async ({ page }) => {
  await openMission(page, 'fa-IR', 3);
  await page.locator('.int-input').fill('۰/۷۳۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('خیلی کوچک');
  await page.locator('.int-input').fill('۷/۳۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at 390px, every mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    for (let i = 0; i < 4; i++) {
      await openMission(page, loc, i);
      const reveal = page.locator('.kg-ca-reveal');
      while (await reveal.isVisible()) await reveal.click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
      for (const b of await page.locator('.kg-ca-box:visible').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
});
