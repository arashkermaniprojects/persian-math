import { expect, test, type Page } from '@playwright/test';
import { checkAlgebra, type AlgebraCheck, type AlgebraState } from '../src/engines/lib/algebra-tiles-check';

const URL = (loc: string) => `/${loc}/studio/alg-expressions-like-terms/`;
const CHECK: Record<string, string> = { 'fa-IR': 'بررسی کن', en: 'Check' };
const at = (page: Page) => page.locator('kg-algebra-tiles');
const add = (page: Page, kind: string, sign = 1) => at(page).locator(`[data-a="add"][data-kind="${kind}"][data-sign="${sign}"]`);
const mat = (page: Page) => at(page).locator('.kg-at-mat');
const matTiles = (page: Page) => mat(page).locator('.kg-at-cell');
const tool = (page: Page, a: string) => at(page).locator(`.kg-at-tools [data-a="${a}"]`);
const answer = (page: Page) => at(page).locator('[data-a="field"][data-f="w"]');
const no = (page: Page) => page.locator('.feedback.no');
const ok = (page: Page) => page.locator('.feedback.ok');
const msg = (page: Page) => at(page).locator('.kg-at-msg');

async function open(page: Page, loc: string, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(at(page).locator('.kg-at')).toBeVisible();
}
const check = (page: Page, loc: string) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();

/** Type on the engine's keypad: "3x^2+2x-3" (a ^ and its digit are one key). */
async function write(page: Page, s: string) {
  for (let n = (await answer(page).textContent())!.length + 4; n > 0; n--) {
    const del = at(page).locator('[data-a="key"][data-v="del"]');
    await del.click();
    if (!(await answer(page).textContent())) break;
  }
  for (const k of s.match(/\^\d|./g)!) await at(page).locator(`[data-a="key"][data-v="${k}"]`).click();
}
async function build(page: Page, tiles: [string, number][]) {
  if (await tool(page, 'clear').isEnabled()) await tool(page, 'clear').click();
  for (const [k, n] of tiles) for (let i = 0; i < n; i++) await add(page, k, n < 0 ? -1 : 1).click();
}
const tile = (page: Page, name: string) => mat(page).locator(`button[aria-label="${name}"]`);

test('fa-IR: build 2x + 3 — five strips, a big square and swapped numbers are caught, then right', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, 'fa-IR', 0);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.mission h2 bdi.alg')).toHaveText('۲x + ۳');
  await expect(page.locator('.mission h2 bdi.alg')).toHaveAttribute('dir', 'ltr');
  await expect(at(page).locator('.kg-at-hint')).toContainText('روی کاشی‌ها بزن');
  // The tray: a white row and a red row of x², x, 1, left to right.
  await expect(at(page).locator('.kg-at-tray')).toHaveAttribute('dir', 'ltr');
  await expect(at(page).locator('.kg-at-tray .kg-at-row').first().locator('button')).toHaveCount(3);
  await expect(add(page, 'x', -1)).toHaveAttribute('aria-label', 'اضافه کن: −x');
  await expect(add(page, 'x', -1).locator('.kg-at-t')).toHaveClass(/neg/);

  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('صفحهٔ کار خالی است');

  await build(page, [['x', 5]]);
  await expect(matTiles(page)).toHaveCount(5);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('پنج نوار');

  await build(page, [['x^2', 1], ['1', 3]]);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('مربع بزرگ');

  await build(page, [['x', 3], ['1', 2]]);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('۲ مال x است');

  // Remove one strip: select it, then «بردار».
  await expect(tool(page, 'remove')).toBeDisabled();
  await matTiles(page).first().click();
  await expect(matTiles(page).first()).toHaveAttribute('aria-pressed', 'true');
  await tool(page, 'remove').click();
  await expect(matTiles(page)).toHaveCount(4);
  await add(page, '1').click();
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('آفرین');
  await expect(page.locator('.justify textarea')).toBeVisible();
  expect(errors).toEqual([]);
});

