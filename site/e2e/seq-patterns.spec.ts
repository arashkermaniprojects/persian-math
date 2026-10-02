import { expect, test, type Page } from '@playwright/test';

const URL_FA = '/fa-IR/studio/seq-patterns/';
const URL_EN = '/en/studio/seq-patterns/';
const pm = (page: Page) => page.locator('kg-pattern-machine');
const slot = (page: Page, i: number) => pm(page).locator(`.kg-pm-row [data-i="${i}"]`);
const put = (page: Page, item: string) => pm(page).locator(`.kg-pm-pal [data-v="${item}"]`).click();
const field = (page: Page, key: string) => pm(page).locator(`input[data-key="${key}"]`);
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();
const check = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

test('fa-IR: continue a repeating pattern (wrong colour, then right)', async ({ page }) => {
  await page.goto(URL_FA);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(pm(page).locator('.kg-pm-row .kg-pm-slot')).toHaveCount(9);
  await expect(pm(page).locator('.kg-pm-row button')).toHaveCount(3); // only the empty end is editable
  await expect(slot(page, 6)).toHaveAttribute('aria-pressed', 'true'); // first empty space is chosen
  await expect(pm(page).locator('.kg-pm-hint')).toContainText('الگو را ادامه بده');

  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('خانهٔ خالی');

  await put(page, 'blue-circle');
  await put(page, 'blue-triangle');
  await put(page, 'blue-triangle');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('رنگش');

  await slot(page, 6).click();
  await put(page, 'red-circle');
  await expect(slot(page, 6)).toHaveAttribute('aria-label', 'خانهٔ ۷: قرمز دایره');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR: find the unit of repeat (too short, then right)', async ({ page }) => {
  await page.goto(URL_FA);
  await tab(page, 1);
  await slot(page, 2).click();
  await expect(pm(page).locator('.kg-pm-slot.unit')).toHaveCount(2);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('زود است');
  await slot(page, 4).click();
  await expect(pm(page).locator('.kg-pm-slot.cut')).toHaveCount(2); // the row is cut after every unit
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: fix the mistake (unchanged, then fixed)', async ({ page }) => {
  await page.goto(URL_FA);
  await tab(page, 2);
  await expect(pm(page).locator('.kg-pm-pal button').first()).toBeDisabled(); // choose a space first
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('رنگ');
  await slot(page, 4).click();
  await put(page, 'yellow-circle');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: matchstick pattern (four sticks each, then right)', async ({ page }) => {
  await page.goto(URL_FA);
  await tab(page, 3);
  await expect(pm(page).locator('.kg-pm-fig')).toHaveCount(3);
  await expect(pm(page).locator('.kg-pm-fig').nth(1).locator('line')).toHaveCount(7);
  await expect(pm(page).locator('.kg-pm-tab td').first()).toHaveText('۱');
  await field(page, 't4').fill('۱۳');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('هر دو خانه');
  await field(page, 't10').fill('۴۰');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('ضلع مشترک');
  await field(page, 't10').fill('۳۱');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: number jumps (counted the start, then right); the hops show the typed jump', async ({ page }) => {
  await page.goto(URL_FA);
  await tab(page, 4);
  await expect(pm(page).locator('.kg-pm-hop b').first()).toHaveText('+?');
  await field(page, 'step').fill('۴');
  await expect(pm(page).locator('.kg-pm-hop b').first()).toHaveText('+۴');
  await field(page, 't4').fill('۱۴');
  await field(page, 't5').fill('۱۸');
  await field(page, 't6').fill('۲۲');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('خود ۱۱');
  await field(page, 't4').fill('۱۵');
  await field(page, 't5').fill('۱۹');
  await field(page, 't6').fill('۲۳');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: continue the pattern with the keyboard (wrong shape, then right)', async ({ page }) => {
  await page.goto(URL_EN);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  const red = pm(page).locator('.kg-pm-pal [data-v="red-triangle"]');
  await red.focus();
  await page.keyboard.press('Enter');
  await expect(slot(page, 6)).toHaveAttribute('aria-label', 'space 7: red triangle');
  await expect(pm(page).locator('.kg-pm-pal [data-v="blue-triangle"]')).toHaveAttribute('aria-label', 'blue triangle');
  await put(page, 'blue-triangle');
  await put(page, 'blue-triangle');
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('not the shape');
  await slot(page, 6).click();
  await put(page, 'red-circle');
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: unit twice over, then right; matchsticks forgot the first stick, then right', async ({ page }) => {
  await page.goto(URL_EN);
  await tab(page, 1);
  await slot(page, 8).click();
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('twice over');
  await slot(page, 4).click();
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 3);
  await field(page, 't4').fill('13');
  await field(page, 't10').fill('30');
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('first stick');
  await field(page, 't10').fill('31');
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: fix the mistake and number jumps (wrong jump, then right)', async ({ page }) => {
  await page.goto(URL_EN);
  await tab(page, 2);
  await slot(page, 4).click();
  await put(page, 'blue-square');
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('does not fit');
  await slot(page, 4).click();
  await put(page, 'yellow-circle');
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 4);
  for (const [k, v] of [['step', '3'], ['t4', '15'], ['t5', '19'], ['t6', '23']]) await field(page, k).fill(v);
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('jump size');
  await field(page, 'step').fill('4');
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width on any mission', async ({ page }) => {
  for (const url of [URL_FA, URL_EN]) {
    await page.goto(url);
    for (let i = 0; i < 5; i++) {
      await tab(page, i);
      await expect(pm(page)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${url} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
