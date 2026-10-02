import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ps-draw-picture/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

const canvas = (page: Page) => page.locator('kg-problem-canvas');
async function check(page: Page, loc: keyof typeof CHECK) {
  await page.getByRole('button', { name: CHECK[loc], exact: true }).click();
}
/** Tap a fact or a question in step 1 by its text. */
const tap = (page: Page, name: string) => canvas(page).getByRole(/[؟?]$/.test(name) ? 'radio' : 'button', { name, exact: true }).click();
/** Pick up a number from the tray and put it in a slot of the bar (w = whole, p0, p1 = parts, d = difference). */
async function place(page: Page, v: string, slot: string) {
  await canvas(page).locator(`.kg-pc-tray [data-v="${v}"]`).first().click();
  await canvas(page).locator(`[data-a="slot"][data-v="${slot}"]`).first().click();
}
const answer = (page: Page) => canvas(page).locator('input[data-a="answer"]');
const fbNo = (page: Page) => page.locator('.feedback.no');
const fbOk = (page: Page) => page.locator('.feedback.ok');

test('fa-IR join: known and asked, draw the whole as ?, then tap the total', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(canvas(page).locator('.kg-pc-hint')).toContainText('روی یک عدد بزن');
  await expect(canvas(page).locator('.kg-pc-step h3')).toHaveText(['۱فهمیدن مسئله', '۲رسم شکل و جواب']);
  await expect(canvas(page).locator('.kg-pc-tray button')).toHaveText(['۵', '۳', '؟']);

  // Wrong: nothing marked yet
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('هر دو عدد');

  await tap(page, 'سارا ۵ سیب دارد.');
  await tap(page, 'علی ۳ سیب به او می‌دهد.');
  await expect(canvas(page).getByRole('button', { name: 'سارا ۵ سیب دارد.' })).toHaveAttribute('aria-pressed', 'true');
  // Wrong question: something the problem already says
  await tap(page, 'علی چند سیب داد؟');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('نمی‌داند');
  await tap(page, 'حالا سارا چند سیب دارد؟');

  // Wrong drawing: a part as the whole
  await place(page, '5', 'w');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('نوار بالا «کل» است');
  await place(page, '?', 'w');
  await place(page, '5', 'p0');
  await place(page, '3', 'p1');
  await expect(canvas(page).locator('[data-a="slot"]')).toHaveText(['؟', '۵', '۳']);
  // Unit squares: 5 and 3 are drawn as squares
  await expect(canvas(page).locator('.kg-pc-grow.u')).toHaveCount(2);

  // Wrong answer: took away
  await canvas(page).getByRole('radio', { name: '۲', exact: true }).click();
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('داد');
  await canvas(page).getByRole('radio', { name: '۸', exact: true }).click();
  await expect(canvas(page).locator('.kg-pc-blank')).toHaveText('۸');
  await check(page, 'fa-IR');
  await expect(fbOk(page)).toContainText('۵ + ۳ = ۸');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR part unknown: leave out the shelves, whole 23, then type 11 in Persian digits', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(1).click();
  await expect(canvas(page).locator('.kg-pc-tray button')).toHaveText(['۲۳', '۲', '۱۲', '؟']);
  await tap(page, 'علی ۲۳ کتاب دارد.');
  await tap(page, 'کتاب‌ها در ۲ قفسه هستند.');
  await tap(page, '۱۲ کتاب داستان است.');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('قفسه‌ها');
  await tap(page, 'کتاب‌ها در ۲ قفسه هستند.');
  await tap(page, 'علی چند کتاب علمی دارد؟');

  // Wrong: whole and part swapped
  await place(page, '12', 'w');
  await place(page, '23', 'p0');
  await place(page, '?', 'p1');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('همهٔ کتاب‌های علی');
  await place(page, '23', 'w');
  await place(page, '12', 'p0');
  // The unknown part is drawn as what the whole leaves: narrower than the 12
  const [w12, wq] = await canvas(page).locator('.kg-pc-grow').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  expect(wq).toBeLessThan(w12);

  // Wrong: added
  await answer(page).fill('۳۵');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('بخشی');
  await answer(page).fill('۱۱');
  await check(page, 'fa-IR');
  await expect(fbOk(page)).toContainText('۲۳ − ۱۲ = ۱۱');
});

test('fa-IR compare: say who has more, then the difference; "fewer" is not add', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(2).click();
  await tap(page, 'مریم ۱۴ مداد دارد.');
  await tap(page, 'حسن ۶ مداد کمتر از مریم دارد.');
  await tap(page, 'حسن چند مداد دارد؟');
  // No difference piece until someone has more
  await expect(canvas(page).locator('.kg-pc-seg.diff')).toHaveCount(0);
  await canvas(page).getByRole('radio', { name: 'حسن', exact: true }).click();
  await place(page, '14', 'p0');
  await place(page, '?', 'p1');
  await place(page, '6', 'd');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('چه کسی بیشتر دارد');

  await canvas(page).getByRole('radio', { name: 'مریم', exact: true }).click();
  await expect(canvas(page).locator('.kg-pc-line').nth(1).locator('.kg-pc-seg.diff')).toHaveText('۶');
  await answer(page).fill('۲۰');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('باید از ۱۴ کمتر باشد');
  await answer(page).fill('8');
  await check(page, 'fa-IR');
  await expect(fbOk(page)).toBeVisible();
});