test('fa-IR: red tiles — different shapes do not cancel, a zero pair does; the forgotten white tile is caught', async ({ page }) => {
  await open(page, 'fa-IR', 1);
  await expect(matTiles(page)).toHaveCount(6);
  await expect(mat(page).locator('.kg-at-t.neg')).toHaveCount(3);
  await expect(at(page).locator('.kg-at-tray')).toHaveCount(0); // nothing to add in a reading mission

  await tile(page, 'کاشی x').click();
  await tile(page, 'کاشی −۱').first().click();
  await expect(msg(page)).toContainText('هم‌شکل نیستند');
  await expect(matTiles(page)).toHaveCount(6);

  await tile(page, 'کاشی ۱').click();
  await tile(page, 'کاشی −۱').first().click();
  await expect(msg(page)).toContainText('با هم صفر می‌شوند');
  await expect(matTiles(page)).toHaveCount(4);

  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('با دکمه‌ها بنویس');

  await write(page, 'x^2+x-3');
  await expect(answer(page)).toHaveText('x۲ + x − ۳');
  await expect(answer(page).locator('sup')).toHaveText('۲');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('مربع کوچک سفید را فراموش کردی');

  await write(page, 'x^2+x+1-3');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('ساده‌ترش کن');

  await write(page, 'x^2+x+');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('تمام نشده');

  await write(page, 'x^2+x-2');
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('درست است');
});

test('fa-IR: collect like terms — sorting groups the tiles; 5x³, a red strip "cancelled" with a square and a lost minus are caught', async ({ page }) => {
  await open(page, 'fa-IR', 2);
  await expect(matTiles(page)).toHaveCount(12);
  await expect(mat(page).locator('.kg-at-cell.gap')).toHaveCount(0);
  await tool(page, 'sort').click();
  const names = await matTiles(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(names).toEqual(['کاشی x²', 'کاشی x²', 'کاشی x²', 'کاشی x', 'کاشی x', 'کاشی x', 'کاشی −x', 'کاشی ۱', 'کاشی −۱', 'کاشی −۱', 'کاشی −۱', 'کاشی −۱']);
  await expect(mat(page).locator('.kg-at-cell.gap')).toHaveCount(2); // three groups: the three like terms

  await write(page, '5x^3-3');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('یک جمله نمی‌شوند');

  await write(page, '3x^2+3x-4');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('با هم صفر نمی‌شوند');

  await write(page, '3x^2+4x-3');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('یک x کم می‌کند');

  await write(page, '4x^2-3');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('دو نوار');

  await write(page, '2x^2+x^2+2x-3');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('هنوز جملهٔ متشابه داری');

  // Take the zero pairs off on the mat too: a white and a red strip, a white and a red square.
  await tile(page, 'کاشی x').first().click();
  await tile(page, 'کاشی −x').click();
  await tile(page, 'کاشی ۱').click();
  await tile(page, 'کاشی −۱').first().click();
  await expect(matTiles(page)).toHaveCount(8);
  await write(page, '3x^2+2x-3');
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('عالی');
});

test('fa-IR: substitute x = 3 — 2x read as 23 and as 2 + x are caught; flipped tiles show 3', async ({ page }) => {
  await open(page, 'fa-IR', 3);
  await expect(mat(page).locator('button')).toHaveCount(0); // the mat is locked
  await expect(mat(page).locator('.kg-at-t').first()).toHaveText('x');
  const flip = tool(page, 'flip');
  await expect(flip).toHaveText('برگردان: x = ۳');
  await expect(flip).toHaveAttribute('aria-pressed', 'false');
  await flip.click();
  await expect(flip).toHaveAttribute('aria-pressed', 'true');
  await expect(mat(page).locator('.kg-at-t').first()).toHaveText('۳');
  await expect(mat(page).locator('.kg-at-t').last()).toHaveText('۱');
  await expect(mat(page).locator('.kg-at-cell').first()).toHaveAttribute('aria-label', 'کاشی x: ۳');
  // A number keypad: digits and minus only.
  await expect(at(page).locator('[data-a="key"][data-v="x"]')).toHaveCount(0);

  await write(page, '28');
  await expect(answer(page)).toHaveText('۲۸');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('۲ را کنار ۳ نوشتی');

  await write(page, '10');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('جمع کردی، نه ضرب');

  await write(page, '12');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('زیاد است');

  await write(page, '11');
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('همین است');
});

test('fa-IR: substitute x = −3 into 4 − x² — the red square shows −(−3)²; 13 and 5 are caught, then −5', async ({ page }) => {
  await open(page, 'fa-IR', 4);
  await tool(page, 'flip').click();
  const big = mat(page).locator('.kg-at-t.neg');
  await expect(big).toHaveText('−(−۳)۲');
  await expect(big.locator('sup')).toHaveText('۲');
  // The expression on the tile runs left to right: the minus is drawn left of the bracket.
  const [m, b] = await big.evaluate((el) => {
    const t = el.querySelector('bdi')!.firstChild!, r = document.createRange();
    const x = (i: number) => { r.setStart(t, i); r.setEnd(t, i + 1); return r.getBoundingClientRect().left; };
    return [x(0), x(1)];
  });
  expect(m).toBeLessThan(b);

  await write(page, '13');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('۹ را اضافه کردی');

  await write(page, '5');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('از صفر کمتر');

  await write(page, '-5');
  await expect(answer(page)).toHaveText('−۵');
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('آفرین');
});

test('en: build, read the red tiles and substitute — traps then right answers', async ({ page }) => {
  await open(page, 'en', 0);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('.mission-tab')).toHaveCount(5);
  await build(page, [['x', 5]]);
  await check(page, 'en');
  await expect(no(page)).toContainText('five strips');
  await build(page, [['x', 2], ['1', 3]]);
  await check(page, 'en');
  await expect(ok(page)).toContainText('Well done');

  await page.locator('.mission-tab').nth(1).click();
  await tile(page, 'tile x').click();
  await tile(page, 'tile −1').first().click();
  await expect(msg(page)).toContainText('different shapes');
  await write(page, 'x^2+x+4');
  await check(page, 'en');
  await expect(no(page)).toContainText('Red tiles are negative');
  await write(page, 'x^2+x-2');
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await page.locator('.mission-tab').nth(3).click();
  await tool(page, 'flip').click();
  await write(page, '28');
  await check(page, 'en');
  await expect(no(page)).toContainText('making 23');
  await write(page, '11');
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();
});

