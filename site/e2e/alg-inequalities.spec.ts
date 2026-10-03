import { expect, test, type Page } from '@playwright/test';

// Pilot of the number-line `intervals` module (site/src/engines/number-line/intervals.ts).
const ID = 'alg-inequalities';
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
type Loc = keyof typeof CHECK;

async function open(page: Page, loc: Loc, i: number) {
  await page.goto(`/${loc}/studio/${ID}/`);
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('kg-number-line .kg-nl-svg')).toBeVisible();
  await page.locator('kg-number-line .kg-nl-iv').waitFor({ state: 'attached' }); // the module is loaded
}
async function tapTick(page: Page, i: number) {
  await page.locator('kg-number-line .kg-nl-svg').scrollIntoViewIfNeeded();
  const b = (await page.locator(`kg-number-line [data-tick="${i}"]`).boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const tickX = async (page: Page, i: number) => {
  const b = (await page.locator(`kg-number-line [data-tick="${i}"]`).boundingBox())!;
  return b.x + b.width / 2;
};
const check = (page: Page, loc: Loc) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const ok = (page: Page) => expect(page.locator('.feedback.ok')).toBeVisible();
const no = (page: Page, text: string) => expect(page.locator('.feedback.no')).toContainText(text);
const shape = (page: Page, kind: string) => page.locator(`kg-number-line button[data-kind="${kind}"]`).click();
const state = (page: Page) => page.locator('kg-number-line').evaluate((el) => (el as HTMLElement & { state: unknown }).state);

test('fa-IR: x > 3, from a segment to a ray with a hollow circle', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  // the line still increases left → right, and the shape buttons keep ← … → in screen order
  expect(await tickX(page, -2)).toBeLessThan(await tickX(page, 5));
  const kinds = page.locator('kg-number-line button[data-kind]');
  expect((await kinds.nth(0).boundingBox())!.x).toBeLessThan((await kinds.nth(2).boundingBox())!.x);
  await check(page, 'fa-IR');
  await no(page, 'روی ۳ بزن');
  await tapTick(page, 3);
  await check(page, 'fa-IR');
  await no(page, 'تمام نمی‌شوند');
  await shape(page, 'right');
  await check(page, 'fa-IR');
  await no(page, 'توخالی');
  // tap the dot itself: filled → hollow
  await page.locator('kg-number-line [data-h="0-0"]').click();
  await expect(page.locator('kg-number-line [data-h="0-0"] .kg-nl-end')).toHaveClass(/open/);
  await expect(page.locator('kg-number-line .kg-nl-read')).toBeHidden(); // no readout in this mission
  await check(page, 'fa-IR');
  await ok(page);
  expect(await state(page)).toMatchObject({ intervals: [{ from: 3, to: null, open: [true, true] }] });
});

test('fa-IR: the wrong way and the open/closed buttons; Persian digits on the line', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  await expect(page.locator('kg-number-line .kg-nl-lab').first()).toHaveText('−۳');
  await tapTick(page, 3);
  await shape(page, 'left');
  await check(page, 'fa-IR');
  await no(page, 'کوچک‌تر از ۳');
  await shape(page, 'right');
  await page.locator('kg-number-line button[data-open="1"]').click();
  await expect(page.locator('kg-number-line button[data-open="1"]')).toHaveAttribute('aria-pressed', 'true');
  await check(page, 'fa-IR');
  await ok(page);
});

test('fa-IR: read [−2, 4); success shows the interval left to right', async ({ page }) => {
  await open(page, 'fa-IR', 1);
  await expect(page.locator('kg-number-line .kg-nl-end')).toHaveCount(2);
  await expect(page.locator('kg-number-line button[data-kind]')).toHaveCount(0); // locked picture
  await page.locator('.choice').nth(0).click();
  await check(page, 'fa-IR');
  await no(page, 'توپر');
  await page.locator('.choice').nth(1).click();
  await check(page, 'fa-IR');
  await ok(page);
  await expect(page.locator('.feedback.ok bdi.set')).toHaveText('[−۲, ۴)');
  await expect(page.locator('.feedback.ok bdi.set')).toHaveAttribute('dir', 'ltr');
});

test('en: 1 ≥ x — the readout shows the ray drawn the wrong way', async ({ page }) => {
  await open(page, 'en', 2);
  await tapTick(page, 1);
  await shape(page, 'right');
  await expect(page.locator('kg-number-line .kg-nl-read')).toHaveText('x ≥ 1');
  await check(page, 'en');
  await no(page, 'your picture is');
  await shape(page, 'left');
  await expect(page.locator('kg-number-line .kg-nl-read')).toHaveText('x ≤ 1');
  await check(page, 'en');
  await ok(page);
});

test('fa-IR: 1 ≥ x readout shows the inequality and the interval', async ({ page }) => {
  await open(page, 'fa-IR', 2);
  await tapTick(page, 1);
  await shape(page, 'left');
  await expect(page.locator('kg-number-line .kg-nl-read bdi').nth(0)).toHaveText('x ≤ ۱');
  await expect(page.locator('kg-number-line .kg-nl-read bdi').nth(1)).toHaveText('(−∞, ۱]');
  await check(page, 'fa-IR');
  await ok(page);
});

