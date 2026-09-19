// Screenshots of every UI scene. Run from the project folder:
//   node src/ui/dev/shots.mjs [baseUrl] [width] [height] [only]
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5191';
const W = Number(process.argv[3] ?? 1600);
const H = Number(process.argv[4] ?? 900);
const only = process.argv[5];
const out = (n) => `test-output/ui-${n}-${W}.png`;

const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: W, height: H } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

async function scene(name, fn, delay = 900) {
  if (only && !name.startsWith(only)) return;
  await p.goto(`${base}/src/ui/dev.html#${name}`);
  await p.reload();
  await p.waitForTimeout(delay);
  if (fn) await fn();
  await p.screenshot({ path: out(name) });
  const bad = await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.pn.open, .dlg.open, .cbar.open, .cc-frame, .roll-panel.open, .hud-plate, .hud-strip, .cside.open, .cc-body, .pn-body')) {
      const r = el.getBoundingClientRect();
      if (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push(el.className + ' offscreen');
      if (el.scrollWidth > el.clientWidth + 1) out.push(el.className + ' h-overflow');
    }
    const plate = document.querySelector('.hud-plate')?.getBoundingClientRect();
    const bar = document.querySelector('.cbar.open')?.getBoundingClientRect();
    if (plate && bar && plate.width && bar.left < plate.right && bar.top < plate.bottom) out.push('cbar overlaps plate');
    return out;
  });
  console.log('shot', name, bad.length ? 'PROBLEMS: ' + bad.join(', ') : 'ok');
}

await scene('title', null, 1600);
await scene('creation', async () => {
  await p.click('.cc-card.race-sehari');
  await p.waitForTimeout(300);
  await p.screenshot({ path: out('creation-1') });
  await p.click('.cc-foot .btn.primary');
  await p.click('.cc-card >> nth=2');
  await p.waitForTimeout(500);
  await p.screenshot({ path: out('creation-2') });
  await p.click('.cc-foot .btn.primary');
  await p.click('.cc-actions .btn >> nth=0');
  await p.waitForTimeout(500);
  await p.screenshot({ path: out('creation-3') });
  await p.click('.cc-foot .btn.primary');
  await p.waitForTimeout(500);
  await p.screenshot({ path: out('creation-4') });
  await p.click('.cc-foot .btn.primary');
  await p.waitForTimeout(500);
});
await scene('narrate', async () => {
  await p.mouse.click(400, 400);
  await p.waitForTimeout(400);
  await p.mouse.click(400, 400);
  await p.waitForTimeout(1500);
});
await scene('hud', async () => {
  await p.mouse.move(700, 300);
  await p.waitForTimeout(100);
  await p.hover('.wslot.moderate');
  await p.waitForTimeout(400);
});
await scene('roll', async () => {
  await p.screenshot({ path: out('roll-mid') });
  await p.waitForTimeout(1100);
}, 450);
await scene('rollpartial', null, 1500);
await scene('rollmiss', null, 1500);
await scene('dialogue', async () => {
  await p.waitForTimeout(1200);
  await p.hover('.dlg-choice >> nth=2');
  await p.waitForTimeout(400);
});
await scene('record', null, 1400);
await scene('rolllock', null, 1400);
await scene('combat', async () => {
  await p.hover('.cbar .abtn >> nth=2');
  await p.waitForTimeout(400);
});
await scene('banner', null, 450);
await scene('journal', null, 700);
await scene('inventory', null, 700);
await scene('character', null, 700);
await scene('help', null, 700);
await scene('menu', async () => {
  await p.click('.menu-btn >> nth=1');
  await p.waitForTimeout(200);
});
await scene('ending', null, 3800);

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await b.close();