test('en: everything works with the keyboard alone', async ({ page }) => {
  await open(page, 'en', 0);
  await add(page, 'x').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(add(page, 'x')).toBeFocused(); // focus stays on the tray button after the redraw
  await page.keyboard.press('Tab');
  await expect(add(page, '1')).toBeFocused();
  for (let k = 0; k < 4; k++) await page.keyboard.press('Space');
  await expect(matTiles(page)).toHaveCount(6);
  // The mat is one tab stop; arrows move along it and Delete removes a tile.
  await matTiles(page).first().focus();
  await page.keyboard.press('End');
  await expect(matTiles(page).last()).toBeFocused();
  await page.keyboard.press('Delete');
  await expect(matTiles(page)).toHaveCount(5);
  await page.getByRole('button', { name: 'Check', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(ok(page)).toBeVisible();

  await page.locator('.mission-tab').nth(1).click();
  await matTiles(page).first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(matTiles(page).nth(1)).toBeFocused();
  await answer(page).focus();
  await page.keyboard.type('x^2+x-2');
  await expect(answer(page)).toHaveText('x2 + x − 2');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('3');
  await expect(answer(page)).toHaveText('x2 + x − 3');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('2');
  await page.getByRole('button', { name: 'Check', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(ok(page)).toBeVisible();

  await page.locator('.mission-tab').nth(4).click();
  await tool(page, 'flip').focus();
  await page.keyboard.press('Enter');
  await expect(tool(page, 'flip')).toHaveAttribute('aria-pressed', 'true');
  await answer(page).focus();
  await page.keyboard.type('-5');
  await page.getByRole('button', { name: 'Check', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(ok(page)).toBeVisible();
});

test('no horizontal scroll at 390px and 44px targets, every mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    for (let i = 0; i < 5; i++) {
      await open(page, loc, i);
      if (i === 0) await build(page, [['x^2', 2], ['x', 4], ['1', 5], ['x', -2], ['1', -3]]);
      if (i >= 3) await tool(page, 'flip').click();
      if (i >= 1) await write(page, i >= 3 ? '-123' : '3x^2+2x-3');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
      for (const b of await at(page).locator('button, [tabindex]').all()) {
        const r = (await b.boundingBox())!;
        expect(Math.min(r.width, r.height), `${loc} mission ${i + 1} target`).toBeGreaterThanOrEqual(44);
      }
    }
  }
});

// The rectangle and grid modes (loaded on demand) are used by later studios; check them here on the pilot's page.
async function mount(page: Page, cfg: Record<string, unknown>) {
  await page.evaluate((c) => {
    const el = document.querySelector('kg-algebra-tiles') as unknown as { config: unknown; ready: Promise<void> };
    el.config = c;
    return el.ready; // the mode's code loads on demand
  }, cfg);
  await expect(at(page).locator('.kg-at').first()).toBeVisible();
}
const stateOf = (page: Page) => page.evaluate(() => (document.querySelector('kg-algebra-tiles') as unknown as { state: { algebra: AlgebraState } }).state);
const verdict = async (page: Page, c: Omit<AlgebraCheck, 'type'>) => checkAlgebra({ type: 'algebra', ...c }, await stateOf(page)).code ?? 'ok';

test('modes: rectangle — paint 3(x + 4); build the sides of x² + 5x + 6', async ({ page }) => {
  await open(page, 'en', 0);
  await mount(page, { mode: 'rectangle', sides: [3, 'x + 4'], write: 'expr' });
  const blocks = at(page).locator('.kg-at-block');
  await expect(blocks).toHaveCount(2);
  expect(await verdict(page, { rectangle: { cells: true } })).toBe('cells-empty');
  await at(page).locator('[data-a="m-brush"][data-v="x^2"]').click(); // x × 1 is not x²
  await blocks.first().click();
  await at(page).locator('[data-a="m-brush"][data-v="1"]').click();
  await blocks.last().click();
  expect(await verdict(page, { rectangle: { cells: true } })).toBe('wrong-cell');
  await at(page).locator('[data-a="m-brush"][data-v="x"]').click();
  await blocks.first().click();
  await write(page, '3x+4');
  expect(await verdict(page, { rectangle: { cells: true }, written: '3x + 12' })).toBe('wrong-1');
  await write(page, '3x+12');
  expect(await verdict(page, { rectangle: { cells: true }, written: '3x + 12' })).toBe('ok');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  await mount(page, { mode: 'rectangle', tiles: 'x^2 + 5x + 6' });
  const more = (side: number, k: string) => at(page).locator(`[data-a="m-side"][data-i="${side}"][data-kind="${k}"][data-d="1"]`);
  await more(0, 'x').click();
  await more(1, 'x').click();
  for (let k = 0; k < 6; k++) await more(0, '1').click();
  await more(1, '1').click();
  await expect(at(page).locator('.kg-at-block')).toHaveCount(4);
  expect(await verdict(page, { rectangle: { sides: ['x + 2', 'x + 3'] } })).toBe('not-given');
  for (let k = 0; k < 4; k++) await at(page).locator('[data-a="m-side"][data-i="0"][data-kind="1"][data-d="-1"]').click();
  await more(1, '1').click();
  await more(1, '1').click();
  expect(await verdict(page, { rectangle: { sides: ['x + 2', 'x + 3'] } })).toBe('ok');
  await expect(at(page).locator('.kg-at-read').last()).toHaveText('area: x2 + 5x + 6');
});

test('modes: grid — expand (x + 3)(x + 2) and divide x² + 5x + 6 by x + 2', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  await mount(page, { mode: 'grid', rows: 'x + 3', cols: 'x + 2' });
  const cell = (k: string) => at(page).locator(`[data-a="field"][data-f="${k}"]`);
  await expect(at(page).locator('.kg-at-grid')).toHaveAttribute('dir', 'ltr');
  await expect(cell('g0-0')).toHaveAttribute('aria-current', 'true');
  for (const [k, v] of [['g0-0', 'x^2'], ['g0-1', 'x+2'], ['g1-0', '3x'], ['g1-1', '6']]) {
    await cell(k).click();
    for (const key of v.match(/\^\d|./g)!) await at(page).locator(`[data-a="key"][data-v="${key}"]`).click();
  }
  expect(await verdict(page, { grid: { cells: true } })).toBe('added-not-multiplied');
  await cell('g0-1').click();
  for (let k = 0; k < 3; k++) await at(page).locator('[data-a="key"][data-v="del"]').click();
  for (const key of ['2', 'x']) await at(page).locator(`[data-a="key"][data-v="${key}"]`).click();
  expect(await verdict(page, { grid: { cells: true } })).toBe('ok');

  await mount(page, { mode: 'grid', rows: 'x + 2', cols: ['?', '?'], total: 'x^2 + 5x + 6' });
  expect(await verdict(page, { grid: { cells: true } })).toBe('headers-empty');
  for (const [k, v] of [['c0', 'x'], ['c1', '3'], ['g0-0', 'x^2'], ['g0-1', '3x'], ['g1-0', '2x'], ['g1-1', '6']]) {
    await cell(k).click();
    for (const key of v.match(/\^\d|./g)!) await at(page).locator(`[data-a="key"][data-v="${key}"]`).click();
  }
  expect(await verdict(page, { grid: { cells: true, cols: ['x', '3'] } })).toBe('ok');
});
