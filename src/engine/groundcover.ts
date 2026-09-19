import * as THREE from 'three';
import type { Terrain } from './terrain';
import type { Grid } from './grid';
import { hash2, fbm } from './terrain';
import { makeRng, rr, noise3, smooth, clamp01, prepFor, paintFn, type Rng } from '../world/models/scn-kit';

// Ground cover: the small stuff that makes open sand read as a place. Pebbles, rust scrub and
// pale stone chips, all instanced (one draw call per kind), placed by ground type and height.
// None of it blocks the grid. Density lives in one table so a quality setting can thin it.

const coverMat = (crease: number) => {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  m.userData.crease = crease;
  return m;
};

function pebbleGeo(r: Rng, seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.5, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  const sy = rr(r, 0.28, 0.45);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (noise3(x * 2.5, y * 2.5, z * 2.5, seed) - 0.5) * 0.5;
    p.setXYZ(i, x * k, Math.max(-0.12, y * sy * k) + 0.04, z * k);
  }
  return paintFn(g, (x, y, z, out) => {
    out.setHex(0xa0805e).multiplyScalar(0.7 + 0.3 * noise3(x * 4, y * 4, z * 4, seed + 1) + 0.12 * smooth(-0.05, 0.2, y));
  });
}

/** Dry rust scrub: a tangle of thin twigs from one root, tips darker red, like the paintings. */
function scrubGeo(r: Rng, seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n = 9 + Math.floor(r() * 6);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, lean = rr(r, 0.35, 1.0), len = rr(r, 0.35, 0.7);
    const tip = new THREE.Vector3(Math.cos(a) * Math.sin(lean) * len, Math.cos(lean) * len * 0.9 + 0.05, Math.sin(a) * Math.sin(lean) * len);
    const twig = new THREE.CylinderGeometry(0.006, 0.018, len, 3, 1, true);
    twig.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().normalize());
    twig.applyQuaternion(q);
    parts.push(twig);
    // a small clump of dry leaves at the tip and one halfway
    for (const t of [1, 0.6]) {
      const c = new THREE.IcosahedronGeometry(rr(r, 0.05, 0.1) * (t === 1 ? 1 : 0.8), 0);
      c.scale(1.3, 0.8, 1.3);
      c.translate(tip.x * t, tip.y * t, tip.z * t);
      parts.push(c);
    }
  }
  const merged: THREE.BufferGeometry[] = parts.map((x) => (x.index ? x.toNonIndexed() : x));
  const pos: number[] = [];
  for (const m of merged) pos.push(...(m.attributes.position.array as Float32Array));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const base = new THREE.Color(0x6a3a24), mid = new THREE.Color(0xa4502e), tipC = new THREE.Color(0xc4683c);
  return paintFn(g, (x, y, z, out) => {
    const h = clamp01(y / 0.6);
    out.copy(base).lerp(mid, smooth(0, 0.5, h)).lerp(tipC, smooth(0.5, 1, h) * noise3(x * 6, y * 6, z * 6, seed));
  });
}

function chipGeo(r: Rng, seed: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(rr(r, 0.2, 0.4), rr(r, 0.05, 0.1), rr(r, 0.15, 0.3), 1, 1, 1).toNonIndexed();
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + 0.4 * noise3(i, 0, 0, seed)), p.getY(i) + 0.03, p.getZ(i));
  return paintFn(g, (x, y, z, out) => out.setHex(0xd8ccb4).multiplyScalar(0.85 + 0.2 * noise3(x * 5, y * 5, z * 5, seed)));
}

interface Kind { geos: THREE.BufferGeometry[]; mat: THREE.Material; shadow: boolean; name: string }

/**
 * Scatter the cover over the map and a band past its edge.
 * density: 1 on High; lower values thin everything evenly.
 */