test('fa-IR start unknown: "gave" but the start is the whole', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(3).click();
  await tap(page, 'زهرا ۵ برچسب به فاطمه داد.');
  await tap(page, 'حالا زهرا ۹ برچسب دارد.');
  await tap(page, 'زهرا اول چند برچسب داشت؟');
  await place(page, '?', 'w');
  await place(page, '9', 'p0');
  await place(page, '5', 'p1');
  await answer(page).fill('۴');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('چطور می‌توانست ۵ تا بدهد');
  await answer(page).fill('۱۴');
  await check(page, 'fa-IR');
  await expect(fbOk(page)).toContainText('۹ + ۵ = ۱۴');
});

test('en: every mission, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  // join
  await tap(page, 'Sara has 5 apples.');
  await tap(page, 'Ali gives her 3 apples.');
  await tap(page, 'How many apples does Sara have now?');
  await place(page, '5', 'p0');
  await place(page, '3', 'p1');
  await canvas(page).getByRole('radio', { name: '8', exact: true }).click();
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('The top bar is the whole');
  await place(page, '?', 'w');
  await check(page, 'en');
  await expect(fbOk(page)).toContainText('5 + 3 = 8');

  // part unknown
  await page.locator('.mission-tab').nth(1).click();
  await tap(page, 'Ali has 23 books.');
  await tap(page, '12 books are storybooks.');
  await tap(page, 'How many books does Ali have altogether?');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText("What don't we know?");
  await tap(page, 'How many science books does Ali have?');
  await place(page, '23', 'w');
  await place(page, '?', 'p0');
  await place(page, '12', 'p1');
  await answer(page).fill('35');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('35 is more than all the books');
  await answer(page).fill('11');
  await check(page, 'en');
  await expect(fbOk(page)).toBeVisible();

  // compare
  await page.locator('.mission-tab').nth(2).click();
  await tap(page, 'Maryam has 14 pencils.');
  await tap(page, 'Hassan has 6 fewer pencils than Maryam.');
  await tap(page, 'How many pencils does Hassan have?');
  await canvas(page).getByRole('radio', { name: 'Maryam', exact: true }).click();
  await place(page, '14', 'p0');
  await place(page, '?', 'p1');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('dashed piece');
  await place(page, '6', 'd');
  await answer(page).fill('8');
  await check(page, 'en');
  await expect(fbOk(page)).toContainText('14 − 6 = 8');

  // start unknown
  await page.locator('.mission-tab').nth(3).click();
  await tap(page, 'Zahra gave 5 stickers to Fatima.');
  await tap(page, 'Now Zahra has 9 stickers.');
  await tap(page, 'How many stickers did Zahra have at first?');
  await place(page, '?', 'w');
  await place(page, '5', 'p0');
  await place(page, '9', 'p1');
  await answer(page).fill('13');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('Work it out again');
  await answer(page).fill('14');
  await check(page, 'en');
  await expect(fbOk(page)).toBeVisible();
});

