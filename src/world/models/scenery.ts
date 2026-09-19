// Static scenery: Aza'los ruins, miner ruins, Mi'naa shacks, scaffolds, the Maker wreck,
// rocks, plants and debris. Every builder returns an Object3D with its origin on the ground.
// Each takes a seed last, so the same call always makes the same piece.
import * as THREE from 'three';
import { PALETTE } from './types';
import {
  Kit, makeRng, rr, ri, pick, lerp, clamp01, smooth, noise3, snoise3, fbm3, xf, displace, paint, paintFn,
  loft, sweep, lathe, ribbon, seam, lump, matte, matte2, matteBack, metal, glow, pointLight, type Rng,
} from './scn-kit';
import { buildPlant, type PlantType } from './scn-plants';
import { tornCanvas, corrugated } from './scn-camp';

export type { PlantType } from './scn-plants';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// Aza'los palette.
const STONE = PALETTE.stone;
const STONE_STAIN = 0xb7a17f;
const tealSeam = () => glow(PALETTE.teal, 1.8);
const tealLine = () => glow(PALETTE.teal, 1.25);

function paintStone(g: THREE.BufferGeometry, seed: number, aoHeight = 1.2): THREE.BufferGeometry {
  return paint(g, STONE, {
    vary: 0.07, freq: 0.9, seed, ao: 0.42, aoHeight, dust: PALETTE.sand, dustHeight: 0.55,
    stain: STONE_STAIN, stainAmount: 0.5,
  });
}

function rubble(kit: Kit, r: Rng, x: number, z: number, size: number, hex = STONE, seed = 3) {
  const g = lump(r, size, 0);
  xf(g, x, size * 0.15, z, r() * 3, r() * 3, r() * 3, 1, rr(r, 0.5, 0.8), 1);
  kit.add(paint(g, hex, { vary: 0.1, seed, ao: 0.3, aoHeight: 0.4, dust: PALETTE.sand }), matte());
}

// ================================================================ Aza'los

/**
 * A curving wall of pale stone. Runs along local X from -length/2 to +length/2 and bows
 * towards +Z by `curve` metres at its middle (negative bows to -Z). Base about 0.9 m thick.
 */
export function azalosWall(length: number, height: number, curve: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const L = Math.max(0.6, length), H = Math.max(0.6, height);
  const N = Math.max(8, Math.ceil(L * 3));
  const halfBase = 0.26 + 0.05 * H, halfTop = 0.12 + 0.02 * H;

  const pathAt = (u: number) => {
    const x = (u - 0.5) * L;
    return V(x, 0, curve * (1 - (2 * x / L) ** 2));
  };
  const sideAt = (u: number) => {
    const x = (u - 0.5) * L;
    const t = V(1, 0, (-8 * curve * x) / (L * L)).normalize();
    return V(-t.z, 0, t.x);
  };
  const leanAt = (u: number) => 0.16 * snoise3(u * L * 0.22, 3.3, 0, seed) * Math.min(1.4, H / 3);
  const thickAt = (u: number) => 1 + 0.18 * snoise3(u * L * 0.4, 5.1, 0, seed);
  const tops: number[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    let h = H * (0.86 + 0.14 * fbm3(u * L * 0.35, 0, 0, seed, 2));
    const n2 = noise3(u * L * 0.45 + 7, 0, 0, seed + 3);
    if (n2 > 0.6) h -= H * (n2 - 0.6) * 1.5; // broken dips
    h -= r() * 0.1 * H; // jagged crest
    tops.push(Math.max(H * 0.4, h));
  }
  const topAt = (u: number) => {
    const f = u * N, i = Math.min(N - 1, Math.floor(f));
    return lerp(tops[i], tops[i + 1], f - i);
  };
  const YS = [-0.15, 0.12, 0.35, 0.6, 0.82];
  const widthAt = (yf: number, tm: number, endK: number) =>
    lerp(halfBase * 1.35, halfTop, Math.pow(clamp01(yf), 0.55)) * tm * endK;

  const rings: THREE.Vector3[][] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, P = pathAt(u), S = sideAt(u);
    // Ends round off in width and height so the wall bends away rather than being cut.
    const de = smooth(0, 0.9, Math.min(u, 1 - u) * L);
    const h = tops[i] * lerp(0.4, 1, Math.sqrt(de)), tm = thickAt(u), lean = leanAt(u);
    const endK = lerp(0.1, 1, Math.sqrt(de));
    const prof: [number, number][] = [];
    for (const yf of YS) prof.push([widthAt(yf, tm, endK) + lean * yf * yf, yf * h]);
    prof.push([halfTop * 0.6 * tm * endK + lean, 0.95 * h], [lean, h], [-halfTop * 0.6 * tm * endK + lean, 0.95 * h]);
    for (let k = YS.length - 1; k >= 0; k--) prof.push([-widthAt(YS[k], tm, endK) + lean * YS[k] * YS[k], YS[k] * h]);
    rings.push(prof.map(([s, y]) => P.clone().addScaledVector(S, s).setY(y)));
  }
  let wall = loft(rings, { closed: false, capStart: true, capEnd: true });
  displace(wall, 0.05, 2.2, seed);
  kit.add(paintStone(wall, seed), matte());

  // Teal seams, one main line and one branch on each face.
  for (const side of [1, -1]) {
    const um = Math.min(0.3, 0.95 / L);
    const u0 = Math.max(um, rr(r, 0.04, 0.25)), u1 = Math.min(1 - um, rr(r, 0.72, 0.96)), yf0 = rr(r, 0.3, 0.55);
    const pts: THREE.Vector3[] = [];
    const at = (u: number, yf: number) => {
      const h = topAt(u);
      const s = side * (widthAt(yf, thickAt(u), 1) + 0.03) + leanAt(u) * yf * yf;
      return pathAt(u).addScaledVector(sideAt(u), s).setY(yf * h);
    };
    for (let k = 0; k <= 8; k++) {
      const u = lerp(u0, u1, k / 8);
      const yf = Math.min(0.72, Math.max(0.14, yf0 + 0.2 * snoise3(u * L * 0.5, side * 4, 0, seed + 9)));
      pts.push(at(u, yf));
    }
    const main = seam(pts, 0.035, Math.max(16, Math.round(L * 3)));
    displace(main, 0.05, 2.2, seed);
    kit.add(main, tealSeam());
    const ub = lerp(u0, u1, rr(r, 0.3, 0.7));
    const yb = Math.min(0.72, Math.max(0.14, yf0 + 0.2 * snoise3(ub * L * 0.5, side * 4, 0, seed + 9)));
    const bpts = [at(ub, yb), at(ub + 0.03 * side, Math.min(0.78, yb + 0.12)), at(ub + 0.05, Math.min(0.8, yb + 0.22))];
    const br = seam(bpts, 0.025, 8);
    displace(br, 0.05, 2.2, seed);
    kit.add(br, tealSeam());
  }

  // A few fallen pieces at the foot.
  const n = ri(r, 1, 3);
  for (let i = 0; i < n; i++) {
    const u = rr(r, 0.1, 0.9), side = r() < 0.5 ? 1 : -1;
    const p = pathAt(u).addScaledVector(sideAt(u), side * (halfBase * 1.4 + rr(r, 0.1, 0.4)));
    rubble(kit, r, p.x, p.z, rr(r, 0.25, 0.5), STONE, seed + i);
  }
  return kit.build('azalos-wall');
}

