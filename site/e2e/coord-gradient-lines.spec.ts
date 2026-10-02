import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/coord-gradient-lines/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const MISSIONS = 5;

async function open(page: Page, loc: keyof typeof CHECK, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('kg-coord-plane svg.kg-cp-svg')).toBeVisible();
}
const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const ok = (page: Page) => expect(page.locator('.feedback.ok')).toBeVisible();
const no = (page: Page, text: string) => expect(page.locator('.feedback.no')).toContainText(text);

/** Page position of plane point (x, y), from the engine's own mapping (x right, y up, in every locale). */
async function at(page: Page, x: number, y: number) {
  const svg = page.locator('kg-coord-plane svg.kg-cp-svg');
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  const [px, py, w, h] = await svg.evaluate((s: SVGSVGElement, [x, y]) => {
    const el = s.closest('kg-coord-plane') as HTMLElement & { sx(v: number): number; sy(v: number): number };
    return [el.sx(x), el.sy(y), s.viewBox.baseVal.width, s.viewBox.baseVal.height];
  }, [x, y]);
  return [box.x + (px * box.width) / w, box.y + (py * box.height) / h];
}
async function tapAt(page: Page, x: number, y: number) {
  const [px, py] = await at(page, x, y);
  await page.mouse.click(px, py);
}
/** Drag with the mouse from one plane point to another, in small steps like a finger. */
async function dragFrom(page: Page, from: [number, number], to: [number, number]) {
  const [ax, ay] = await at(page, ...from), [bx, by] = await at(page, ...to);
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(bx, by, { steps: 8 });
  await page.mouse.up();
}
const handle = (page: Page, i: number) => page.locator(`kg-coord-plane [data-h="${i}"]`);
async function press(page: Page, keys: string[]) {
  for (const k of keys) await page.keyboard.press(k);
}
async function clicks(page: Page, name: string, n: number) {
  for (let i = 0; i < n; i++) await page.getByRole('button', { name, exact: true }).click();
}

test('fa-IR rise over run: run ÷ rise is caught, then the right gradient with the keyboard', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  // the step triangle labels run and rise in Persian digits; the letters are آ and ب
  await expect(page.locator('kg-coord-plane .kg-cp-lt')).toHaveText(['آ', 'ب']);
  await expect(page.locator('kg-coord-plane .kg-cp-facts')).toContainText('تغییر طول ۴، تغییر عرض ۱');
  // B to (−1, 1): run 2, rise 3, a gradient of 3/2
  await dragFrom(page, [1, -1], [-1, 1]);
  await expect(page.locator('kg-coord-plane .kg-cp-facts')).toContainText('تغییر طول ۲، تغییر عرض ۳');
  await check(page, 'fa-IR');
  await no(page, 'جابه‌جا کردی');
  // arrow keys move the focused point: right means bigger x even on an RTL page
  await handle(page, 1).focus();
  await press(page, ['ArrowRight', 'ArrowDown']);
  await expect(handle(page, 1)).toBeFocused();
  await expect(handle(page, 1)).toHaveAttribute('aria-label', 'ب (۰, ۰)');
  await check(page, 'fa-IR');
  await ok(page);
});

test('fa-IR falling line: the sign and c from the x-axis are caught, then y = −2x + 4', async ({ page }) => {
  await open(page, 'fa-IR', 1);
  const eq = page.locator('kg-coord-plane .kg-cp-eq');
  await expect(eq).toHaveText('y = x');
  await clicks(page, 'زیاد کردن شیب a', 2);
  await clicks(page, 'زیاد کردن عرض از مبدأ b', 4);
  await expect(eq).toHaveText('y = ۲x + ۴');
  await check(page, 'fa-IR');
  await no(page, 'سربالاست');
  await clicks(page, 'کم کردن شیب a', 8);
  await clicks(page, 'کم کردن عرض از مبدأ b', 2);
  await expect(eq).toHaveText('y = −۲x + ۲');
  await check(page, 'fa-IR');
  await no(page, 'محور x (افقی)');
  // the range input itself works with the keyboard too
  await page.locator('kg-coord-plane input[data-k="c"]').focus();
  await press(page, ['ArrowRight', 'ArrowRight']);
  await expect(eq).toHaveText('y = −۲x + ۴');
  await check(page, 'fa-IR');
  await ok(page);
});

