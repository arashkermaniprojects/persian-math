import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/prob-trees-counting/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

async function check(page: Page, loc: keyof typeof CHECK) {
  await page.getByRole('button', { name: CHECK[loc], exact: true }).click();
}
const lab = (page: Page) => page.locator('kg-discrete-lab');
const tree = (page: Page) => lab(page).locator('.kg-dl-tbox');
const grow = (page: Page, p: string) => lab(page).locator(`[data-a="g"][data-p="${p}"]`);
const leaf = (page: Page, p: string) => lab(page).locator(`[data-a="pick"][data-p="${p}"]`);
const sets = (page: Page) => lab(page).evaluate((el) => (el as unknown as { state: { sets: Record<string, any> } }).state.sets);
async function mission(page: Page, i: number) {
  await page.locator('.mission-tab').nth(i).click();
  await expect(tree(page)).toHaveCount(1);
}
/** Tap a branch (p), leaf product (x) or count (n) chip and type into the editor under the tree. */
async function write(page: Page, k: 'p' | 'x' | 'n', path: string, n: string, d?: string) {
  await lab(page).locator(`.kg-dl-tc[data-a="${k}"][data-p="${path}"]`).click();
  const ed = lab(page).locator('.kg-dl-ed');
  await ed.locator('input[data-f="0"]').fill(n);
  if (d !== undefined) await ed.locator('input[data-f="1"]').fill(d);
}
/** Choose-mode growing: open a node's palette and toggle these outcomes. */
async function choose(page: Page, p: string, outcomes: string[]) {
  await grow(page, p).click();
  for (const o of outcomes) await lab(page).locator(`.kg-dl-ed [data-a="o"][data-o="${o}"]`).click();
}
const answer = (page: Page) => page.locator('.int-input');
async function fraction(page: Page, n: string, d: string) {
  await page.locator('.kg-fi-n').fill(n);
  await page.locator('.kg-fi-d').fill(d);
}

test('fa-IR outfits: grow the tree; 3 + 2 = 5 is caught, then 6', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(tree(page)).toHaveAttribute('dir', 'ltr');
  await expect(lab(page).locator('.kg-dl-hint')).toContainText('روی + بزن');
  await answer(page).fill('۶');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('درخت هنوز کامل نیست');
  await grow(page, '').click();
  await expect(lab(page).locator('.kg-dl-tn.in')).toHaveText(['قرمز', 'آبی', 'سبز']);
  await grow(page, 'red').click();
  await grow(page, 'blue').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('درخت هنوز کامل نیست');
  await grow(page, 'green').click();
  await expect(grow(page, 'green')).toHaveCount(0);
  await expect(lab(page).locator('.kg-dl-tn.leaf')).toHaveCount(6);
  expect((await sets(page)).tree).toMatchObject({ leaves: 6, sum: 5 });
  await answer(page).fill('۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۳ + ۲ = ۵');
  await answer(page).fill('۶');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۳ × ۲ = ۶');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR race places: a runner first and second is caught (replacement ignored)', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await mission(page, 1);
  await choose(page, '', ['zahra', 'sara', 'maryam']);
  await expect(lab(page).locator('.kg-dl-ed [data-o="sara"]')).toHaveAttribute('aria-pressed', 'true');
  await choose(page, 'zahra', ['zahra', 'sara', 'maryam']);
  await choose(page, 'sara', ['zahra', 'maryam']);
  await choose(page, 'maryam', ['zahra', 'sara']);
  await answer(page).fill('۹');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هم اول شده و هم دوم');
  // tap the node again and take the branch away
  await choose(page, 'zahra', ['zahra']);
  await expect(lab(page).locator('.kg-dl-tn.leaf')).toHaveCount(6);
  // the tree is right now, but 9 = 3 × 3 is the same slip in the typed answer
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هم اول شده و هم دوم');
  await answer(page).fill('۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('انتخاب‌ها را جمع می‌کند');
  await answer(page).fill('۶');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۳ × ۲ = ۶');
});

