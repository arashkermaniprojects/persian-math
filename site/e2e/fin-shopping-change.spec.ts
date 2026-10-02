import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/fin-shopping-change/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

async function openMission(page: Page, loc: string, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('kg-clock-calendar-money .kg-ccm-money')).toBeVisible();
}
const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
/** Tap the coin or note worth v (toman, afghani or pence) in the bank, n times. */
async function add(page: Page, v: number, n = 1) {
  for (let k = 0; k < n; k++) await page.locator(`.kg-ccm-bank [data-v="${v}"]`).click();
}

test('fa-IR: change from a 50 000 rial note for a 3500 toman juice — giving the price is caught', async ({ page }) => {
  await openMission(page, 'fa-IR', 1);
  await expect(page.locator('.kg-ccm-price')).toHaveText('۳۵۰۰ تومان');
  await expect(page.locator('.kg-ccm-pile.paid .kg-ccm-piece')).toContainText('۵۰۰۰۰'); // the note says rial
  await expect(page.locator('.kg-ccm-pile.paid .kg-ccm-piece')).toContainText('ریال');
  await add(page, 2000);
  await add(page, 1000);
  await add(page, 500);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('قیمت');
  await page.locator('.mission-tab').nth(1).click(); // start again
  await add(page, 1000);
  await add(page, 500);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱۵۰۰ تومان');
});

test('fa-IR: count up from 2700 to 5000 with the fewest pieces', async ({ page }) => {
  await openMission(page, 'fa-IR', 2);
  await add(page, 1000, 3);
  await add(page, 200);
  await add(page, 100);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۱۰۰۰ تومان زیاد');
  await page.locator('.mission-tab').nth(2).click();
  await add(page, 1000, 2);
  await add(page, 200);
  await add(page, 100);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('کمتری');
  await page.locator('.mission-tab').nth(2).click();
  await add(page, 2000);
  await add(page, 200);
  await add(page, 100);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۲۳۰۰');
});

test('en: a notebook and a pen — paying for one is caught, then 55p', async ({ page }) => {
  await openMission(page, 'en', 0);
  await add(page, 20);
  await add(page, 10);
  await add(page, 5);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('just one of them');
  await add(page, 20);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('55p');
});

test('en only: pounds and pence — £1.55 change from £5', async ({ page }) => {
  await openMission(page, 'en', 4);
  await expect(page.locator('.kg-ccm-price')).toHaveText('£3.45');
  await add(page, 200);
  await add(page, 50);
  await add(page, 10);
  await add(page, 5);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('10p too much');
  await page.locator('.mission-tab').nth(4).click();
  await add(page, 100);
  await add(page, 50);
  await add(page, 5);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('£1.55');
});

test('the decimal money mission is en only', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('.mission-tab')).toHaveCount(4);
  await page.goto(URL('en'));
  await expect(page.locator('.mission-tab')).toHaveCount(5);
});

test('no horizontal scroll at 390px and 44px targets, every mission, fa-IR and en', async ({ page }) => {
  for (const [loc, n] of [['fa-IR', 4], ['en', 5]] as const) {
    for (let i = 0; i < n; i++) {
      await openMission(page, loc, i);
      const bank = page.locator('.kg-ccm-bank button');
      for (let k = 0; k < Math.min(await bank.count(), 8); k++) await bank.nth(k).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
      for (const b of await page.locator('kg-clock-calendar-money button').all()) {
        const r = (await b.boundingBox())!;
        expect(Math.min(r.width, r.height), `${loc} mission ${i + 1} button`).toBeGreaterThanOrEqual(44);
      }
    }
  }
});