test('fa-IR: 2x − 1 < 7 with the test point (keyboard) and dragging the boundary', async ({ page }) => {
  await open(page, 'fa-IR', 3);
  const probe = page.locator('kg-number-line [data-probe]');
  await expect(page.locator('kg-number-line .kg-nl-test')).toContainText('درست است');
  await probe.focus();
  for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('kg-number-line .kg-nl-test bdi')).toHaveText('x = ۴ → ۷ < ۷');
  await expect(page.locator('kg-number-line .kg-nl-test')).toContainText('نادرست');
  await expect(probe).toBeFocused();
  // the "subtract 1" slip: x < 3
  await tapTick(page, 3);
  await shape(page, 'left');
  await page.locator('kg-number-line button[data-open="1"]').click();
  await check(page, 'fa-IR');
  await no(page, 'اضافه کنی');
  // drag the circle from 3 to 4
  const h = (await page.locator('kg-number-line [data-h="0-1"]').boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(await tickX(page, 4), h.y + h.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('kg-number-line .kg-nl-read bdi').nth(0)).toHaveText('x < ۴');
  await check(page, 'fa-IR');
  await ok(page);
});

test('en: −3x ≥ 6 — the sign not turned round is caught', async ({ page }) => {
  await open(page, 'en', 4);
  await expect(page.locator('kg-number-line .kg-nl-test bdi')).toHaveText('x = 0 → 0 ≥ 6');
  await expect(page.locator('kg-number-line .kg-nl-test')).toContainText('false');
  await tapTick(page, -2);
  await shape(page, 'right');
  await check(page, 'en');
  await no(page, 'turns the inequality sign round');
  await shape(page, 'left');
  await check(page, 'en');
  await ok(page);
  // keyboard on a dot: Enter switches it, arrows move it
  const dot = page.locator('kg-number-line [data-h="0-1"]');
  await dot.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('kg-number-line .kg-nl-read')).toHaveText('x < −2');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('kg-number-line .kg-nl-read')).toHaveText('x < −3');
});

test('module options for later studios: unions, sign rows with a pole, given sets', async ({ page }) => {
  await open(page, 'en', 0);
  // a fresh line on the page, configured like alg-sign-tables will be
  await page.evaluate(() => {
    const el = document.createElement('kg-number-line') as HTMLElement & { config: unknown };
    el.id = 'probe-line';
    el.dataset.digits = '۰۱۲۳۴۵۶۷۸۹';
    el.dataset.decimal = ',';
    el.dataset.notation = 'both';
    el.config = { min: -4, max: 4, labels: 'whole', intervals: { max: 2, notation: 'auto', given: ['(-1, inf)'], signs: { num: ['x - 1'], den: ['x + 2'], edit: 'result' } } };
    document.querySelector('.mission')!.append(el);
  });
  const line = page.locator('#probe-line');
  await expect(line.locator('.kg-nl-cell')).toHaveCount(9); // 3 rows × 3 cells
  await expect(line.locator('.kg-nl-c')).toHaveCount(3); // only the result row is filled in by the learner
  await expect(line.locator('.kg-nl-end.open')).toHaveCount(2); // the pole on the result row, and the given set's end
  const cell = line.locator('[data-c="2-1"]');
  await cell.click();
  await cell.click(); // '' → + → −
  await expect(cell.locator('.kg-nl-sign')).toHaveText('−');
  await line.locator('[data-c="2-0"]').focus();
  await page.keyboard.press('+');
  await line.locator('[data-c="2-2"]').focus();
  await page.keyboard.press('+');
  const s = await line.evaluate((el) => (el as HTMLElement & { state: { signs: { cells: string[][]; want: string[][] } } }).state);
  expect(s.signs.cells[2]).toEqual(['+', '-', '+']);
  expect(s.signs.want).toEqual([['-', '-', '+'], ['-', '+', '+'], ['+', '-', '+']]);
  // two pieces: (−∞, −2) ∪ [1, ∞), read in Afghan style with "،" between the ends
  await line.locator('button.add').click();
  await line.locator('button[data-kind="left"]').click();
  const box = (await line.locator('[data-tick="-2"]').boundingBox())!;
  const h = (await line.locator('[data-h="0-1"]').boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, h.y + h.height / 2, { steps: 6 });
  await page.mouse.up();
  await line.locator('button[data-open="1"]').click();
  await line.locator('button.add').click();
  await line.locator('button[data-kind="right"]').click();
  const one = (await line.locator('[data-tick="1"]').boundingBox())!;
  const h2 = (await line.locator('[data-h="1-0"]').boundingBox())!;
  await page.mouse.move(h2.x + h2.width / 2, h2.y + h2.height / 2);
  await page.mouse.down();
  await page.mouse.move(one.x + one.width / 2, h2.y + h2.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(line.locator('.kg-nl-read bdi').last()).toHaveText('(−∞، −۲) ∪ [۱، ∞)');
  await expect(line.locator('button.add')).toBeHidden();
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en'] as const) {
    await page.goto(`/${loc}/studio/${ID}/`);
    for (let m = 0; m < 5; m++) {
      await page.locator('.mission-tab').nth(m).click();
      await expect(page.locator('kg-number-line .kg-nl-svg')).toBeVisible();
      await page.locator('kg-number-line .kg-nl-iv').waitFor({ state: 'attached' }); // the module is loaded
      if (m !== 1) await tapTick(page, 0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