test('fa-IR two coins: adding along the path and a coin with memory are caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await mission(page, 2);
  // stage 1 is given as stacked fractions; stage 2 and the products are asked
  await expect(lab(page).locator('.kg-dl-tp .kg-dl-fr').first()).toHaveText('۱۲');
  await expect(lab(page).locator('.kg-dl-tc[data-a="p"]')).toHaveCount(4);
  await expect(lab(page).locator('.kg-dl-tc[data-a="x"]')).toHaveCount(4);
  await lab(page).locator('[data-a="pick"][data-r="memory"][data-o="yes"]').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('سکه حافظه ندارد');
  await lab(page).locator('[data-a="pick"][data-r="memory"][data-o="no"]').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز ؟ هست');
  for (const p of ['h.h', 'h.t', 't.h']) await write(page, 'p', p, '۱', '۲');
  await write(page, 'p', 't.t', '۱', '۳');
  await expect(lab(page).locator('.kg-dl-tc[data-a="p"][data-p="t.t"]')).toHaveText('۱۳');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('باید ۱ شود');
  await write(page, 'p', 't.t', '۱', '۲');
  for (const p of ['h.h', 'h.t', 't.h']) await write(page, 'x', p, '۱', '۴');
  await write(page, 'x', 't.t', '2', '2');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('در طول مسیر جمع کردی');
  await write(page, 'x', 't.t', '۱', '۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR with replacement: pick the same-colour leaves and add the paths', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await mission(page, 3);
  for (const [p, n] of [['r.r', '۳'], ['r.b', '۲'], ['b.r', '۳'], ['b.b', '۲']]) await write(page, 'p', p, n, '۵');
  await leaf(page, 'r.b').click();
  await leaf(page, 'b.r').click();
  await expect(leaf(page, 'r.b')).toHaveAttribute('aria-pressed', 'true');
  await fraction(page, '۱۳', '۲۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('دو رنگ مختلف');
  for (const p of ['r.b', 'b.r', 'r.r', 'b.b']) await leaf(page, p).click();
  await fraction(page, '۹', '۲۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هر دو مسیر را جمع کن');
  await fraction(page, '۱۳', '۲۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱۳');
});

test('fa-IR without replacement: 3/5 on the second draw is caught, then 6/20', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await mission(page, 4);
  await write(page, 'p', 'r.r', '۳', '۵');
  await write(page, 'p', 'r.b', '۲', '۵');
  await write(page, 'p', 'b.r', '۳', '۴');
  await write(page, 'p', 'b.b', '۱', '۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('مهره برنگشته است');
  await write(page, 'p', 'r.r', '۲', '۴');
  await write(page, 'p', 'r.b', '۲', '۴');
  await fraction(page, '۹', '۲۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('مهره برنگشته است');
  await fraction(page, '۶', '۲۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۴ مهره می‌ماند');
  expect((await sets(page)).tree.p['r.r']).toMatchObject({ ask: true, got: [2, 4], truth: [2, 4], alt: [3, 5] });
});

test('en: every mission, a wrong then a right answer, with English digits; the UK frequency tree', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('.mission-tab')).toHaveCount(6);
  for (const p of ['', 'red', 'blue', 'green']) await grow(page, p).click();
  await answer(page).fill('3');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('only one stage');
  await answer(page).fill('6');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('3 × 2 = 6');

  await mission(page, 1);
  await choose(page, '', ['zahra', 'sara', 'maryam']);
  await choose(page, 'zahra', ['sara', 'maryam']);
  await choose(page, 'sara', ['zahra']);
  await answer(page).fill('6');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('not finished');
  await choose(page, 'sara', ['maryam']);
  await choose(page, 'maryam', ['zahra', 'sara']);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await mission(page, 2);
  await lab(page).locator('[data-a="pick"][data-r="memory"][data-o="no"]').click();
  for (const p of ['h.h', 'h.t', 't.h', 't.t']) await write(page, 'p', p, '1', '2');
  for (const p of ['h.h', 'h.t', 't.h']) await write(page, 'x', p, '1', '4');
  await write(page, 'x', 't.t', '1', '2');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Multiply the branches');
  await write(page, 'x', 't.t', '2', '8');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await mission(page, 3);
  for (const [p, n] of [['r.r', '3'], ['r.b', '2'], ['b.r', '3'], ['b.b', '2']]) await write(page, 'p', p, n, '5');
  await leaf(page, 'r.r').click();
  await fraction(page, '13', '25');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('another way to get the same colour');
  await leaf(page, 'b.b').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('13');

  await mission(page, 4);
  for (const [p, n, d] of [['r.r', '2', '4'], ['r.b', '2', '4'], ['b.r', '3', '4'], ['b.b', '1', '4']]) await write(page, 'p', p, n, d);
  await fraction(page, '11', '10');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('we multiply');
  await fraction(page, '3', '10');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await mission(page, 5);
  await expect(lab(page).locator('.kg-dl-tv')).toHaveText(['80', '35', '20', '12']);
  await write(page, 'n', 'adult', '35');
  await write(page, 'n', 'young.none', '15');
  await write(page, 'n', 'adult.none', '33');
  await answer(page).fill('32');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('80 − 35');
  await write(page, 'n', 'adult', '45');
  await write(page, 'n', 'adult.none', '30');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('must add up');
  await write(page, 'n', 'adult.none', '33');
  await answer(page).fill('20');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('only one group');
  await answer(page).fill('32');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('keyboard: + grows and moves on; a chip opens the editor, Enter returns to the chip', async ({ page }) => {
  for (const loc of ['fa-IR', 'en'] as const) {
    await page.goto(URL(loc));
    await grow(page, '').focus();
    await page.keyboard.press('Enter');
    await expect(grow(page, 'red')).toBeFocused();
    await expect(lab(page).locator('.kg-dl-live')).toContainText(loc === 'en' ? '3 branches grew from the start' : '۳ شاخه از شروع رویید');
    await page.keyboard.press('Enter');
    await expect(grow(page, 'blue')).toBeFocused();

    await mission(page, 2);
    const chip = lab(page).locator('.kg-dl-tc[data-a="p"][data-p="h.t"]');
    await expect(chip).toHaveAttribute('aria-label', loc === 'en' ? 'probability on the branch heads, then tails: empty' : 'احتمال روی شاخهٔ شیر، بعد خط: خالی');
    await chip.focus();
    await page.keyboard.press('Enter');
    await expect(lab(page).locator('.kg-dl-ed input[data-f="0"]')).toBeFocused();
    await page.keyboard.type('1');
    await page.keyboard.press('Tab');
    await page.keyboard.type(loc === 'en' ? '2' : '۲');
    await page.keyboard.press('Enter');
    await expect(chip).toBeFocused();
    await expect(chip).toHaveAttribute('aria-label', loc === 'en' ? 'probability on the branch heads, then tails: 1 over 2' : 'احتمال روی شاخهٔ شیر، بعد خط: صورت ۱، مخرج ۲');
  }
});

test('touch targets are at least 44px and there is no horizontal scroll at 390px', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    const n = loc === 'en' ? 6 : 5;
    for (let m = 0; m < n; m++) {
      await mission(page, m);
      // grow everything, and open an editor, so every control is on the page
      for (let i = 0; i < 12 && (await lab(page).locator('.kg-dl-grow:not(.done)').count()); i++) {
        const g = lab(page).locator('.kg-dl-grow:not(.done)').first();
        await g.click();
        const opts = lab(page).locator('.kg-dl-ed [data-a="o"][aria-pressed="false"]');
        for (let j = await opts.count(); j > 0; j--) await opts.first().click();
      }
      const c = lab(page).locator('.kg-dl-tc').first();
      if (await c.count()) await c.click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const small = await lab(page).locator('button, input').evaluateAll((bs) =>
        bs.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
      expect(small, `${loc} mission ${m + 1}: controls under 44px`).toBe(0);
      // chips and leaf buttons do not overlap each other
      const boxes = await lab(page).locator('.kg-dl-tbox button').evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect()).map((r) => [r.left, r.top, r.right, r.bottom]));
      const hit = boxes.some((a, i) => boxes.some((b, j) => j > i && a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1));
      expect(hit, `${loc} mission ${m + 1}: overlapping buttons`).toBe(false);
    }
  }
});

