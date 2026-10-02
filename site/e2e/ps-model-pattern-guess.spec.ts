import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ps-model-pattern-guess/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

const canvas = (page: Page) => page.locator('kg-problem-canvas');
const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const tap = (page: Page, name: string) => canvas(page).getByRole(/[؟?]$/.test(name) ? 'radio' : 'button', { name, exact: true }).click();
/** Type v into table cell (row r, column c) and leave the cell. */
async function cell(page: Page, r: number, c: number, v: string) {
  const i = canvas(page).locator(`input[data-r="${r}"][data-c="${c}"]`);
  await i.fill(v);
  await i.press('Tab');
}
const answer = (page: Page) => canvas(page).locator('input[data-a="answer"]');
const fbNo = (page: Page) => page.locator('.feedback.no');
const fbOk = (page: Page) => page.locator('.feedback.ok');

test('fa-IR model: every way to put 6 marbles in 2 pockets, in order; a wrong row and a missing row', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(canvas(page).locator('.kg-pc-hint')).toContainText('به ترتیب');
  await tap(page, 'رضا ۶ تیله دارد.');
  await tap(page, 'او تیله‌ها را در ۲ جیبش می‌گذارد.');
  await tap(page, 'به چند روش می‌تواند تیله‌ها را در جیب‌هایش بگذارد؟');
  await expect(canvas(page).locator('th')).toHaveText(['جیب چپ', 'جیب راست', 'روی هم']);
  await cell(page, 0, 1, '۶');
  await cell(page, 1, 1, '۴');
  // The total column works itself out and shows the slip
  await expect(canvas(page).locator('td.calc')).toHaveText(['۶', '۵', '…']);
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('روی هم ۶ تیله ندارند');
  await cell(page, 1, 1, '۵');
  await cell(page, 2, 0, '۲');
  await cell(page, 2, 1, '۴');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('هنوز همهٔ حالت‌ها');
  const add = canvas(page).getByRole('button', { name: '+ یک سطر دیگر' });
  for (let r = 3; r <= 6; r++) {
    await add.click();
    await cell(page, r, 0, String(r));
    await cell(page, r, 1, String(6 - r));
  }
  await expect(canvas(page).locator('tbody tr')).toHaveCount(7);
  await answer(page).fill('۶');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('۰ و ۶ با ۶ و ۰ فرق دارد');
  await answer(page).fill('۷');
  await check(page, 'fa-IR');
  await expect(fbOk(page)).toContainText('۷ روش');
});

test('fa-IR pattern: hops +2 +3 +4 shown; repeating +4 breaks the pattern; 21 dots', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(1).click();
  await tap(page, 'شکل ۱ یک دایره، شکل ۲ سه دایره، شکل ۳ شش دایره و شکل ۴ ده دایره دارد.');
  await tap(page, 'شکل‌ها را به همین ترتیب ادامه می‌دهیم.');
  await tap(page, 'شکل ۶ چند دایره دارد؟');
  await cell(page, 4, 1, '۱۴');
  await cell(page, 5, 1, '۱۸');
  await expect(canvas(page).locator('td.hop')).toHaveText(['', '+۲', '+۳', '+۴', '+۴', '+۴']);
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('هر بار یکی بیشتر');
  await cell(page, 4, 1, '۱۵');
  await cell(page, 5, 1, '۲۱');
  await answer(page).fill('۱۵');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('شکل ۵');
  await answer(page).fill('۲۱');
  await check(page, 'fa-IR');
  await expect(fbOk(page)).toContainText('۱۵ + ۶ = ۲۱');
});

test('en eliminate: cross out the orders starting with 0; crossing a real number is caught', async ({ page }) => {
  await page.goto(URL('en'));
  await page.locator('.mission-tab').nth(2).click();
  await tap(page, 'There are 3 cards with 7, 0 and 9 on them.');
  await tap(page, 'We use all three cards to make a three-digit number.');
  await tap(page, 'How many three-digit numbers can we make?');
  await expect(canvas(page).locator('.kg-pc-item')).toHaveText(['709', '790', '079', '097', '907', '970']);
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('start with 0');
  const item = (t: string) => canvas(page).locator('.kg-pc-item', { hasText: new RegExp(`^${t}$`) });
  await item('079').click();
  await item('709').click();
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('real three-digit number');
  await item('709').click();
  await item('097').click();
  await expect(canvas(page).locator('.kg-pc-item.x')).toHaveText(['079', '097']);
  await answer(page).fill('6');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('crossed out');
  await answer(page).fill('4');
  await check(page, 'en');
  await expect(fbOk(page)).toContainText('709, 790, 907 and 970');
});

test('en guess and check: the log says too few or too many legs; answering the hens is a trap', async ({ page }) => {
  await page.goto(URL('en'));
  await page.locator('.mission-tab').nth(3).click();
  await tap(page, 'A farm has some sheep and some hens. Altogether they have 10 heads.');
  await tap(page, 'Altogether they have 28 legs.');
  await tap(page, 'How many sheep are on the farm?');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('Try it');
  const x = canvas(page).locator('input[data-a="gx"]');
  await x.fill('2');
  await canvas(page).getByRole('button', { name: 'Try it' }).click();
  await check(page, 'en');
  await expect(fbNo(page)).toContainText("haven't reached 28");
  await x.fill('6');
  await x.press('Enter');
  await x.fill('4');
  await canvas(page).getByRole('button', { name: 'Try it' }).click();
  await expect(canvas(page).locator('td.cmp')).toHaveText(['< 28', '> 28', '= 28 ✓']);
  await answer(page).fill('6');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('number of hens');
  await answer(page).fill('4');
  await check(page, 'en');
  await expect(fbOk(page)).toContainText('28 legs');
});

test('every mission fits 390px with no horizontal scroll, and targets are at least 44px', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    for (let m = 0; m < 4; m++) {
      await page.locator('.mission-tab').nth(m).click();
      await expect(canvas(page).locator('.kg-pc-tool')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const small = await canvas(page).locator('button, input').evaluateAll((bs) =>
        bs.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
      expect(small, `${loc} mission ${m + 1}: targets under 44px`).toBe(0);
    }
  }
});
