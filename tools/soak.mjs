// Soak test: walk the player around for a while and watch memory and GPU objects for leaks.
import { chromium } from 'playwright-core';
const secs = Number(process.argv[2] ?? 90);
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
page.on('crash', () => errs.push('CRASH'));
await page.goto('http://localhost:' + (process.env.PORT ?? '5190') + '/?freeroam', { waitUntil: 'load' });
await page.waitForTimeout(5000);
const spots = [[40, 37], [20, 20], [42, 22], [30, 7], [12, 45], [42, 9], [8, 30]];
const t0 = Date.now(); let i = 0;
while ((Date.now() - t0) / 1000 < secs && !errs.includes('CRASH')) {
  const [x, y] = spots[i++ % spots.length];
  const r = await page.evaluate(([x, y]) => {
    const w = __world; const p = w.get('player');
    const path = w.findPath(p.tile, { x, y }, { ignoreEntities: false });
    if (path) w.moveAlong('player', path, 6).catch(() => {});
    w.fx('hit', 'player'); w.fx('dust', 'player'); w.floatText('player', 'test', 'bad');
    const h = w.highlight(w.reachable(p.tile, 4), 'move'); setTimeout(() => w.clearHighlight(h), 800);
    const m = w.r.renderer.info.memory;
    return { heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e6), geo: m.geometries, tex: m.textures, progs: w.r.renderer.info.programs.length, pr: w.r.renderer.getPixelRatio().toFixed(2) };
  }, [x, y]);
  console.log(Math.round((Date.now() - t0) / 1000) + 's', JSON.stringify(r));
  await page.waitForTimeout(6000);
}
console.log('errors', JSON.stringify(errs));
await browser.close();
