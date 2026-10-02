import { chromium } from '@playwright/test';
const [,, loc, id, m, sel, out] = process.argv;
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:4721/' + loc + '/studio/' + id + '/');
await p.locator('.mission-tab').nth(+m).click();
await p.waitForTimeout(300);
await p.locator(sel).first().screenshot({ path: out });
await b.close();