/** A broken tower on a flared stalagmite base. Footprint is a circle of about 1.9 x radius. */
export function azalosTowerStump(radius: number, height: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const R = Math.max(0.4, radius), H = Math.max(1, height);
  const YF = [-0.04, 0.02, 0.07, 0.14, 0.23, 0.34, 0.47, 0.6, 0.72, 0.83, 0.92, 1.0];
  const phase = r() * 6;
  const rAt = (yf: number) => R * (1 + 0.95 * Math.exp(-Math.max(0, yf) * 8)) * (1 - 0.2 * yf) + R * 0.07 * Math.sin(yf * 10 + phase);
  const SEGS = 12;
  const drops: number[] = [];
  for (let i = 0; i < SEGS; i++) drops.push(H * 0.28 * Math.pow(r(), 1.6));
  drops[ri(r, 0, SEGS - 1)] = H * rr(r, 0.35, 0.45); // one deep break
  const maxDrop = Math.max(...drops);
  const profile: [number, number][] = YF.map((yf) => [rAt(yf), yf * H]);
  profile.push([rAt(1) * 0.7, H - 0.12]);
  profile.push([0, H - maxDrop - 0.2]);
  const nOuter = YF.length;
  const lean = rr(r, -1, 1) * H * 0.06;
  const leanDir = r() * Math.PI * 2;
  let tower = lathe(profile, SEGS, (_a, col, j, rad, y) => {
    if (j < nOuter) return [rad, y - drops[col] * smooth(0.45, 1.0, y / H)];
    if (j === nOuter) return [rad, y - drops[col]];
    return [rad, y];
  });
  const bend = (g: THREE.BufferGeometry) => {
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const k = lean * (p.getY(i) / H) ** 2;
      p.setXYZ(i, p.getX(i) + Math.cos(leanDir) * k, p.getY(i), p.getZ(i) + Math.sin(leanDir) * k);
    }
    return g;
  };
  bend(tower);
  displace(tower, 0.06, 1.7, seed);
  kit.add(paintStone(tower, seed, 1.6), matte());

  // Seams spiralling up the shaft.
  const nSeams = ri(r, 2, 3);
  for (let s = 0; s < nSeams; s++) {
    const a0 = r() * Math.PI * 2, turn = rr(r, 0.5, 1.1) * (r() < 0.5 ? 1 : -1);
    const y0 = rr(r, 0.06, 0.15), y1 = rr(r, 0.45, 0.58);
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const yf = lerp(y0, y1, k / 8), a = a0 + turn * (k / 8) + 0.12 * Math.sin(k * 1.7);
      const rad = rAt(yf) * 0.985 + 0.035;
      pts.push(V(Math.sin(a) * rad, yf * H, Math.cos(a) * rad));
    }
    const g = bend(seam(pts, 0.04, 18));
    displace(g, 0.06, 1.7, seed);
    kit.add(g, tealSeam());
  }
  // A crystal node set in the stone.
  const na = r() * Math.PI * 2, ny = rr(r, 0.3, 0.45);
  const node = xf(new THREE.OctahedronGeometry(0.12 + R * 0.05, 0), Math.sin(na) * rAt(ny) * 0.97, ny * H, Math.cos(na) * rAt(ny) * 0.97, 0, na, 0, 1, 1.6, 0.7);
  kit.add(bend(node), glow(PALETTE.teal, 2.2));

  // Fallen chunks.
  const n = ri(r, 3, 5);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = rAt(0) * rr(r, 1.0, 1.35);
    rubble(kit, r, Math.sin(a) * d, Math.cos(a) * d, rr(r, 0.25, 0.6) * Math.min(1.5, R), STONE, seed + i);
  }
  return kit.build('azalos-tower');
}

/**
 * A flowing arch. Feet at x = -span/2 and +span/2, arch in the XY plane, about 1.2 m deep in Z.
 */
export function azalosArch(span: number, height: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const s = Math.max(1, span), h = Math.max(1, height);
  const k = Math.min(1.5, Math.max(0.7, s / 4));
  const j = () => rr(r, -0.06, 0.06);
  const pts = [
    V(-s / 2, -0.3, 0), V(-s / 2 + j(), h * 0.3, 0.05), V(-s * 0.38 + j(), h * 0.72 + j(), j()),
    V(-s * 0.12, h * 0.97 + j(), 0), V(s * 0.14, h * 0.99 + j(), 0), V(s * 0.4 + j(), h * 0.7 + j(), j()),
    V(s / 2 + j(), h * 0.3, -0.05), V(s / 2, -0.3, 0),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const base = (t: number) => k * lerp(0.2, 0.42, Math.pow(Math.abs(t - 0.5) * 2, 2));
  const Z = V(0, 0, 1);
  const main = sweep(pts, { segments: 28, radial: 8, up: Z, radius: (t, a) => base(t) * (1 + 0.12 * Math.sin(a * 3 + t * 11)) });
  displace(main, 0.04, 2, seed);
  kit.add(paintStone(main, seed, 1.4), matte());

  // Flared feet.
  for (const sx of [-1, 1]) {
    const foot = lathe([[0.62 * k, -0.05], [0.5 * k, 0.1], [0.34 * k, 0.32], [0.26 * k, 0.6], [0.2 * k, 0.9]], 9);
    xf(foot, (sx * s) / 2, 0, 0);
    displace(foot, 0.04, 2, seed + 1);
    kit.add(paintStone(foot, seed + 1), matte());
  }

  // Frame helper for points around the main curve.
  const T = V(), N = V(), B = V();
  const around = (t: number, ang: number, off: number) => {
    const P = curve.getPointAt(t);
    curve.getTangentAt(t, T);
    N.crossVectors(T, Z).normalize();
    B.crossVectors(N, T).normalize();
    const rad = base(t) + off;
    return P.addScaledVector(N, Math.cos(ang) * rad).addScaledVector(B, Math.sin(ang) * rad);
  };
  // Tendrils winding round the main body, like coral grown over it.
  for (const [t0, t1] of [[0.04, 0.6], [0.42, 0.96]] as const) {
    const ph = r() * 6, tp: THREE.Vector3[] = [];
    for (let i = 0; i <= 11; i++) {
      const t = lerp(t0, t1, i / 11);
      tp.push(around(t, ph + t * 11, 0.04 * k));
    }
    const g = sweep(tp, { segments: 26, radial: 5, radius: (t) => 0.075 * k * (0.4 + 0.6 * Math.sin(Math.PI * t)) });
    displace(g, 0.02, 3, seed + 2);
    kit.add(paintStone(g, seed + 2, 1.4), matte());
  }
  // A coral sprig growing from the crown, with one fork.
  const top = curve.getPointAt(0.5).add(V(0, base(0.5) * 0.7, 0));
  const dir = rr(r, -1, 1) * 0.5;
  const sprig = [top.clone(), top.clone().add(V(dir * 0.4, 0.35 * k, 0.05)), top.clone().add(V(dir * 0.9, 0.75 * k, -0.05)), top.clone().add(V(dir * 1.1 + 0.15, 1.0 * k, 0))];
  kit.add(paintStone(sweep(sprig, { segments: 8, radial: 5, radius: (t) => 0.1 * k * (1 - t * 0.9) }), seed), matte());
  const fork = [sprig[1].clone(), sprig[1].clone().add(V(-dir * 0.3 - 0.2, 0.3 * k, 0.1)), sprig[1].clone().add(V(-dir * 0.4 - 0.35, 0.5 * k, 0.05))];
  kit.add(paintStone(sweep(fork, { segments: 5, radial: 4, radius: (t) => 0.06 * k * (1 - t * 0.85) }), seed), matte());

  // Seams on the front and back faces.
  for (const face of [Math.PI / 2, -Math.PI / 2]) {
    const sp: THREE.Vector3[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = lerp(0.07, 0.93, i / 14);
      sp.push(around(t, face + 0.25 * Math.sin(t * 9 + face), 0.015));
    }
    const g = seam(sp, 0.035, 30);
    displace(g, 0.04, 2, seed);
    kit.add(g, tealSeam());
  }
  return kit.build('azalos-arch');
}

/**
 * A toppled spire lying along X (base at -length/2, tip at +length/2), half sunk in sand,
 * cracked open along its upper side. Width about 0.22 x length (0.9 to 3.2 m).
 */
export function azalosFallenSpire(length: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const L = Math.max(2, length);
  const R0 = Math.min(1.6, Math.max(0.45, L * 0.11));
  const NP = 16;
  const rAt = (yf: number) => R0 * Math.pow(Math.max(0, 1 - yf), 0.75) * (1 + 0.07 * Math.sin(yf * 26));
  const outerProf: [number, number][] = [];
  const innerProf: [number, number][] = [];
  for (let i = 0; i < NP; i++) {
    const yf = i / (NP - 1);
    outerProf.push([rAt(yf), yf * L]);
    if (yf < 0.86) innerProf.push([rAt(yf) * 0.84, yf * L]);
  }
  const SEGS = 14;
  const gc = 10 + ri(r, -1, 0); // first gap column; columns gc..gc+2 face up after the turn
  const jStart: number[] = [], jEnd: number[] = [];
  for (let c = 0; c < SEGS; c++) { jStart.push(2 + ri(r, 0, 1)); jEnd.push(10 + ri(r, -1, 1)); }
  const inGap = (c: number, j: number) => c >= gc && c <= gc + 2 && j >= jStart[c] && j < jEnd[c];
  const outer = lathe(outerProf, SEGS, undefined, 0, Math.PI * 2, inGap);
  const inner = lathe(innerProf, SEGS);

  // Lathe space: axis +Y. World: axis along +X, base end at -L/2, slightly tipped.
  const y0 = R0 * 0.35;
  const M = new THREE.Matrix4().compose(V(-L / 2, y0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2 - 0.035)), V(1, 1, 1));
  const place = <G extends THREE.BufferGeometry>(g: G) => { g.applyMatrix4(M); return g; };

  displace(place(outer), 0.04, 1.5, seed);
  kit.add(paintStone(outer, seed, 0.8), matte());
  displace(place(inner), 0.04, 1.5, seed);
  kit.add(paint(inner, 0x6f6655, { vary: 0.1, seed, ao: 0.5, aoHeight: 0.6 }), matteBack());

  const lp = (a: number, yf: number, rad: number) => V(Math.sin(a) * rad, yf * L, Math.cos(a) * rad);
  // Spiral ribs across the shell (they bridge the crack like tendons).
  for (let k = 0; k < 2; k++) {
    const a0 = r() * Math.PI * 2, pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const yf = lerp(0.05, 0.85, i / 10);
      pts.push(lp(a0 + 2.4 * (i / 10) * (k ? -1 : 1), yf, rAt(yf) * 0.97 + 0.045));
    }
    const g = place(sweep(pts, { segments: 30, radial: 4, radius: (t) => 0.06 * Math.min(1.2, R0) * (1 - 0.6 * t) }));
    displace(g, 0.03, 1.5, seed);
    kit.add(paintStone(g, seed, 0.8), matte());
  }
  // Glow along the crack lips and inside.
  const colA = (c: number) => (c / SEGS) * Math.PI * 2;
  for (const c of [gc, gc + 3]) {
    const pts: THREE.Vector3[] = [];
    const a = colA(c) + (c === gc ? 0.08 : -0.08);
    for (let i = 0; i <= 6; i++) {
      const yf = lerp(0.16, 0.62, i / 6);
      pts.push(lp(a, yf, rAt(yf) * 0.92));
    }
    kit.add(place(seam(pts, 0.04, 16)), tealSeam());
  }
  for (let i = 0; i < 3; i++) {
    const yf = rr(r, 0.2, 0.6), a = colA(gc + 1.5) + (r() < 0.5 ? 1 : -1) * rr(r, 0.9, 1.3);
    const p = lp(a, yf, rAt(yf) * 0.8);
    kit.add(place(xf(new THREE.OctahedronGeometry(0.1 + R0 * 0.06, 0), p.x, p.y, p.z, r(), r(), r(), 1, 1.8, 0.8)), glow(PALETTE.teal, 2.4));
  }
  // Coral growths near the tip.
  for (let i = 0; i < 3; i++) {
    const yf = rr(r, 0.72, 0.9), a = colA(gc + 1.5) + rr(r, -1.2, 1.2);
    const b = lp(a, yf, rAt(yf) * 0.9);
    const out = V(Math.sin(a), 0, Math.cos(a));
    const len = rr(r, 0.4, 0.8) * Math.min(1.3, R0 + 0.3);
    const pts = [b, b.clone().addScaledVector(out, len * 0.5).add(V(0, len * 0.2, 0)), b.clone().addScaledVector(out, len).add(V(0, len * 0.5, 0))];
    kit.add(paintStone(place(sweep(pts, { segments: 5, radial: 4, radius: (t) => 0.07 * (1 - 0.85 * t) })), seed), matte());
  }
  // Sand drifted along the sides and over the base.
  for (let i = 0; i < 5; i++) {
    const x = lerp(-L / 2, L * 0.3, i / 4) + rr(r, -0.3, 0.3), side = i % 2 ? 1 : -1;
    const g = lump(r, 1, 1);
    xf(g, x, 0, side * (R0 * 0.85 + 0.1), 0, r() * 3, 0, R0 * rr(r, 1.4, 2.2), R0 * 0.45, R0 * 0.9);
    kit.add(paint(g, PALETTE.sand, { vary: 0.05, seed: seed + i, ao: 0.1 }), matte());
  }
  return kit.build('azalos-fallen-spire');
}

