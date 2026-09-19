import * as THREE from 'three';
import type { LevelBundle } from '../level/layout';
import type { Terrain } from './terrain';
import { distToPolyline, hash2 } from './terrain';
import type { Grid } from './grid';
import * as S from '../world/models/scenery';
import { buildProp } from '../world/models/props';
import { greatTower, ruinFloor, mendedCrack, flowingWall, arcPath } from '../world/models/scn-azalos';
import { canopy, jars, blocks, pipeRun, stiltHut } from '../world/models/scn-camp';
import { makerWreck, minerHull, azalosVessel } from '../world/models/scn-wrecks';

// Turns the layout into scenery meshes and blocks the walk grid to match.

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

const _box = new THREE.Box3();
/** Features solid enough to hide the player. Canvas, pipes, jars and plants never open the see-through circle. */
const SOLID = new Set(['azalos-wall', 'azalos-ring', 'tower', 'great-tower', 'arch', 'miner-ruin', 'shack', 'wreck', 'rock', 'ridge', 'stilt-hut', 'miner-hull', 'azalos-vessel', 'fallen-spire']);
let curT = '';

export function buildLevelArt(bundle: LevelBundle, terrain: Terrain, grid: Grid): THREE.Group {
  const root = new THREE.Group();
  root.name = 'scenery';
  const W = bundle.data.width, H = bundle.data.height;
  let seed = 1;
  const R = rng(9173);

  const put = (o: THREE.Object3D, x: number, y: number, rotDeg = 0, sink = 0.05) => {
    o.position.set(x, terrain.heightAt(x, y) - sink, y);
    o.rotation.y = -THREE.MathUtils.degToRad(rotDeg);
    o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    root.add(o);
    // record how tall the solid thing is on every blocked tile it covers (the see-through circle asks)
    if (!SOLID.has(curT)) return o;
    o.updateMatrixWorld(true);
    _box.setFromObject(o);
    for (let ty = Math.floor(_box.min.z); ty <= Math.floor(_box.max.z); ty++) for (let tx = Math.floor(_box.min.x); tx <= Math.floor(_box.max.x); tx++) {
      if (!grid.isStaticFree(tx, ty)) grid.raiseTop(tx, ty, _box.max.y);
    }
    return o;
  };
  const eachTile = (fn: (x: number, y: number, cx: number, cy: number) => void) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) fn(x, y, x + 0.5, y + 0.5);
  };
  const blockRect = (rx: number, ry: number, rw: number, rh: number) => {
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) grid.block(x, y);
  };
  /** Place a wall piece along the segment a->b. The piece is built along local +X. */
  const wallAlong = (a: [number, number], b: [number, number], h: number, curve: number) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const o = flowingWall(len + 0.35, h, curve, seed++);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    put(o, mx, my, 0, 0.15);
    o.rotation.y = Math.atan2(-dy, dx);
  };

  const clears = bundle.features.filter((f): f is Extract<typeof f, { t: 'clear' }> => f.t === 'clear').map((f) => f.rect);
  const isClear = (x: number, y: number) => clears.some(([cx, cy, cw, ch]) => x >= cx && x < cx + cw && y >= cy && y < cy + ch);
  for (const f of bundle.features) {
    curT = f.t;
    switch (f.t) {
      case 'chasm': blockRect(...f.rect); break;
      case 'block': blockRect(...f.rect); break;

      case 'ridge': {
        eachTile((x, y, cx, cy) => { if (distToPolyline(cx, cy, f.pts) <= f.width / 2) grid.block(x, y); });
        // dress the ridge with boulders along its spine
        for (let i = 0; i < f.pts.length - 1; i++) {
          const [ax, ay] = f.pts[i], [bx, by] = f.pts[i + 1];
          const len = Math.hypot(bx - ax, by - ay);
          // a few big outcrops along the spine, a scatter of smaller stones at their feet
          const n = Math.max(1, Math.round(len / 2.4));
          for (let k = 0; k < n; k++) {
            const t = (k + R()) / n;
            const x = ax + (bx - ax) * t + (R() - 0.5) * f.width * 0.5;
            const y = ay + (by - ay) * t + (R() - 0.5) * f.width * 0.5;
            const size = 1.8 + R() * 1.8 * Math.min(1.4, f.height / 2.5);
            put(S.rock(size, seed++), x, y, R() * 360, size * 0.38);
            if (R() < 0.7) {
              const a2 = R() * Math.PI * 2, d2 = size * (0.55 + R() * 0.3);
              put(S.rock(0.4 + R() * 0.6, seed++), x + Math.cos(a2) * d2, y + Math.sin(a2) * d2, R() * 360, 0.08);
            }
          }
        }
        break;
      }

      case 'azalos-wall': {
        eachTile((x, y, cx, cy) => { if (distToPolyline(cx, cy, f.pts) <= 0.55) grid.block(x, y); });
        f.pts.forEach((p, i) => {
          if (i === f.pts.length - 1 || f.gaps?.includes(i)) return;
          wallAlong(p, f.pts[i + 1], f.h, 0.15);
        });
        break;
      }

      case 'azalos-ring': {
        const [cx0, cy0] = f.c;
        const inGap = (deg: number) => (f.gapsDeg ?? []).some(([a, b]) => deg >= a && deg <= b);
        eachTile((x, y, cx, cy) => {
          const d = Math.hypot(cx - cx0, cy - cy0);
          if (Math.abs(d - f.r) > 0.62) return;
          const deg = (THREE.MathUtils.radToDeg(Math.atan2(cx - cx0, -(cy - cy0))) + 360) % 360;
          if (!inGap(deg)) grid.block(x, y);
        });
        // one continuous wall per unbroken run of the ring, rounded only where it meets a gap
        const step = 1;
        const open: boolean[] = [];
        for (let d = 0; d < 360; d += step) open.push(!(d >= f.from && d < f.to) || inGap(d + step / 2));
        const full = !open.some((x) => x);
        const start = full ? 0 : open.findIndex((x, i) => x && !open[(i + 1) % open.length]) + 1;
        let i = 0, run = 0;
        while (i < open.length) {
          const k = (start + i) % open.length;
          if (open[k]) { i++; continue; }
          let j = i;
          while (j < open.length && !open[(start + j) % open.length]) j++;
          const a0 = THREE.MathUtils.degToRad((start + i) * step), a1 = THREE.MathUtils.degToRad((start + j) * step);
          const o = flowingWall(0, f.h, 0, seed++ + run++ * 7, { path: arcPath(f.r, a0, a1), ends: [!full, !full] });
          put(o, cx0, cy0, 0, 0.15);
          i = j;
        }
        break;
      }

      case 'tower': {
        eachTile((x, y, cx, cy) => { if (Math.hypot(cx - f.at[0], cy - f.at[1]) <= f.r * 1.9) grid.block(x, y); });
        put(S.azalosTowerStump(f.r, f.h, seed++), f.at[0], f.at[1], R() * 360, 0.2);
        break;
      }

      case 'arch': {
        const rad = THREE.MathUtils.degToRad(f.rot);
        const ox = Math.cos(rad) * f.span / 2, oy = Math.sin(rad) * f.span / 2;
        for (const s of [-1, 1]) {
          const fx = f.at[0] + ox * s, fy = f.at[1] + oy * s;
          eachTile((x, y, cx, cy) => { if (Math.hypot(cx - fx, cy - fy) <= 0.6) grid.block(x, y); });
        }
        put(S.azalosArch(f.span, f.h, seed++), f.at[0], f.at[1], f.rot, 0.1);
        break;
      }

      case 'fallen-spire': {
        // a great tower toppled onto its side, root-ball and all (the critic read the old one as a bent pipe)
        const t0 = greatTower(0.95, f.len, seed++, { broken: true, char: 0.4 });
        const g = new THREE.Group();
        t0.rotation.z = -Math.PI / 2 + 0.04;
        t0.position.set(-f.len / 2, 0.9, 0);
        g.add(t0);
        put(g, f.at[0], f.at[1], f.rot, 0.35);
        break;
      }
      case 'miner-hull': put(minerHull(f.len, seed++), f.at[0], f.at[1], f.rot, 0); break;
      case 'azalos-vessel': put(azalosVessel(f.len, seed++), f.at[0], f.at[1], f.rot, 0.5); break;
      case 'trench': break;
      case 'floor-disc':
        if (f.raise) put(ruinFloor(f.r, f.raise, seed++), f.at[0], f.at[1], 0, -0.005);
        else put(S.azalosFloorDisc(f.r, seed++), f.at[0], f.at[1], 0, -0.02);
        break;

      case 'great-tower': {
        const br = f.block ?? f.r * 1.6;
        eachTile((x, y, cx, cy) => { if (Math.hypot(cx - f.at[0], cy - f.at[1]) <= br) grid.block(x, y); });
        put(greatTower(f.r, f.h, seed++, { broken: f.broken, doors: f.doors, char: f.char }), f.at[0], f.at[1], R() * 360, 0.15);
        break;
      }

      case 'wall-crack': put(mendedCrack(seed++), f.at[0], f.at[1], f.rot, 0.02); break;

      case 'canopy': put(canopy(f.w, f.d, f.h, seed++), f.at[0], f.at[1], f.rot, 0); break;
      case 'jars': put(jars(seed++), f.at[0], f.at[1], R() * 360, 0.02); break;
      case 'blocks': {
        grid.block(Math.floor(f.at[0]), Math.floor(f.at[1]));
        put(blocks(seed++), f.at[0], f.at[1], R() * 360, 0.03);
        break;
      }
      case 'pipe': {
        const o = pipeRun(f.pts.map(([x, y]) => new THREE.Vector3(x, terrain.heightAt(x, y), y)), f.h, seed++);
        o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        root.add(o);
        break;
      }
      case 'stilt-hut': {
        eachTile((x, y, cx, cy) => { if (Math.hypot(cx - f.at[0], cy - f.at[1]) <= 1.3) grid.block(x, y); });
        put(stiltHut(f.h, seed++), f.at[0], f.at[1], f.rot, 0);
        break;
      }

      case 'miner-ruin':
      case 'shack': {
        const rad = THREE.MathUtils.degToRad(f.rot);
        const cos = Math.cos(rad), sin = Math.sin(rad);
        eachTile((x, y, cx, cy) => {
          const lx = (cx - f.at[0]) * cos + (cy - f.at[1]) * sin;
          const ly = -(cx - f.at[0]) * sin + (cy - f.at[1]) * cos;
          // shacks carry a lean-to on -X, a barrel on +X and an awning on +Z (see scenery.ts)
          const [x0, x1, z0, z1] = f.t === 'shack' ? [-f.w / 2 - 1.0, f.w / 2 + 0.5, -f.d / 2 - 0.2, f.d / 2 + 1.0] : [-f.w / 2 - 0.2, f.w / 2 + 0.2, -f.d / 2 - 0.2, f.d / 2 + 0.2];
          if (lx >= x0 && lx <= x1 && ly >= z0 && ly <= z1) grid.block(x, y);
        });
        const o = f.t === 'shack' ? S.minaaShack(f.w, f.d, seed++) : S.minerRuin(f.w, f.d, f.h, seed++);
        put(o, f.at[0], f.at[1], f.rot, 0.1);
        break;
      }

      case 'scaffold': put(S.scaffold(f.w, f.h, seed++), f.at[0], f.at[1], f.rot, 0.05); break;

      case 'wreck': {
        f.block.forEach((r) => blockRect(...r));
        put(makerWreck(f.len, seed++), f.at[0], f.at[1], f.rot, 0.6);
        break;
      }

      case 'rock': {
        eachTile((x, y, cx, cy) => { if (Math.hypot(cx - f.at[0], cy - f.at[1]) <= f.size * 0.45) grid.block(x, y); });
        put(S.rock(f.size, seed++), f.at[0], f.at[1], R() * 360, f.size * 0.18);
        break;
      }

      case 'plant': {
        if (f.block) grid.block(Math.floor(f.at[0]), Math.floor(f.at[1]), f.kind === 'spire-root' || f.kind === 'sun-date');
        put(S.plant(f.kind, seed++), f.at[0], f.at[1], R() * 360, 0.02);
        break;
      }

      case 'scatter': {
        const [rx, ry, rw, rh] = f.rect;
        let placed = 0, tries = 0;
        while (placed < f.count && tries++ < f.count * 20) {
          const x = rx + R() * rw, y = ry + R() * rh;
          const tx = Math.floor(x), ty = Math.floor(y);
          if (!grid.isStaticFree(tx, ty) || isClear(x, y)) continue;
          // keep dressing off the paths and plazas so the walkable ground reads clearly
          const k = terrain.kindAt(x, y);
          // nothing lives on the Scar's dead lip; twist-weed only grows a little way back from it
          if (f.kind !== 'debris' && f.kind !== 'rock-small' && terrain.scarLip(x, y) < (f.kind === 'twist-weed' ? 2.5 : 7)) continue;
          if ((k === 'path' || k === 'plaza') && f.kind !== 'debris') continue;
          let o: THREE.Object3D;
          if (f.kind === 'debris') o = S.debris(seed++);
          else if (f.kind === 'rock-small') o = S.rock(0.3 + R() * 0.5, seed++);
          else o = S.plant(f.kind, seed++);
          put(o, x, y, R() * 360, 0.03);
          placed++;
        }
        break;
      }
      case 'crate': put(buildProp('prop-chest', { seed: seed++ }).root, f.at[0], f.at[1], f.rot, 0.02); break;
      case 'ground': break;
      case 'clear': break;
    }
  }
  return root;
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = THREE.MathUtils.degToRad(deg);
  return [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
}
