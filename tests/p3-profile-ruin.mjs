// What the ruin costs, by object group (agent D, phase 3).
// Usage: node tests/p3-profile-ruin.mjs <port> [x,y]
// Lists the scene's top-level groups with mesh and triangle counts, then hides each one in turn
// and measures the frame rate. Frozen build only, never 5190. Honours comms/BROWSER.lock.
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
const port = Number(process.argv[2]);
if (!port || port === 5190) { console.log('give a test port, never 5190'); process.exit(1); }
const [cx, cy] = (process.argv[3] ?? '44,17').split(',').map(Number);
const LOCK = 'comms/BROWSER.lock', ME = 'agent D (tests/p3-profile-ruin.mjs)';
for (;;) {
  if (!existsSync(LOCK)) break;
  if ((Date.now() - statSync(LOCK).mtimeMs) / 60000 > 10) { unlinkSync(LOCK); break; }
  console.log('browser busy:', readFileSync(LOCK, 'utf8').trim()); await new Promise((r) => setTimeout(r, 20000));
}
writeFileSync(LOCK, `${ME} ${new Date().toISOString()}\n`);
const free = () => { try { if (readFileSync(LOCK, 'utf8').startsWith(ME)) unlinkSync(LOCK); } catch {} };
process.on('exit', free);

const browser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(`http://localhost:${port}/?quick=minaa-tech`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!(window.__game && window.__game()), null, { timeout: 60000 });
  await page.bringToFront();
  await page.waitForTimeout(2500);
  await page.evaluate(([x, y]) => {
    const w = window.__world;
    w.follow(null); w.cam.resetPan?.(); w.cam.setZoom(1); w.cam.snapTo?.(w.tileToWorld({ x, y }));
  }, [cx, cy]);
  await page.waitForTimeout(2000);

  // what is in the scene, and what the camera actually draws
  const inventory = await page.evaluate(() => {
    const w = window.__world;
    const tri = (g) => { const p = g.getAttribute && g.getAttribute('position'); return g.index ? g.index.count / 3 : p ? p.count / 3 : 0; };
    const rows = [];
    for (const child of w.r.scene.children) {
      let meshes = 0, tris = 0, skinned = 0, mats = new Set();
      child.traverse((o) => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        const n = o.isInstancedMesh ? o.count : 1;
        meshes += n; tris += tri(o.geometry) * n;
        if (o.isSkinnedMesh) skinned++;
        const m = o.material; (Array.isArray(m) ? m : [m]).forEach((x) => x && mats.add(x.uuid));
      });
      rows.push({ name: child.name || child.type, meshes, tris: Math.round(tris), skinned, materials: mats.size });
    }
    rows.sort((a, b) => b.tris - a.tris);
    const i = w.r.renderer.info;
    return { rows, drawn: { calls: i.render.calls, tris: i.render.triangles, programs: i.programs ? i.programs.length : -1, textures: i.memory.textures, geometries: i.memory.geometries } };
  });

  const fps = () => page.evaluate(() => new Promise((res) => {
    const t = []; let last = performance.now(); const t0 = last;
    const f = (now) => { t.push(now - last); last = now; if (now - t0 < 2500) requestAnimationFrame(f); else { const d = t.slice(5).sort((a, b) => a - b); res(+(1000 / (d.reduce((s, v) => s + v, 0) / d.length)).toFixed(1)); } };
    requestAnimationFrame(f);
  }));

  const base1 = await fps();
  const hidden = [];
  for (const row of inventory.rows.slice(0, 10)) {
    await page.evaluate((n) => { const c = window.__world.r.scene.children.find((x) => (x.name || x.type) === n); if (c) c.visible = false; }, row.name);
    await page.waitForTimeout(900);
    const f = await fps();
    await page.evaluate((n) => { const c = window.__world.r.scene.children.find((x) => (x.name || x.type) === n); if (c) c.visible = true; }, row.name);
    hidden.push({ group: row.name, fpsWithItHidden: f });
  }
  const base2 = await fps();
  console.log(JSON.stringify({ camera: [cx, cy], baseFps: [base1, base2], drawn: inventory.drawn, groups: inventory.rows, hideTest: hidden }, null, 1));
} finally { await browser.close(); free(); }
