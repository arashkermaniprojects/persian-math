import { expect, test, type Page } from '@playwright/test';
import { checkAlgebra, type AlgebraCheck, type AlgebraState } from '../src/engines/lib/algebra-tiles-check';

const URL = (loc: string) => `/${loc}/studio/alg-solve-linear/`;
const CHECK: Record<string, string> = { 'fa-IR': 'بررسی کن', en: 'Check' };
const at = (page: Page) => page.locator('kg-algebra-tiles');
const bal = (page: Page) => at(page).locator('.kg-at-bal');
const tileOp = (page: Page, kind: string, s: 1 | -1) => at(page).locator(`[data-a="b-op"][data-o="add"][data-kind="${kind}"][data-s="${s}"]`);
const numOp = (page: Page, o: 'mul' | 'div') => at(page).locator(`[data-a="b-op"][data-o="${o}"]`).first();
const pan = (page: Page, i: 0 | 1) => at(page).locator(`[data-a="b-pan"][data-i="${i}"]`);
const both = (page: Page) => at(page).locator('[data-a="b-both"]');
const btn = (page: Page, a: string) => at(page).locator(`[data-a="${a}"]`);
const steps = (page: Page) => at(page).locator('.kg-at-steps li');
const rel = (page: Page) => at(page).locator('.kg-at-rel');
const msg = (page: Page) => at(page).locator('.kg-at-msg.bal');
const answer = (page: Page) => at(page).locator('[data-a="field"][data-f="w"]');
const no = (page: Page) => page.locator('.feedback.no');
const ok = (page: Page) => page.locator('.feedback.ok');

async function open(page: Page, loc: string, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(bal(page)).toBeVisible(); // the balance module has loaded
}
const check = (page: Page, loc: string) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
async function write(page: Page, s: string) {
  for (let n = 6; n > 0 && (await answer(page).textContent()); n--) await at(page).locator('[data-a="key"][data-v="del"]').click();
  for (const k of s) await at(page).locator(`[data-a="key"][data-v="${k}"]`).click();
}
/** Choose a move, then do it `n` times on both pans. */
async function onBoth(page: Page, move: ReturnType<typeof tileOp>, n = 1) {
  if ((await move.getAttribute('aria-pressed')) !== 'true') await move.click();
  for (let k = 0; k < n; k++) await both(page).click();
}
async function setK(page: Page, k: number) {
  for (let g = 0; g < 30; g++) {
    const now = Number((await at(page).locator('.kg-at-num output').textContent())!.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace('−', '-'));
    if (now === k) return;
    await at(page).locator(`[data-a="b-k"][data-k="${now < k ? 'k+' : 'k-'}"]`).click();
  }
}

test('fa-IR: try a value — the beam shows heavier and lighter; 2 + x is caught; x = 4 balances', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, 'fa-IR', 0);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(bal(page)).toHaveAttribute('dir', 'ltr');
  await expect(at(page).locator('.kg-at-hint')).toContainText('ترازو متعادل شود');
  await expect(at(page).locator('.kg-at-ops')).toHaveCount(0); // no moves in try mode
  await expect(at(page).locator('.kg-at-try output')).toHaveText('?');
  await expect(pan(page, 0)).toHaveCount(0);
  await expect(at(page).locator('.kg-at-pan').first()).toHaveAttribute('aria-label', 'کفهٔ چپ: ۲x + ۵');

  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('عدد بگذار');

  const plus = at(page).locator('[data-k="try+"]');
  for (let k = 0; k < 6; k++) await plus.click();
  await expect(at(page).locator('.kg-at-try output')).toHaveText('۶');
  await expect(at(page).locator('.kg-at-pan').first().locator('.kg-at-t.d1').first()).toHaveText('۶');
  await expect(at(page).locator('.kg-at-total').first()).toHaveText('۱۷');
  await expect(bal(page)).toHaveAttribute('data-tilt', '1'); // 17 > 13: the left pan goes down
  await expect(rel(page)).toHaveText('≠');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('کفهٔ چپ ۱۷'); // 2x is 6 + 6, not 2 + 6

  await at(page).locator('[data-k="try-"]').click();
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('سنگین‌تر');
  for (let k = 0; k < 2; k++) await at(page).locator('[data-k="try-"]').click();
  await expect(bal(page)).toHaveAttribute('data-tilt', '-1'); // x = 3: 11 < 13
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('سبک‌تر');
  await plus.click();
  await expect(bal(page)).toHaveAttribute('data-tilt', '0');
  await expect(rel(page)).toHaveText('=');
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('ترازو متعادل است');
  expect(errors).toEqual([]);
});

