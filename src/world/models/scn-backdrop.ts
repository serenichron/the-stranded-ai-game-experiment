import * as THREE from 'three';
import { Kit, lathe, sweep, paintFn, makeRng, rr, fbm3, noise3, smooth, matte, glow, type Rng } from './scn-kit';
import { PALETTE } from './types';

// The horizon, past the edge of the map. Every concept painting has one: flat-topped mesas and
// hoodoo spires in layered rust and ochre, fading into lavender haze, with broken Aza'los towers
// and the ribs of old ship wrecks standing against the sky. The distance fog does the fading.
// All of it merges into a few meshes. Nothing here is reachable, so nothing blocks the grid.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const STRATA = [0xb86a44, 0xcfa27a, 0x9a5236, 0xd8bc98, 0xa8744e, 0xc48c62];

/** Layered sandstone colour by height, wavy bands, darker at the foot. */
function strata(seed: number, top: number) {
  const cols = STRATA.map((h) => new THREE.Color(h));
  return (x: number, y: number, z: number, out: THREE.Color) => {
    const band = (y / 3.2) + fbm3(x * 0.05, y * 0.02, z * 0.05, seed) * 1.6;
    const i = Math.floor(Math.abs(band)) % cols.length;
    out.copy(cols[i]).lerp(cols[(i + 1) % cols.length], smooth(0.6, 1, band - Math.floor(band)));
    out.multiplyScalar(0.82 + 0.3 * smooth(0, top, y));
  };
}

function mesa(r: Rng, seed: number, radius: number, height: number): THREE.BufferGeometry {
  // steep sides, a talus skirt at the foot, a flat worn cap
  const prof: [number, number][] = [
    [radius * 1.35, -2], [radius * 1.18, height * 0.12], [radius * 1.02, height * 0.28],
    [radius * 0.97, height * 0.55], [radius * 0.94, height * 0.82], [radius * 0.9, height * 0.97],
    [radius * 0.6, height * 1.0], [0.01, height * 1.0],
  ];
  const lump = rr(r, 0.25, 0.45);
  const g = lathe(prof, 26, (a, _c, j, rad, y) => {
    const k = 1 + (noise3(Math.cos(a) * 2.2, y * 0.08, Math.sin(a) * 2.2, seed) - 0.5) * lump
      + (noise3(Math.cos(a) * 7, y * 0.3, Math.sin(a) * 7, seed + 3) - 0.5) * 0.12;
    return [j === prof.length - 1 ? rad : rad * k, y];
  });
  return paintFn(g, strata(seed, height));
}

function hoodoo(r: Rng, seed: number, height: number): THREE.BufferGeometry {
  // a stack of eroded drums, narrow waists, a harder cap stone on top
  const prof: [number, number][] = [];
  const base = height * rr(r, 0.16, 0.24);
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const waist = 0.72 + 0.28 * Math.abs(Math.sin(t * Math.PI * rr(r, 2.2, 3.4) + seed));
    prof.push([base * (1.25 - 0.55 * t) * waist, t * height]);
  }
  prof.push([base * 0.9, height * 1.02], [base * 0.55, height * 1.08], [0.01, height * 1.1]);
  const g = lathe(prof, 12, (a, _c, _j, rad, y) => [rad * (0.85 + 0.3 * noise3(Math.cos(a) * 2, y * 0.2, Math.sin(a) * 2, seed)), y]);
  return paintFn(g, strata(seed + 9, height));
}

/** A broken Aza'los tower on the skyline: a stalagmite of pale stone with a teal seam. */
function farTower(kit: Kit, r: Rng, seed: number, height: number, at: THREE.Vector3) {
  const base = height * 0.13;
  const prof: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    // flared foot, long taper, snapped top
    prof.push([base * (0.35 + 0.65 * Math.pow(1 - t, 1.8) + 0.9 * Math.pow(1 - t, 8)), t * height]);
  }
  const g = lathe(prof, 16, (a, _c, j, rad, y) => {
    const rib = 1 + 0.08 * Math.sin(a * 5 + y * 0.05);
    const snap = j === 12 ? (noise3(Math.cos(a) * 3, 0, Math.sin(a) * 3, seed) - 0.5) * height * 0.12 : 0;
    return [rad * rib, y + snap];
  });
  const stone = new THREE.Color(PALETTE.stone);
  paintFn(g, (x, y, z, out) => { out.copy(stone).multiplyScalar(0.8 + 0.25 * smooth(0, height, y) + 0.08 * fbm3(x * 0.1, y * 0.05, z * 0.1, seed)); });
  kit.add(g.translate(at.x, at.y, at.z), matte());
  // one teal seam running up the side
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, y = t * height * 0.92;
    const rad = base * (0.35 + 0.65 * Math.pow(1 - t, 1.8) + 0.9 * Math.pow(1 - t, 8)) * 1.02;
    const a = 0.4 + Math.sin(t * 3) * 0.25;
    pts.push(V(Math.sin(a) * rad + at.x, y + at.y, Math.cos(a) * rad + at.z));
  }
  kit.add(sweep(pts, { segments: 30, radial: 4, radius: () => height * 0.006 }), glow(PALETTE.teal, 1.2));
}

