// Real per-frame draw calls and triangles at a camera (agent D, phase 3): read straight after a frame.
// Usage: node tests/p3-calls.mjs <port> [x,y] [zoom]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
const port = Number(process.argv[2]);
if (!port || port === 5190) { console.log('give a test port, never 5190'); process.exit(1); }
const [cx, cy] = (process.argv[3] ?? '44,17').split(',').map(Number);
const zoom = Number(process.argv[4] ?? 1);
const LOCK = 'comms/BROWSER.lock', ME = 'agent D (tests/p3-calls.mjs)';
for (;;) { if (!existsSync(LOCK)) break; if ((Date.now() - statSync(LOCK).mtimeMs) / 60000 > 10) { unlinkSync(LOCK); break; } await new Promise((r) => setTimeout(r, 15000)); }
writeFileSync(LOCK, `${ME} ${new Date().toISOString()}\n`);
const free = () => { try { if (readFileSync(LOCK, 'utf8').startsWith(ME)) unlinkSync(LOCK); } catch {} };
process.on('exit', free);
const browser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(`http://localhost:${port}/?quick=minaa-tech`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!(window.__game && window.__game()), null, { timeout: 60000 });
  await page.bringToFront();
  await page.waitForTimeout(2500);
  await page.evaluate(([x, y, z]) => { const w = window.__world; w.follow(null); w.cam.resetPan?.(); w.cam.setZoom(z); w.cam.snapTo?.(w.tileToWorld({ x, y })); }, [cx, cy, zoom]);
  await page.waitForTimeout(1800);
  const r = await page.evaluate(() => new Promise((res) => {
    // sample the renderer's counters over several frames, reading each one at frame end
    const info = window.__world.r.renderer.info;
    info.autoReset = false;
    const s = []; let n = 0;
    const tick = () => {
      const i = info;
      s.push({ calls: i.render.calls, tris: i.render.triangles });
      i.reset();
      if (++n < 12) requestAnimationFrame(tick);
      else res({ samples: s, memory: { geometries: i.memory.geometries, textures: i.memory.textures }, programs: i.programs ? i.programs.length : -1 });
    };
    requestAnimationFrame(tick);
  }));
  const peak = r.samples.reduce((a, b) => (b.calls > a.calls ? b : a));
  console.log(JSON.stringify({ camera: [cx, cy, zoom], peakFrame: peak, programs: r.programs, memory: r.memory }, null, 1));
} finally { await browser.close(); free(); }