test('fa-IR: pan by pan — one pan tips the beam, the other levels it; 9 and a tipped scale are caught', async ({ page }) => {
  await open(page, 'fa-IR', 1);
  await expect(both(page)).toHaveCount(0); // this mission has no «both pans» button
  await expect(steps(page)).toHaveCount(1);
  await expect(steps(page).first()).toHaveText('۳x + ۲ = ۱۴');
  await expect(steps(page).first().locator('bdi')).toHaveAttribute('dir', 'ltr');

  await write(page, '9');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('بین ۳ نوار تقسیم کنی');

  await write(page, '4');
  await pan(page, 0).click();
  await expect(msg(page)).toContainText('اول یک حرکت');
  await tileOp(page, '1', -1).click();
  await expect(tileOp(page, '1', -1)).toHaveAttribute('aria-pressed', 'true');
  await pan(page, 0).click();
  await expect(bal(page)).toHaveAttribute('data-tilt', '-1'); // 3x + 1 < 14
  await expect(rel(page)).toHaveText('≠');
  await expect(msg(page)).toContainText('ترازو کج شد');
  await expect(steps(page).last()).toHaveClass(/bad/);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('ترازو کج است');

  await pan(page, 1).click();
  await expect(bal(page)).toHaveAttribute('data-tilt', '0');
  await expect(msg(page)).toContainText('دوباره متعادل شد');
  await pan(page, 0).click();
  await pan(page, 1).click();
  await expect(steps(page)).toHaveCount(2); // −1 twice is one step: −2
  await expect(steps(page).last()).toHaveText('−۲۳x = ۱۲');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('سه دستهٔ مساوی');

  await setK(page, 3);
  await numOp(page, 'div').click();
  await pan(page, 0).click();
  await expect(bal(page)).toHaveAttribute('data-tilt', '-1'); // x vs 12
  await pan(page, 1).click();
  await expect(steps(page).last()).toHaveText('÷۳x = ۴');
  await expect(pan(page, 0).locator('.kg-at-t')).toHaveCount(1);
  await expect(pan(page, 1).locator('.kg-at-t')).toHaveCount(4);
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('آفرین');
});

test('fa-IR: x on both pans — red tiles cancel; the forgotten negative and x not alone are caught; undo works', async ({ page }) => {
  await open(page, 'fa-IR', 2);
  await expect(pan(page, 0).locator('.kg-at-t.neg')).toHaveCount(3);
  await write(page, '3');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('سه مربع قرمز');

  await write(page, '5');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('هر دو کفه نوار هست');

  await onBoth(page, tileOp(page, '1', 1), 3);
  await expect(pan(page, 0).locator('.kg-at-t')).toHaveCount(5); // the zero pairs went at once
  await expect(steps(page).last()).toHaveText('+۳۵x = ۲x + ۱۵');
  await onBoth(page, tileOp(page, 'x', -1), 2);
  await expect(steps(page).last()).toHaveText('−۲x۳x = ۱۵');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('دسته‌های مساوی');

  // a wrong move, then undo
  await setK(page, 5);
  await numOp(page, 'div').click();
  await pan(page, 1).click();
  await expect(bal(page)).not.toHaveAttribute('data-tilt', '0');
  await btn(page, 'b-undo').click();
  await expect(bal(page)).toHaveAttribute('data-tilt', '0');
  await setK(page, 3);
  await numOp(page, 'div').click();
  await both(page).click();
  await expect(steps(page).last()).toHaveText('÷۳x = ۵');
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('عالی');
});

