import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/num-count-to-10/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

async function check(page: Page, loc: keyof typeof CHECK) {
  await page.getByRole('button', { name: CHECK[loc], exact: true }).click();
}
const tile = (page: Page, n: string) => page.locator('kg-counters .kg-ct-pick').getByRole('radio', { name: n, exact: true });
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();

test('fa-IR match: one apple per plate, then the apples left over', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const pile = page.locator('kg-counters .kg-ct-zone.group button.kg-ct-c');
  await expect(pile).toHaveCount(8);
  await expect(page.locator('kg-counters .kg-ct-zone.row .kg-ct-empty')).toHaveCount(6);

  // Wrong: an empty plate is left
  for (let i = 0; i < 5; i++) await pile.first().click();
  await tile(page, '۳').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بشقاب خالی');

  await pile.first().click();
  await expect(page.locator('kg-counters .kg-ct-zone.row .kg-ct-c')).toHaveCount(6);
  // A full row: the last apples cannot move
  await pile.first().click();
  await expect(pile).toHaveCount(2);

  // Wrong: counted every apple
  await tile(page, '۸').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('همهٔ سیب‌هاست');

  await tile(page, '۲').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR count-frame: build 7 in the ten-frame, then tap 7', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await expect(page.locator('kg-counters .kg-ct-zone.group .kg-ct-c')).toHaveCount(7);
  const empty = page.locator('kg-counters .kg-ct-frame button.kg-ct-empty');
  for (let i = 0; i < 6; i++) await empty.first().click();
  await tile(page, '۶').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('کم گذاشتی');

  await empty.first().click();
  await expect(page.locator('kg-counters .kg-ct-frame .kg-ct-c')).toHaveCount(7);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('کوچک‌تر');
  await tile(page, '۷').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۵ تا و ۲ تا');
});

test('fa-IR who-has-more and signs: circle the extras, bigger number, then the sign', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  const maryam = page.locator('kg-counters .kg-ct-zone.row').nth(1).locator('button.kg-ct-c');
  await expect(maryam).toHaveCount(8);
  for (const i of [5, 6, 7]) await maryam.nth(i).click();
  await tile(page, '۵').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بزرگ‌تر');
  await tile(page, '۸').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 3);
  const choices = page.locator('.choices .choice');
  await expect(choices).toHaveCount(3);
  await expect(choices.first()).toContainText('۶');
  await choices.nth(1).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('دهانهٔ باز');
  await choices.nth(0).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: every mission, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  // match
  const pile = page.locator('kg-counters .kg-ct-zone.group button.kg-ct-c');
  for (let i = 0; i < 6; i++) await pile.first().click();
  await tile(page, '6').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText("didn't fit");
  await tile(page, '2').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('2 apples are left over');

  // count-frame
  await tab(page, 1);
  const empty = page.locator('kg-counters .kg-ct-frame button.kg-ct-empty');
  for (let i = 0; i < 8; i++) await empty.first().click();
  await tile(page, '7').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Too many in the frame');
  await page.locator('kg-counters .kg-ct-frame button.kg-ct-c').last().click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // who-has-more
  await tab(page, 2);
  const maryam = page.locator('kg-counters .kg-ct-zone.row').nth(1).locator('button.kg-ct-c');
  for (const i of [6, 7]) await maryam.nth(i).click();
  await tile(page, '8').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('no partner');
  await maryam.nth(5).click();
  await tile(page, '3').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('bigger number');
  await tile(page, '8').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // signs
  await tab(page, 3);
  const choices = page.locator('.choices .choice');
  await expect(choices.first()).toHaveText(/6\s*<\s*9/);
  await choices.nth(2).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('open mouth');
  await choices.nth(0).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('6 < 9');
});

test('no horizontal scroll at 390px and 44px targets on every mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    const n = await page.locator('.mission-tab').count();
    expect(n).toBe(4);
    for (let m = 0; m < n; m++) {
      await tab(page, m);
      await expect(page.locator('kg-counters')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const small = await page.locator('kg-counters button').evaluateAll((bs) =>
        bs.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
      expect(small, `${loc} mission ${m + 1}: buttons under 44px`).toBe(0);
    }
  }
});
