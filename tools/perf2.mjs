import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5190/?freeroam', { waitUntil: 'load' });
await page.waitForTimeout(5000);
await page.evaluate(() => __world.place('player', { x: 40, y: 17 }));
await page.waitForTimeout(2500);
const fps = () => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(Math.round(n / 1.5)); }; requestAnimationFrame(f); }));
const tests = {
  hazeOff: "__world.fxl.group.children.filter(o=>o.isPoints).forEach(o=>o.visible=false)",
  hazeOn: "__world.fxl.group.children.filter(o=>o.isPoints).forEach(o=>o.visible=true)",
  base: '0',
  noBloom: '__world.r.composer.passes[1].enabled=false',
  noShadow: '__world.r.composer.passes[1].enabled=true; __world.r.renderer.shadowMap.enabled=false; __world.r.sun.castShadow=false',
  noPost: '__world.r.renderer.shadowMap.enabled=true; __world.r.sun.castShadow=true; __world.r.composer.passes.forEach((p,i)=>{ if(i>0 && i<3) p.enabled=false })',
  pr1: '__world.r.composer.passes.forEach(p=>p.enabled=true); __world.r.renderer.setPixelRatio(1); __world.r.composer.setPixelRatio(1)',
};
for (const [k, js] of Object.entries(tests)) { await page.evaluate(js); await page.waitForTimeout(1500); console.log(k.padEnd(9), await fps()); }
console.log('dpr', await page.evaluate(() => devicePixelRatio));
await browser.close();
