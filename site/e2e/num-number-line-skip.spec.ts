import { expect, test, type Page } from '@playwright/test';

const ID = 'num-number-line-skip';
/** Tap the number line on tick i (here tick i = the number i). */
async function tapTick(page: Page, i: number) {
  await page.locator('kg-number-line svg').scrollIntoViewIfNeeded();
  const b = (await page.locator(`kg-number-line [data-tick="${i}"]`).boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const check = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const mission = (page: Page, n: number) => page.locator('.mission-tab').nth(n).click();

test('fa-IR: find 15 on a 0–20 line (too small first)', async ({ page }) => {
  await page.goto(`/fa-IR/studio/${ID}/`);
  await expect(page.locator('.kg-nl-hint')).toContainText('روی محور بزن');
  await tapTick(page, 5);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('کمی جلوتر برو');
  await tapTick(page, 15); // the line is full: the tap moves the point
  await expect(page.locator('kg-number-line .kg-nl-pt')).toHaveCount(1);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR: hop in 2s draws +۲ arcs; too few hops first', async ({ page }) => {
  await page.goto(`/fa-IR/studio/${ID}/`);
  await mission(page, 1);
  for (const i of [2, 4, 6]) await tapTick(page, i);
  await expect(page.locator('kg-number-line .kg-nl-jump')).toHaveCount(3);
  await expect(page.locator('kg-number-line .kg-nl-hop').first()).toHaveText('+۲');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('باید ۵ تا باشد');
  for (const i of [8, 10]) await tapTick(page, i);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toContainText('عدد زوج');
});

test('en: hop in 5s, fix a wrong hop with the keyboard', async ({ page }) => {
  await page.goto(`/en/studio/${ID}/`);
  await mission(page, 3);
  for (const i of [5, 10, 14, 20]) await tapTick(page, i);
  await expect(page.locator('kg-number-line .kg-nl-hop')).toHaveText(['+5', '+5', '+4', '+6']);
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText("isn't a 5");
  await page.locator('kg-number-line .kg-nl-pt').nth(2).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('kg-number-line .kg-nl-pt').nth(2)).toHaveAttribute('aria-valuetext', '15');
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: hop in 10s on 0–100 snaps to tens and lands on 50', async ({ page }) => {
  await page.goto(`/en/studio/${ID}/`);
  await mission(page, 4);
  await expect(page.locator('kg-number-line [data-tick="45"]')).toHaveCount(0); // only tens are drawn
  for (const i of [10, 20, 30, 40, 50]) await tapTick(page, i);
  await expect(page.locator('kg-number-line .kg-nl-val').last()).toHaveText('50');
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toContainText('halfway');
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/${ID}/`);
    for (let m = 0; m < 5; m++) {
      await mission(page, m);
      await expect(page.locator('kg-number-line svg')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
