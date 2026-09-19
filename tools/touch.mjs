// Touch smoke test: a 1024x768 tablet in Edge. Taps the ground and an NPC, checks the player moved.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5190/?freeroam', { waitUntil: 'load' });
await page.waitForTimeout(5000);
const before = await page.evaluate(() => __world.get('player').tile);
const t = await page.evaluate(() => __world.toScreen({ x: 15, y: 43 }));
await page.touchscreen.tap(t.x, t.y + 20);
await page.waitForTimeout(3000);
const after = await page.evaluate(() => __world.get('player').tile);
const buttons = await page.evaluate(() => [...document.querySelectorAll('#stage button')].map((b) => b.getAttribute('aria-label')));
await page.screenshot({ path: 'test-output/touch.png' });
console.log(JSON.stringify({ before, after, moved: before.x !== after.x || before.y !== after.y, buttons, errs }));
await browser.close();
