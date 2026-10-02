import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/fin-money-coins/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

async function openMission(page: Page, loc: string, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('kg-clock-calendar-money .kg-ccm-money')).toBeVisible();
}
const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
/** Tap the coin or note worth v (in the currency's counting unit) in the bank, n times. */
async function add(page: Page, v: number, n = 1) {
  for (let k = 0; k < n; k++) await page.locator(`.kg-ccm-bank [data-v="${v}"]`).click();
}

test('fa-IR: ten 1-rial coins or one 10-rial coin — more coins is not more money', async ({ page }) => {
  await openMission(page, 'fa-IR', 0);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.kg-ccm-groups .kg-ccm-piece').last()).toContainText('۱۰');
  await expect(page.locator('.kg-ccm-groups .kg-ccm-piece').last()).toContainText('ریال');
  await page.locator('.kg-ccm-choice').first().click(); // Ali's ten coins
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('سکه‌هایش را بشمار');
  await page.locator('.kg-ccm-choice.same').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱۰ ریال');
});

test('fa-IR: 1600 rial with the fewest coins (Iran G3 coins)', async ({ page }) => {
  await openMission(page, 'fa-IR', 2);
  await expect(page.locator('.kg-ccm-bank button')).toHaveCount(6); // 10, 100, 500, 1000 rial coins; 5000, 10 000 notes
  await expect(page.locator('.kg-ccm-tip')).toContainText('روی پول‌ها بزن');
  await add(page, 1000);
  await add(page, 100, 6);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('سکه‌های کمتری');
  await page.locator('.mission-tab').nth(2).click(); // start again
  await add(page, 1000);
  await add(page, 500);
  await add(page, 100);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('فقط ۳ سکه');
});

test('fa-IR: the coins say rial, the price says toman', async ({ page }) => {
  await openMission(page, 'fa-IR', 4);
  await expect(page.locator('.kg-ccm-price')).toHaveText('۵۰۰ تومان');
  await expect(page.locator('.kg-ccm-bank [data-v="500"]')).toContainText('۵۰۰۰'); // 500 toman shows as 5000 rial
  await add(page, 50); // the 500-rial coin
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('نه ۵۰۰ تومان');
  await page.locator('.kg-ccm-purse .kg-ccm-piece').first().click(); // take it out
  await add(page, 500);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۵۰۰۰ ریال');
});

test('en: pence — make 35p, too little first', async ({ page }) => {
  await openMission(page, 'en', 1);
  await expect(page.locator('.kg-ccm-bank [data-v="100"]')).toContainText('£1');
  await add(page, 20);
  await add(page, 10);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Not enough');
  await add(page, 5);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('35p');
});

test('en: five 10p coins against 50p + 20p', async ({ page }) => {
  await openMission(page, 'en', 3);
  await page.locator('.kg-ccm-choice').first().click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Reza has more coins');
  await page.locator('.kg-ccm-choice').nth(1).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('the toman mission is fa-IR only', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('.mission-tab')).toHaveCount(4);
  await page.goto(URL('fa-IR'));
  await expect(page.locator('.mission-tab')).toHaveCount(5);
});

test('no horizontal scroll at 390px and 44px targets, every mission, fa-IR and en', async ({ page }) => {
  for (const [loc, n] of [['fa-IR', 5], ['en', 4]] as const) {
    for (let i = 0; i < n; i++) {
      await openMission(page, loc, i);
      // Fill the purse so it is at its widest.
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
