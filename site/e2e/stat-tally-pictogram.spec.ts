import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/stat-tally-pictogram/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const tab = (page: Page, n: number) => page.locator('.mission-tab').nth(n).click();

const DATA = ['apple', 'banana', 'orange', 'apple', 'grapes', 'orange', 'apple', 'banana', 'apple', 'orange', 'apple', 'grapes', 'banana', 'orange', 'apple'];
const FA: Record<string, string> = { apple: 'سیب', banana: 'موز', orange: 'پرتقال', grapes: 'انگور' };
const fa = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

test('fa-IR tally: sort the survey cards into rows, fix a card in the wrong row', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const cards = page.locator('kg-chart-builder .kg-cb-card');
  await expect(cards).toHaveCount(15);
  const add = (cat: string) => page.getByRole('button', { name: `یک چوب‌خط برای ${FA[cat]}` }).click();

  // Tapping a row before a card asks for a card first.
  await add('apple');
  await expect(page.locator('.kg-cb-say')).toContainText('اول روی یک کارت بزن');

  // Card 1 (an apple) goes into the banana row by mistake.
  await cards.nth(0).click();
  await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await add('banana');
  await expect(cards.nth(0)).toHaveClass(/used/);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز کارت شمرده‌نشده');

  for (let j = 1; j < DATA.length; j++) {
    await cards.nth(j).click();
    await add(DATA[j]);
  }
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ردیف اشتباه');

  // Tap the crossed-out card to take it back, then put it in the apple row.
  await cards.nth(0).click();
  await expect(cards.nth(0)).not.toHaveClass(/used/);
  await cards.nth(0).click();
  await add('apple');
  // Six apples: one group of five (4 strokes + 1 across) and one more stroke.
  await expect(page.locator('.kg-cb-table tbody tr').first().locator('.vh')).toHaveText(`سیب: ${fa(6)}`);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR count: a group of five read as four, then the right counts', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  const box = (s: string) => page.getByRole('textbox', { name: `تعداد ${s}` });
  await box('بهار').fill('۶');
  await box('تابستان').fill('۵');
  await box('پاییز').fill('۹');
  await box('زمستان').fill('۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('خط کج را هم بشمار');
  await box('بهار').fill('۷');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR pictogram: forget the half picture, then build it with one face = 2', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await expect(page.locator('.kg-cb-key')).toContainText('۲');
  const more = (cat: string) => page.getByRole('button', { name: `نصف تصویر بیشتر برای ${FA[cat]}` });
  const tapMore = async (cat: string, n: number) => { for (let k = 0; k < n; k++) await more(cat).click(); };
  await tapMore('apple', 6);
  await tapMore('banana', 4); // 2 whole faces instead of 1½
  await tapMore('orange', 4);
  await tapMore('grapes', 2);
  // Pictures run left → right inside the RTL table.
  const row = page.getByRole('slider', { name: 'سیب' });
  await expect(row).toHaveAttribute('aria-valuetext', `سیب: ${fa(3)} تصویر`);
  const syms = row.locator('svg.ico');
  expect((await syms.nth(0).boundingBox())!.x).toBeLessThan((await syms.nth(2).boundingBox())!.x);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('نصف تصویر را فراموش نکن');

  await page.getByRole('button', { name: 'نصف تصویر کمتر برای موز' }).click();
  await expect(page.getByRole('slider', { name: 'موز' })).toHaveAttribute('aria-valuetext', 'موز: ۱/۵ تصویر');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en pictogram with the keyboard: one picture per child ignores the key', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 2);
  const want: Record<string, number> = { apple: 12, banana: 6, orange: 8, grapes: 4 };
  for (const [cat, n] of Object.entries(want)) {
    await page.getByRole('slider', { name: cat }).focus();
    for (let k = 0; k < n; k++) await page.keyboard.press('ArrowRight');
  }
  await expect(page.getByRole('slider', { name: 'grapes' })).toBeFocused();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('each picture stands for 2 children');
  for (const [cat, n] of Object.entries(want)) {
    await page.getByRole('slider', { name: cat }).focus();
    for (let k = 0; k < n / 2; k++) await page.keyboard.press('ArrowLeft');
  }
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR and en read: counting pictures or adding is caught, then the difference', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await expect(page.getByRole('img', { name: 'مریم: ۵ تصویر' })).toBeVisible();
  await page.locator('.int-input').fill('۳');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('تصویرها را شمردی');
  await page.locator('.int-input').fill('۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await page.goto(URL('en'));
  await tab(page, 3);
  await page.locator('.int-input').fill('15');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('You added');
  await page.locator('.int-input').fill('5');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en tally: a card in the wrong row, rubbed out with −', async ({ page }) => {
  await page.goto(URL('en'));
  const cards = page.locator('kg-chart-builder .kg-cb-card');
  await cards.nth(0).click();
  await page.getByRole('button', { name: 'Add a tally mark for grapes' }).click();
  for (let j = 1; j < DATA.length; j++) {
    await cards.nth(j).click();
    await page.getByRole('button', { name: `Add a tally mark for ${DATA[j]}` }).click();
  }
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('wrong row');
  // Rub out the grapes row's marks (last first) until card 1 comes back, then re-sort.
  const rub = page.getByRole('button', { name: 'Rub out a tally mark for grapes' });
  await rub.click(); // card 12 (grapes) comes back
  await rub.click(); // card 5 (grapes) comes back
  await rub.click(); // card 1 (the apple) comes back
  await expect(cards.nth(0)).not.toHaveClass(/used/);
  for (const [j, cat] of [[0, 'apple'], [4, 'grapes'], [11, 'grapes']] as const) {
    await cards.nth(j).click();
    await page.getByRole('button', { name: `Add a tally mark for ${cat}` }).click();
  }
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    for (let m = 0; m < 4; m++) {
      await tab(page, m);
      await expect(page.locator('kg-chart-builder table')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
