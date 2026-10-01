import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ops-add-sub-10/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

async function check(page: Page, loc: keyof typeof CHECK) {
  await page.getByRole('button', { name: CHECK[loc], exact: true }).click();
}
const tile = (page: Page, n: string) => page.locator('kg-counters .kg-ct-pick').getByRole('radio', { name: n, exact: true });

test('fa-IR join: move both plates into the basket, then tap the total', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const plates = page.locator('kg-counters .kg-ct-zone.group button.kg-ct-c');
  await expect(plates).toHaveCount(7);
  // The sentence reads left to right with Persian digits and an empty answer box.
  await expect(page.locator('.kg-ct-sent')).toHaveText('۳+۴=?');
  await expect(page.locator('.kg-ct-hint')).toContainText('روی هر سیب بزن');

  // Wrong: apples still on the plates
  await plates.first().click();
  await tile(page, '۷').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز سیب در بشقاب مانده');

  for (let i = 0; i < 6; i++) await plates.first().click();
  await expect(plates).toHaveCount(0);
  const basket = page.locator('kg-counters .kg-ct-frame .kg-ct-c');
  await expect(basket).toHaveCount(7);
  await expect(page.locator('kg-counters .kg-ct-frame .kg-ct-c.c1')).toHaveCount(4);

  // Wrong: only one plate counted
  await tile(page, '۴').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('فقط سیب‌های یک بشقاب');

  await tile(page, '۷').click();
  await expect(page.locator('.kg-ct-sent .kg-ct-box')).toHaveText('۷');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR take away: cross out, wrong count, then the number left', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(1).click();
  const apples = page.locator('kg-counters button.kg-ct-c');
  await expect(apples).toHaveCount(8);
  await apples.nth(7).click();
  await apples.nth(6).click();
  await tile(page, '۵').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('باید ۳ سیب را خط بزنی');

  await apples.nth(5).click();
  await expect(page.locator('kg-counters .kg-ct-c.x')).toHaveCount(3);
  await expect(apples.nth(5)).toHaveAttribute('aria-pressed', 'true');
  await tile(page, '۳').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ماندند');

  await tile(page, '۵').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR compare: circle the apples with no partner, then the difference', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(2).click();
  const sara = page.locator('kg-counters .kg-ct-zone.row').first().locator('button.kg-ct-c');
  await expect(sara).toHaveCount(7);
  await expect(page.locator('kg-counters .kg-ct-zone.row').nth(1).locator('.kg-ct-c')).toHaveCount(4);
  for (const i of [4, 5, 6]) await sara.nth(i).click();
  await expect(page.locator('kg-counters .kg-ct-c.ring')).toHaveCount(3);

  await tile(page, '۷').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بیشتر');

  await tile(page, '۳').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR bond of 10: paint the yellow part, then find it', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(3).click();
  const counters = page.locator('kg-counters button.kg-ct-c');
  await expect(counters).toHaveCount(10);
  await expect(page.locator('.kg-ct-bond .whole')).toHaveText('۱۰');
  await expect(page.locator('.kg-ct-bond .part.c0')).toHaveText('۶');

  // Wrong: only 3 painted
  for (const i of [9, 8, 7]) await counters.nth(i).click();
  await tile(page, '۴').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۶ مهره قرمز');

  await counters.nth(6).click();
  await expect(page.locator('kg-counters .kg-ct-c.c1')).toHaveCount(4);
  await tile(page, '۶').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('زرد');

  await tile(page, '۴').click();
  await expect(page.locator('.kg-ct-bond .part.c1')).toHaveText('۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: every mission, wrong then right, with English digits', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  // join
  const plates = page.locator('kg-counters .kg-ct-zone.group button.kg-ct-c');
  for (let i = 0; i < 7; i++) await plates.first().click();
  await tile(page, '8').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Count each apple only once');
  await tile(page, '7').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('3 + 4 = 7');

  // take away
  await page.locator('.mission-tab').nth(1).click();
  const apples = page.locator('kg-counters button.kg-ct-c');
  for (const i of [0, 1, 2]) await apples.nth(i).click();
  await tile(page, '8').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('There were 8 at the start');
  await tile(page, '5').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // compare
  await page.locator('.mission-tab').nth(2).click();
  const sara = page.locator('kg-counters .kg-ct-zone.row').first().locator('button.kg-ct-c');
  for (const i of [4, 5]) await sara.nth(i).click();
  await tile(page, '3').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('no partner');
  await sara.nth(6).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // bond
  await page.locator('.mission-tab').nth(3).click();
  const counters = page.locator('kg-counters button.kg-ct-c');
  for (const i of [6, 7, 8, 9]) await counters.nth(i).click();
  await tile(page, '10').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Count only the yellow');
  await tile(page, '4').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('keyboard: counters and number tiles work with Enter and Space, focus stays put', async ({ page }) => {
  await page.goto(URL('en'));
  await page.locator('.mission-tab').nth(1).click();
  const first = page.locator('kg-counters button.kg-ct-c').first();
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('kg-counters .kg-ct-c.x')).toHaveCount(1);
  await expect(page.locator('kg-counters button.kg-ct-c').first()).toBeFocused();
  await expect(page.locator('kg-counters button.kg-ct-c').first()).toHaveAttribute('aria-label', /counter 1, red, crossed out/);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(page.locator('kg-counters .kg-ct-c.x')).toHaveCount(2);
  await tile(page, '6').focus();
  await page.keyboard.press('Enter');
  await expect(tile(page, '6')).toHaveAttribute('aria-checked', 'true');
});

test('touch targets are at least 44px and there is no horizontal scroll at 390px', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    for (let m = 0; m < 4; m++) {
      await page.locator('.mission-tab').nth(m).click();
      await expect(page.locator('kg-counters .kg-ct-pick')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const small = await page.locator('kg-counters button').evaluateAll((bs) =>
        bs.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
      expect(small, `${loc} mission ${m + 1}: buttons under 44px`).toBe(0);
    }
  }
});

// Options the later counters studios (count-to-10, numbers-to-20, add-sub-20, mul-div-groups, frac-of-a-set,
// factors-primes) need, mounted on this studio's page because it already loads the engine.
async function mount(page: Page, config: unknown) {
  await page.goto(URL('en'));
  await expect(page.locator('kg-counters')).toHaveCount(1);
  await page.evaluate((cfg) => {
    const el = document.createElement('kg-counters') as HTMLElement & { config: unknown };
    el.id = 'probe';
    el.dataset.digits = '0123456789';
    el.config = cfg;
    document.querySelector('.mission')!.replaceWith(el);
  }, config);
  return page.locator('#probe');
}
const state = (page: Page) => page.locator('#probe').evaluate((el) => (el as unknown as { state: unknown }).state);

test('engine: sharing deals from a pool into plates, and a counter can go back', async ({ page }) => {
  const el = await mount(page, { zones: [{ kind: 'group', fill: 6 }, { kind: 'group', from: 0, to: 0 }, { kind: 'group', from: 0, to: 0 }] });
  const drops = el.locator('.kg-ct-zone > .kg-ct-btn');
  await expect(drops).toHaveCount(2);
  for (let i = 0; i < 3; i++) { await drops.nth(0).click(); await drops.nth(1).click(); }
  expect(await state(page)).toMatchObject({ zones: [{ count: 0 }, { count: 3 }, { count: 3 }] });
  await el.locator('.kg-ct-zone').nth(1).locator('button.kg-ct-c').first().click();
  expect(await state(page)).toMatchObject({ zones: [{ count: 1 }, { count: 2 }, { count: 3 }] });
});

test('engine: pick up and drop, fill a double ten-frame, numbered rows', async ({ page }) => {
  const el = await mount(page, {
    zones: [{ kind: 'group', fill: [2, 1], act: 'move' }, { kind: 'group', drop: true }, { kind: 'frame', slots: 20, fill: 10, act: 'fill', count: true }, { kind: 'row', slots: 5, fill: 5, numbers: true }],
  });
  const first = el.locator('.kg-ct-zone').first().locator('button.kg-ct-c').last();
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await el.locator('.kg-ct-zone').nth(1).locator('.kg-ct-btn').click();
  const s = (await state(page)) as { zones: { colors: number[] }[] };
  expect(s.zones.slice(0, 2).map((z) => z.colors)).toEqual([[2, 0], [0, 1]]);
  await expect(el.locator('.kg-ct-frame')).toHaveCount(2);
  await el.locator('.kg-ct-frame').nth(1).locator('button.kg-ct-empty').nth(4).click();
  await expect(el.locator('.kg-ct-n')).toHaveText('11');
  await expect(el.locator('.kg-ct-row i')).toHaveText(['1', '2', '3', '4', '5']);
});

test('engine: arrays resize, turn and split; a kept number shows when rows are not a factor', async ({ page }) => {
  const el = await mount(page, { zones: [{ kind: 'array', rows: 2, cols: 3, act: 'split', turn: true }] });
  await el.getByRole('button', { name: 'more rows' }).click();
  await el.getByRole('button', { name: 'more columns' }).click();
  expect(await state(page)).toMatchObject({ zones: [{ rows: 3, cols: 4, count: 12 }] });
  await el.locator('button.kg-ct-c').nth(0).click();
  expect(await state(page)).toMatchObject({ zones: [{ colors: [3, 9] }] });
  await el.getByRole('button', { name: 'turn' }).click();
  expect(await state(page)).toMatchObject({ zones: [{ rows: 4, cols: 3, colors: [12, 0] }] });

  const kept = await mount(page, { zones: [{ kind: 'array', cols: 1, keep: 12, maxCols: 12 }] });
  await expect(kept.getByRole('button', { name: 'more rows' })).toHaveCount(0);
  for (let i = 0; i < 4; i++) await kept.getByRole('button', { name: 'more columns' }).click();
  await expect(kept.locator('.kg-ct-array.short')).toHaveCount(1);
  expect(await state(page)).toMatchObject({ zones: [{ rows: 3, cols: 5, count: 12 }] });
  await kept.getByRole('button', { name: 'fewer columns' }).click();
  await expect(kept.locator('.kg-ct-array.short')).toHaveCount(0);
});

test('engine: a factor tree splits until every leaf is prime', async ({ page }) => {
  const el = await mount(page, { zones: [{ kind: 'tree', value: 12 }] });
  await el.locator('button.kg-ct-v').click();
  await el.getByRole('button', { name: '3 × 4' }).click();
  await el.locator('button.kg-ct-v', { hasText: '4' }).click();
  await el.getByRole('button', { name: '2 × 2' }).click();
  await expect(el.locator('.kg-ct-v.prime')).toHaveCount(3);
  expect(await state(page)).toMatchObject({ zones: [{ leaves: [2, 2, 3], done: true }] });
});