/** A round pale-stone plaza floor, top surface at y = 0.03. Inlaid curving teal lines. */
export function azalosFloorDisc(radius: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const R = Math.max(0.8, radius);
  const K = Math.max(3, Math.round(R * 1.2));
  const S = Math.min(56, Math.max(28, Math.round(R * 10)));
  const TOP = 0.03;
  const vert = (k: number, s: number) => {
    const th = ((s % S) / S) * Math.PI * 2;
    let rad = (R * k) / K;
    if (k === K) rad *= 1 - 0.06 * noise3(Math.cos(th) * 3, Math.sin(th) * 3, 0, seed + 4);
    const x = Math.sin(th) * rad, z = Math.cos(th) * rad;
    const y = TOP - 0.012 * noise3(x * 0.8, 0, z * 0.8, seed + 8);
    return V(x, y, z);
  };
  const pos: number[] = [];
  const e1 = V(), e2 = V(), nn = V();
  const push = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, dir: THREE.Vector3) => {
    e1.subVectors(b, a); e2.subVectors(c, a); nn.crossVectors(e1, e2);
    if (nn.dot(dir) < 0) pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    else pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const centre = V(0, TOP, 0);
  for (let s = 0; s < S; s++) {
    push(centre, vert(1, s), vert(1, s + 1), UP);
    for (let k = 1; k < K; k++) {
      const a = vert(k, s), b = vert(k, s + 1), c = vert(k + 1, s + 1), d = vert(k + 1, s);
      push(a, b, d, UP); push(b, c, d, UP);
    }
    // bevelled rim, down into the ground
    const a = vert(K, s), b = vert(K, s + 1);
    const c = b.clone().multiplyScalar(1.03).setY(-0.08), d = a.clone().multiplyScalar(1.03).setY(-0.08);
    const out = a.clone().add(b).setY(0).normalize();
    push(a, b, d, out); push(b, c, d, out);
  }
  let disc: THREE.BufferGeometry = new THREE.BufferGeometry();
  disc.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const base = new THREE.Color(0xc9bea6), stain = new THREE.Color(PALETTE.sand), tmp = new THREE.Color();
  disc = paintFn(disc, (x, y, z, out) => {
    const rad = Math.hypot(x, z);
    const band = Math.floor((rad / R) * K * 2);
    out.copy(base).multiplyScalar(1 + (band % 2 ? 0.035 : -0.02) + 0.05 * snoise3(x * 1.4, 0, z * 1.4, seed));
    const worn = smooth(0.45, 0.8, noise3(x * 0.35, 1, z * 0.35, seed + 2)) * 0.55 + smooth(0.8, 1.0, rad / R) * 0.3;
    out.lerp(tmp.copy(stain), worn);
    if (y < 0) out.multiplyScalar(0.8);
  });
  kit.add(disc, matte());

  // Inlaid lines.
  const LY = TOP + 0.008;
  const circle = (rad: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; pts.push(V(Math.sin(a) * rad, LY, Math.cos(a) * rad)); }
    return ribbon(pts, 0.07, 64, UP, false, true);
  };
  kit.add(circle(R * 0.86), tealLine());
  if (R > 1.5) kit.add(circle(R * 0.2), tealLine());
  const arms = R > 3 ? 5 : 3;
  const a0 = r() * Math.PI * 2;
  for (let i = 0; i < arms; i++) {
    const th0 = a0 + (i / arms) * Math.PI * 2, sw = rr(r, 1.2, 1.8);
    const armPts = (t0: number, t1: number) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 6; k++) {
        const t = lerp(t0, t1, k / 6), rad = lerp(R * 0.22, R * 0.84, t), th = th0 + sw * t * t;
        pts.push(V(Math.sin(th) * rad, LY, Math.cos(th) * rad));
      }
      return pts;
    };
    if (r() < 0.4) {
      const g0 = rr(r, 0.35, 0.55);
      kit.add(ribbon(armPts(0, g0), 0.06, 14), tealLine());
      kit.add(ribbon(armPts(g0 + 0.12, 1), 0.06, 14), tealLine());
    } else {
      kit.add(ribbon(armPts(0, 1), 0.06, 24), tealLine());
    }
    // a small curl beside each arm
    const thc = th0 + sw * 0.5 + 0.35, rc = R * 0.62, cp: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) {
      const a = thc + k * 0.7, rr0 = R * 0.09 * (1 - k / 9);
      cp.push(V(Math.sin(thc) * rc + Math.sin(a) * rr0, LY, Math.cos(thc) * rc + Math.cos(a) * rr0));
    }
    kit.add(ribbon(cp, 0.045, 14), tealLine());
  }
  const g = kit.build('azalos-floor-disc');
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = false; });
  return g;
}

// ================================================================ Miner (ancient)

const MINER_STONE = 0x7a6e60;
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
  xf(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
const cyl = (rt: number, rb: number, h: number, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg, 1);

function paintMetal(g: THREE.BufferGeometry, seed: number, hex: number = PALETTE.minerMetal, rust = 0.3) {
  return paint(g, hex, { vary: 0.12, freq: 2, seed, ao: 0.3, aoHeight: 0.8, stain: PALETTE.rust, stainAmount: rust });
}

/** Place a box between two points (a beam, a pole). */
function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, d = w): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(w, len, d);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1)));
  return g;
}
function pole(a: THREE.Vector3, b: THREE.Vector3, rad: number, seg = 5): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = cyl(rad * 0.9, rad, len, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1)));
  return g;
}

/**
 * An ancient miner structure, ruined. Rectangular, w (X) by d (Z), walls up to h.
 * Doorway gap in the +Z wall. Ladder on the +X side, pipes on the -X side (each adds ~0.4 m).
 */