test('fa-IR: undo a division — the thirds strip; dividing again (x/9) is caught; × 3 solves it', async ({ page }) => {
  await open(page, 'fa-IR', 3);
  await expect(pan(page, 0).locator('.kg-at-lump .frac')).toHaveCount(1); // x/3 is a short strip with a stacked label
  await expect(steps(page).first().locator('.frac-d')).toHaveText('۳');
  await write(page, '12');
  await onBoth(page, tileOp(page, '1', -1));
  await setK(page, 3);
  await numOp(page, 'div').click();
  await both(page).click();
  await expect(steps(page).last().locator('.frac-d').first()).toHaveText('۹');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('دوباره تقسیم کردی');
  await btn(page, 'b-undo').click();
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('عددِ زیر x ضرب کن');
  await numOp(page, 'mul').click();
  await both(page).click();
  await expect(steps(page).last()).toHaveText('×۳x = ۱۲');
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('درست است');
});

test('fa-IR: brackets — two groups; the factor ignored is caught; open the brackets, then solve', async ({ page }) => {
  await open(page, 'fa-IR', 4);
  await expect(pan(page, 0).locator('.kg-at-grp')).toHaveCount(2);
  await write(page, '13');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('۱۶ را هم بر ۲ تقسیم کن');
  await write(page, '5');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('x هنوز در دو دسته است');
  await btn(page, 'b-open').click();
  await expect(pan(page, 0).locator('.kg-at-grp')).toHaveCount(0);
  await expect(steps(page).last()).toContainText('۲x + ۶ = ۱۶');
  await expect(btn(page, 'b-open')).toHaveCount(0);
  await onBoth(page, tileOp(page, '1', -1), 6);
  await numOp(page, 'div').click(); // k is 2
  await both(page).click();
  await expect(steps(page).last()).toHaveText('÷۲x = ۵');
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('آفرین');
});

test('en: six missions; brackets by ÷ 2; change the subject of v = u + at', async ({ page }) => {
  await open(page, 'en', 4);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('.mission-tab')).toHaveCount(6);
  await write(page, '8');
  await onBoth(page, numOp(page, 'div'));
  await expect(steps(page).last()).toHaveText('÷2x + 3 = 8');
  await check(page, 'en');
  await expect(no(page)).toContainText('8 is what x + 3 weighs');
  await write(page, '5');
  await check(page, 'en');
  await expect(no(page)).toContainText('Take the small squares away');
  await onBoth(page, tileOp(page, '1', -1), 3);
  await check(page, 'en');
  await expect(ok(page)).toContainText('Well done');

  await page.locator('.mission-tab').nth(5).click();
  await expect(steps(page).first()).toHaveText('v = u + at');
  await expect(at(page).locator('[data-a="field"]')).toHaveCount(0);
  await expect(at(page).locator('.kg-at-num')).toHaveCount(0); // only letters to × and ÷ by
  await onBoth(page, tileOp(page, 'u', -1));
  await expect(steps(page).last()).toHaveText('−uv − u = at');
  await check(page, 'en');
  await expect(no(page)).toContainText('Divide both pans by a');
  const divA = at(page).locator('[data-a="b-op"][data-o="div"][data-n="a"]');
  await divA.click();
  await pan(page, 1).click();
  await check(page, 'en');
  await expect(no(page)).toContainText('The scale is tipped');
  await btn(page, 'b-undo').click();
  await both(page).click();
  await expect(pan(page, 0).locator('.kg-at-den')).toHaveText('a');
  await expect(steps(page).last().locator('.frac-n')).toHaveText('v − u');
  await check(page, 'en');
  await expect(ok(page)).toContainText('t = ');
});

