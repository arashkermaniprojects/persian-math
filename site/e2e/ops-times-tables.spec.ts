import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ops-times-tables/`;
const engine = (page: Page) => page.locator('kg-fact-fluency');
const input = (page: Page) => page.locator('kg-fact-fluency input.kg-ff-in');
const msg = (page: Page) => page.locator('.kg-ff-msg');
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

interface Q { a: number; b: number; op: string }
interface State { total: number; answered: number; correct: number; done: boolean; question: Q | null; missed: string[]; timer: boolean; split?: number }
const state = (page: Page) => engine(page).evaluate((e) => (e as unknown as { state: State }).state);
const product = (q: Q) => q.a * q.b;
const fa = (n: number | string) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

async function openMission(page: Page, loc: string, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(engine(page)).toBeVisible();
}

/** Type an answer with the keyboard (Latin digits are accepted in every locale) and press Enter. */
async function type(page: Page, n: number) {
  await input(page).fill(String(n));
  await input(page).press('Enter');
}

/** Answer every remaining question right; returns the facts asked as "a×b". */
async function playOut(page: Page) {
  const asked: string[] = [];
  for (let s = await state(page); s.question; s = await state(page)) {
    asked.push(`${s.question.a}×${s.question.b}`);
    await type(page, product(s.question));
  }
  return asked;
}

test('fa-IR: say the 5 table in order; the array grows a row of 5 each time', async ({ page }) => {
  await openMission(page, 'fa-IR', 0);
  await expect(engine(page)).toHaveAttribute('data-mode', 'recite');
  await expect(page.locator('.kg-ff-q')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('.kg-ff-q')).toContainText('۱×۵=');
  await expect(page.locator('.kg-ff-array .kg-ff-row')).toHaveCount(1);

  // Checking before answering is "empty", not a fail.
  await page.getByRole('button', { name: CHECK['fa-IR'] }).click();
  await expect(page.locator('.feedback.no')).toContainText('شروع کن');

  await type(page, 5);
  await expect(msg(page)).toContainText('آفرین!');
  await expect(page.locator('.kg-ff-array .kg-ff-row')).toHaveCount(2);
  await expect(page.locator('.kg-ff-array .kg-ff-tot').first()).toHaveText('۵'); // skip counting at the row ends
  // 2 × 5: answering 7 (2 + 5) is "added instead of multiplied".
  await type(page, 7);
  await expect(msg(page)).toContainText('جمع کردی');
  await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: CHECK['fa-IR'] }).click();
  await expect(page.locator('.feedback.no')).toContainText('ادامه بده');

  // The rest with the on-screen keypad (Persian digits on the keys).
  for (let k = 2; k <= 10; k++) {
    for (const d of String(k * 5)) await page.locator('.kg-ff-key', { hasText: new RegExp(`^${fa(d)}$`) }).click();
    await page.getByRole('button', { name: 'تأیید' }).click();
  }
  await expect(page.locator('.kg-ff-list li')).toHaveCount(10);
  await expect(page.locator('.kg-ff-list li').last()).toHaveText('۱۰ × ۵ = ۵۰');
  await expect(page.locator('.kg-ff-score')).toContainText('۹ از ۱۰');
  const s = await state(page);
  expect(s).toMatchObject({ total: 10, answered: 10, correct: 9, done: true });
  await page.getByRole('button', { name: CHECK['fa-IR'] }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('en: the 5 table goes to 12 × 5, and a keypad mistake can be deleted', async ({ page }) => {
  await openMission(page, 'en', 0);
  await page.locator('.kg-ff-key', { hasText: /^9$/ }).click();
  await page.getByRole('button', { name: 'delete' }).click();
  await page.locator('.kg-ff-key', { hasText: /^5$/ }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(msg(page)).toContainText('Yes! 1 × 5 = 5');
  for (let k = 2; k <= 12; k++) await type(page, k * 5);
  expect(await state(page)).toMatchObject({ total: 12, correct: 12, done: true });
  await expect(page.locator('.kg-ff-list li').last()).toHaveText('12 × 5 = 60');
  await page.getByRole('button', { name: CHECK.en }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: 2, 5 and 10 quiz; a miss shows the picture, comes back later and is remembered on the device', async ({ page }) => {
  await openMission(page, 'en', 1);
  await expect(page.locator('.kg-ff-array')).toHaveCount(0); // picture only on request
  await page.getByRole('button', { name: 'Show me a picture' }).click();
  const q = (await state(page)).question!;
  await expect(page.locator('.kg-ff-pic .kg-ff-row')).toHaveCount(q.a);
  await expect(page.locator('.kg-ff-pic .kg-ff-row').first().locator('i')).toHaveCount(q.b);

  await type(page, product(q) + q.b); // one row too many
  await expect(msg(page)).toContainText(q.a === 1 || q.b === 1 ? 'Times 1' : 'So close');
  await expect(page.locator('.kg-ff-pic .kg-ff-tot').last()).toHaveText(String(product(q))); // running totals after a miss
  await type(page, product(q));
  await expect(msg(page)).toContainText('Now you');

  await page.getByRole('button', { name: CHECK.en }).click();
  await expect(page.locator('.feedback.no')).toContainText('Keep going');

  const asked = await playOut(page);
  const key = `${q.a}×${q.b}`;
  expect(asked).toContain(key); // asked again within the round
  const s = await state(page);
  expect(s).toMatchObject({ total: 10, answered: 10, correct: 9, done: true, missed: [key] });
  await expect(page.locator('.kg-ff-missed li')).toHaveCount(1);
  const mem = await page.evaluate(() => JSON.parse(localStorage.getItem('kamangir:facts') ?? '{}'));
  const memKey = `mul:${Math.min(q.a, q.b)}:${Math.max(q.a, q.b)}`;
  expect(mem[memKey]).toMatchObject({ box: 0, missed: 1 });
  await page.getByRole('button', { name: CHECK.en }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // A new round (even after a reload) asks the missed fact again.
  await page.reload();
  await page.locator('.mission-tab').nth(1).click();
  const next = await playOut(page);
  expect(next.some((f) => f === key || f === `${q.b}×${q.a}`)).toBe(true);
});

test('fa-IR: ×0 and ×1 with the picture always shown, and targeted feedback', async ({ page }) => {
  await openMission(page, 'fa-IR', 2);
  await expect(page.locator('.kg-ff-pic .kg-ff-array')).toBeVisible();
  await expect(page.getByRole('button', { name: 'شکلش را نشانم بده' })).toBeHidden();
  const q = (await state(page)).question!;
  if (q.a === 0 || q.b === 0) {
    await type(page, q.a + q.b); // "7 × 0 = 7"
    await expect(msg(page)).toContainText('صفر می‌شود');
  } else {
    await type(page, q.a + q.b); // "7 × 1 = 8"
    await expect(msg(page)).toContainText('عوض نمی‌کند');
  }
  await page.getByRole('button', { name: CHECK['fa-IR'] }).click();
  await expect(page.locator('.feedback.no')).toContainText('ادامه بده');
  await type(page, product(q));
  await playOut(page);
  expect(await state(page)).toMatchObject({ total: 8, correct: 7, done: true });
  await page.getByRole('button', { name: CHECK['fa-IR'] }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: a round with too few right first time asks to play again', async ({ page }) => {
  await openMission(page, 'fa-IR', 1);
  for (let i = 0; i < 3; i++) {
    const q = (await state(page)).question!;
    await type(page, product(q) + 1);
    await type(page, product(q));
  }
  await playOut(page);
  expect(await state(page)).toMatchObject({ correct: 7, done: true });
  await page.getByRole('button', { name: CHECK['fa-IR'] }).click();
  await expect(page.locator('.feedback.no')).toContainText('یک دور دیگر');
  await page.getByRole('button', { name: 'یک دور دیگر' }).click();
  expect(await state(page)).toMatchObject({ answered: 0, done: true, correct: 7 });
  await playOut(page);
  expect(await state(page)).toMatchObject({ correct: 10 });
  await page.getByRole('button', { name: CHECK['fa-IR'] }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR and en: split 6 × 7 into facts you know', async ({ page }) => {
  for (const loc of ['fa-IR', 'en'] as const) {
    await openMission(page, loc, 3);
    await expect(page.locator('.kg-ff-array .kg-ff-row')).toHaveCount(6);
    const parts = page.locator('.kg-ff-parts bdi');
    await expect(parts.first()).toHaveText(loc === 'en' ? '3 × 7 = 21' : '۳ × ۷ = ۲۱');
    const down = page.getByRole('button', { name: loc === 'en' ? 'Move the line down' : 'خط را پایین ببر' });
    await down.click();
    await down.click();
    await expect(parts.first()).toHaveText(loc === 'en' ? '5 × 7 = 35' : '۵ × ۷ = ۳۵');
    await expect(parts.last()).toHaveText(loc === 'en' ? '1 × 7 = 7' : '۱ × ۷ = ۷');
    await expect(down).toBeDisabled();
    expect((await state(page)).split).toBe(5);
    const box = page.locator('.int-input');
    await box.fill(loc === 'en' ? '13' : '۱۳');
    await page.getByRole('button', { name: CHECK[loc] }).click();
    await expect(page.locator('.feedback.no')).toContainText(loc === 'en' ? 'You added 6 and 7' : 'جمع کردی');
    await box.fill(loc === 'en' ? '35' : '۳۵');
    await page.getByRole('button', { name: CHECK[loc] }).click();
    await expect(page.locator('.feedback.no')).toContainText(loc === 'en' ? 'one more row' : 'یک ردیف ۷تایی دیگر');
    await box.fill(loc === 'en' ? '42' : '۴۲');
    await page.getByRole('button', { name: CHECK[loc] }).click();
    await expect(page.locator('.feedback.ok')).toBeVisible();
  }
});

test('the rest: tables to 10 × 10 in fa-IR, to 12 × 12 in en', async ({ page }) => {
  await openMission(page, 'fa-IR', 4);
  const faAsked = await playOut(page);
  expect(faAsked).toHaveLength(12);
  expect(faAsked.every((f) => f.split('×').every((n) => +n <= 10))).toBe(true);
  await page.getByRole('button', { name: CHECK['fa-IR'] }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // en: the 11 and 12 tables are in the pool (a few rounds make it near-certain one shows up).
  await openMission(page, 'en', 4);
  const enAsked: string[] = [];
  for (let r = 0; r < 4; r++) {
    enAsked.push(...(await playOut(page)));
    await page.locator('.kg-ff-again').click();
  }
  expect(enAsked.some((f) => f.split('×').some((n) => +n > 10))).toBe(true);
});

test('fa-IR: the gentle timer is off by default, never marks wrong, and is remembered', async ({ page }) => {
  await page.clock.install();
  await openMission(page, 'fa-IR', 4);
  const timer = page.getByRole('button', { name: 'زمان‌سنج آرام' });
  await expect(timer).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.kg-ff-bar')).toBeHidden();
  await timer.click();
  await expect(timer).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.kg-ff-bar')).toBeVisible();
  await page.clock.fastForward(7000);
  await expect(msg(page)).toContainText('عجله نکن');
  const q = (await state(page)).question!;
  await type(page, product(q));
  expect(await state(page)).toMatchObject({ correct: 1, timer: true });
  await page.reload();
  await page.locator('.mission-tab').nth(4).click();
  await expect(page.getByRole('button', { name: 'زمان‌سنج آرام' })).toHaveAttribute('aria-pressed', 'true');
});

test('no horizontal scroll at 390px and 44px targets, every mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    for (let i = 0; i < 5; i++) {
      await openMission(page, loc, i);
      const s = await state(page);
      if (s.question) {
        // Show the biggest picture: after a miss (quiz) or near the end of the table (recite).
        const help = page.locator('.kg-ff-help');
        if (await help.isVisible()) await help.click();
        if (i === 0) for (let k = 1; k < (loc === 'en' ? 12 : 10); k++) await type(page, k * 5);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
      for (const b of await page.locator('kg-fact-fluency button:visible').all()) {
        const box = (await b.boundingBox())!;
        expect(box.height, `${loc} mission ${i + 1}`).toBeGreaterThanOrEqual(44);
        expect(box.width, `${loc} mission ${i + 1}`).toBeGreaterThanOrEqual(44);
      }
    }
  }
});