test('fa-IR table and plot: a sign slip in the table, squares counted on the y-axis, then right', async ({ page }) => {
  await open(page, 'fa-IR', 2);
  const cell = (i: number) => page.locator(`kg-coord-plane input[data-cell="${i}"]`);
  await check(page, 'fa-IR');
  await no(page, 'سطر y');
  await cell(0).fill('-۴');
  await cell(1).fill('۲');
  await cell(2).fill('۴');
  await cell(3).fill('۶');
  await check(page, 'fa-IR');
  await no(page, 'دوباره حساب کن');
  await cell(0).fill('۰');
  // one square on the y-axis is 2: counting squares puts (1, 4) at 8
  for (const [x, y] of [[-1, 0], [0, 2], [1, 8], [2, 6]]) await tapAt(page, x, y);
  await expect(page.locator('kg-coord-plane [data-p]')).toHaveCount(4);
  await check(page, 'fa-IR');
  await no(page, 'خانه‌ها را به جای واحد شمردی');
  await tapAt(page, 1, 8); // tap a point again to remove it
  await expect(page.locator('kg-coord-plane [data-p]')).toHaveCount(3);
  await tapAt(page, 1, 4);
  await check(page, 'fa-IR');
  await ok(page);
});

test('fa-IR line through two points: run over rise is caught, then y = 2x − 4', async ({ page }) => {
  await open(page, 'fa-IR', 3);
  await expect(page.locator('.prompt .vec').first().locator('span')).toHaveText(['۱', '-۲']);
  await expect(page.locator('kg-coord-plane .kg-cp-lt')).toHaveText(['آ', 'ب']);
  await clicks(page, 'کم کردن شیب a', 1);
  await expect(page.locator('kg-coord-plane .kg-cp-sliders output[data-k="m"] .frac')).toBeVisible(); // ½ is stacked, never 1/2 inline
  await check(page, 'fa-IR');
  await no(page, 'تغییر طول ÷ تغییر عرض');
  await clicks(page, 'زیاد کردن شیب a', 3);
  await clicks(page, 'کم کردن عرض از مبدأ b', 4);
  await expect(page.locator('kg-coord-plane .kg-cp-eq')).toHaveText('y = ۲x − ۴');
  await expect(page.locator('kg-coord-plane .kg-cp-int')).toHaveCount(1);
  await check(page, 'fa-IR');
  await ok(page);
});

test('fa-IR y = 3 or x = 3: the vertical line is caught as swapped, then the horizontal one', async ({ page }) => {
  await open(page, 'fa-IR', 4);
  await dragFrom(page, [-3, -2], [3, -3]);
  await dragFrom(page, [2, 1], [3, 2]);
  await check(page, 'fa-IR');
  await no(page, 'x = ۳ را کشیدی');
  await dragFrom(page, [3, -3], [-3, 3]);
  await dragFrom(page, [3, 2], [2, 3]);
  await expect(page.locator('kg-coord-plane .kg-cp-facts')).toContainText('تغییر عرض ۰');
  await check(page, 'fa-IR');
  await ok(page);
});

