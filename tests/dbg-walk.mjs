import { chromium } from 'playwright-core';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
const LOCK = 'comms/BROWSER.lock';
while (existsSync(LOCK)) await new Promise((r) => setTimeout(r, 5000));
writeFileSync(LOCK, 'agent B debug ' + new Date().toISOString());
const b = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const p = await b.newPage();
  await p.goto('http://localhost:5190/?freeroam', { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
  await p.waitForTimeout(2000);
  const rows = await p.evaluate(() => {
    const w = window.__world; const out = [];
    for (let y = 20; y <= 55; y++) { let s = String(y).padStart(2) + ' '; for (let x = 0; x <= 63; x++) s += w.isWalkable({ x, y }, true) ? '.' : '#'; out.push(s); }
    return out;
  });
  console.log('   ' + Array.from({ length: 64 }, (_, i) => String(i % 10)).join(''));
  console.log(rows.join('\n'));
} finally { await b.close(); unlinkSync(LOCK); }
