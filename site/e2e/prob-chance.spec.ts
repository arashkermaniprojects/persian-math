import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/prob-chance/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

async function check(page: Page, loc: keyof typeof CHECK) {
  await page.getByRole('button', { name: CHECK[loc], exact: true }).click();
}
const sim = (page: Page) => page.locator('kg-probability-sim');
const tile = (page: Page, name: string) => sim(page).locator('.kg-ps-tile', { hasText: name });
/** The level buttons of one event on the likelihood line (left to right: impossible … certain). */
const stops = (page: Page, i: number) => sim(page).locator('.kg-ps-stops').nth(i).getByRole('radio');
const engineState = (page: Page) => sim(page).evaluate((el) => (el as unknown as { state: { chance: Record<string, unknown> } }).state.chance);

test('fa-IR what can come out: tap the colours in the bag', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(sim(page).locator('.kg-ps-bag i')).toHaveCount(6);
  await expect(sim(page).locator('.kg-ps-hint')).toContainText('یک مهره بردار');

  // drawing a counter shows it beside the bag and counts the trial
  await sim(page).getByRole('button', { name: 'یک مهره بردار' }).click();
  await expect(sim(page).locator('.kg-ps-drawn')).toHaveCount(1);
  await expect(sim(page).locator('.kg-ps-tally caption')).toHaveText('آزمایش: ۱ بار');

  // Wrong: blue is not in the bag
  await tile(page, 'قرمز').click();
  await tile(page, 'آبی').click();
  await expect(tile(page, 'آبی')).toHaveAttribute('aria-pressed', 'true');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('آبی یا سبز نیست');

  // Wrong: white is missing
  await tile(page, 'آبی').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('جا انداختی');

  await tile(page, 'سفید').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR certain, possible, impossible: place each event on the line', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(1).click();
  await expect(sim(page).locator('.kg-ps-ev')).toHaveCount(4);
  // the line runs left to right: impossible, possible, certain
  await expect(sim(page).locator('.kg-ps-line .lbl')).toHaveText(['غیرممکن', 'ممکن', 'حتمی']);

  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز جمله‌ای مانده');

  // Wrong: "most are red" is not "certain"
  await stops(page, 0).nth(2).click();
  await stops(page, 1).nth(1).click();
  await stops(page, 2).nth(0).click();
  await stops(page, 3).nth(2).click();
  await expect(stops(page, 0).nth(2)).toHaveAttribute('aria-checked', 'true');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بیشتر مهره‌ها قرمزند');

  // Wrong: one white counter is still possible
  await stops(page, 0).nth(1).click();
  await stops(page, 1).nth(0).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('همان یکی هم ممکن است');

  await stops(page, 1).nth(1).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR make it certain: empty bag, other colours left, then only red', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(2).click();
  const less = (c: string) => sim(page).getByRole('button', { name: `یک مهرهٔ ${c} کمتر` });
  const more = (c: string) => sim(page).getByRole('button', { name: `یک مهرهٔ ${c} بیشتر` });

  await less('آبی').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('غیر از قرمز');

  for (const c of ['قرمز', 'قرمز', 'آبی', 'سبز']) await less(c).click();
  await expect(sim(page).locator('.kg-ps-bag i')).toHaveCount(0);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('کیسه خالی است');

  await more('قرمز').click();
  await expect(less('قرمز')).toBeFocused();
  await sim(page).getByRole('button', { name: /۱۰ بار/ }).click();
  expect(await engineState(page)).toMatchObject({ trials: 10, tally: { red: 10 }, bag: { red: 1, blue: 0, green: 0 } });
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR which colour: guess, then spin 10 times to test it', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(3).click();
  await expect(sim(page).locator('.kg-ps-spin path[class^="c-"]')).toHaveCount(8);

  await tile(page, 'قرمز').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('کمترین شانس');

  await tile(page, 'آبی').click();
  await expect(tile(page, 'آبی')).toHaveAttribute('aria-checked', 'true');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('حداقل ۱۰ بار');

  await sim(page).getByRole('button', { name: /۱۰ بار/ }).click();
  await expect(sim(page).locator('.kg-ps-tally caption')).toHaveText('آزمایش: ۱۰ بار');
  await expect(sim(page).locator('.kg-ps-live')).toContainText('نتیجه:');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR roll a six: the fraction, upside down then right; 100 rolls show fractions', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(4).click();
  await sim(page).getByRole('button', { name: /۱۰۰ بار/ }).click();
  const s = (await engineState(page)) as { trials: number; tally: Record<string, number> };
  expect(s.trials).toBe(100);
  expect(Object.values(s.tally).reduce((a, b) => a + b, 0)).toBe(100);
  await expect(sim(page).locator('.kg-ps-tally .frac').first()).toBeVisible();
  await expect(sim(page).locator('.kg-ps-tally .kg-ps-bar')).toHaveCount(6);

  await page.locator('.kg-fi-n').fill('۶');
  await page.locator('.kg-fi-d').fill('۱');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('برعکس');
  await page.locator('.kg-fi-n').fill('۱');
  await page.locator('.kg-fi-d').fill('۶');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: every mission, wrong then right, with English digits', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  // what can come out
  await tile(page, 'red').click();
  await tile(page, 'green').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText("can't come out");
  await tile(page, 'green').click();
  await tile(page, 'white').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // likelihood line
  await page.locator('.mission-tab').nth(1).click();
  for (const [e, l] of [[0, 1], [1, 1], [2, 1], [3, 2]]) await stops(page, e).nth(l).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('no blue counters');
  await stops(page, 2).nth(0).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // make it certain
  await page.locator('.mission-tab').nth(2).click();
  await sim(page).getByRole('button', { name: 'one fewer green' }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText("that isn't red");
  for (let i = 0; i < 2; i++) await sim(page).getByRole('button', { name: 'one fewer blue' }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // which colour
  await page.locator('.mission-tab').nth(3).click();
  await tile(page, 'green').click();
  await sim(page).getByRole('button', { name: 'Spin, 10 times' }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Green has 3 parts');
  await tile(page, 'blue').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // roll a six
  await page.locator('.mission-tab').nth(4).click();
  await sim(page).getByRole('button', { name: 'Roll', exact: true }).click();
  await expect(sim(page).locator('.kg-ps-tally caption')).toHaveText('Trials: 1');
  await page.locator('.kg-fi-n').fill('1');
  await page.locator('.kg-fi-d').fill('5');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('not 5');
  await page.locator('.kg-fi-d').fill('6');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('keyboard: arrow keys move along the likelihood line, left to right even in RTL', async ({ page }) => {
  for (const loc of ['en', 'fa-IR']) {
    await page.goto(URL(loc));
    await page.locator('.mission-tab').nth(1).click();
    const first = stops(page, 0);
    await first.nth(0).focus();
    await page.keyboard.press('Enter');
    await expect(first.nth(0)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(first.nth(1)).toHaveAttribute('aria-checked', 'true');
    await expect(first.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(first.nth(0)).toBeFocused();
    await expect(first.nth(0)).toHaveAttribute('aria-label', loc === 'en' ? 'impossible' : 'غیرممکن');
  }
});

test('touch targets are at least 44px and there is no horizontal scroll at 390px', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    for (let m = 0; m < 5; m++) {
      await page.locator('.mission-tab').nth(m).click();
      await expect(sim(page)).toBeVisible();
      await sim(page).locator('.kg-ps-run .go').last().click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const small = await sim(page).locator('button').evaluateAll((bs) =>
        bs.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
      expect(small, `${loc} mission ${m + 1}: buttons under 44px`).toBe(0);
    }
  }
});

// Options later studios need, mounted on this studio's page because it already loads the engine.
async function mount(page: Page, config: unknown) {
  await page.goto(URL('en'));
  await expect(sim(page)).toHaveCount(1);
  await page.evaluate((cfg) => {
    const el = document.createElement('kg-probability-sim') as HTMLElement & { config: unknown };
    el.id = 'probe';
    el.dataset.digits = '0123456789';
    el.config = cfg;
    document.querySelector('.mission')!.replaceWith(el);
  }, config);
  return page.locator('#probe');
}
const probe = (page: Page) => page.locator('#probe').evaluate((el) => (el as unknown as { state: { chance: Record<string, unknown> } }).state.chance);

test('engine: the same seed gives the same results; a limit stops the trials', async ({ page }) => {
  const el = await mount(page, { kind: 'coin', seed: 9, limit: 20 });
  await el.getByRole('button', { name: 'Go, 10 times' }).click();
  const first = (await probe(page)).tally;
  await page.evaluate(() => { (document.getElementById('probe') as unknown as { config: unknown }).config = { kind: 'coin', seed: 9, limit: 20 }; });
  await el.getByRole('button', { name: 'Go, 10 times' }).click();
  expect((await probe(page)).tally).toEqual(first);
  await el.getByRole('button', { name: 'Go, 10 times' }).click();
  await expect(el.getByRole('button', { name: 'Go, 10 times' })).toBeDisabled();
  await el.getByRole('button', { name: 'Start again' }).click();
  expect(await probe(page)).toMatchObject({ trials: 0, tally: {} });
});

test('engine: two coins list a joint sample space; theory column', async ({ page }) => {
  const el = await mount(page, { devices: [{ kind: 'coin' }, { kind: 'coin' }], space: { extra: ['heads'] }, tally: { theory: true } });
  await expect(el.locator('.kg-ps-coin')).toHaveCount(2);
  await expect(el.locator('.kg-ps-tile')).toHaveCount(5);
  for (let i = 0; i < 4; i++) await el.locator('.kg-ps-tile').nth(i).click();
  expect(await probe(page)).toMatchObject({ listed: ['heads-heads', 'heads-tails', 'tails-heads', 'tails-tails'], space: ['heads-heads', 'heads-tails', 'tails-heads', 'tails-tails'] });
  await expect(el.locator('.kg-ps-tally tr').nth(1).locator('td').last().locator('.frac')).toHaveAttribute('aria-label', '1/4');
});

test('engine: hidden bag, 5-level line with numbers, spinner painting', async ({ page }) => {
  const el = await mount(page, {
    kind: 'bag', bag: { red: 1, blue: 3 }, hidden: true,
    scale: { levels: 5, numbers: true, events: [{ key: 'red', outcomes: ['red'] }, { key: 'sun', level: 'certain' }] },
  });
  await expect(el.locator('.kg-ps-bag i')).toHaveCount(0);
  await expect(el.locator('.kg-ps-bag b')).toHaveText('?');
  await expect(el.locator('.kg-ps-line .lv')).toHaveCount(5);
  await expect(el.locator('.kg-ps-line .num .frac')).toHaveCount(1);
  expect((await probe(page)).events).toEqual([{ key: 'red', placed: null, truth: 'unlikely' }, { key: 'sun', placed: null, truth: 'certain' }]);

  const sp = await mount(page, { kind: 'spinner', sectors: ['red', 'red'], edit: ['red', 'blue'], run: [] });
  await expect(sp.locator('.kg-ps-run')).toHaveCount(0);
  await sp.locator('path[data-a="paint"]').nth(1).click();
  expect((await probe(page)).probs).toEqual({ red: [1, 2], blue: [1, 2] });
  await sp.locator('path[data-a="paint"]').nth(0).focus();
  await page.keyboard.press('Enter');
  expect((await probe(page)).probs).toEqual({ blue: [1, 1] });
});