export function minerRuin(w: number, d: number, h: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const W = Math.max(2, w), D = Math.max(2, d), Hh = Math.max(1.5, h);

  // Foundation slab.
  const slab = box(W + 0.4, 0.3, D + 0.4, 0, 0.02, 0);
  kit.add(paint(slab, 0x6c6155, { vary: 0.1, seed, ao: 0.2 }), matte());

  // Rough-cut stone courses around the edge, ruined to uneven heights.
  const doorX = rr(r, -W * 0.2, W * 0.2);
  const sides = [
    { a: V(-W / 2, 0, -D / 2), b: V(W / 2, 0, -D / 2), n: V(0, 0, -1) },
    { a: V(W / 2, 0, -D / 2), b: V(W / 2, 0, D / 2), n: V(1, 0, 0) },
    { a: V(W / 2, 0, D / 2), b: V(-W / 2, 0, D / 2), n: V(0, 0, 1) },
    { a: V(-W / 2, 0, D / 2), b: V(-W / 2, 0, -D / 2), n: V(-1, 0, 0) },
  ];
  const CH = 0.45;
  sides.forEach((sd, si) => {
    const len = sd.a.distanceTo(sd.b), dir = sd.b.clone().sub(sd.a).normalize();
    const ang = Math.atan2(-dir.z, dir.x);
    let u = 0;
    while (u < len - 0.05) {
      const bl = Math.min(len - u, rr(r, 0.7, 1.1));
      const mid = sd.a.clone().addScaledVector(dir, u + bl / 2).addScaledVector(sd.n, -0.25);
      u += bl;
      if (si === 2 && Math.abs(mid.x - doorX) < 0.7) continue;
      const nC = Math.max(0, Math.min(3, Math.round(3 * (0.3 + 0.9 * noise3(mid.x * 0.6, 0, mid.z * 0.6, seed)))));
      for (let c = 0; c < nC; c++) {
        const g = box(bl - 0.04, CH - 0.03, 0.5, 0, 0, 0, rr(r, -0.03, 0.03), rr(r, -0.04, 0.04), rr(r, -0.03, 0.03));
        xf(g, mid.x + rr(r, -0.03, 0.03), 0.17 + CH / 2 + c * CH, mid.z + rr(r, -0.03, 0.03), 0, ang, 0);
        kit.add(paint(g, MINER_STONE, { vary: 0.08, seed: seed + c * 13 + Math.floor(u * 7), ao: 0.35, aoHeight: 1.0, stain: 0x8f7a5c, stainAmount: 0.6 }), matte());
      }
    }
  });

  // Metal columns (I-beams), some snapped.
  const colPos: THREE.Vector3[] = [V(-W / 2, 0, -D / 2), V(W / 2, 0, -D / 2), V(W / 2, 0, D / 2), V(-W / 2, 0, D / 2)];
  if (W > 3.5) colPos.push(V(0, 0, -D / 2), V(0, 0, D / 2));
  const colH = colPos.map(() => (r() < 0.35 ? Hh * rr(r, 0.4, 0.75) : Hh));
  colPos.forEach((p, i) => {
    const hc = colH[i];
    const x = p.x * 0.96, z = p.z * 0.96;
    kit.add(paintMetal(box(0.26, hc, 0.05, x, hc / 2, z + 0.1), seed + i), metal());
    kit.add(paintMetal(box(0.26, hc, 0.05, x, hc / 2, z - 0.1), seed + i), metal());
    kit.add(paintMetal(box(0.05, hc, 0.2, x, hc / 2, z), seed + i), metal());
  });
  // Ring beams between standing columns, and a collapsed one.
  const idxPairs: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0]];
  if (W > 3.5) idxPairs.splice(0, 1, [0, 4], [4, 1]), idxPairs.splice(3, 1, [2, 5], [5, 3]);
  let collapsed = false;
  for (const [a, b] of idxPairs) {
    const pa = colPos[a].clone().multiplyScalar(0.96), pb = colPos[b].clone().multiplyScalar(0.96);
    if (colH[a] >= Hh && colH[b] >= Hh) {
      kit.add(paintMetal(beam(pa.clone().setY(Hh - 0.12), pb.clone().setY(Hh - 0.12), 0.2, 0.26), seed), metal());
    } else if (!collapsed && (colH[a] >= Hh || colH[b] >= Hh)) {
      collapsed = true;
      const top = (colH[a] >= Hh ? pa : pb).clone().setY(Hh - 0.15);
      const foot = (colH[a] >= Hh ? pb : pa).clone().lerp(top, 0.15).setY(0.1);
      kit.add(paintMetal(beam(top, foot, 0.2, 0.26), seed + 5), metal());
    }
  }
  // Cross beams over the back half, with a few roof grating panels.
  const zb = -D * 0.1;
  kit.add(paintMetal(beam(V(-W / 2, Hh - 0.1, zb), V(W / 2, Hh - 0.1, zb), 0.18, 0.2), seed + 2), metal());
  const nRoof = ri(r, 1, 3);
  for (let i = 0; i < nRoof; i++) {
    const x0 = lerp(-W / 2 + 0.6, W / 2 - 0.6, (i + 0.5) / nRoof) + rr(r, -0.2, 0.2);
    const sag = i === nRoof - 1 && r() < 0.6 ? rr(r, 0.25, 0.5) : 0;
    const g = box(rr(r, 0.9, 1.3), 0.05, D * 0.45, x0, Hh + 0.02 - sag * 0.5, -D * 0.3, sag, rr(r, -0.05, 0.05), 0);
    kit.add(paintMetal(g, seed + 20 + i, 0x55504a), metal());
  }
  // Upper wall sheets on some sides, some missing, one fallen.
  for (let si = 0; si < 4; si++) {
    if (r() < 0.3) continue;
    const sd = sides[si], len = sd.a.distanceTo(sd.b), dir = sd.b.clone().sub(sd.a).normalize();
    const ang = Math.atan2(-dir.z, dir.x);
    const n = Math.floor(len / 0.95);
    for (let k = 0; k < n; k++) {
      if (r() < 0.45) continue;
      const mid = sd.a.clone().addScaledVector(dir, (k + 0.5) * (len / n)).addScaledVector(sd.n, -0.05);
      if (si === 2 && Math.abs(mid.x - doorX) < 0.7) continue;
      const ph = rr(r, 0.6, Hh - 1.5);
      if (ph < 0.3) continue;
      const g = box(len / n - 0.06, ph, 0.04, 0, 0, 0, rr(r, -0.06, 0.06), 0, rr(r, -0.04, 0.04));
      xf(g, mid.x, 1.45 + ph / 2, mid.z, 0, ang, 0);
      kit.add(paintMetal(g, seed + si * 10 + k, 0x5a5048, 0.7), metal());
    }
  }
  const fallen = box(0.9, 0.04, 1.4, rr(r, -W * 0.3, W * 0.3), 0.2, D / 2 + 0.9, 0.12, r() * 3, 0.05);
  kit.add(paintMetal(fallen, seed + 40, 0x5a5048, 0.8), metal());

  // Pipes on the -X side.
  const px = -W / 2 - 0.38, py = Hh * 0.55;
  const pz0 = -D * 0.42, pz1 = D * rr(r, 0.1, 0.35);
  kit.add(paintMetal(pole(V(px, py, pz0), V(px, py, pz1), 0.1, 7), seed + 50), metal());
  kit.add(paintMetal(pole(V(px, 0, pz0), V(px, py + 0.1, pz0), 0.1, 7), seed + 51), metal());
  kit.add(paintMetal(xf(cyl(0.15, 0.15, 0.08, 7), px, py, pz1 - 0.02, Math.PI / 2, 0, 0), seed + 52), metal());
  const py2 = py + 0.3, pz2 = D * rr(r, -0.15, 0.05);
  kit.add(paintMetal(pole(V(px + 0.05, py2, pz0), V(px + 0.05, py2, pz2), 0.06, 6), seed + 53), metal());
  kit.add(paintMetal(pole(V(px + 0.05, py2, pz2), V(px - 0.15, py2 - 0.5, pz2 + 0.25), 0.06, 6), seed + 54), metal());
  for (const z of [pz0 + 0.5, (pz0 + pz1) / 2]) kit.add(paintMetal(box(0.35, 0.06, 0.06, px + 0.18, py, z), seed + 55), metal());

  // Ladder up the +X side.
  const lx = W / 2 + 0.12, lz = rr(r, -D * 0.25, D * 0.25), lh = Math.min(Hh, Math.max(...colH));
  kit.add(paintMetal(box(0.05, lh, 0.05, lx, lh / 2, lz - 0.22), seed + 60), metal());
  kit.add(paintMetal(box(0.05, lh * 0.8, 0.05, lx, lh * 0.4, lz + 0.22), seed + 61), metal());
  for (let y = 0.3; y < lh * 0.8; y += 0.32) {
    if (r() < 0.12) continue;
    kit.add(paintMetal(box(0.04, 0.04, 0.46, lx, y, lz), seed + 62), metal());
  }

  // An old tank lying inside the back corner.
  const tx = rr(r, -W * 0.25, W * 0.2), tz = -D * 0.22;
  kit.add(paintMetal(xf(cyl(0.45, 0.45, 1.4, 10), tx, 0.62, tz, 0, 0, Math.PI / 2), seed + 70, 0x5c4c3e, 0.8), metal());
  for (const o of [-0.45, 0.45]) kit.add(paintMetal(xf(cyl(0.48, 0.48, 0.07, 10), tx + o, 0.62, tz, 0, 0, Math.PI / 2), seed + 71), metal());

  // Rubble.
  const nr = ri(r, 5, 8);
  for (let i = 0; i < nr; i++) {
    const a = r() * Math.PI * 2;
    const x = Math.cos(a) * (W / 2 + rr(r, -0.8, 0.5)), z = Math.sin(a) * (D / 2 + rr(r, -0.8, 0.5));
    rubble(kit, r, x, z, rr(r, 0.2, 0.45), MINER_STONE, seed + i);
  }
  return kit.build('miner-ruin');
}