export function buildGroundCover(t: Terrain, grid: Grid, density = 1, clear: [number, number, number, number][] = []): THREE.Group {
  const r = makeRng(777);
  const group = new THREE.Group();
  group.name = 'ground-cover';
  const kinds: Record<'pebble' | 'scrub' | 'chip', Kind> = {
    pebble: { geos: [0, 1, 2, 3].map((i) => pebbleGeo(r, 30 + i)), mat: coverMat(70), shadow: false, name: 'pebbles' },
    scrub: { geos: [0, 1, 2].map((i) => scrubGeo(r, 50 + i)), mat: coverMat(80), shadow: true, name: 'scrub' },
    chip: { geos: [0, 1, 2].map((i) => chipGeo(r, 70 + i)), mat: coverMat(35), shadow: false, name: 'chips' },
  };
  const placed: Record<string, THREE.Matrix4[][]> = { pebble: [[], [], [], []], scrub: [[], [], []], chip: [[], [], []] };
  const colours: Record<string, THREE.Color[][]> = { pebble: [[], [], [], []], scrub: [[], [], []], chip: [[], [], []] };
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  const add = (kind: keyof typeof kinds, x: number, y: number, size: number, tint = 1) => {
    const vi = Math.floor(r() * kinds[kind].geos.length);
    e.set(kind === 'scrub' ? rr(r, -0.1, 0.1) : r() * 0.4, r() * Math.PI * 2, kind === 'scrub' ? rr(r, -0.1, 0.1) : r() * 0.4);
    q.setFromEuler(e);
    sc.set(size, size * (kind === 'scrub' ? rr(r, 0.8, 1.2) : 1), size);
    ps.set(x, t.heightAt(x, y) - 0.02 * size, y);
    placed[kind][vi].push(m.compose(ps, q, sc).clone());
    colours[kind][vi].push(new THREE.Color(tint, tint * rr(r, 0.97, 1.02), tint * rr(r, 0.95, 1.03)));
  };
  const x0 = -20, x1 = t.W + 20, y0 = -12, y1 = t.H + 20;
  for (let y = y0; y < y1; y += 0.5) for (let x = x0; x < x1; x += 0.5) {
    const jx = x + hash2(Math.round(x * 2), Math.round(y * 2) + 91) * 0.5, jy = y + hash2(Math.round(x * 2) + 37, Math.round(y * 2)) * 0.5;
    const inside = jx >= 0 && jy >= 0 && jx < t.W && jy < t.H;
    const tx = Math.floor(jx), ty = Math.floor(jy);
    const kind = t.kindAt(jx, jy);
    const h = t.heightAt(jx, jy);
    if (h < -0.6) continue; // the Scar's walls: nothing grows or rests there
    if (clear.some(([cx, cy, cw, ch]) => jx >= cx && jx < cx + cw && jy >= cy && jy < cy + ch)) continue;
    const lip = t.scarLip(jx, jy);
    // canon: the Scar is dead ground. Only grit near it, a little dark rubble on the very lip
    if (lip < 7) { if (r() < 0.08 * (1 - lip / 7)) add('pebble', jx, jy, rr(r, 0.1, 0.3), 0.6); continue; }
    const free = !inside || grid.isStaticFree(tx, ty);
    const ridge = h > 0.6;
    // clumps: density rides a slow noise so cover gathers in patches, not an even sprinkle
    const patch = fbm(jx * 0.22 + 40, jy * 0.22, 3);
    const roll = r();
    const d = density * (inside ? 1 : 0.6);
    if (kind === 'plaza') {
      if (free && roll < 0.05 * d) add('chip', jx, jy, rr(r, 0.7, 1.4));
      continue;
    }
    if (kind === 'scar') { if (roll < 0.05 * d) add('pebble', jx, jy, rr(r, 0.15, 0.35), 0.7); continue; }
    // pebbles: thick on ridge feet and rock ground, thin on paths
    const pebbleP = (ridge ? 0.22 : kind === 'rock' ? 0.16 : kind === 'path' ? 0.02 : 0.06) * smooth(0.3, 0.7, patch + 0.15);
    if (roll < pebbleP * d) { add('pebble', jx, jy, rr(r, 0.07, 0.24) * (ridge ? 1.6 : 1) * (r() < 0.08 ? 1.8 : 1), 0.85 + r() * 0.25); continue; }
    // scrub: on open sand in loose clumps, never on paths, packed camp ground or ridge tops
    if (!free || ridge || kind === 'path' || kind === 'packed' || kind === 'oasis') continue;
    const scrubP = 0.035 * smooth(0.45, 0.75, patch);
    if (roll > 1 - scrubP * d) add('scrub', jx, jy, rr(r, 0.7, 1.5), 0.85 + r() * 0.3);
  }
  for (const [key, kind] of Object.entries(kinds) as [keyof typeof kinds, Kind][]) {
    kind.geos.forEach((g0, vi) => {
      const list = placed[key][vi];
      if (!list.length) return;
      const g = prepFor(g0, kind.mat);
      const im = new THREE.InstancedMesh(g, kind.mat, list.length);
      list.forEach((mm, i) => { im.setMatrixAt(i, mm); im.setColorAt(i, colours[key][vi][i]); });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = kind.shadow;
      im.receiveShadow = true;
      im.name = kind.name;
      im.userData.noMerge = true;
      im.computeBoundingSphere();
      group.add(im);
    });
  }
  return group;
}
