// Screenshot the running dev server with the Edge already installed on Windows.
// Usage: node tools/shot.mjs [url] [out.png] [waitMs] [--js "code to run before the shot"]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const jsIdx = args.indexOf('--js');
const js = jsIdx >= 0 ? args.splice(jsIdx, 2)[1] : null;
const url = args[0] ?? 'http://localhost:5190/';
const out = args[1] ?? 'test-output/shot.png';
const wait = Number(args[2] ?? 4000);
mkdirSync('test-output', { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(wait);
if (js) { const r = await page.evaluate(js); if (r !== undefined) console.log('js ->', JSON.stringify(r)); await page.waitForTimeout(1500); }
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); }));
await page.screenshot({ path: out });
console.log(`saved ${out}  fps~${fps}`);
logs.slice(0, 30).forEach((l) => console.log(l));
await browser.close();