// ================================================================ Mi'naa (modern)

const WOOD = 0x6f5236;
const SALVAGE = [PALETTE.rust, 0x9a7a4e, 0x5f8a82, 0x6d665c, PALETTE.cloth, 0xa8977a, 0x7a5a3e];

/**
 * A patched Mi'naa shack, w (X) by d (Z). Door and awning on the +Z side (awning adds 1.3 m),
 * lean-to on the -X side (adds 1.1 m). Walls about 2.3 m, roof slopes down to the back.
 */
export function minaaShack(w: number, d: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const W = Math.max(1.8, w), D = Math.max(1.6, d);
  const HF = 2.35, HB = 1.95;
  const topAtZ = (z: number) => lerp(HB, HF, (z + D / 2) / D);

  // Corner posts.
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]]) {
    const h = topAtZ(z) + 0.05;
    kit.add(paint(box(0.12, h, 0.12, x, h / 2, z, 0, rr(r, -0.1, 0.1), rr(r, -0.02, 0.02)), WOOD, { seed, vary: 0.1 }), matte());
  }
  // Walls of salvaged panels.
  const doorX = rr(r, -W * 0.2, W * 0.15);
  const walls = [
    { a: V(-W / 2, 0, D / 2), b: V(W / 2, 0, D / 2), n: V(0, 0, 1), front: true },
    { a: V(W / 2, 0, D / 2), b: V(W / 2, 0, -D / 2), n: V(1, 0, 0), front: false },
    { a: V(W / 2, 0, -D / 2), b: V(-W / 2, 0, -D / 2), n: V(0, 0, -1), front: false },
    { a: V(-W / 2, 0, -D / 2), b: V(-W / 2, 0, D / 2), n: V(-1, 0, 0), front: false },
  ];
  for (const wl of walls) {
    const len = wl.a.distanceTo(wl.b), dir = wl.b.clone().sub(wl.a).normalize();
    const ang = Math.atan2(-dir.z, dir.x);
    let u = 0.06;
    while (u < len - 0.1) {
      const pw = Math.min(len - 0.06 - u, rr(r, 0.6, 1.05));
      const mid = wl.a.clone().addScaledVector(dir, u + pw / 2);
      u += pw;
      if (wl.front && Math.abs(mid.x - doorX) < 0.5) continue;
      const top = topAtZ(mid.z) - rr(r, 0, 0.12);
      const col = pick(r, SALVAGE);
      const isMetal = col === PALETTE.rust || col === 0x6d665c || col === 0x5f8a82;
      if (isMetal) {
        // corrugated sheet, faced outwards
        const cg = corrugated(pw + 0.04, top, col, seed + Math.floor(u * 10));
        xf(cg, 0, 0, 0, rr(r, -0.03, 0.03), 0, rr(r, -0.025, 0.025));
        xf(cg, mid.x + wl.n.x * 0.03, top / 2, mid.z + wl.n.z * 0.03, 0, Math.atan2(wl.n.x, wl.n.z), 0);
        kit.add(cg, matte2());
      } else {
        // phase 3 (C-015): boards, not one flat slab. A dark backing shows in the gaps between them;
        // each board has its own tone and length, darker and dustier at the foot.
        const back = box(pw + 0.04, top, 0.02, 0, 0, 0, 0, 0, 0);
        xf(back, mid.x - wl.n.x * 0.02, top / 2, mid.z - wl.n.z * 0.02, 0, ang, 0);
        kit.add(paint(back, 0x2e2620, { seed, vary: 0.05, ao: 0 }), matte());
        const nb = Math.max(2, Math.round(pw / rr(r, 0.2, 0.28)));
        const bw = (pw + 0.04) / nb;
        const lean = rr(r, -0.03, 0.03);
        for (let k = 0; k < nb; k++) {
          const bh = top - rr(r, 0, 0.14) * (r() < 0.4 ? 1 : 0);
          const off = (k + 0.5) * bw - (pw + 0.04) / 2;
          const g = box(bw - 0.025, bh, 0.045, 0, 0, 0, lean + rr(r, -0.01, 0.01), 0, rr(r, -0.012, 0.012));
          xf(g, mid.x + dir.x * off + wl.n.x * rr(r, 0.005, 0.02), bh / 2, mid.z + dir.z * off + wl.n.z * rr(r, 0.005, 0.02), 0, ang, 0);
          const bc = new THREE.Color(col).multiplyScalar(rr(r, 0.82, 1.12)).getHex();
          kit.add(paint(g, bc, { seed: seed + Math.floor(u * 10) + k, vary: 0.1, ao: 0.55, aoHeight: 0.7, dust: PALETTE.sand }), matte());
        }
      }
      if (r() < 0.3) {
        // a patch nailed over the panel
        const ps = rr(r, 0.3, 0.5), py = rr(r, 0.5, top - 0.4);
        const pg = box(ps, ps * rr(r, 0.7, 1.2), 0.03, 0, 0, 0, 0, 0, rr(r, -0.2, 0.2));
        xf(pg, mid.x + wl.n.x * 0.05 + dir.x * rr(r, -0.2, 0.2), py, mid.z + wl.n.z * 0.05 + dir.z * rr(r, -0.2, 0.2), 0, ang, 0);
        kit.add(paint(pg, pick(r, SALVAGE), { seed: seed + 3, vary: 0.1 }), matte());
      }
    }
  }
  // Doorway: a dark curtain hung in the gap, pulled to one side.
  kit.add(paint(box(0.95, 2.0, 0.03, doorX, 1.0, D / 2 - 0.06), 0x2e2620, { seed, vary: 0.05, ao: 0 }), matte());
  kit.add(paint(box(0.35, 1.85, 0.06, doorX - 0.34, 1.07, D / 2 + 0.02, 0, 0, 0.04), pick(r, [PALETTE.cloth, 0x5f8a82, PALETTE.rust]), { seed, vary: 0.15 }), matte());
  kit.add(paint(box(1.05, 0.08, 0.08, doorX, 2.05, D / 2 + 0.03), WOOD, { seed }), matte());
  // A shuttered window on the +X side.
  const wz = rr(r, -D * 0.25, D * 0.1);
  kit.add(paint(box(0.04, 0.45, 0.55, W / 2 + 0.04, 1.45, wz), 0x2a221c, { seed, ao: 0 }), matte());
  kit.add(paint(xf(box(0.03, 0.5, 0.6, 0, 0.25, 0), W / 2 + 0.07, 1.68, wz, 0, 0, -0.6), 0x8a6a4a, { seed, vary: 0.15 }), matte());

  // Roof: corrugated sheets sloping to the back, weighed down with stones.
  const slope = Math.atan2(HF - HB, D + 0.6);
  const rl = Math.hypot(HF - HB, D + 0.6) + 0.1;
  const n = Math.ceil((W + 0.5) / 0.85);
  for (let i = 0; i < n; i++) {
    const x = lerp(-W / 2 - 0.2, W / 2 + 0.2, (i + 0.5) / n);
    const col = pick(r, [0x6d665c, PALETTE.rust, 0x8c7a5a, 0x5c5a52]);
    // real corrugated sheet (phase 2: flat boxes with painted stripes read as clean toy roofs)
    const g = corrugated((W + 0.5) / n + 0.1, rl, col, seed + i);
    g.rotateX(-Math.PI / 2);
    xf(g, x, (HF + HB) / 2 + 0.1 + i * 0.012, 0, slope, rr(r, -0.03, 0.03), rr(r, -0.02, 0.02));
    kit.add(g, matte2());
  }
  const roofY = (z: number) => lerp(HB, HF, (z + D / 2 + 0.3) / (D + 0.6)) + 0.13;
  const pz = rr(r, -D * 0.3, D * 0.2);
  kit.add(paint(box(rr(r, 0.7, 1.1), 0.04, rr(r, 0.6, 0.9), rr(r, -W * 0.3, W * 0.3), roofY(pz) + 0.03, pz, slope, rr(r, -0.4, 0.4), 0), pick(r, SALVAGE), { seed: seed + 9 }), metal());
  for (let i = 0; i < 3; i++) {
    const z = rr(r, -D / 2, D / 2), s = rr(r, 0.18, 0.28);
    const g = xf(lump(r, s, 0), rr(r, -W / 2, W / 2), roofY(z) + s * 0.2, z, r() * 3, r() * 3, 0, 1, 0.6, 1);
    kit.add(paint(g, 0x8a7a66, { seed: seed + i, vary: 0.1, ao: 0 }), matte());
  }

  // Awning over the front.
  const ax0 = -W / 2 + 0.1, ax1 = W / 2 - 0.1, az0 = D / 2 + 0.05, az1 = D / 2 + 1.25, ay0 = HF - 0.15, ay1 = 1.95;
  for (const x of [ax0 + 0.05, ax1 - 0.05]) kit.add(paint(pole(V(x, 0, az1), V(x + rr(r, -0.05, 0.05), ay1 + 0.08, az1), 0.045), WOOD, { seed }), matte());
  // torn canvas instead of phase 1's striped awning
  const aw = tornCanvas(r, ax1 - ax0, az1 - az0, ay1, ay0, pick(r, [0xa4502e, 0xc8904a, 0x8c5a3a, 0x6a8a82]), seed + 50);
  aw.translate((ax0 + ax1) / 2, 0, (az0 + az1) / 2);
  kit.add(aw, matte2());

  // Lean-to on the -X side, with crates under it.
  const lx0 = -W / 2, lx1 = -W / 2 - 1.05, lz = rr(r, -D * 0.2, D * 0.1);
  for (const z of [lz - 0.65, lz + 0.65]) kit.add(paint(pole(V(lx1 + 0.05, 0, z), V(lx1 + 0.05, 1.15, z), 0.04), WOOD, { seed }), matte());
  const lt = Math.atan2(1.7 - 1.1, 1.05);
  kit.add(paintMetal(box(1.2, 0.04, 1.5, (lx0 + lx1) / 2, 1.42, lz, 0, 0, lt), seed + 30, 0x6d665c, 0.7), metal());
  for (let i = 0; i < 3; i++) {
    const s = rr(r, 0.4, 0.55);
    kit.add(paint(box(s, s, s, lx0 - 0.4 + rr(r, -0.1, 0.1), s / 2 + (i === 2 ? 0.5 : 0), lz + (i === 2 ? 0 : (i ? 0.3 : -0.3)), 0, rr(r, -0.3, 0.3), 0), 0x8a6a44, { seed: seed + i, vary: 0.12 }), matte());
  }
  // Stovepipe, water barrel, antenna.
  const cx = rr(r, -W * 0.3, W * 0.3), cz = -D * 0.2;
  const cy = roofY(cz);
  kit.add(paintMetal(xf(cyl(0.08, 0.08, 0.9, 7), cx, cy + 0.4, cz), seed + 40), metal());
  kit.add(paintMetal(xf(new THREE.ConeGeometry(0.16, 0.14, 7), cx, cy + 0.9, cz), seed + 41), metal());
  const bx = W / 2 + 0.35, bz = D / 2 - 0.2;
  kit.add(paintMetal(xf(cyl(0.3, 0.28, 0.85, 10), bx, 0.425, bz), seed + 42, 0x5f8a82, 0.5), metal());
  for (const y of [0.2, 0.65]) kit.add(paintMetal(xf(cyl(0.315, 0.315, 0.05, 10), bx, y, bz), seed + 43), metal());
  const ant0 = V(W / 2 - 0.3, roofY(-D / 2 + 0.4), -D / 2 + 0.4);
  const ant1 = ant0.clone().add(V(0.1, 1.2, 0.05)), ant2 = ant1.clone().add(V(-0.2, 0.5, 0));
  kit.add(paintMetal(pole(ant0, ant1, 0.025, 4), seed + 44), metal());
  kit.add(paintMetal(pole(ant1, ant2, 0.02, 4), seed + 45), metal());
  kit.add(paintMetal(xf(new THREE.ConeGeometry(0.22, 0.1, 8, 1, true), ant1.x - 0.05, ant1.y - 0.1, ant1.z + 0.12, -1.1, 0, 0), seed + 46, 0x8c7a5a), matte2());
  return kit.build('minaa-shack');
}

