// Measure fps at named spots in one warm session. Usage: node tools/perf.mjs
import { chromium } from 'playwright-core';
const spots = { camp: [12, 45], gap: [40, 37], reach: [20, 20], mouth: [42, 23], court: [40, 17], inner: [42, 9], scar: [30, 6] };
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5190/?freeroam', { waitUntil: 'load' });
await page.waitForTimeout(5000);
const fps = () => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(Math.round(n / 1.5)); }; requestAnimationFrame(f); }));
for (const [name, [x, y]] of Object.entries(spots)) {
  await page.evaluate(([x, y]) => __world.place('player', { x, y }), [x, y]);
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => ({ calls: __world.r.renderer.info.render.calls, tris: __world.r.renderer.info.render.triangles, progs: __world.r.renderer.info.programs.length }));
  console.log(name.padEnd(6), 'fps', String(await fps()).padStart(3), JSON.stringify(info));
}
await browser.close();
