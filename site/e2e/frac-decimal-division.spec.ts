import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/frac-decimal-division/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const boxes = (page: Page) => page.locator('kg-long-division .kg-ld-box');

async function openMission(page: Page, loc: string, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(boxes(page).first()).toBeVisible();
}
const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();

test('fa-IR: 7.5 ÷ 0.25 made whole as 750 ÷ 25, with the Iranian decimal mark in the prompt', async ({ page }) => {
  await openMission(page, 'fa-IR', 0);
  await expect(page.locator('.mission .prompt')).toContainText('۷/۵');
  await expect(page.locator('.mission .prompt')).toContainText('۰/۲۵');
  await boxes(page).first().click();
  await page.keyboard.type('۲'); // 2 × 25 = 50, not 75
  await expect(boxes(page).first()).toHaveClass(/\bno\b/);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toBeVisible();
  await page.keyboard.type('۳۷۵۰' + '۰'); // 75: 3, 75, 0 | bring down 0: 0
  await expect(page.locator('.kg-ld-status.ok')).toBeVisible();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۳۰');
});

test('fa-IR: 9.6 ÷ 4 — 24 tenths is not 24', async ({ page }) => {
  await openMission(page, 'fa-IR', 1);
  const input = page.locator('.int-input');
  await input.fill('۲۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۲۴ دهم است');
  await input.fill('۲/۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۲/۴');
});

test('fa-IR: 1 ÷ 3 keeps giving remainder 1 and quotient digit 3', async ({ page }) => {
  await openMission(page, 'fa-IR', 2);
  await expect(page.locator('.kg-ld-box.given')).toHaveCount(1);
  await boxes(page).nth(1).focus();
  await expect(page.locator('.kg-ld-ask')).toContainText('۱۰');
  await page.keyboard.type('۳۹۱'.repeat(4));
  await expect(page.locator('.kg-ld-status.ok')).toBeVisible();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۰/۳۳۳۳');
});

test('en: 2 ÷ 11 — the repeating block is 18', async ({ page }) => {
  await openMission(page, 'en', 3);
  await page.getByRole('radio', { name: '8', exact: true }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('1, 8, 1, 8');
  await page.getByRole('radio', { name: '18', exact: true }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('0.181818');
});

test('en: 0.777… as a fraction — 7/10 is caught, 7/9 is right', async ({ page }) => {
  await openMission(page, 'en', 4);
  await expect(page.locator('.kg-ld-status.ok')).toBeVisible(); // 4 ÷ 9 is shown worked
  await page.locator('.kg-fi-n').fill('7');
  await page.locator('.kg-fi-d').fill('10');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('which stops');
  await page.locator('.kg-fi-d').fill('9');
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