/** Wooden scaffolding, w (X) by 1.2 m (Z), h tall. */
export function scaffold(w: number, h: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const W = Math.max(1.2, w), H = Math.max(1.2, h), D = 1.2;
  const nx = Math.max(2, Math.ceil(W / 1.5) + 1);
  const woodC = 0x86623f, plankC = 0xa98559;
  const pw = (g: THREE.BufferGeometry, c = woodC) => kit.add(paint(g, c, { seed: seed + Math.floor(r() * 99), vary: 0.12, ao: 0.3, aoHeight: 0.6 }), matte());
  const xs: number[] = [];
  for (let i = 0; i < nx; i++) xs.push(lerp(-W / 2, W / 2, i / (nx - 1)));
  for (const x of xs) for (const z of [-D / 2, D / 2]) {
    const top = H + rr(r, 0.1, 0.45);
    pw(pole(V(x, -0.1, z), V(x + rr(r, -0.06, 0.06), top, z + rr(r, -0.04, 0.04)), 0.055));
  }
  const levels: number[] = [];
  for (let y = 1.3; y <= H + 0.05; y += 1.3) levels.push(Math.min(y, H));
  if (!levels.length || levels[levels.length - 1] < H - 0.4) levels.push(H);
  for (const y of levels) {
    for (const z of [-D / 2, D / 2]) pw(pole(V(-W / 2 - 0.15, y, z + 0.06), V(W / 2 + 0.15, y + rr(r, -0.04, 0.04), z + 0.06), 0.04));
    for (const x of xs) pw(pole(V(x + 0.06, y - 0.05, -D / 2 - 0.12), V(x + 0.06, y - 0.05, D / 2 + 0.12), 0.035));
  }
  // Diagonal braces on the back face.
  let yPrev = 0;
  levels.forEach((y, li) => {
    for (let i = 0; i < nx - 1; i++) {
      if (r() < 0.25) continue;
      const flip = (i + li) % 2 === 0;
      pw(pole(V(xs[flip ? i : i + 1], yPrev + 0.1, -D / 2 - 0.07), V(xs[flip ? i + 1 : i], y - 0.1, -D / 2 - 0.07), 0.03, 4));
    }
    yPrev = y;
  });
  // Plank decks, some boards missing.
  levels.forEach((y, li) => {
    if (li % 2 === 1 && li !== levels.length - 1) return;
    for (let k = 0; k < 4; k++) {
      if (r() < 0.15) continue;
      const z = lerp(-D / 2 + 0.15, D / 2 - 0.15, k / 3);
      pw(box(W + rr(r, -0.2, 0.3), 0.04, 0.26, rr(r, -0.1, 0.1), y + 0.02 + rr(r, 0, 0.02), z, 0, rr(r, -0.03, 0.03), rr(r, -0.01, 0.01)), plankC);
    }
  });
  // A ladder lashed to one end.
  const lx = -W / 2 - 0.3;
  pw(pole(V(lx, 0, -0.25), V(lx + 0.1, levels[0] + 0.5, -0.25), 0.03, 4));
  pw(pole(V(lx, 0, 0.25), V(lx + 0.1, levels[0] + 0.5, 0.25), 0.03, 4));
  for (let y = 0.3; y < levels[0] + 0.3; y += 0.35) pw(box(0.04, 0.04, 0.5, lx + (y / (levels[0] + 0.5)) * 0.1, y, 0));
  // A sun cloth over the top.
  if (r() < 0.7) {
    const cl = box(W * rr(r, 0.4, 0.7), 0.02, D + 0.3, rr(r, -W * 0.2, W * 0.2), H + 0.35, 0, 0.08, 0, rr(r, -0.1, 0.1));
    kit.add(paint(cl, pick(r, [0x5f8a82, PALETTE.rust, 0xa8906a]), { seed, vary: 0.1 }), matte2());
  }
  return kit.build('scaffold');
}

// ================================================================ Maker wreck

/**
 * A crashed Maker vessel section along X, nose buried at -length/2, torn stern at +length/2.
 * Torn opening on the +Z side. A broken fin reaches out on the -Z side.
 * Footprint about length x 0.45 length.
 */
