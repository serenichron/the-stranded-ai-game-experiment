// A/B cost of each render layer, in one warm session. Usage: node tools/p2-perf.mjs <port> [x,y]
// Honours comms/BROWSER.lock. Shoots a frozen build, never 5190.
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
const port = Number(process.argv[2] ?? 5195);
const [x, y] = (process.argv[3] ?? '42,17').split(',').map(Number);
const LOCK = 'comms/BROWSER.lock', ME = 'agent D (tests/p3-perf-layers.mjs)';
for (;;) {
  if (!existsSync(LOCK)) break;
  if ((Date.now() - statSync(LOCK).mtimeMs) / 60000 > 10) { unlinkSync(LOCK); break; }
  console.log('browser busy:', readFileSync(LOCK, 'utf8').trim()); await new Promise((r) => setTimeout(r, 20000));
}
writeFileSync(LOCK, `${ME} ${new Date().toISOString()}\n`);
const free = () => { try { if (readFileSync(LOCK, 'utf8').startsWith(ME)) unlinkSync(LOCK); } catch {} };
process.on('exit', free);
const browser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(`http://localhost:${port}/?freeroam`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
  await page.evaluate(([x, y]) => { __world.place('player', { x, y }); __world.cam.setZoom(1); }, [x, y]);
  await page.bringToFront();
  await page.waitForTimeout(3000);
  const fps = () => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / 2)); }; requestAnimationFrame(f); }));
  const tests = [
    ['base', '0'],
    ['noPaint', '__world.r.setPaint(0)'],
    ['paint', '__world.r.setPaint(0.75)'],
    ['noSurface', '__world.atmos.uSurface.value = 0'],
    ['noMottle', '__world.atmos.uSurface.value = 1; __world.atmos.uMottle.value = 0'],
    ['noFog', '__world.atmos.uMottle.value = 1; __world.atmos.uFogDensity.value = 0; __world.atmos.uHeightFog.value = 0'],
    ['noBloom', '__world.r.composer.passes[1].enabled = false'],
    ['noShadow', '__world.r.composer.passes[1].enabled = true; __world.r.renderer.shadowMap.enabled = false; __world.r.sun.castShadow = false'],
    ['noPost', '__world.r.renderer.shadowMap.enabled = true; __world.r.sun.castShadow = true; __world.r.composer.passes.forEach((p, i) => { if (i > 0 && i < 3) p.enabled = false })'],
    ['pr1', '__world.r.composer.passes.forEach((p) => p.enabled = true); __world.r.renderer.setPixelRatio(1); __world.r.composer.setPixelRatio(1)'],
    ['base2', '0'],
  ];
  for (const [k, js] of tests) { await page.evaluate(js); await page.waitForTimeout(1200); console.log(k.padEnd(9), await fps()); }
  console.log('dpr', await page.evaluate(() => devicePixelRatio), 'calls', await page.evaluate(() => { const i = __world.r.renderer.info; return i.render.calls; }));
} finally { await browser.close(); free(); }
