// Automated playthrough in the installed Edge. Agent 2 owns this file.
// Usage: node tests/playthrough.mjs [race-role] [port] [route]
//   e.g. node tests/playthrough.mjs iskari-tech 5190 main
// Routes: main (critical path, teleporting between beats), starve, fight, crack.
// Screenshots go to test-output/play-<quick>-<route>-*.png. Page errors fail the run.

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const quick = process.argv[2] ?? 'iskari-tech';
const port = process.argv[3] ?? '5190';
const route = process.argv[4] ?? 'main';
const out = 'test-output';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

let n = 0;
const shot = async (name) => {
  const f = `${out}/play-${quick}-${route}-${String(++n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: f });
  console.log('shot', f);
};
const wait = (ms) => page.waitForTimeout(ms);
const G = (fn, arg) => page.evaluate(fn, arg);
const state = () => G(() => {
  const g = window.__game();
  return { obj: g.s.objective, wounds: g.s.wounds, items: g.s.items, combat: !!g.combat, busy: g.busy, tile: g.s.playerTile };
});

/** Drive any open dialogue. prefs: substrings of choices to prefer, in order. Returns when no dialogue for idleMs. */
async function play(prefs = [], { idleMs = 1800, max = 60, log = true } = {}) {
  let idle = 0;
  for (let i = 0; i < max && idle < idleMs; ) {
    const view = await G(() => {
      const d = document.querySelector('.dlg.open');
      const scr = document.querySelector('.layer-screen .screen');
      if (scr) return { screen: scr.className };
      if (!d) return null;
      const typing = d.querySelector('.dlg-text.typing');
      const text = d.querySelector('.dlg-text')?.textContent ?? '';
      const choices = [...d.querySelectorAll('.dlg-choice')].map((li) => ({
        text: li.querySelector('.ctext')?.textContent?.trim() ?? '',
        disabled: li.classList.contains('disabled'),
      }));
      return { typing: !!typing, text, choices, shown: !!d.querySelector('.dlg-choices.show') };
    });
    if (!view) {
      await wait(300);
      idle += 300;
      continue;
    }
    idle = 0;
    i++;
    if (view.screen) {
      await page.mouse.click(800, 450);
      await wait(700);
      continue;
    }
    if (view.typing || !view.shown) {
      await page.click('.dlg-text').catch(() => {});
      await wait(250);
      continue;
    }
    if (log) console.log('  >', view.text.slice(0, 110));
    let idx = -1;
    for (const p of prefs) {
      idx = view.choices.findIndex((c) => !c.disabled && c.text.includes(p));
      if (idx >= 0) break;
    }
    if (idx < 0) idx = view.choices.findIndex((c) => !c.disabled);
    if (idx < 0) idx = 0;
    if (log && view.choices.length > 1) console.log('    pick:', view.choices[idx]?.text);
    await wait(700); // let the choices finish their entrance
    await page.locator('.dlg-choice button').nth(idx).click().catch(() => {});
    await wait(600);
  }
}

async function teleport(x, y) {
  await G(([x, y]) => {
    const g = window.__game();
    g.world.place('player', { x, y });
    g.s.playerTile = { x, y };
  }, [x, y]);
  await wait(500);
}

/** Walk (real pathing) to a tile and wait until arrival or timeout. */
async function walk(x, y, ms = 15000) {
  G(([x, y]) => void window.__game().walkTo({ x, y }), [x, y]);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await wait(400);
    const s = await state();
    if (s.combat || s.busy) return s;
    const me = await G(() => window.__world.get('player').tile);
    if (me.x === x && me.y === y) return s;
  }
  return state();
}

async function interact(id, prefs = []) {
  G((id) => void window.__game().interact(id), id);
  await wait(900);
  await play(prefs);
}

async function zone(id) {
  G((id) => void window.__bus.emit('zone:enter', { zoneId: id, id: 'player' }), id);
  await wait(900);
}

/** Fight until combat ends: attack or use the first damage ability on the nearest enemy, then end turn. */
async function fight(maxRounds = 25) {
  for (let r = 0; r < maxRounds; r++) {
    const s = await state();
    if (!s.combat) return true;
    await G(async () => {
      const g = window.__game();
      const c = g.combat;
      if (!c || c.turn !== 'player') return;
      const me = g.world.get('player').tile;
      const foes = c.foes.filter((f) => !f.dead && g.world.get(f.id));
      if (!foes.length) return;
      foes.sort((a, b) => g.world.distance(g.world.get(a.id).tile, me) - g.world.distance(g.world.get(b.id).tile, me));
      const f = foes[0];
      const ft = g.world.get(f.id).tile;
      const range = c.attackRange();
      if (g.world.distance(me, ft) > range) {
        const path = g.world.findPath(me, ft, { adjacentOk: true, maxLength: 40 });
        if (path && path.length) c.onTileClick(path[Math.min(c.moveLeft, path.length) - 1]);
      }
    });
    await wait(2500);
    await G(() => {
      const g = window.__game();
      const c = g.combat;
      if (!c || c.turn !== 'player' || !c.actionLeft) return;
      const me = g.world.get('player').tile;
      const f = c.foes.find((f) => !f.dead && g.world.get(f.id) && g.world.distance(g.world.get(f.id).tile, me) <= c.attackRange());
      if (f) c.onEntityClick(f.id);
    });
    await wait(4000);
    await G(() => {
      const c = window.__game().combat;
      if (c && c.turn === 'player') c.endTurn?.();
    });
    await wait(9000);
  }
  return !(await state()).combat;
}

// ------------------------------------------------------------------ run

await page.goto(`http://localhost:${port}/?quick=${quick}`);
await page.waitForFunction(() => typeof window.__game === 'function' && !!window.__game(), null, { timeout: 90000 });
await wait(2000);
await play(); // opening narration
await shot('camp');

console.log('# apprentice');
await teleport(11, 43);
await interact('apprentice', ['What is the job?', 'I will bring the plate back', 'I should go.']);
console.log(await state());
await shot('after-apprentice');

console.log('# Pell');
await teleport(22, 44);
await interact('scav1', ['Watch Pell', 'No. Your business is yours.', 'Later.']);

if (route === 'starve' || route === 'fight') {
  console.log('# the wreck');
  await teleport(36, 40);
  await walk(38, 36);
  await play(['Crouch low', 'Ready yourself']);
  if ((await state()).combat) await fight();
  await play();
  await shot('wreck');
  if (route === 'starve') {
    await G(() => window.__game().setSneak(true));
    const approach = { metal2: [42, 37], metal1: [38, 35], metal4: [38, 29], metal3: [44, 30] };
    for (const id of ['metal2', 'metal1', 'metal4', 'metal3']) {
      for (let tries = 0; tries < 3; tries++) {
        const gone = await G((id) => window.__game().s.entityState[id] === 'gone', id);
        if (gone) break;
        await walk(...approach[id]);
        await play(['Haul it']);
        if ((await state()).combat) break;
        await interact(id, ['Haul it']);
        console.log('   ', id, 'tries', tries, await G((id) => window.__game().s.entityState[id] ?? 'there', id));
      }
      await wait(1500);
      if ((await state()).combat) {
        await shot('starve-caught');
        await fight();
      }
      await play(['It is yours. As agreed.', 'Take it and go.']);
    }
    await shot('after-starve');
  } else {
    G(() => void window.__game().startCombat(['tel1'], false));
    await wait(3000);
    await shot('fight-start');
    await fight(30);
    await shot('after-fight');
  }
  console.log(await state());
}

if (route === 'crack') {
  await teleport(8, 34);
  await walk(8, 31);
  await play(['Climb through.']);
  await shot('after-crack');
  console.log(await state());
}

console.log('# the north');
await teleport(15, 22);
await zone('z-spire-root');
await play(['Dig where', 'Why would a tree']);
await teleport(12, 21);
await interact('npc-hunter', ['Have you been inside', 'I will leave you']);
await shot('north');

console.log('# the ruin');
await teleport(42, 26);
await zone('z-ruin-mouth');
await play();
await shot('ruin-mouth');
await teleport(38, 20);
await interact('sign-rings', ['Work out what it means', 'Step back.']);
await teleport(37, 16);
await interact('lever-a');
await teleport(42, 22);
await interact('lever-c');
await wait(2500);
await play();
await shot('levers');
await teleport(42, 14);
await interact('symbol-door', ['Let the meaning come', 'Hold the pale crystal', 'Put your palm', 'Fuse a bypass', 'Study the marks', 'Match the apprentice']);
await wait(1000);
await shot('door');
console.log(await G(() => ({ door: window.__game().s.flags.doorOpen, inner: window.__game().s.flags.innerOpen })));
await teleport(42, 8);
await interact('archive', ['Take the plate.']);
await shot('archive');

console.log('# home');
await teleport(12, 45);
await zone('z-camp');
await wait(800);
await teleport(10, 41);
await interact('tent-apprentice', ['Read what is left.']);
await wait(6000);
await shot('ending');
await play([], { idleMs: 1000, max: 3 });
console.log(await G(() => ({ flags: Object.keys(window.__game()?.s.flags ?? {}), quests: window.__game()?.s.quests })));

const bad = errors.filter((e) => !/favicon|status of 404/.test(e)); // 404 = no saves server in preview
console.log(bad.length ? 'ERRORS:\n' + bad.join('\n') : 'no console errors');
await browser.close();
process.exit(bad.length ? 1 : 0);
