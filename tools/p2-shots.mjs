// Phase 2 fixed shot list for the world half. One browser, one session, every shot.
// Usage: node tools/p2-shots.mjs <port> <round> [shot,shot,...]
//   Shoots a FROZEN build (vite preview), never the user's dev server on 5190.
//   Saves test-output/p2-A-<round>-<shot>.png and prints fps per shot.
// Honours comms/BROWSER.lock (see comms/PHASE-2.md): waits for a fresh lock, takes it, frees it.
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync, mkdirSync } from 'node:fs';

const port = Number(process.argv[2] ?? 5195);
const round = process.argv[3] ?? 'r0';
// build to a spare folder first (a failed build must not empty the one the preview serves):
//   npx vite build --outDir test-output/build-A-next && swap it into test-output/build-A
const only = process.argv[4] ? process.argv[4].split(',') : null;
const LOCK = 'comms/BROWSER.lock';
const ME = 'agent A (tools/p2-shots.mjs)';

// Same camera every round: where the player stands, zoom, camera turn (0..3).
export const SHOTS = {
  'camp-wide':   { at: [14, 44], zoom: 0.8, yaw: 0 },
  'camp-close':  { at: [12, 43], zoom: 2.1, yaw: 0 },
  'wreck':       { at: [39, 36], zoom: 1.1, yaw: 0 },
  'maker-whole': { at: [44, 35], zoom: 0.75, yaw: 3 },
  'miner-hull':  { at: [24, 26], zoom: 1.1, yaw: 0 },
  'aza-vessel':  { at: [53, 28], zoom: 1.2, yaw: 0 },
  'north-sand':  { at: [16, 21], zoom: 1.0, yaw: 0 },
  'ruin-court':  { at: [42, 19], zoom: 0.9, yaw: 0 },
  'scar':        { at: [24, 6], zoom: 1.6, yaw: 0 },
  // the see-through circle: behind a shack it should open, in the open it should not
  // low views: zoomed right in, the camera drops and the horizon shows
  'camp-low':    { at: [13, 44], zoom: 2.4, yaw: 1 },
  'ruin-low':    { at: [42, 24], zoom: 2.3, yaw: 2 },
  'ruin-nopaint': { at: [42, 19], zoom: 1.4, yaw: 0, setup: '__world.r.setPaint(0)' },
  'ruin-paint':  { at: [42, 19], zoom: 1.4, yaw: 0, setup: '__world.r.setPaint(0.75)' },
  'camp-nopaint': { at: [12, 43], zoom: 2.1, yaw: 0, setup: '__world.r.setPaint(0)' },
  'camp-plain': { at: [12, 43], zoom: 2.1, yaw: 0, setup: '__world.r.setPaint(0); __world.atmos.uBrush.value = 0; __world.atmos.uSurface.value = 0' },
  'ruin-plain': { at: [42, 19], zoom: 1.4, yaw: 0, setup: '__world.r.setPaint(0); __world.atmos.uBrush.value = 0; __world.atmos.uSurface.value = 0' },
  'ruin-now':   { at: [42, 19], zoom: 1.4, yaw: 0, setup: '__world.r.setPaint(0.75); __world.atmos.uBrush.value = 1; __world.atmos.uSurface.value = 1' },
  'camp-nopaint-wide': { at: [14, 44], zoom: 0.8, yaw: 0, setup: '__world.r.setPaint(0)' },
  'occ-hidden':  { at: [19, 37], zoom: 1.4, yaw: 0 },
  'niche':       { at: [48, 15], zoom: 1.5, yaw: 0, setup: "if (!__world.get('niche1')) __world.spawn('prop-niche', { x: 51, y: 14 }, { id: 'niche1', facing: 6 })" },
  // the activation code mid-run: the pulse leaves the court's west side for the niche
  'pulse':       { at: [44, 16], zoom: 1.1, yaw: 0, setup: "if (!__world.get('niche1')) __world.spawn('prop-niche', { x: 51, y: 14 }, { id: 'niche1', facing: 6 }); void __world.seamPulse({ x: 36, y: 16 }, 'niche1', { duration: 2.4 }).then(() => __world.setState('niche1', 'lit'))", wait: 1300 },
};

async function takeLock() {
  for (;;) {
    if (!existsSync(LOCK)) break;
    const age = (Date.now() - statSync(LOCK).mtimeMs) / 60000;
    if (age > 10) { console.log('stale lock removed:', readFileSync(LOCK, 'utf8').trim()); unlinkSync(LOCK); break; }
    console.log('browser busy:', readFileSync(LOCK, 'utf8').trim(), '- waiting 20 s');
    await new Promise((r) => setTimeout(r, 20000));
  }
  writeFileSync(LOCK, `${ME} ${new Date().toISOString()}\n`);
}
const freeLock = () => { try { if (readFileSync(LOCK, 'utf8').startsWith(ME)) unlinkSync(LOCK); } catch {} };
process.on('exit', freeLock);
process.on('SIGINT', () => { freeLock(); process.exit(130); });

mkdirSync('test-output', { recursive: true });
await takeLock();
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://localhost:${port}/?freeroam`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  const fps = () => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(Math.round(n / 1.5)); }; requestAnimationFrame(f); }));
  for (const [name, s] of Object.entries(SHOTS)) {
    if (only && !only.includes(name)) continue;
    await page.evaluate((s) => {
      const w = window.__world;
      w.place('player', { x: s.at[0], y: s.at[1] }, 0);
      w.cam.resetPan?.();
      w.cam.yawStep = s.yaw;
      w.cam.setZoom(s.zoom);
      w.cam.snapTo?.(w.tileToWorld({ x: s.at[0], y: s.at[1] }));
    }, s);
    if (s.setup) await page.evaluate(s.setup);
    await page.waitForTimeout(s.wait ?? 2500);
    const f = s.wait ? 0 : await fps();
    const info = await page.evaluate(() => ({ calls: __world.r.renderer.info.render.calls, tris: __world.r.renderer.info.render.triangles }));
    const out = `test-output/p2-A-${round}-${name}.png`;
    await page.screenshot({ path: out });
    console.log(`${name.padEnd(12)} fps ${String(f).padStart(3)}  calls ${info.calls}  tris ${info.tris}  -> ${out}`);
  }
  if (errs.length) console.log('page errors:\n  ' + errs.slice(0, 10).join('\n  '));
} finally {
  await browser.close();
  freeLock();
}
