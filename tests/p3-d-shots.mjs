// Agent D's fixed shot list (phase 3, from agent B's phase 2 list): people, creatures, creation and the ruin fight.
// Usage: node tests/p3-d-shots.mjs <port> <round> [shot,shot,...]
// Shoots a FROZEN build (tests/p3-build-D.sh, then vite preview; never 5190). Honours comms/BROWSER.lock.
// Saves test-output/p2-B-<round>-<shot>.png.
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync, mkdirSync } from 'node:fs';

const port = Number(process.argv[2] ?? 5197);
if (port === 5190) { console.log('never shoot the user dev server'); process.exit(1); }
const round = process.argv[3] ?? 'r1';
const only = process.argv[4] ? process.argv[4].split(',') : null;
const want = (n) => !only || only.includes(n);
const LOCK = 'comms/BROWSER.lock';
const ME = 'agent D (tests/p3-d-shots.mjs)';
const base = `http://localhost:${port}`;

async function takeLock() {
  for (;;) {
    if (!existsSync(LOCK)) break;
    const age = (Date.now() - statSync(LOCK).mtimeMs) / 60000;
    if (age > 10) { unlinkSync(LOCK); break; }
    console.log('browser busy:', readFileSync(LOCK, 'utf8').trim(), '- waiting 20 s');
    await new Promise((r) => setTimeout(r, 20000));
  }
  writeFileSync(LOCK, `${ME} ${new Date().toISOString()}\n`);
}
const freeLock = () => { try { if (readFileSync(LOCK, 'utf8').startsWith(ME)) unlinkSync(LOCK); } catch {} };
process.on('exit', freeLock);

mkdirSync('test-output', { recursive: true });
await takeLock();
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });
const wait = (ms) => page.waitForTimeout(ms);
const G = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name) => {
  const out = `test-output/p3-D-${round}-${name}.png`;
  await page.screenshot({ path: out });
  console.log('shot', out);
};

/** Click through any open dialogue or narration card, taking the first choice. */
async function clickThrough(ms = 1500, max = 30) {
  let idle = 0;
  for (let i = 0; i < max && idle < ms; ) {
    const v = await G(() => {
      const d = document.querySelector('.dlg.open');
      const scr = document.querySelector('.layer-screen .screen.narrate');
      if (scr) return 'screen';
      if (!d) return null;
      return d.querySelector('.dlg-choices.show') ? 'choices' : 'text';
    });
    if (!v) { await wait(250); idle += 250; continue; }
    idle = 0; i++;
    if (v === 'screen') await page.mouse.click(800, 450);
    else if (v === 'text') await page.click('.dlg-text').catch(() => {});
    else await page.locator('.dlg-choice button').first().click().catch(() => {});
    await wait(450);
  }
}

/** Put the camera on a tile at a zoom, the same way agent A's script does. */
async function cam(x, y, zoom, yaw = 0) {
  await G(([x, y, zoom, yaw]) => {
    const w = window.__world;
    w.follow(null);
    w.cam.resetPan?.();
    w.cam.yawStep = yaw;
    w.cam.setZoom(zoom);
    w.cam.snapTo?.(w.tileToWorld({ x, y }));
  }, [x, y, zoom, yaw]);
  await wait(1200);
}

