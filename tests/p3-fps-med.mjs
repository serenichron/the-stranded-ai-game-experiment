// Frame rate at 1600x900 on High, at three cameras (agent D, phase 3).
// Usage: node tests/p3-fps.mjs <port>   Frozen build only, never 5190. Honours comms/BROWSER.lock.
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
const port = Number(process.argv[2]);
if (!port || port === 5190) { console.log('give a test port, never 5190'); process.exit(1); }
const LOCK = 'comms/BROWSER.lock', ME = 'agent D (tests/p3-fps.mjs)';
for (;;) {
  if (!existsSync(LOCK)) break;
  if ((Date.now() - statSync(LOCK).mtimeMs) / 60000 > 10) { unlinkSync(LOCK); break; }
  console.log('browser busy:', readFileSync(LOCK, 'utf8').trim()); await new Promise((r) => setTimeout(r, 20000));
}
writeFileSync(LOCK, `${ME} ${new Date().toISOString()}\n`);
const free = () => { try { if (readFileSync(LOCK, 'utf8').startsWith(ME)) unlinkSync(LOCK); } catch {} };
process.on('exit', free);

// headed, so the GPU really composites frames (headless can idle the swap chain)
const browser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(`http://localhost:${port}/?quick=minaa-tech&quality=medium`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!(window.__game && window.__game()), null, { timeout: 60000 });
  await page.bringToFront();
  await page.waitForTimeout(3000);
  const spots = [['camp', 13, 42, 1.0], ['wreck', 40, 34, 1.0], ['ruin', 44, 17, 1.0], ['camp-close', 13, 42, 2.0]];
  const out = [];
  for (const [name, x, y, zoom] of spots) {
    await page.evaluate(([x, y, zoom]) => {
      const w = window.__world;
      w.follow(null); w.cam.resetPan?.(); w.cam.setZoom(zoom); w.cam.snapTo?.(w.tileToWorld({ x, y }));
    }, [x, y, zoom]);
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => new Promise((res) => {
      const t = []; let last = performance.now(); const t0 = last;
      function tick(now) { t.push(now - last); last = now; if (now - t0 < 4000) requestAnimationFrame(tick); else res(t); }
      requestAnimationFrame(tick);
    }));
    const d = r.slice(5).sort((a, b) => a - b);
    const avg = d.reduce((s, v) => s + v, 0) / d.length;
    const p95 = d[Math.floor(d.length * 0.95)];
    out.push({ spot: name, fps: +(1000 / avg).toFixed(1), worstFps: +(1000 / p95).toFixed(1), frames: d.length });
  }
  const info = await page.evaluate(() => ({ calls: window.__world.r.renderer.info.render.calls, tris: window.__world.r.renderer.info.render.triangles }));
  console.log(JSON.stringify({ port, spots: out, lastFrame: info }, null, 1));
} finally { await browser.close(); free(); }