/** The ribs of a wreck on the horizon: curved spars rising out of the sand. */
function ribs(kit: Kit, r: Rng, seed: number, at: THREE.Vector3, yaw: number, len: number, dark: number) {
  const n = 5 + Math.floor(r() * 4);
  const col = new THREE.Color(dark);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const h = len * 0.35 * (0.6 + 0.4 * Math.sin(t * Math.PI)) * rr(r, 0.7, 1.1);
    if (r() < 0.25) continue; // missing ribs
    const x = (t - 0.5) * len;
    const span = h * 0.9;
    const pts = [V(x, -2, -span), V(x, h * 0.7, -span * 0.8), V(x + h * 0.05, h, 0), V(x, h * 0.75, span * 0.7), V(x, h * 0.2, span * rr(r, 0.6, 1))];
    if (r() < 0.5) pts.splice(3); // broken off halfway
    const g = sweep(pts, { segments: 16, radial: 5, radius: (tt) => len * 0.012 * (1.3 - 0.6 * tt) });
    g.rotateY(yaw).translate(at.x, at.y, at.z);
    kit.add(paintFn(g, (px, py, pz, out) => out.copy(col).multiplyScalar(0.85 + 0.3 * noise3(px * 0.2, py * 0.2, pz * 0.2, seed))), matte());
  }
}

/**
 * Build the whole horizon around a level of size W x H.
 * heightAt gives the ground height so every piece sits on the far plain.
 */
export function buildBackdrop(W: number, H: number, heightAt: (x: number, z: number) => number): THREE.Group {
  const r = makeRng(4242);
  const kit = new Kit();
  const cx = W / 2, cz = H / 2;
  const place = (ang: number, dist: number) => {
    const x = cx + Math.sin(ang) * dist, z = cz - Math.cos(ang) * dist;
    return V(x, heightAt(x, z) - 1, z);
  };
  let seed = 1;
  // mesas in two rings: near ones large and detailed enough, far ones just shapes in the haze
  for (let i = 0; i < 34; i++) {
    const ang = (i / 34) * Math.PI * 2 + rr(r, -0.08, 0.08);
    const dist = rr(r, 120, 190) + (i % 3) * 60;
    const p = place(ang, dist);
    const rad = rr(r, 10, 26), h = rr(r, 12, 34);
    kit.add(mesa(r, seed++, rad, h).translate(p.x, p.y, p.z), matte());
  }
  // hoodoo clusters, the spires the paintings are full of
  for (let c = 0; c < 16; c++) {
    const ang = rr(r, 0, Math.PI * 2), dist = rr(r, 85, 230);
    const n = 3 + Math.floor(r() * 5);
    for (let k = 0; k < n; k++) {
      const p = place(ang + rr(r, -0.04, 0.04), dist + rr(r, -12, 12));
      kit.add(hoodoo(r, seed++, rr(r, 7, 26)).translate(p.x + rr(r, -6, 6), p.y, p.z + rr(r, -6, 6)), matte());
    }
  }
  // broken Aza'los towers: one cluster beyond the Scar to the north-east, a lone one west
  const towerAngs = [0.55, 0.62, 0.7, 4.9];
  towerAngs.forEach((ang, i) => farTower(kit, r, seed++, rr(r, 38, 62) * (i === 1 ? 1.25 : 1), place(ang, 200 + i * 14)));
  // wreck ribs: a miner hull east, a Maker spine south-west (dark grey-green)
  ribs(kit, r, seed++, place(1.75, 160), 0.4, 60, 0x4a423a);
  ribs(kit, r, seed++, place(3.9, 175), -0.9, 48, 0x3d4a3c);
  const g = kit.build('backdrop', false);
  g.traverse((o) => { o.userData.noMerge = true; if ((o as THREE.Mesh).isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return g;
}