test('keyboard and screen reader: tray and slots work with Enter, focus stays, labels say what is in a slot', async ({ page }) => {
  await page.goto(URL('en'));
  const five = canvas(page).locator('.kg-pc-tray [data-v="5"]');
  await five.focus();
  await page.keyboard.press('Enter');
  await expect(canvas(page).locator('.kg-pc-tray [data-v="5"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas(page).locator('.kg-pc-tray [data-v="5"]')).toBeFocused();
  const part = canvas(page).getByRole('button', { name: 'part 1: empty' });
  await part.focus();
  await page.keyboard.press('Space');
  await expect(canvas(page).getByRole('button', { name: 'part 1: 5' })).toBeFocused();
  // Enter on a filled slot with nothing held empties it
  await page.keyboard.press('Enter');
  await expect(canvas(page).getByRole('button', { name: 'part 1: empty' })).toBeVisible();
  await expect(canvas(page).getByRole('button', { name: 'whole: empty' })).toBeVisible();
  await expect(canvas(page).getByRole('group', { name: 'picture of the problem' })).toBeVisible();
});

test('touch targets are at least 44px and there is no horizontal scroll at 390px', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    for (let m = 0; m < 4; m++) {
      await page.locator('.mission-tab').nth(m).click();
      await expect(canvas(page).locator('.kg-pc-bar')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const small = await canvas(page).locator('button, input').evaluateAll((bs) =>
        bs.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
      expect(small, `${loc} mission ${m + 1}: targets under 44px`).toBe(0);
    }
  }
});

// The tools the later problem-canvas studios need (ps-symbolic, ps-model-pattern-guess, ps-multistep-listing,
// ratio-proportion), mounted on this studio's page because it already loads the engine.
async function mount(page: Page, config: unknown) {
  await page.goto(URL('en'));
  await expect(canvas(page)).toHaveCount(1);
  await page.evaluate((cfg) => {
    const el = document.createElement('kg-problem-canvas') as HTMLElement & { config: unknown };
    el.id = 'probe';
    el.dataset.digits = '0123456789';
    el.dataset.decimal = '.';
    el.config = cfg;
    document.querySelector('.mission')!.replaceWith(el);
  }, config);
  return page.locator('#probe');
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const state = (page: Page) => page.locator('#probe').evaluate((el) => (el as unknown as { state: any }).state);

test('engine: number sentences, with the box solved and passed on to the next step (sub-problems)', async ({ page }) => {
  const el = await mount(page, {
    tools: [{ kind: 'sentence', tray: [3, 5], ops: ['+', '×'], solve: true }, { kind: 'sentence', tray: [20], form: '_ o _ = _', solve: true }],
  });
  const first = el.locator('.kg-pc-tool').first();
  for (const [v, s] of [['3', '0'], ['5', '2'], ['?', '4']]) {
    await first.locator(`.kg-pc-tray [data-v="${v}"]`).click();
    await first.locator(`[data-a="slot"][data-v="${s}"]`).click();
  }
  await first.locator('.kg-pc-op').click();
  await expect(first.locator('.kg-pc-sent')).toHaveText('3×5=□');
  await first.locator('input[data-a="solve"]').fill('15');
  await first.locator('input[data-a="solve"]').press('Tab');
  const second = el.locator('.kg-pc-tool').nth(1);
  await expect(second.locator('.kg-pc-tray button')).toHaveText(['20', '15', '□']);
  expect((await state(page)).tools[0]).toMatchObject({ kind: 'sentence', tokens: ['3', '×', '5', '=', '?'], solved: 15 });
});

test('engine: guess and check works out each guess and says bigger, smaller or equal', async ({ page }) => {
  const el = await mount(page, { tools: [{ kind: 'guess', cols: [{ key: 'hens', expr: '10 - x' }, { key: 'legs', expr: '4*x + 2*hens' }], target: 28 }] });
  const x = el.locator('input[data-a="gx"]');
  await x.fill('3');
  await el.getByRole('button', { name: 'try it' }).click();
  await x.fill('5');
  await x.press('Enter');
  await x.fill('4');
  await el.getByRole('button', { name: 'try it' }).click();
  await expect(el.locator('td.cmp')).toHaveText(['< 28', '> 28', '= 28 ✓']);
  await expect(el.locator('tbody tr, table tr').last().locator('td.calc')).toHaveText(['6', '28']);
  expect(await state(page)).toMatchObject({ tools: [{ kind: 'guess', found: true }] });
});

test('engine: a table with typed, given and computed columns, extra rows and pattern hops', async ({ page }) => {
  const el = await mount(page, {
    tools: [{ kind: 'table', cols: [{ key: 'n', given: [1, 2, 3, 4] }, { key: 'dots', given: [1, 3, null, null] }, { key: 'twice', expr: 'dots * 2' }], hops: [1], extend: true, maxRows: 5 }],
  });
  const cell = (r: number) => el.locator(`input[data-r="${r}"][data-c="1"]`);
  await cell(2).fill('6');
  await cell(2).press('Tab');
  await cell(3).fill('10');
  await cell(3).press('Tab');
  await expect(el.locator('td.hop')).toHaveText(['', '+2', '+3', '+4']);
  await expect(el.locator('td.calc')).toHaveText(['2', '6', '12', '20']);
  await el.getByRole('button', { name: '+ add a row' }).click();
  await expect(el.locator('tbody tr')).toHaveCount(5);
  await expect(el.getByRole('button', { name: '+ add a row' })).toHaveCount(0);
  expect((await state(page)).tools[0].rows[3]).toEqual([4, 10, 20]);
});

test('engine: strategies show their own tool; a list to cross out; equal groups', async ({ page }) => {
  const el = await mount(page, {
    strategies: ['draw', 'eliminate'],
    tools: [{ kind: 'bar', for: 'draw', model: 'groups', parts: 3, resize: true, tray: [5] }, { kind: 'list', for: 'eliminate', items: [12, 15, 18] }],
  });
  await expect(el.locator('.kg-pc-tool')).toHaveCount(0);
  await el.getByRole('radio', { name: 'eliminate' }).click();
  await el.locator('.kg-pc-item').first().click();
  await expect(el.locator('.kg-pc-item.x')).toHaveText(['12']);
  expect(await state(page)).toMatchObject({ strategy: 'eliminate', tools: [{ shown: false }, { kind: 'list', crossed: [0], shown: true }] });
  await el.getByRole('radio', { name: 'draw' }).click();
  await el.locator('.kg-pc-tray [data-v="5"]').click();
  await el.locator('[data-a="slot"][data-v="p1"]').click();
  await el.getByRole('button', { name: 'more parts' }).click();
  expect((await state(page)).tools[0]).toMatchObject({ model: 'groups', parts: [5, 5, 5, 5] });
});
