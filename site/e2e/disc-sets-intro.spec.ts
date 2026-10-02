import { expect, test, type Locator, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/disc-sets-intro/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

async function check(page: Page, loc: keyof typeof CHECK) {
  await page.getByRole('button', { name: CHECK[loc], exact: true }).click();
}
const lab = (page: Page) => page.locator('kg-discrete-lab');
/** An element card on the diagram or in its tray (not the cards used to write in braces). */
const card = (page: Page, n: number | string) => lab(page).locator(`[data-a="card"][data-c="${n}"]`);
const regionBtn = (page: Page, r: string) => lab(page).locator(`.kg-dl-rbtn[data-r="${r}"]`);
/** Tap a card, then the region button: the touch and keyboard way to move it. */
async function put(page: Page, n: number, r: string) {
  await card(page, n).click();
  await regionBtn(page, r).click();
}
const write = (page: Page, n: number) => lab(page).locator(`.kg-dl-wtray [data-v="${n}"]`).click();
const written = (page: Page) => lab(page).locator('.kg-dl-braces .kg-dl-chip');
const opt = (page: Page, row: string, o: string) => lab(page).locator(`[data-a="pick"][data-r="${row}"][data-o="${o}"]`);
const count = (page: Page, r: string) => lab(page).locator(`input[data-r="${r}"]`);
const sets = (page: Page) => lab(page).evaluate((el) => (el as unknown as { state: { sets: Record<string, unknown> } }).state.sets);
async function mission(page: Page, i: number) {
  await page.locator('.mission-tab').nth(i).click();
  await expect(lab(page).locator('.kg-dl-panels')).toHaveCount(1);
}
/** The point of the diagram at drawing units (x, y), as page coordinates. */
async function at(page: Page, x: number, y: number) {
  await lab(page).locator('.kg-dl-svg').scrollIntoViewIfNeeded();
  const b = (await lab(page).locator('.kg-dl-svg').boundingBox())!;
  return { x: b.x + (x / 360) * b.width, y: b.y + (y / 340) * b.height };
}
async function dragTo(page: Page, from: Locator, x: number, y: number) {
  const to = await at(page, x, y), a = (await from.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

test('fa-IR members and braces: drag the even numbers into A, an odd one is caught, a repeat is caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(lab(page).locator('.kg-dl-dia')).toHaveAttribute('dir', 'ltr');
  await expect(card(page, 2)).toHaveText('۲');
  // drag one card with the mouse into the middle of oval A
  await dragTo(page, card(page, 2), 180, 145);
  expect((await sets(page)).regions).toMatchObject({ 2: 'A', 1: 'out' });
  for (const n of [4, 6, 8, 3]) await put(page, n, 'A');
  await expect(card(page, 3)).toHaveAttribute('aria-label', 'کارت ۳، در A');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('عدد فرد');
  await put(page, 3, 'out');
  // the set in braces: a repeated element is caught
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('با آکولاد بنویس');
  for (const n of [2, 4, 6, 6, 8]) await write(page, n);
  await expect(written(page)).toHaveText(['۲', '۴', '۶', '۶', '۸']);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('دو بار نوشتی');
  await written(page).nth(3).click();
  await expect(written(page)).toHaveCount(4);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('A = {۲, ۴, ۶, ۸}');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR element or subset: ∈ for {۴} and ∅ = {۰} are caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await mission(page, 1);
  await expect(lab(page).locator('.kg-dl-st').nth(1)).toHaveText('{۴}?A');
  await expect(lab(page).locator('.kg-dl-st').nth(1)).toHaveAttribute('dir', 'ltr');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بی‌جواب');
  for (const [r, o] of [['el', '∈'], ['sub', '∈'], ['odd', '∉'], ['order', '='], ['empty', '≠']]) await opt(page, r, o).click();
  await expect(opt(page, 'sub', '∈')).toHaveAttribute('aria-checked', 'true');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('جابه‌جا شده‌اند');
  await opt(page, 'sub', '⊆').click();
  await opt(page, 'empty', '=').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('تهی نیست');
  await opt(page, 'order', '≠').click();
  await opt(page, 'empty', '≠').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ترتیب نوشتن عضوها مهم نیست');
  await opt(page, 'order', '=').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR subset: sort from the tray, then nest C inside B (not B inside C)', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await mission(page, 2);
  await expect(lab(page).locator('.kg-dl-tray [data-a="card"]')).toHaveCount(9);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بیرون نمودار');
  for (const [n, r] of [[4, 'BC'], [8, 'BC'], [2, 'BC'], [6, 'B'], [1, 'out'], [3, 'out'], [5, 'out'], [7, 'out'], [9, 'out']] as const) await put(page, n, r);
  await expect(lab(page).locator('.kg-dl-tray')).toHaveCount(0);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('مضرب ۴ نیستند');
  await put(page, 2, 'B');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('کارت‌ها درست‌اند');
  // B inside C: "only B" disappears, so 2 and 6 go back to the tray, and the nesting is named first
  await lab(page).locator('[data-a="layout"][data-l="B⊆C"]').click();
  await expect(lab(page).locator('.kg-dl-tray [data-a="card"]')).toHaveCount(2);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('برعکس شد');
  await lab(page).locator('[data-a="layout"][data-l="C⊆B"]').click();
  await expect(lab(page).locator('.kg-dl-rbtn')).toHaveCount(3);
  for (const n of [2, 6]) await put(page, n, 'B');
  expect(await sets(page)).toMatchObject({ layout: 'C⊆B', drawn: ['B', 'BC', 'out'], members: { B: ['2', '4', '6', '8'], C: ['4', '8'] } });
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('C ⊆ B');
});

test('fa-IR union and intersection: shading the union is caught, then the overlap written twice', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await mission(page, 3);
  await expect(lab(page).locator('.kg-dl-card.fixed')).toHaveCount(10);
  for (const r of ['A', 'AB', 'B']) await regionBtn(page, r).click();
  await expect(regionBtn(page, 'AB')).toHaveAttribute('aria-pressed', 'true');
  await expect(lab(page).locator('.kg-dl-shade')).toHaveCount(3);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('این اجتماع است');
  // tapping the drawing itself shades and unshades too
  for (const [x, y] of [[50, 150], [310, 150]]) {
    const p = await at(page, x, y);
    await page.mouse.click(p.x, p.y);
  }
  expect((await sets(page)).shaded).toEqual(['AB']);
  for (const n of [1, 2, 3, 6, 1, 2, 4, 8]) await write(page, n);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۱ و ۲ را دو بار نوشتی');
  for (let i = 0; i < 2; i++) await written(page).nth(4).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('A ∪ B = {۱, ۲, ۳, ۴, ۶, ۸}');
});

test('fa-IR difference and complement: B − A is caught, then the outside forgotten in A′', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await mission(page, 4);
  await regionBtn(page, 'B').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('این B − A است');
  await regionBtn(page, 'B').click();
  await regionBtn(page, 'A').click();
  await regionBtn(page, 'AB').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('همهٔ A را هاشور زدی');
  await regionBtn(page, 'AB').click();
  for (const n of [4, 8]) await write(page, n);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بیرون هر دو بیضی');
  for (const n of [5, 7, 9, 10]) await write(page, n);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('A′ = {۴, ۵, ۷, ۸, ۹, ۱۰}');
});

