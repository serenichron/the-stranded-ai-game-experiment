// Evaluate expressions in the frozen build and print the results as JSON (agent C, phase 3).
// Usage: node tools/p3-eval.mjs <port> "<js expr>" ["<js expr>" ...]
// Example: node tools/p3-eval.mjs 5196 "__world.findPath({x:20,y:18},{x:36,y:14})?.length"
// Honours comms/BROWSER.lock and refuses the user's port 5190.
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';

const port = Number(process.argv[2]);
if (!port || port === 5190) { console.error('need a test port, never 5190'); process.exit(1); }
const exprs = process.argv.slice(3);
const LOCK = 'comms/BROWSER.lock';
const ME = 'agent C (tools/p3-eval.mjs)';

for (;;) {
  if (!existsSync(LOCK)) break;
  const age = (Date.now() - statSync(LOCK).mtimeMs) / 60000;
  if (age > 10) { unlinkSync(LOCK); break; }
  console.log('browser busy:', readFileSync(LOCK, 'utf8').trim(), '- waiting 20 s');
  await new Promise((r) => setTimeout(r, 20000));
}
writeFileSync(LOCK, `${ME} ${new Date().toISOString()}\n`);
const freeLock = () => { try { if (readFileSync(LOCK, 'utf8').startsWith(ME)) unlinkSync(LOCK); } catch {} };
process.on('exit', freeLock);

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  await page.goto(`http://localhost:${port}/?freeroam`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
  for (const e of exprs) {
    try { console.log(e, '=>', JSON.stringify(await page.evaluate(e))); }
    catch (err) { console.log(e, '=> ERROR', err.message.split('\n')[0]); }
  }
} finally {
  await browser.close();
  freeLock();
}