// Options later studios need, mounted on this studio's page because it already loads the engine and the module.
async function mount(page: Page, config: unknown) {
  await page.goto(URL('en'));
  await expect(tree(page)).toHaveCount(1);
  await page.evaluate((cfg) => {
    const el = document.createElement('kg-discrete-lab') as HTMLElement & { config: unknown };
    el.id = 'probe';
    el.dataset.digits = '0123456789';
    el.config = cfg;
    document.querySelector('.mission')!.replaceWith(el);
  }, config);
  const el = page.locator('#probe');
  await expect(el.locator('.kg-dl-tbox')).toHaveCount(1);
  return el;
}
const probe = (page: Page) => page.locator('#probe').evaluate((el) => (el as unknown as { state: { sets: Record<string, any> } }).state.sets);

test('engine: three stages, shown path products, and per-path probabilities (dependent events)', async ({ page }) => {
  const el = await mount(page, { tree: { stages: [{ outcomes: ['h', 't'] }, { outcomes: ['h', 't'] }, { outcomes: ['h', 't'] }], show: { p: false } } });
  await expect(el.locator('.kg-dl-tn.leaf')).toHaveCount(8);
  expect((await probe(page)).tree).toMatchObject({ leaves: 8, sum: 6 });
  const dep = await mount(page, {
    tree: { stages: [{ outcomes: ['rain', 'dry'], p: [[1, 3], [2, 3]] }, { outcomes: ['late', 'on'] }], p: { 'rain.late': [1, 4], 'rain.on': [3, 4], 'dry.late': [1, 10], 'dry.on': [9, 10] }, show: { product: true } },
  });
  await expect(dep.locator('.kg-dl-tp .kg-dl-fr')).toHaveCount(10);
  await expect(dep.locator('.kg-dl-tp .kg-dl-fr').nth(2)).toHaveText('112');
});