export function makerWreck(length: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const L = Math.max(4, length);
  const R = Math.min(2.2, Math.max(0.6, L * 0.13));
  // Knuckle joints at uneven spacing, so it reads as grown rather than a row of segments.
  const J = [0.2, 0.34, 0.5, 0.62, 0.8].map((j) => j + rr(r, -0.03, 0.03));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    pts.push(V((u - 0.5) * L, lerp(-0.85 * R, 0.1 * R, u) + 0.3 * R * Math.sin(u * Math.PI) + (i === 6 ? 0.35 * R : 0), 0.06 * L * Math.sin(u * Math.PI * 1.3)));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const rad = (t: number, a: number) => {
    const nose = Math.pow(smooth(0, 0.35, t), 0.6) * 0.7 + 0.3;
    let knuck = 1.04;
    for (const j of J) knuck -= 0.1 * Math.exp(-(((t - j) / 0.028) ** 2));
    const up = Math.sin(a);
    const keel = 1 + 0.2 * Math.pow(Math.max(0, up), 10);
    const flat = 1 - 0.15 * Math.max(0, -up);
    const asym = 1 + 0.1 * Math.sin(a * 2 + t * 5 + seed) + 0.06 * Math.sin(a * 3 - t * 9);
    const flare = 1 + 0.35 * smooth(0.84, 1, t) + 0.1 * smooth(0.4, 0.55, t) * (1 - smooth(0.6, 0.75, t));
    let v = R * nose * knuck * keel * flat * asym * flare;
    if (t > 0.93) v *= 1 - 0.35 * noise3(a * 2.5, t * 40, 0, seed);
    return v;
  };
  const S = 30, RAD = 11;
  const tear = (i: number, j: number) => {
    const t = i / S, a = (j / RAD) * Math.PI * 2;
    const n = noise3(i * 0.6, j * 0.9, 0, seed + 11);
    return t > 0.4 + 0.06 * n && t < 0.66 + 0.06 * n && Math.cos(a) > 0.25 - 0.3 * n && Math.sin(a) > -0.45;
  };
  const hull = sweep(pts, { segments: S, radial: RAD, radius: rad, up: UP, capStart: true, skip: tear });
  displace(hull, 0.07, 1.4, seed);
  const hullC = new THREE.Color(PALETTE.makerMetal), verd = new THREE.Color(0x5d6b55), boneC = new THREE.Color(0x8b8a76), tmp = new THREE.Color();
  kit.add(paintFn(hull, (x, y, z, out) => {
    out.copy(hullC).lerp(verd, smooth(0.45, 0.8, noise3(x * 0.9, y * 0.9, z * 0.9, seed)) * 0.7);
    out.lerp(tmp.copy(boneC), smooth(0.7, 0.9, noise3(x * 2.2, y * 2.2, z * 2.2, seed + 3)) * 0.35);
    out.multiplyScalar((1 + 0.1 * snoise3(x * 3, y * 3, z * 3, seed + 1)) * (0.65 + 0.35 * smooth(-0.2, 1.2, y)));
  }), metal());
  const innerG = sweep(pts, { segments: 18, radial: 10, radius: (t, a) => rad(t, a) * 0.8, up: UP });
  kit.add(paint(innerG, 0x2a2f28, { vary: 0.15, seed, ao: 0.3, aoHeight: 1.0, stain: 0x5a3a20, stainAmount: 0.6 }), matteBack());

  // Frames matching the sweep.
  const T = V(), N = V(), B = V();
  const surf = (t: number, a: number, off = 0) => {
    const P = curve.getPointAt(t);
    curve.getTangentAt(t, T);
    N.crossVectors(T, UP).normalize();
    B.crossVectors(N, T).normalize();
    const rr0 = rad(t, a) + off;
    return P.addScaledVector(N, Math.cos(a) * rr0).addScaledVector(B, Math.sin(a) * rr0);
  };
  const amber = glow(PALETTE.makerAmber, 2.4);

  // Light leaking from the knuckle joints, in broken arcs.
  for (const t of J) {
    if (r() < 0.35) continue;
    const a0 = rr(r, -1, 2.5), span = rr(r, 0.6, 1.5);
    const ap: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (span * i) / 8;
      if (t > 0.38 && t < 0.7 && Math.cos(a) > 0) continue;
      ap.push(surf(t, a, 0.01));
    }
    if (ap.length >= 3) kit.add(seam(ap, 0.05, 14), amber);
  }
  // Short cracks leaking light along the flanks.
  for (let i = 0; i < 4; i++) {
    const t0 = rr(r, 0.1, 0.85), a = rr(r, Math.PI * 0.6, Math.PI * 1.4);
    kit.add(seam([surf(t0, a, 0.02), surf(t0 + 0.04, a + 0.15, 0.02), surf(t0 + 0.08, a + 0.05, 0.02)], 0.04, 8), amber);
  }
  // Glowing core inside the tear and the stern.
  const c1 = curve.getPointAt(0.53), c2 = curve.getPointAt(0.97);
  kit.add(xf(new THREE.IcosahedronGeometry(R * 0.35, 0), c1.x, c1.y - R * 0.1, c1.z + R * 0.1, 0, 0, 0, 1.8, 0.8, 1), glow(PALETTE.makerAmber, 3));
  kit.add(xf(new THREE.IcosahedronGeometry(R * 0.3, 0), c2.x - R * 0.3, c2.y, c2.z, 0, 0, 0, 1.2, 0.9, 1), glow(PALETTE.makerAmber, 3));

  // Ribs over the tear, knuckled like bone.
  for (const t of [0.46, 0.52, 0.58, 0.64]) {
    const rp: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) rp.push(surf(t + rr(r, -0.005, 0.005), lerp(-0.9, 1.3, i / 6), 0.03));
    const g = sweep(rp, { segments: 14, radial: 5, radius: (u) => R * 0.06 * (1 + 0.35 * Math.abs(Math.sin(u * Math.PI * 4))) });
    kit.add(paint(g, 0x8f8c78, { vary: 0.12, seed, ao: 0.2, stain: PALETTE.makerMetal, stainAmount: 0.5 }), matte());
  }
  // Dorsal thorns along the top, some snapped.
  for (let f = 0; f < 6; f++) {
    if (r() < 0.25) continue;
    const t = 0.12 + (0.7 * f) / 5 + rr(r, -0.05, 0.05);
    const hS = R * rr(r, 0.3, 0.9) * (r() < 0.25 ? 0.4 : 1);
    const lean = rr(r, -0.6, 0.6);
    const sh = new THREE.Shape();
    sh.moveTo(0.1 * hS, 0);
    sh.quadraticCurveTo(0.1 * hS, 0.6 * hS, -0.35 * hS, hS);
    sh.quadraticCurveTo(-0.2 * hS, 0.4 * hS, -0.55 * hS, 0);
    sh.lineTo(0.1 * hS, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.08 * Math.max(1, R), bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -0.04 * Math.max(1, R));
    const base = surf(t, Math.PI / 2 + lean, -0.05);
    curve.getTangentAt(t, T);
    N.crossVectors(T, UP).normalize();
    B.crossVectors(N, T).normalize();
    const out = N.clone().multiplyScalar(Math.cos(Math.PI / 2 + lean)).addScaledVector(B, Math.sin(Math.PI / 2 + lean));
    const sideV = V().crossVectors(T, out).normalize();
    g.applyMatrix4(new THREE.Matrix4().makeBasis(T.clone(), out, sideV).setPosition(base));
    kit.add(paintMetal(g, seed + f, 0x56604c, 0.1), metal());
  }
  // Coral ridges grown along the flanks, forking.
  for (const side of [-1, 1]) {
    const a = Math.PI / 2 + side * 1.25;
    const t0 = rr(r, 0.08, 0.2), t1 = side > 0 ? 0.38 : rr(r, 0.7, 0.88);
    const rp: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = lerp(t0, t1, i / 8);
      rp.push(surf(t, a + 0.25 * Math.sin(i * 1.1 + side), 0.02));
    }
    const g = sweep(rp, { segments: 24, radial: 5, radius: (u) => R * 0.08 * (0.5 + 0.5 * Math.sin(Math.PI * u)) * (1 + 0.3 * Math.abs(Math.sin(u * 20))) });
    kit.add(paint(g, 0x8f8c78, { vary: 0.12, seed, ao: 0, stain: 0x56604c, stainAmount: 0.6 }), matte());
    const tm = lerp(t0, t1, 0.5);
    const fork = [surf(tm, a, 0.02), surf(tm + 0.04, a + side * 0.5, 0.03), surf(tm + 0.07, a + side * 0.8, 0.02)];
    kit.add(paint(sweep(fork, { segments: 8, radial: 4, radius: (u) => R * 0.06 * (1 - 0.8 * u) }), 0x8f8c78, { vary: 0.12, seed, ao: 0 }), matte());
  }
  // Ridged plates over the flanks.
  for (let i = 0; i < 6; i++) {
    const t = rr(r, 0.12, 0.9), a = rr(r, Math.PI * 0.55, Math.PI * 1.35) * (r() < 0.3 ? -0.3 : 1);
    if (t > 0.38 && t < 0.7 && Math.cos(a) > 0.1) continue;
    const p = surf(t, a, -R * 0.02);
    curve.getTangentAt(t, T);
    const nrm = p.clone().sub(curve.getPointAt(t)).normalize();
    const side = V().crossVectors(T, nrm).normalize();
    const g = new THREE.IcosahedronGeometry(1, 0);
    g.scale(R * rr(r, 0.45, 0.7), R * 0.12, R * rr(r, 0.3, 0.45));
    g.applyMatrix4(new THREE.Matrix4().makeBasis(T.clone(), nrm, side).setPosition(p));
    kit.add(paintMetal(g, seed + 90 + i, 0x44523f, 0.15), metal());
  }
  // A broken fin reaching out on -Z and down into the sand, knuckled.
  const f0 = surf(0.3, Math.PI + 0.3, -0.1);
  const finPts = [f0, f0.clone().add(V(0.3, 0.35 * R, -0.9 * R)), f0.clone().add(V(0.6, 0.2 * R, -1.7 * R)), V(f0.x + 0.9, -0.2, f0.z - 2.3 * R)];
  const fin = sweep(finPts, { segments: 16, radial: 6, radius: (t, a) => R * 0.26 * (1 - 0.7 * t) * (1 + 0.25 * Math.abs(Math.sin(t * Math.PI * 5))) * (0.55 + 0.45 * Math.abs(Math.cos(a))) });
  displace(fin, 0.04, 2, seed + 5);
  kit.add(paintMetal(fin, seed + 5, PALETTE.makerMetal, 0.2), metal());
  kit.add(seam([finPts[0].clone().add(V(0, 0.15 * R, 0)), finPts[1].clone().add(V(0, 0.18 * R, 0)), finPts[2].clone().add(V(0, 0.1 * R, 0))], 0.035, 12), amber);

  // Sand banked against the hull and over the nose.
  for (let i = 0; i < 6; i++) {
    const t = i < 2 ? rr(r, 0, 0.12) : rr(r, 0.15, 0.95);
    const P = curve.getPointAt(t), side = i % 2 ? 1 : -1;
    const g = lump(r, 1, 1);
    xf(g, P.x, 0, P.z + side * R * (i < 2 ? 0.3 : 0.9), 0, r() * 3, 0, R * rr(r, 1.2, 2), R * 0.5, R * rr(r, 0.7, 1));
    kit.add(paint(g, PALETTE.sand, { vary: 0.05, seed: seed + i, ao: 0.1 }), matte());
  }
  // Fragments spilled from the tear.
  for (let i = 0; i < 3; i++) {
    const P = curve.getPointAt(rr(r, 0.45, 0.65));
    const g = box(rr(r, 0.3, 0.6), 0.05, rr(r, 0.2, 0.4), P.x + rr(r, -0.6, 0.6), 0.06, P.z + R * rr(r, 1.1, 1.8), rr(r, -0.2, 0.2), r() * 3, rr(r, -0.2, 0.2));
    kit.add(paintMetal(g, seed + 100 + i, PALETTE.makerMetal, 0.2), metal());
  }

  const g = kit.build('maker-wreck');
  const l1 = surf(0.53, 0, -R * 0.2);
  g.add(pointLight(PALETTE.makerAmber, 3, 6, l1.x, Math.max(0.4, l1.y), l1.z));
  const l2 = curve.getPointAt(0.99);
  g.add(pointLight(PALETTE.makerAmber, 2.5, 5, l2.x + 0.4, Math.max(0.4, l2.y), l2.z));
  return g;
}

