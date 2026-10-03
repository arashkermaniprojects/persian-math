import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/geo-parallel-angles/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const MISSIONS = 5;
const FA = '۰۱۲۳۴۵۶۷۸۹';
const latin = (s: string) => s.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)));

async function check(page: Page, loc: keyof typeof CHECK) {
  await page.getByRole('button', { name: CHECK[loc], exact: true }).click();
}
async function tab(page: Page, i: number) {
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('kg-shape-board .kg-sb-dyn')).toBeVisible();
}
const handle = (page: Page, p: string) => page.locator(`kg-shape-board [data-p="${p}"]`);
/** Keyboard: focus a handle and press an arrow key n times. */
async function nudge(page: Page, p: string, key: string, n = 1) {
  await handle(page, p).focus();
  for (let i = 0; i < n; i++) await page.keyboard.press(key);
}
/** Pointer: drag a handle by (dx, dy) screen pixels in a few steps. */
async function drag(page: Page, p: string, dx: number, dy: number) {
  const dot = handle(page, p).locator('.kg-sb-h');
  await dot.scrollIntoViewIfNeeded();
  const b = (await dot.boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
}
/** The number in a readout chip, e.g. "∠۴ = ۶۵°" → 65. */
async function reading(page: Page, i: number) {
  const t = latin((await page.locator('kg-shape-board .kg-sb-w').nth(i).textContent()) ?? '');
  return Number(t.split('=')[1].replace(/[^\d.]/g, ''));
}
const answer = (page: Page, v: string) => page.locator('.int-input').fill(v);
const no = (page: Page) => page.locator('.feedback.no');
const ok = (page: Page) => page.locator('.feedback.ok');
const arrows = (page: Page) => page.locator('kg-shape-board polyline.kg-sb-mk');

test('fa-IR what stays: drag first, a wrong claim is caught, then the equal angles', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(arrows(page)).toHaveCount(2); // AB ∥ CD: one chevron on each
  // letters are Latin as in both countries' books; angle numbers and readouts use Persian digits
  await expect(page.locator('kg-shape-board .kg-sb-lt').first()).toHaveText('A');
  await expect(page.locator('kg-shape-board .kg-sb-w').first()).toHaveText('∠۲ = ۶۵°');
  await page.getByRole('radio', { name: /همیشه با هم برابرند/ }).click();
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('چند وضعیت');
  await nudge(page, 'H', 'ArrowRight', 2); // turn the transversal 10°
  await nudge(page, 'E', 'ArrowRight'); // slide it along AB
  await nudge(page, 'B', 'ArrowDown'); // turn both lines
  const vals = [await reading(page, 0), await reading(page, 1), await reading(page, 2)];
  expect(vals[0]).not.toBe(65);
  expect(new Set(vals).size).toBe(1);
  await expect(arrows(page)).toHaveCount(2); // still parallel
  await page.getByRole('radio', { name: /مجموع/ }).click();
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('برابرند');
  await page.getByRole('radio', { name: /همیشه با هم برابرند/ }).click();
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR co-interior: the same angle again is a trap; 180 − ∠4 after turning is right', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await expect(page.locator('kg-shape-board .kg-sb-w')).toHaveCount(1); // ∠5 is hidden
  await expect(page.locator('kg-shape-board text.kg-sb-ang', { hasText: '?' })).toHaveCount(1);
  await drag(page, 'H', -40, 0); // turn the transversal with the pointer
  const a4 = await reading(page, 0);
  expect(a4).not.toBe(65);
  const fa = (n: number) => String(n).replace(/\d/g, (d) => FA[+d]);
  await answer(page, fa(a4));
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('برابر نیستند');
  await answer(page, fa(180 - a4));
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR not parallel: assuming the angles equal is caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await expect(arrows(page)).toHaveCount(0); // CD is tilted: no parallel marks
  await page.getByRole('radio', { name: /برابر است/ }).click();
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('فقط برای خط‌های موازی');
  await page.getByRole('radio', { name: /برابر نیست/ }).click();
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR make parallel: move D until ∠4 = ∠6 and the parallel marks appear', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('هنوز نه');
  await expect(arrows(page)).toHaveCount(0);
  await nudge(page, 'D', 'ArrowDown');
  await expect(arrows(page)).toHaveCount(2);
  expect(await reading(page, 0)).toBe(await reading(page, 1));
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR triangle sum: explore first; 360 is a trap; 180 is right', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 4);
  await answer(page, '۱۸۰');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('دو مثلث');
  await nudge(page, 'A', 'ArrowLeft', 2);
  await nudge(page, 'C', 'ArrowUp');
  await answer(page, '۳۶۰');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('دور کامل');
  await answer(page, '۱۸۰');
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('en: drag with the pointer, co-interior and triangle sum, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await drag(page, 'E', 60, 0);
  await drag(page, 'H', 30, 0);
  await drag(page, 'B', 0, 25);
  await page.getByRole('radio', { name: '∠2 always stays 65°.' }).click();
  await check(page, 'en');
  await expect(no(page)).toContainText('Turn the ring');
  await page.getByRole('radio', { name: '∠2, ∠4 and ∠6 are always equal.' }).click();
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await tab(page, 1);
  await answer(page, '65');
  await check(page, 'en');
  await expect(no(page)).toContainText('not equal');
  await answer(page, '115');
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await tab(page, 4);
  await drag(page, 'A', 40, 0);
  await drag(page, 'B', 0, -30);
  await answer(page, '90');
  await check(page, 'en');
  await expect(no(page)).toContainText('right angle');
  await answer(page, '180');
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();
});

test('the dynamic module loads only where a mission asks for it', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (r) => scripts.push(r.url()));
  await page.goto('/fa-IR/studio/geo-lines-angles/');
  await expect(page.locator('kg-shape-board svg.kg-sb-svg')).toBeVisible();
  expect(scripts.some((u) => /\/dynamic\.[\w-]+\.js$/.test(u))).toBe(false);
  await page.goto(URL('fa-IR'));
  await expect(page.locator('kg-shape-board .kg-sb-dyn')).toBeVisible();
  expect(scripts.some((u) => /\/dynamic\.[\w-]+\.js$/.test(u))).toBe(true);
});

for (const loc of ['fa-IR', 'en']) {
  test(`${loc}: no horizontal scroll at 390px on any mission`, async ({ page }) => {
    await page.goto(URL(loc));
    for (let i = 0; i < MISSIONS; i++) {
      await tab(page, i);
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(sw, `mission ${i + 1}`).toBeLessThanOrEqual(cw);
    }
  });
}