test('en: everything works with the keyboard alone', async ({ page }) => {
  await open(page, 'en', 1);
  await tileOp(page, '1', -1).focus();
  await page.keyboard.press('Enter');
  await expect(tileOp(page, '1', -1)).toHaveAttribute('aria-pressed', 'true');
  await expect(tileOp(page, '1', -1)).toBeFocused(); // focus stays after the redraw
  await pan(page, 0).focus();
  await expect(pan(page, 0)).toHaveAttribute('aria-label', 'left pan: 3x + 2');
  await page.keyboard.press('Enter');
  await expect(pan(page, 0)).toHaveAttribute('aria-label', 'left pan: 3x + 1');
  await page.keyboard.press('Tab');
  await expect(pan(page, 1)).toBeFocused();
  await page.keyboard.press('Space');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(steps(page).last()).toHaveText('−23x = 12');
  await at(page).locator('[data-k="k+"]').focus();
  await page.keyboard.press('Enter');
  await numOp(page, 'div').focus();
  await page.keyboard.press('Enter');
  await pan(page, 0).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await answer(page).focus();
  await page.keyboard.type('4');
  await page.getByRole('button', { name: 'Check', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(ok(page)).toBeVisible();
});

test('no horizontal scroll at 390px and 44px targets, every mission, fa-IR and en', async ({ page }) => {
  test.setTimeout(180_000);
  for (const loc of ['fa-IR', 'en']) {
    for (let i = 0; i < (loc === 'en' ? 6 : 5); i++) {
      await open(page, loc, i);
      if (i === 0) await at(page).locator('[data-k="try-"]').click();
      if (i >= 2 && i <= 4) await onBoth(page, tileOp(page, '1', 1), 4); // fuller pans
      if (i >= 1 && i <= 4) await write(page, '-123');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
      for (const b of await at(page).locator('button, [tabindex]').all()) {
        const r = (await b.boundingBox())!;
        expect(Math.min(r.width, r.height), `${loc} mission ${i + 1} target`).toBeGreaterThanOrEqual(44);
      }
    }
  }
});

// The inequality variant and other options are for later studios; check them here on the pilot's page.
async function mount(page: Page, cfg: Record<string, unknown>) {
  await page.evaluate((c) => {
    const el = document.querySelector('kg-algebra-tiles') as unknown as { config: unknown; ready: Promise<void> };
    el.config = c;
    return el.ready;
  }, cfg);
  await expect(bal(page)).toBeVisible();
}
const stateOf = (page: Page) => page.evaluate(() => (document.querySelector('kg-algebra-tiles') as unknown as { state: { algebra: AlgebraState } }).state);
const verdict = async (page: Page, c: Omit<AlgebraCheck, 'type'>) => checkAlgebra({ type: 'algebra', ...c }, await stateOf(page)).code ?? 'ok';

test('inequalities: the beam leans; ÷ a negative turns the sign by itself, or the learner turns it', async ({ page }) => {
  await open(page, 'en', 1);
  await mount(page, { mode: 'balance', equation: '-2x + 1 > 7' });
  await expect(bal(page)).toHaveAttribute('data-tilt', '1');
  await expect(rel(page)).toHaveText('>');
  await onBoth(page, tileOp(page, '1', -1));
  await setK(page, -2);
  await numOp(page, 'div').click();
  await both(page).click();
  await expect(rel(page)).toHaveText('<');
  await expect(msg(page)).toContainText('turned the sign');
  await expect(bal(page)).toHaveAttribute('data-tilt', '-1');
  expect(await verdict(page, { solution: 'x < -3' })).toBe('ok');

  await mount(page, { mode: 'balance', equation: '-2x + 1 > 7', flip: 'learner' });
  await onBoth(page, tileOp(page, '1', -1));
  await setK(page, -2);
  await numOp(page, 'div').click();
  await both(page).click();
  await expect(rel(page)).toHaveText('>');
  expect(await verdict(page, { solution: 'x < -3' })).toBe('sign-flip-missed');
  await rel(page).click();
  await expect(rel(page)).toHaveText('<');
  expect(await verdict(page, { solution: 'x < -3' })).toBe('ok');
  expect((await stateOf(page)).algebra.moves!.map((m) => m.do)).toContain('rel');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
