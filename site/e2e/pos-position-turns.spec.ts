import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/pos-position-turns/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const MISSIONS = 5;

async function check(page: Page, loc: keyof typeof CHECK) {
  await page.getByRole('button', { name: CHECK[loc], exact: true }).click();
}
async function tab(page: Page, i: number) {
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('kg-shape-board')).toBeVisible();
}
const clear = (page: Page) => page.locator('kg-shape-board [data-act="clear"]').click();
const cw = (page: Page) => page.locator('kg-shape-board [data-act="cw"]').click();
const acw = (page: Page) => page.locator('kg-shape-board [data-act="acw"]').click();

test('fa-IR left of the circle: the right-hand shape is caught, then the triangle', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.kg-sb-main')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('.kg-sb-hint')).toContainText('روی یک شکل بزن');
  const shape = (name: string) => page.getByRole('checkbox', { name });
  // the board stays left to right: the triangle is drawn left of the circle even in an RTL page
  const [tri, sq] = await Promise.all([shape('مثلث نارنجی').boundingBox(), shape('مربع سبز').boundingBox()]);
  expect(tri!.x).toBeLessThan(sq!.x);

  await shape('مربع سبز').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('دست راست');

  await shape('مربع سبز').click();
  await shape('مثلث نارنجی').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR between: one square too low, then in the gap (keyboard)', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  const red = page.getByRole('button', { name: 'مربع قرمز' });
  await red.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز بین آن دو نیست');

  await red.focus();
  await page.keyboard.press('ArrowUp');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR quarter turn: anticlockwise is caught, then clockwise', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await expect(page.locator('.kg-sb-hint')).toContainText('بچرخان');
  await expect(page.getByRole('button', { name: 'ربع دور در جهت عقربه‌های ساعت' })).toBeVisible();
  await acw(page);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('خلاف جهت');

  await clear(page);
  await cw(page);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR three-quarter turn: a quarter turn clockwise lands there but is the long way', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 4);
  await cw(page);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('سه بار ↺');

  await clear(page);
  for (let i = 0; i < 3; i++) await acw(page);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: left of, between (drag), half turn', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.getByRole('checkbox', { name: 'Blue circle' }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('circle itself');
  await page.getByRole('checkbox', { name: 'Blue circle' }).click();
  await page.getByRole('checkbox', { name: 'Orange triangle' }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // between: drag the red square 3 right and 2 up with the mouse
  await tab(page, 1);
  const red = page.getByRole('button', { name: 'Red square' });
  await red.scrollIntoViewIfNeeded();
  const box = (await red.boundingBox())!, unit = box.width; // the piece is one square wide
  await page.mouse.move(box.x + unit / 2, box.y + unit / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + unit * 2, box.y - unit, { steps: 5 });
  await page.mouse.move(box.x + unit * 3.5, box.y - unit * 1.5, { steps: 5 });
  await page.mouse.up();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // half turn: anticlockwise twice also points at the ball, but this mission asks for clockwise
  await tab(page, 3);
  await acw(page);
  await acw(page);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('either way');
  await clear(page);
  await cw(page);
  await cw(page);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

for (const loc of ['fa-IR', 'en']) {
  test(`${loc}: no horizontal scroll at 390px on any mission`, async ({ page }) => {
    await page.goto(URL(loc));
    for (let i = 0; i < MISSIONS; i++) {
      await tab(page, i);
      const [sw, cw2] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(sw, `mission ${i + 1}`).toBeLessThanOrEqual(cw2);
    }
  });
}
