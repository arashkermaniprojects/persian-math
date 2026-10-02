import { chromium } from '@playwright/test';
const [,, loc, id, ...ms] = process.argv;
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:4721/' + loc + '/studio/' + id + '/');
for (const m of ms) {
  await p.locator('.mission-tab').nth(+m).click();
  await p.waitForTimeout(300);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await p.locator('.mission').screenshot({ path: '/private/tmp/claude-501/-Users-arashkermanikolankeh-Documents-Work-Peojects-Persian-math/f055c3ff-caea-4065-a25a-8e2d05968574/scratchpad/s-pc/shots/' + loc + '-' + id + '-' + m + '.png' });
  console.log(loc, id, m, 'overflow', ov);
}
console.log('errors', errs);
await b.close();
