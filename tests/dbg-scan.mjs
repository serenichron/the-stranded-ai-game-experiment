// Find a spot for the creation line-up with nothing between the camera and the six bodies.
import { chromium } from 'playwright-core';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
const LOCK = 'comms/BROWSER.lock';
while (existsSync(LOCK) && Date.now() - (await import('node:fs')).statSync(LOCK).mtimeMs < 600000) await new Promise((r) => setTimeout(r, 5000));
writeFileSync(LOCK, 'agent B scan ' + new Date().toISOString());
const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.goto('http://localhost:5196/?freeroam', { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
  await p.waitForTimeout(3000);
  const cands = await p.evaluate(() => {
    const w = window.__world, out = [];
    for (let y = 10; y < 52; y += 2) for (let x = 3; x < 58; x += 2) {
      const row = []; for (let i = 0; i < 6; i++) row.push({ x: x + i, y: y + i });
      if (row.every((t) => w.isWalkable(t, true))) out.push({ x, y });
    }
    return out;
  });
  console.log('candidates', cands.length);
  await p.evaluate(() => {
    const w = window.__world, boxes = [];
    w.r.scene.traverse((o) => {
      if (!o.isMesh || !o.visible || o.userData.entityId) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if (bb.max.y < 0.8) return;
      const sz = bb.max.clone().sub(bb.min);
      if (sz.x > 80 || sz.z > 80) return;
      boxes.push(bb);
    });
    window.__scanBoxes = boxes;
  });
  const good = [];
  for (const c of cands) {
    const res = await p.evaluate(async (c) => {
      const w = window.__world;
      w.follow(null);
      const centre = { x: c.x + 2.5, y: c.y + 2.5 };
      await w.focus(centre, { zoom: 1.15, duration: 0.01 });
      w.cam.target.copy(w.cam.goal); w.cam.zoom = w.cam.zoomGoal; w.cam.update(0.016);
      const cam = w.cam.camera.position;
      const boxes = window.__scanBoxes;
      let hits = 0;
      for (let i = 0; i < 6; i++) {
        const t = w.tileToWorld({ x: c.x + i, y: c.y + i }); t.y += 1.2;
        const seg = cam.clone();
        let hit = false;
        for (let k = 1; k < 60 && !hit; k++) {
          seg.copy(cam).lerp(t, k / 60);
          for (const bb of boxes) if (bb.containsPoint(seg)) { hit = true; break; }
        }
        if (hit) hits++;
      }
      return hits;
    }, c);
    if (res === 0) good.push(c);
  }
  console.log('clear spots', JSON.stringify(good));
} finally { await b.close(); unlinkSync(LOCK); }