test('en: gradient sign, sliders and the table, with (x, y) pairs', async ({ page }) => {
  await open(page, 'en', 0);
  await expect(page.locator('kg-coord-plane .kg-cp-lt')).toHaveText(['A', 'B']);
  // B to (0, −4): a falling line, gradient −2/3
  await dragFrom(page, [1, -1], [0, -4]);
  await check(page, 'en');
  await no(page, 'goes down from left to right');
  await dragFrom(page, [0, -4], [0, 0]);
  await check(page, 'en');
  await ok(page);

  await page.locator('.mission-tab').nth(1).click();
  await clicks(page, 'Decrease gradient m', 6);
  await clicks(page, 'Increase intercept c', 4);
  await expect(page.locator('kg-coord-plane .kg-cp-eq')).toHaveText('y = −2x + 4');
  await check(page, 'en');
  await ok(page);

  await page.locator('.mission-tab').nth(2).click();
  for (const [i, v] of ['0', '0', '4', '6'].entries()) await page.locator(`kg-coord-plane input[data-cell="${i}"]`).fill(v);
  await check(page, 'en');
  await no(page, "Don't forget the + 2");
  await page.locator('kg-coord-plane input[data-cell="1"]').fill('2');
  for (const [x, y] of [[-1, 0], [2, 0], [1, 4], [2, 6]]) await tapAt(page, x, y);
  await check(page, 'en');
  await no(page, 'You swapped x and y');
});

test('keyboard: the plane cursor places points with Enter; arrows follow the axes in RTL', async ({ page }) => {
  await open(page, 'fa-IR', 2);
  for (const [i, v] of ['۰', '۲', '۴', '۶'].entries()) await page.locator(`kg-coord-plane input[data-cell="${i}"]`).fill(v);
  const svg = page.locator('kg-coord-plane svg.kg-cp-svg');
  await svg.focus();
  // the cursor starts at the origin; one step is one square (x: 1, y: 2)
  await press(page, ['ArrowLeft', 'Enter', 'ArrowRight', 'ArrowUp', 'Enter', 'ArrowRight', 'ArrowUp', 'Enter', 'ArrowRight', 'ArrowUp', 'Enter']);
  const pts = await page.locator('kg-coord-plane').evaluate((e) => (e as HTMLElement & { state: { plane: { points: number[][] } } }).state.plane.points);
  expect(pts).toEqual([[-1, 0], [0, 2], [1, 4], [2, 6]]);
  await page.getByRole('button', { name: CHECK['fa-IR'], exact: true }).focus();
  await page.keyboard.press('Enter');
  await ok(page);
  // Backspace on a focused point removes it
  await page.locator('kg-coord-plane [data-p="3"]').focus();
  await page.keyboard.press('Backspace');
  await expect(page.locator('kg-coord-plane [data-p]')).toHaveCount(3);
});

test('the plane is not mirrored in RTL: x grows to the right and y upwards', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  const nums = page.locator('kg-coord-plane text.kg-cp-num');
  const xOf = async (t: string) => Number(await nums.filter({ hasText: new RegExp(`^${t}$`) }).first().getAttribute('x'));
  expect(await xOf('۵')).toBeGreaterThan(await xOf('−۵'));
  const [lx] = await at(page, -4, 0), [rx] = await at(page, 4, 0);
  expect(rx).toBeGreaterThan(lx);
  const [, top] = await at(page, 0, 4), [, bottom] = await at(page, 0, -4);
  expect(top).toBeLessThan(bottom);
  await expect(page.locator('kg-coord-plane .kg-cp-main')).toHaveAttribute('dir', 'ltr');
});

test('no horizontal scroll at 390px and 44px touch targets, every mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en'] as const) {
    await page.goto(URL(loc));
    await expect(page.locator('.mission-tab')).toHaveCount(MISSIONS);
    for (let m = 0; m < MISSIONS; m++) {
      await page.locator('.mission-tab').nth(m).click();
      await expect(page.locator('kg-coord-plane .kg-cp-hint')).toBeVisible();
      if (m === 2) await tapAt(page, 0, 2); // a point to measure
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      // measured in one pass: the plane re-renders, so element handles can go stale between calls
      const sizes = await page.evaluate(() => [...document.querySelectorAll('kg-coord-plane :is(button, input, [data-p], [data-h])')]
        .map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height).map((r) => Math.min(r.width, r.height)));
      expect(sizes.length, `${loc} mission ${m + 1} has targets`).toBeGreaterThan(0);
      for (const s of sizes) expect(s, `${loc} mission ${m + 1} target`).toBeGreaterThanOrEqual(44);
    }
  }
});
