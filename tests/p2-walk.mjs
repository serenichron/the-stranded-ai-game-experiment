// Phase 2 final test: one character WALKS the whole level (no teleports), with a shot at every beat.
// Usage: node tests/p2-walk.mjs [race-role] [port]   e.g. node tests/p2-walk.mjs minaa-frontline 5196
// Shoots a frozen build. Honours comms/BROWSER.lock. Shots: test-output/p2-walk-<quick>-NN-<beat>.png
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';

const quick = process.argv[2] ?? 'minaa-frontline';
const port = process.argv[3] ?? '5196';
const LOCK = 'comms/BROWSER.lock', ME = 'agent B (tests/p2-walk.mjs)';
while (existsSync(LOCK) && (Date.now() - statSync(LOCK).mtimeMs) / 60000 < 10) { console.log('busy:', readFileSync(LOCK, 'utf8').trim()); await new Promise((r) => setTimeout(r, 15000)); }
writeFileSync(LOCK, `${ME} ${new Date().toISOString()}\n`);
const free = () => { try { if (readFileSync(LOCK, 'utf8').startsWith(ME)) unlinkSync(LOCK); } catch {} };
process.on('exit', free);

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const wait = (ms) => page.waitForTimeout(ms);
const G = (fn, arg) => page.evaluate(fn, arg);
let n = 0;
const shot = async (name) => { const f = `test-output/p2-walk-${quick}-${String(++n).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: f }); console.log('  shot', f); };
const state = () => G(() => { const g = window.__game(); return { combat: !!g.combat, busy: g.busy, tile: g.world.get('player')?.tile, wounds: g.s.wounds, obj: g.s.objective }; });

/** Answer any open dialogue or narration. prefs: substrings of choices to prefer. */
async function play(prefs = [], { idleMs = 1500, max = 80 } = {}) {
  let idle = 0;
  for (let i = 0; i < max && idle < idleMs; ) {
    const v = await G(() => {
      const d = document.querySelector('.dlg.open');
      if (document.querySelector('.layer-screen .screen')) return { screen: true };
      if (!d) return null;
      const choices = [...d.querySelectorAll('.dlg-choice')].map((li) => ({ text: li.querySelector('.ctext')?.textContent?.trim() ?? '', disabled: li.classList.contains('disabled') }));
      return { typing: !!d.querySelector('.dlg-text.typing'), shown: !!d.querySelector('.dlg-choices.show'), text: d.querySelector('.dlg-text')?.textContent ?? '', choices };
    });
    if (!v) { await wait(250); idle += 250; continue; }
    idle = 0; i++;
    if (v.screen) { await page.mouse.click(800, 450); await wait(600); continue; }
    if (v.typing || !v.shown) { await page.click('.dlg-text').catch(() => {}); await wait(250); continue; }
    console.log('   >', v.text.slice(0, 120));
    let idx = -1;
    for (const p of prefs) { idx = v.choices.findIndex((c) => !c.disabled && c.text.includes(p)); if (idx >= 0) break; }
    if (idx < 0) idx = v.choices.findIndex((c) => !c.disabled);
    if (v.choices.length > 1) console.log('     pick:', v.choices[Math.max(0, idx)]?.text);
    await wait(500);
    await page.locator('.dlg-choice button').nth(Math.max(0, idx)).click().catch(() => {});
    await wait(500);
  }
}

/** Fight until it ends: walk to the nearest foe and strike. */
async function fight(maxRounds = 40) {
  for (let r = 0; r < maxRounds; r++) {
    await play([], { idleMs: 300, max: 5 });
    const s = await state();
    if (!s.combat) return true;
    await G(() => {
      const g = window.__game(); const c = g.combat;
      if (!c || c.turn !== 'player') return;
      const me = g.world.get('player').tile;
      const foes = c.foes.filter((f) => !f.dead && g.world.get(f.id));
      if (!foes.length) return;
      foes.sort((a, b) => g.world.distance(g.world.get(a.id).tile, me) - g.world.distance(g.world.get(b.id).tile, me));
      const ft = g.world.get(foes[0].id).tile;
      if (g.world.distance(me, ft) > c.attackRange()) {
        const path = g.world.findPath(me, ft, { adjacentOk: true, maxLength: 60 });
        if (path && path.length) c.onTileClick(path[Math.min(c.moveLeft, path.length) - 1]);
      }
    });
    await wait(2500);
    for (let a = 0; a < 2; a++) {
      await G(() => {
        const g = window.__game(); const c = g.combat;
        if (!c || c.turn !== 'player' || !c.actionLeft) return;
        const me = g.world.get('player').tile;
        const f = c.foes.find((f) => !f.dead && g.world.get(f.id) && g.world.distance(g.world.get(f.id).tile, me) <= c.attackRange());
        if (!f) return;
        c.selected = 'attack';
        c.onEntityClick(f.id);
      });
      await wait(3500);
      await play([], { idleMs: 300, max: 5 });
    }
    await G(() => { const c = window.__game().combat; if (c && c.turn === 'player') c.endTurn?.(); });
    await wait(7000);
  }
  return !(await state()).combat;
}

/** Walk (real pathing) to a tile, answering dialogues and fighting on the way. */
async function go(x, y, prefs = [], ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await state();
    if (s.combat) { console.log('   fight on the way'); await shot('fight'); await fight(); continue; }
    if (s.busy) { await play(prefs); continue; }
    if (s.tile.x === x && s.tile.y === y) return true;
    await G(([x, y]) => void window.__game().walkTo({ x, y }), [x, y]);
    await wait(1200);
    await play(prefs, { idleMs: 400, max: 20 });
    const s2 = await state();
    if (!s2.combat && !s2.busy && s2.tile.x === s.tile.x && s2.tile.y === s.tile.y) {
      // stuck: try the nearest walkable neighbour of the goal
      const ok = await G(([x, y]) => !!window.__world.findPath(window.__world.get('player').tile, { x, y }), [x, y]);
      if (!ok) { console.log('   NO PATH to', x, y); return false; }
    }
  }
  console.log('   timeout walking to', x, y);
  return false;
}

async function talkTo(id, prefs) {
  const t = await G((id) => window.__world.get(id)?.tile, id);
  if (!t) { console.log('   missing', id); return; }
  await G((id) => { const g = window.__game(); const t = g.world.get(id).tile; return g.walkTo(t, true); }, id);
  await wait(4000);
  await G((id) => void window.__game().interact(id), id);
  await wait(800);
  await play(prefs);
}

try {
  await page.goto(`http://localhost:${port}/?quick=${quick}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => typeof window.__game === 'function' && !!window.__game(), null, { timeout: 120000 });
  await wait(2000);
  await play();
  await shot('camp');

  console.log('# the apprentice');
  await talkTo('apprentice', ['What is the job', 'job', 'plate back', 'bring', 'go.', 'leave']);
  await shot('apprentice');
  console.log('# Mother Tarn');
  await talkTo('npc-cook', ['love some', 'Yes', 'eat']);
  console.log('# Pell');
  await talkTo('scav1', ['Watch', 'business', 'Later', 'leave', 'go']);
  await shot('pell');

  console.log('# the crack in the west ridge');
  await go(8, 33, ['Climb through', 'Squeeze']);
  await go(8, 28, ['Climb through', 'Squeeze']);
  await play(['Climb through', 'Squeeze']);
  await shot('after-crack');

  console.log('# the north sand');
  await go(15, 21, ['Dig', 'Why would a tree']);
  await shot('spire-root');
  await talkTo('npc-hunter', ['ruin', 'hunting', 'leave', 'Walk']);
  await shot('hunter');

  console.log('# the ruin');
  await go(42, 25);
  await play();
  await shot('ruin-mouth');
  await go(40, 20);
  await shot('court');
  const drone = await G(() => window.__game().drone()?.id);
  console.log('# the drone', drone);
  if (drone) {
    const dt = await G((id) => window.__world.get(id).tile, drone);
    await G((id) => { void window.__game().startCombat([id], false); }, drone);
    await wait(2500);
    await shot('drone-fight');
    await fight();
    console.log('   after drone', await state());
  }
  // the code runs through the seams and the defender wakes, then fights
  await wait(3000);
  await play();
  await shot('defender-wake');
  await wait(3000);
  await play();
  if ((await state()).combat) { await shot('defender-fight'); await fight(60); }
  await play();
  await shot('after-defender');
  console.log('   after defender', await state(), await G(() => ({ defDead: window.__game().defender()?.dead })));

  console.log('# the ring panel and sockets');
  await talkTo('sign-rings', ['Work out', 'Step back']);
  await talkTo('lever-a', []);
  await talkTo('lever-c', []);
  await wait(2500);
  await play();
  await shot('sockets');

  console.log('# the symbol door');
  await talkTo('symbol-door', ['Let the meaning', 'palm', 'Fuse', 'Hold the pale', 'Study', 'Match the apprentice', 'Trace it']);
  await play(['Study', 'Match the apprentice', 'Trace it']);
  await talkTo('symbol-door', ['Let the meaning', 'palm', 'Fuse', 'Hold the pale', 'Match the apprentice', 'Trace it', 'Study']);
  await play(['Trace it']);
  await shot('door');
  console.log('   door', await G(() => window.__game().s.flags.doorOpen));

  console.log('# the archive');
  await go(42, 9);
  await talkTo('archive', ['Take the plate']);
  await shot('archive');

  console.log('# home, walking');
  await go(42, 25);
  await go(8, 28, ['Climb through', 'Squeeze']);
  await go(8, 34, ['Climb through', 'Squeeze']);
  await go(12, 44);
  await play();
  await shot('camp-return');
  await talkTo('tent-apprentice', ['Read what is left']);
  await wait(6000);
  await shot('ending');
  await play([], { idleMs: 1000, max: 3 });
} finally {
  const bad = errors.filter((e) => !/favicon|status of 404/.test(e));
  console.log(bad.length ? 'ERRORS:\n' + bad.slice(0, 15).join('\n') : 'no console errors');
  await browser.close();
  free();
}
