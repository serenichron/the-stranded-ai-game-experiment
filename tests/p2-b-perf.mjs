// Character cost: load time, fps and triangles in the camp and the ruin, on the frozen build.
// Usage: node tests/p2-b-perf.mjs [port]. Honours comms/BROWSER.lock.
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
const port = Number(process.argv[2] ?? 5196);
const LOCK = 'comms/BROWSER.lock', ME = 'agent B (tests/p2-b-perf.mjs)';
while (existsSync(LOCK) && (Date.now() - statSync(LOCK).mtimeMs) / 60000 < 10) { console.log('busy:', readFileSync(LOCK, 'utf8').trim()); await new Promise((r) => setTimeout(r, 15000)); }
writeFileSync(LOCK, `${ME} ${new Date().toISOString()}\n`);
const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const t0 = Date.now();
  await p.goto(`http://localhost:${port}/?quick=minaa-tech`, { waitUntil: 'load' });
  await p.waitForFunction(() => !!(window.__game && window.__game()), null, { timeout: 120000 });
  console.log('load to game ms', Date.now() - t0);
  const fps = () => p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(f); else res(Math.round(n / 2.5)); }; requestAnimationFrame(f); }));
  for (const [name, x, y] of [['camp', 13, 43], ['wreck', 39, 36], ['ruin', 44, 17]]) {
    await p.evaluate(([x, y]) => { const w = window.__world; w.place('player', { x, y }); w.cam.setZoom(1); }, [x, y]);
    await p.waitForTimeout(3000);
    const f = await fps();
    const info = await p.evaluate(() => ({ calls: __world.r.renderer.info.render.calls, tris: __world.r.renderer.info.render.triangles }));
    console.log(name.padEnd(6), 'fps', f, JSON.stringify(info));
  }
  const t = await p.evaluate(() => { const t0 = performance.now(); window.__world.spawn('npc-minaa', { x: 20, y: 44 }, { id: 'perf-x', seed: 999 }); return performance.now() - t0; });
  console.log('one new crowd body ms', Math.round(t));
} finally { await b.close(); try { if (readFileSync(LOCK, 'utf8').startsWith(ME)) unlinkSync(LOCK); } catch {} }