// ================================================================ rocks, plants, debris

const ROCK_BANDS = [0xb89470, 0xcdb08c, 0xa47a58, 0xc29c74, 0x9c6e4c];

/**
 * Weathered desert sandstone, about `size` metres across, sunk a little into the ground.
 * A rounded block (superellipsoid), terraced into ledges along its bedding, split by one or two
 * vertical cracks, banded in ochre and bone, bleached on top and dusty at the foot.
 */
export function rock(size: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const s = Math.max(0.2, size);
  const small = s < 0.9;
  const g = new THREE.IcosahedronGeometry(1, small ? 1 : s < 2.4 ? 2 : 3);
  const p = g.attributes.position as THREE.BufferAttribute;
  const ex = rr(r, 3.4, 6);                      // how blocky: 2 is round, 4 is a soft cube
  const sx = rr(r, 0.8, 1.25), sy = rr(r, 0.45, 0.75), sz = rr(r, 0.75, 1.1);
  const layer = s * rr(r, 0.16, 0.24);             // bedding thickness
  const tilt = rr(r, -0.12, 0.12);                 // bedding is not quite level
  const cracks = small ? [] : Array.from({ length: ri(r, 1, 2) }, () => { const a = r() * Math.PI; return { nx: Math.cos(a), nz: Math.sin(a), d: rr(r, -0.3, 0.3) }; });
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const k = Math.pow(Math.pow(Math.abs(v.x), ex) + Math.pow(Math.abs(v.y), ex) + Math.pow(Math.abs(v.z), ex), -1 / ex);
    let x = v.x * k * sx * s * 0.5, y = v.y * k * sy * s * 0.5, z = v.z * k * sz * s * 0.5;
    // lumpy, with finer pitting
    const n1 = fbm3(x * 1.1 / s, y * 1.1 / s, z * 1.1 / s, seed, 3), n2 = snoise3(x * 5 / s, y * 5 / s, z * 5 / s, seed + 4);
    const push = 1 + n1 * 0.22 + n2 * 0.035;
    x *= push; z *= push; y *= 1 + n1 * 0.12;
    if (!small) {
      // ledges: each bed of stone steps in a little under the one above
      const yy = y + (x * tilt) + s * 0.5;
      const f = yy / layer - Math.floor(yy / layer);
      const inset = 1 - 0.12 * smooth(0.72, 1, f) - 0.06 * (1 - smooth(0, 0.2, f));
      x *= inset; z *= inset;
      // vertical cracks pull the surface in along a plane
      for (const c of cracks) {
        const side = x * c.nx + z * c.nz - c.d * s * 0.5;
        const cut = 1 - smooth(0, s * 0.07, Math.abs(side));
        const sg = side < 0 ? -1 : 1;
        x -= c.nx * cut * s * 0.06 * sg;
        z -= c.nz * cut * s * 0.06 * sg;
        y -= cut * s * 0.02;
      }
    }
    // weathered flat top
    const top = s * sy * 0.42;
    if (y > top) y = top + (y - top) * 0.35;
    p.setXYZ(i, x, y + s * sy * 0.28, z);
  }
  p.needsUpdate = true;
  const bands = ROCK_BANDS.map((h) => new THREE.Color(h));
  const base = r() * 5;
  const dustC = new THREE.Color(PALETTE.sand), bleach = new THREE.Color(0xe2cfb0);
  const painted = paintFn(g, (x, y, z, out) => {
    const band = (y + x * tilt) / layer + base + fbm3(x * 0.6 / s, y * 2 / s, z * 0.6 / s, seed + 2) * 0.5;
    const bi = ((Math.floor(band) % bands.length) + bands.length) % bands.length;
    out.copy(bands[bi]).lerp(bands[(bi + 1) % bands.length], smooth(0.7, 1, band - Math.floor(band)) * 0.6);
    // grooves at the bed lines read darker, like the shadowed seams in the paintings
    const f = band - Math.floor(band);
    out.multiplyScalar(0.82 + 0.18 * smooth(0, 0.15, f));
    const h01 = clamp01(y / (s * 0.9));
    out.lerp(bleach, smooth(0.55, 1, h01) * 0.35);
    out.lerp(dustC, (1 - smooth(0, 0.3, h01)) * 0.45);
    out.multiplyScalar(0.72 + 0.28 * smooth(0, 0.35, h01));
  });
  kit.add(painted, rockMat());
  return kit.build('rock');
}

/** Sandstone keeps crisp ledges (crease 42) but smooth faces. */
let _rockMat: THREE.MeshStandardMaterial | null = null;
function rockMat() {
  if (!_rockMat) { _rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }); _rockMat.userData.crease = 42; _rockMat.userData.surface = 'rock'; }
  return _rockMat;
}

/** A desert or oasis plant. Sizes 0.3 to 2.5 m, spire-root about 3.5 m, sun-date about 3.5 m. */
export function plant(type: PlantType, seed = 1): THREE.Object3D {
  return buildPlant(type, seed);
}

/** Scattered scrap and stones within about 1 m of the origin. */
export function debris(seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const n = ri(r, 3, 5);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = rr(r, 0, 0.9);
    rubble(kit, r, Math.cos(a) * d, Math.sin(a) * d, rr(r, 0.1, 0.3), pick(r, [0x9a7a56, 0x8a6a4a, MINER_STONE, 0xb09a78]), seed + i);
  }
  const m = ri(r, 1, 3);
  for (let i = 0; i < m; i++) {
    const a = r() * Math.PI * 2, d = rr(r, 0.1, 0.8);
    const kind = r();
    let g: THREE.BufferGeometry;
    if (kind < 0.5) g = box(rr(r, 0.25, 0.5), 0.03, rr(r, 0.15, 0.35), Math.cos(a) * d, 0.03, Math.sin(a) * d, rr(r, -0.25, 0.25), r() * 6, rr(r, -0.25, 0.25));
    else if (kind < 0.8) g = xf(cyl(0.05, 0.05, rr(r, 0.4, 0.8), 6), Math.cos(a) * d, 0.05, Math.sin(a) * d, 0, r() * 6, Math.PI / 2);
    else g = box(rr(r, 0.5, 0.9), 0.04, 0.12, Math.cos(a) * d, 0.03, Math.sin(a) * d, 0, r() * 6, 0.05);
    const hex = kind >= 0.8 ? 0x8a6a44 : pick(r, [PALETTE.rust, PALETTE.minerMetal, 0x6d665c]);
    kit.add(kind >= 0.8 ? paint(g, hex, { seed, vary: 0.15 }) : paintMetal(g, seed + i, hex, 0.6), kind >= 0.8 ? matte() : metal());
  }
  return kit.build('debris');
}