try {
  // ---------------------------------------------------------------- creation with the line-up
  if (want('creation') || want('creation-iskari')) {
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
    await wait(2500);
    // the title: start a new game
    const btn = page.locator('button', { hasText: /new/i }).first();
    await btn.click().catch(() => page.mouse.click(800, 450));
    await wait(1800);
    await page.click('.cc-card.race-sehari').catch(() => {});
    await wait(400);
    await page.locator('.cc-body-btn').nth(1).click().catch(() => {});
    await wait(2200);
    if (want('creation')) await shot('creation');
    await page.click('.cc-card.race-iskari').catch(() => {});
    await wait(300);
    await page.locator('.cc-body-btn').nth(0).click().catch(() => {});
    await wait(2000);
    if (want('creation-iskari')) await shot('creation-iskari');
  }

  // ---------------------------------------------------------------- in the game
  await page.goto(`${base}/?quick=minaa-tech`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!(window.__game && window.__game()), null, { timeout: 60000 });
  await wait(1500);
  await clickThrough(2000);

  if (want('camp-npcs')) {
    await G(() => window.__world.place('player', { x: 13, y: 45 }));
    await cam(13, 42, 2.1);
    await wait(1500);
    await shot('camp-npcs');
  }
  if (want('bodies-game')) {
    // all six bodies in open sand at the game's default zoom: do they read apart?
    await G(() => {
      const w = window.__world;
      const b = [['minaa', 'male', 'tech'], ['minaa', 'female', 'healer'], ['sehari', 'male', 'channeller'], ['sehari', 'female', 'ranged'], ['iskari', 'male', 'frontline'], ['iskari', 'female', 'scout']];
      b.forEach(([r, s, l], i) => w.spawn(`player-${r}`, { x: 32 + i, y: 41 + i }, { id: `t-${i}`, body: s, look: l, facing: 4 }));
      w.place('player', { x: 30, y: 46 });
    });
    await cam(34, 43, 1.0);
    await shot('bodies-game');
    await cam(34, 43, 2.0);
    await shot('bodies-close');
    await G(() => { for (let i = 0; i < 6; i++) window.__world.despawn(`t-${i}`); });
  }
  if (want('tel')) {
    // the Tel'sharin in open sand beside a Mi'naa for scale, at the default zoom and close
    await G(() => {
      const w = window.__world;
      w.spawn('telsharin', { x: 34, y: 47 }, { id: 't-tel', facing: 3 });
      w.spawn('player-minaa', { x: 35, y: 48 }, { id: 't-m', body: 'male', look: 'tech', facing: 3 });
      w.place('player', { x: 22, y: 50 });
    });
    await cam(34, 47, 1.0);
    await shot('tel-game');
    await cam(34, 47, 1.7);
    await shot('tel-close');
    await G(() => { window.__world.despawn('t-tel'); window.__world.despawn('t-m'); });
  }
  if (want('wreck-telsharin')) {
    await G(() => window.__world.place('player', { x: 37, y: 37 }));
    await cam(42, 34, 2.0);
    await shot('wreck-telsharin');
  }
  if (want('ruin-drone') || want('defender-wake') || want('combat')) {
    await G(() => {
      const g = window.__game();
      g.world.place('player', { x: 44, y: 19 });
      g.s.playerTile = { x: 44, y: 19 };
      g.s.flags.sawGuardian = true;
      g.s.flags.ruinFound = true;
    });
    const drone = await G(() => window.__game().drone()?.id ?? null);
    if (want('ruin-drone') && drone) {
      await G((id) => { window.__world.place(id, { x: 38, y: 21 }); window.__world.playAnim(id, 'channel'); }, drone);
      await cam(40, 19, 2.0);
      await shot('ruin-drone');
    }
    if ((want('defender-wake') || want('combat')) && drone) {
      await cam(46, 16, 1.4);
      // the drone falls, as if the fight just ended, and the game runs its wake sequence
      await G((id) => {
        const g = window.__game();
        const d = g.drone();
        g.onEnemyDown(d);
        g.world.setState(id, 'dead');
        void g.afterFight();
      }, drone);
      await wait(2600);
      await clickThrough(600, 2); // "The drone lies on its side..."
      await wait(1400);
      if (want('defender-wake')) await shot('defender-pulse');
      await wait(2300);
      if (want('defender-wake')) await shot('defender-wake');
      await wait(1600);
      if (want('defender-wake')) await shot('defender-awake');
      await clickThrough(1500, 6);
      await wait(2500);
      await cam(47, 15, 1.7);
      if (want('combat')) await shot('combat');
    }
  }
  const info = await G(() => ({ calls: window.__world.r.renderer.info.render.calls, tris: window.__world.r.renderer.info.render.triangles }));
  console.log('last frame', JSON.stringify(info));
} finally {
  if (errs.length) console.log('page errors:\n  ' + errs.slice(0, 12).join('\n  '));
  await browser.close();
  freeLock();
}
