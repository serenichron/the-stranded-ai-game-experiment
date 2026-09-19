import { chromium } from 'playwright-core';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
const LOCK = 'comms/BROWSER.lock';
while (existsSync(LOCK)) await new Promise((r) => setTimeout(r, 5000));
writeFileSync(LOCK, 'agent B debug ' + new Date().toISOString());
const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.text().startsWith('[lineup]')) console.log(m.text()); });
  await p.goto('http://localhost:5196/', { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
  await p.waitForTimeout(14000);
  await p.locator('button', { hasText: /new/i }).first().click();
  await p.waitForTimeout(2000);
  await p.click('.cc-card.race-sehari');
  await p.waitForTimeout(14000);
  const r = await p.evaluate(() => {
    const L = window.__lineup; const w = window.__world;
    const out = L?.where;
    return { out, screen: out?.tiles.map((t) => w.toScreen(t)), walk: out?.tiles.map((t) => w.isWalkable(t)), ents: out?.ids.map((id) => !!w.get(id)) };
  });
  console.log(JSON.stringify(r));
  await p.screenshot({ path: 'test-output/dbg-lineup.png' });
  await p.evaluate(() => { for (const id of window.__lineup.where.ids) window.__world.setVisible(id, false); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'test-output/dbg-lineup-hidden.png' });
  console.log('near', JSON.stringify(await p.evaluate(() => window.__world.all().filter((e) => Math.abs(e.tile.x - 12) < 8 && Math.abs(e.tile.y - 25) < 8).map((e) => e.id + ':' + e.kind))));
} finally { await b.close(); unlinkSync(LOCK); }
