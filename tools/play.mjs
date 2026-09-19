// Drive the real game in Edge: a list of steps, a screenshot after each.
// Usage: node tools/play.mjs <name> '<json steps>'
// step: {"click":"text"} | {"key":"Enter"} | {"wait":ms} | {"js":"code"} | {"shot":"label"} | {"clickXY":[x,y]}
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const [name = 'play', stepsJson = '[]'] = process.argv.slice(2);
const steps = JSON.parse(stepsJson);
mkdirSync('test-output', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:5190/', { waitUntil: 'load' });
await page.waitForTimeout(5000);
let n = 0;
for (const s of steps) {
  try {
    if (s.click) await page.getByText(s.click, { exact: false }).first().click({ timeout: 4000, force: true });
    if (s.clickXY) await page.mouse.click(s.clickXY[0], s.clickXY[1]);
    if (s.key) await page.keyboard.press(s.key);
    if (s.js) { const r = await page.evaluate(s.js); if (r !== undefined) console.log('js ->', JSON.stringify(r)); }
    await page.waitForTimeout(s.wait ?? 900);
    if (s.shot) { const f = `test-output/${name}-${String(++n).padStart(2, '0')}-${s.shot}.png`; await page.screenshot({ path: f }); console.log('shot', f); }
  } catch (e) { console.log('step failed', JSON.stringify(s), e.message.split('\n')[0]); }
}
logs.slice(0, 20).forEach((l) => console.log(l));
await browser.close();