test('fa-IR counting: all of F as "only F" is caught, then 20 (the overlap twice); the table shows the totals', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await mission(page, 5);
  await count(page, 'F').fill('۱۲');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز یک قسمت خالی است');
  await count(page, 'FV').fill('۵');
  await count(page, 'V').fill('3');
  await count(page, 'out').fill('۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('آن ۵ نفر را کم کن');
  await count(page, 'F').fill('۷');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('حالا جواب را بنویس');
  // flip into the two-way table and back: the totals are worked out
  await lab(page).locator('.kg-dl-flip').click();
  const t = lab(page).locator('.kg-dl-table');
  await expect(t.locator('tr').nth(1).locator('td')).toHaveText(['۵', '۷', '۱۲']);
  await expect(t.locator('tr').nth(3).locator('td')).toHaveText(['۸', '۱۲', '۲۰']);
  await lab(page).locator('.kg-dl-flip').click();
  await expect(count(page, 'F')).toHaveValue('۷');
  await page.locator('.int-input').fill('۲۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('دو بار شمردی');
  await page.locator('.int-input').fill('۱۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('n(F ∪ V) = ۷ + ۵ + ۳ = ۱۵');
});

test('fa-IR finite or infinite: a very big set called infinite is caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await mission(page, 6);
  await expect(lab(page).locator('.kg-dl-st').first().locator('bdi')).toHaveText('{x ∈ N | x < ۱۰}');
  for (const [r, o] of [['small', 'finite'], ['evens', 'infinite'], ['million', 'infinite'], ['school', 'finite'], ['fives', 'infinite']]) await opt(page, r, o).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بزرگ بودن با نامتناهی بودن فرق دارد');
  await opt(page, 'million', 'finite').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: every mission, a wrong then a right answer, with English digits', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  for (const n of [2, 4, 6]) await put(page, n, 'A');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('An even number is still outside');
  await put(page, 8, 'A');
  for (const n of [8, 6, 4, 2]) await write(page, n);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('A = {2, 4, 6, 8}');

  await mission(page, 1);
  for (const [r, o] of [['el', '⊆'], ['sub', '⊆'], ['odd', '∉'], ['order', '='], ['empty', '≠']]) await opt(page, r, o).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('are mixed up');
  await opt(page, 'el', '∈').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await mission(page, 2);
  for (const [n, r] of [[4, 'BC'], [8, 'BC'], [2, 'B'], [6, 'B'], [1, 'out'], [3, 'out'], [5, 'out'], [7, 'out'], [9, 'out']] as const) await put(page, n, r);
  await lab(page).locator('[data-a="layout"][data-l="apart"]').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('not apart');
  await lab(page).locator('[data-a="layout"][data-l="C⊆B"]').click();
  for (const n of [4, 8]) await put(page, n, 'BC');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await mission(page, 3);
  await regionBtn(page, 'A').click();
  await regionBtn(page, 'AB').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('You shaded all of A');
  await regionBtn(page, 'A').click();
  for (const n of [1, 2]) await write(page, n);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('That is A ∩ B');
  for (const n of [3, 4, 6, 8]) await write(page, n);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await mission(page, 4);
  await regionBtn(page, 'AB').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('That is the overlap');
  await regionBtn(page, 'AB').click();
  await regionBtn(page, 'A').click();
  for (const n of [4, 5, 7, 8, 9, 10]) await write(page, n);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await mission(page, 5);
  for (const [r, v] of [['F', '7'], ['FV', '5'], ['V', '3'], ['out', '0']]) await count(page, r).fill(v);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Those in no team go outside');
  await count(page, 'out').fill('5');
  await page.locator('.int-input').fill('15');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await mission(page, 6);
  for (const [r, o] of [['small', 'finite'], ['evens', 'finite'], ['million', 'finite'], ['school', 'finite'], ['fives', 'infinite']]) await opt(page, r, o).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('no last element');
  await opt(page, 'evens', 'infinite').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('keyboard: Enter picks a card, a region button places it; Escape lets go; arrow keys move along the symbols', async ({ page }) => {
  for (const loc of ['fa-IR', 'en'] as const) {
    await page.goto(URL(loc));
    await card(page, 4).focus();
    await page.keyboard.press('Enter');
    await expect(card(page, 4)).toHaveAttribute('aria-pressed', 'true');
    await expect(lab(page).locator('.kg-dl-live')).toContainText(loc === 'en' ? 'Card 4 chosen' : 'کارت ۴ انتخاب شد');
    await page.keyboard.press('Escape');
    await expect(card(page, 4)).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Space');
    await regionBtn(page, 'A').focus();
    await page.keyboard.press('Enter');
    // the moved card keeps the focus, in its new place
    await expect(card(page, 4)).toBeFocused();
    expect((await sets(page)).regions).toMatchObject({ 4: 'A' });
    await expect(lab(page).locator('.kg-dl-live')).toContainText(loc === 'en' ? '4 moved to: A' : '۴ رفت به: A');

    await mission(page, 1);
    await opt(page, 'order', '=').focus();
    await page.keyboard.press('Enter');
    await expect(opt(page, 'order', '=')).toHaveAttribute('aria-checked', 'true');
    // the symbols run left to right in every locale
    await page.keyboard.press('ArrowRight');
    await expect(opt(page, 'order', '≠')).toBeFocused();
    await expect(opt(page, 'order', '≠')).toHaveAttribute('aria-checked', 'true');
    await expect(opt(page, 'order', '≠')).toHaveAttribute('aria-label', loc === 'en' ? 'does not equal' : 'برابر نیست');
  }
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('tap a card, then tap its place on the drawing', async ({ page }) => {
    await page.goto(URL('fa-IR'));
    await card(page, 6).tap();
    await expect(lab(page).locator('.kg-dl-dia')).toHaveClass(/picking/);
    const p = await at(page, 180, 145);
    await page.touchscreen.tap(p.x, p.y);
    expect((await sets(page)).regions).toMatchObject({ 6: 'A' });
    await card(page, 6).tap();
    const q = await at(page, 20, 320);
    await page.touchscreen.tap(q.x, q.y);
    expect((await sets(page)).regions).toMatchObject({ 6: 'out' });
  });
});

test('touch targets are at least 44px and there is no horizontal scroll at 390px', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    for (let m = 0; m < 7; m++) {
      await mission(page, m);
      for (const flip of m === 5 ? [false, true] : [false]) {
        if (flip) await lab(page).locator('.kg-dl-flip').click();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
        const small = await lab(page).locator('button, input').evaluateAll((bs) =>
          bs.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
        expect(small, `${loc} mission ${m + 1}: controls under 44px`).toBe(0);
      }
    }
  }
});

// Options later studios need, mounted on this studio's page because it already loads the engine.
async function mount(page: Page, config: unknown) {
  await page.goto(URL('en'));
  await expect(lab(page)).toHaveCount(1);
  await page.evaluate((cfg) => {
    const el = document.createElement('kg-discrete-lab') as HTMLElement & { config: unknown };
    el.id = 'probe';
    el.dataset.digits = '0123456789';
    el.config = cfg;
    document.querySelector('.mission')!.replaceWith(el);
  }, config);
  const el = page.locator('#probe');
  await expect(el.locator('.kg-dl-panels')).toHaveCount(1);
  return el;
}
const probe = (page: Page) => page.locator('#probe').evaluate((el) => (el as unknown as { state: { sets: Record<string, unknown> } }).state.sets);

test('engine: table mode fills cells and totals', async ({ page }) => {
  const el = await mount(page, { table: { rows: ['A', 'A′'], cols: ['B', 'B′'], values: [[5, 7], [3, 10]], ask: ['0,1', 't,t'] } });
  await expect(el.locator('.kg-dl-table input')).toHaveCount(2);
  await expect(el.locator('.kg-dl-table tr').nth(2).locator('td')).toHaveText(['3', '10', '13']);
  await el.locator('input[data-cell="0,1"]').fill('7');
  await el.locator('input[data-cell="t,t"]').fill('٢٥');
  expect((await probe(page)).table).toEqual({ cells: { '0,1': 7, 't,t': 25 }, truth: { '0,1': 7, 't,t': 25 } });
});

test('engine: three sets, given counts, and apart ovals', async ({ page }) => {
  const el = await mount(page, { sets: ['A', 'B', 'C'], counts: { A: 3, B: null, ABC: 1 } });
  await expect(el.locator('.kg-dl-oval')).toHaveCount(3);
  await expect(el.locator('.kg-dl-num')).toHaveCount(2);
  await expect(el.locator('input.kg-dl-cnt')).toHaveCount(6);
  expect((await probe(page)).drawn).toEqual(['A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC', 'out']);
  const ap = await mount(page, { sets: ['A', 'B'], layout: 'apart', items: [1, 2], shade: true, lock: true, place: { 1: 'A', 2: 'B' } });
  await expect(ap.locator('.kg-dl-rbtn')).toHaveCount(3);
  await ap.locator('.kg-dl-rbtn[data-r="B"]').click();
  expect(await probe(page)).toMatchObject({ shaded: ['B'], members: { A: ['1'], B: ['2'] } });
});
