// Screenshot the character bench. Honours comms/BROWSER.lock (one browser at a time).
// Usage: node tests/bench-shot.mjs out.png "set=players&anim=idle" [out2.png "query2" ...]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';

const LOCK = 'comms/BROWSER.lock';
const args = process.argv.slice(2);
const jobs = [];
for (let i = 0; i + 1 < args.length; i += 2) jobs.push([args[i], args[i + 1]]);

for (let tries = 0; existsSync(LOCK); tries++) {
  const age = (Date.now() - statSync(LOCK).mtimeMs) / 60000;
  if (age > 10) { unlinkSync(LOCK); break; }
  if (tries === 0) console.log('waiting for browser lock:', readFileSync(LOCK, 'utf8').trim());
  await new Promise((r) => setTimeout(r, 5000));
}
writeFileSync(LOCK, `agent B bench ${new Date().toISOString()}\n`);
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  for (const [out, query] of jobs) {
    await page.goto(`http://localhost:5190/src/world/models/dev/chars.html?still&${query}`, { waitUntil: 'load' });
    try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 }); } catch (e) { console.log('FAILED', out, errs.join(' | ')); continue; }
    await page.waitForTimeout(300);
    await page.screenshot({ path: out });
    console.log('saved', out);
  }
  if (errs.length) console.log(errs.slice(0, 10).join('\n'));
} finally {
  await browser.close();
  if (existsSync(LOCK)) unlinkSync(LOCK);
}
