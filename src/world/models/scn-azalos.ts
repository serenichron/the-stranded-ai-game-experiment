// Aza'los ruin pieces, phase 2. Built against scene-minaa-water-holders.png (the pale towers
// behind the camp) and the ruin floor behind iskari-woken-defensive-azalos-v2.png.
// Canon: organic curving forms, no straight lines, towers rising from organic bases like
// stalagmites, teal-blue glow in the seams, battle damage (breaches, craters, char).
import * as THREE from 'three';
import { PALETTE } from './types';
import {
  Kit, makeRng, rr, ri, lerp, clamp01, smooth, noise3, snoise3, fbm3, displace, paintFn,
  lathe, sweep, ribbon, matte, matteBack, glow, type Rng,
} from './scn-kit';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

const STONE = new THREE.Color(PALETTE.stone);
const STONE_WARM = new THREE.Color(0xd9c7a8);
const STONE_SHADE = new THREE.Color(0xb8a78e);
const SAND = new THREE.Color(PALETTE.sand);
const CHAR = new THREE.Color(0x4a3a32);
const GROOVE = new THREE.Color(0x8e8472);

/** Aza'los stone: smooth, creased at 58 degrees, with the cracked-stone surface layer. */
let _stone: THREE.MeshStandardMaterial | null = null;
const stoneMat = () => { if (!_stone) { _stone = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }); _stone.userData.crease = 58; _stone.userData.surface = 'stone'; } return _stone; };

/** Teal for seams: soft, so it sits inside the golden hour instead of shouting over it. */
export const seamMat = () => glow(PALETTE.teal, 1.05);
const seamDim = () => glow(PALETTE.teal, 0.55);
/** A soft additive halo: teal light bleeding out of a channel into the stone around it. */
let _halo: THREE.MeshBasicMaterial | null = null;
function haloMat() {
  if (!_halo) _halo = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  return _halo;
}
/** A flat strip along points, three vertices across: bright in the middle, black at the edges. */
function haloStrip(pts: THREE.Vector3[], width: number, strength: number): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  const c = new THREE.Color(PALETTE.teal).multiplyScalar(strength);
  const side = (i: number) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
  const ring = (i: number) => { const [nx, nz] = side(i); const p = pts[i]; return [V(p.x + nx * width / 2, p.y, p.z + nz * width / 2), V(p.x, p.y, p.z), V(p.x - nx * width / 2, p.y, p.z - nz * width / 2)]; };
  const cols = [0, 1, 0];
  for (let i = 0; i < pts.length - 1; i++) {
    const A = ring(i), B = ring(i + 1);
    for (let j = 0; j < 2; j++) {
      const quad = [[A[j], B[j], A[j + 1], cols[j], cols[j], cols[j + 1]], [A[j + 1], B[j], B[j + 1], cols[j + 1], cols[j], cols[j + 1]]] as const;
      for (const [p, q, w, cp, cq, cw] of quad) {
        pos.push(p.x, p.y, p.z, w.x, w.y, w.z, q.x, q.y, q.z);
        for (const k of [cp, cw, cq]) col.push(c.r * k, c.g * k, c.b * k);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
/** Floor channels glow less than wall seams: the floor is big and seen from above. */
const floorSeam = () => glow(PALETTE.teal, 0.22);

// ================================================================ the great tower

export interface TowerOpts {
  /** Snapped crown (war damage) instead of an intact rounded top. */
  broken?: boolean;
  /** Arched doorways cut into the base. */
  doors?: number;
  /** Soot scorch on one side, 0..1. */
  char?: number;
}

/**
 * A stalagmite tower: a flared root base whose buttress lobes flow into the ground, a long
 * tapering shaft with shallow vertical ridges, and seams of teal sunk in the ridge grooves.
 * radius is the shaft radius at mid height. Origin on the ground at the centre.
 */
export function greatTower(radius: number, height: number, seed = 1, o: TowerOpts = {}): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const R = Math.max(0.5, radius), H = Math.max(2, height);
  const SEG = 32;
  const lobes = ri(r, 4, 6), lobePh = r() * 6;
  const ridges = lobes * 2, twist = rr(r, -0.35, 0.35);
  const doors = o.doors ?? 0;
  // doorways sit between two root lobes, spread round the base
  const doorAngles = Array.from({ length: doors }, (_, i) => (Math.PI * 2 * (Math.floor((i * lobes) / doors) + 0.5) - lobePh) / lobes);
  const doorW = Math.min(0.55, 1.1 / R), doorH = Math.min(H * 0.28, 2.6);
  const broken = !!o.broken;
  const crown = broken ? rr(r, 0.78, 0.9) : 1;
  const drops = Array.from({ length: SEG }, () => (broken ? H * 0.16 * Math.pow(r(), 1.7) : 0));

  // radius as a function of height fraction and angle
  const shaft = (yf: number) => (0.62 + 0.5 * Math.pow(1 - yf, 1.25)) * (1 + 0.85 * Math.exp(-Math.max(0, yf) * 12));
  const lobe = (a: number, yf: number) => Math.pow(Math.max(0, Math.cos(lobes * a + lobePh)), 2.5) * 0.45 * Math.exp(-Math.max(0, yf) * 8);
  const ridge = (a: number, yf: number) => 0.045 * Math.cos(ridges * a + yf * twist * 6 + lobePh);
  const radAt = (a: number, yf: number) => R * shaft(yf) * (1 + lobe(a, yf)) * (1 + ridge(a, yf));
  const doorAt = (a: number, y: number) => {
    for (const da of doorAngles) {
      let d = Math.abs(((a - da + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < doorW) {
        const archTop = doorH * Math.sqrt(Math.max(0, 1 - (d / doorW) ** 2)) * 0.35 + doorH * 0.65;
        if (y < archTop && d < doorW * 0.97) return true;
      }
    }
    return false;
  };

  const YF: number[] = [-0.03];
  for (let i = 0; i <= 34; i++) YF.push(Math.pow(i / 34, 1.25) * crown);
  if (!broken) for (let i = 1; i <= 6; i++) YF.push(crown + 0.07 * (i / 6));
  const profile: [number, number][] = YF.map((yf) => [1, yf * H]);
  const top = YF.length - 1;
  const g = lathe(profile, SEG, (a, col, j, _rad, y) => {
    const yf = y / H;
    let rad = radAt(a, Math.min(yf, crown));
    let yy = y;
    if (!broken && yf > crown) {
      // intact rounded crown
      const k = (yf - crown) / 0.07;
      rad = radAt(a, crown) * Math.sqrt(Math.max(0.0001, 1 - k * k));
      if (j === top) rad = 0.001;
    }
    if (broken && j >= top - 1) yy = y - drops[col] * (j === top ? 1 : 0.4);
    return [rad, yy];
  }, 0, Math.PI * 2, (col, j) => {
    // cut the doorways out of the outer shell
    if (!doors) return false;
    const a0 = (col + 0.5) / SEG * Math.PI * 2;
    return doorAt(a0, (profile[j][1] + profile[Math.min(j + 1, profile.length - 1)][1]) / 2);
  });
  displace(g, R * 0.035, 1.3 / R, seed, (_x, y) => (y < 0.2 ? 0.3 : 1));

  // colour: pale stone, warmer and dustier low, wind streaks, a scorched flank, dark seam grooves
  const charA = r() * Math.PI * 2, charK = o.char ?? (r() < 0.5 ? rr(r, 0.3, 0.7) : 0);
  const seamAngles: number[] = [];
  const nSeams = ri(r, 2, 3);
  for (let i = 0; i < nSeams; i++) seamAngles.push(((Math.PI * (2 * ri(r, 0, ridges - 1) + 1)) - lobePh) / ridges);
  paintFn(g, (x, y, z, out) => {
    const yf = clamp01(y / H), a = Math.atan2(x, z);
    out.copy(STONE).lerp(STONE_WARM, smooth(0.3, 0, yf) * 0.6);
    const streak = fbm3(Math.cos(a) * 4, y * 0.12 / R, Math.sin(a) * 4, seed + 3);
    out.lerp(STONE_SHADE, smooth(0.1, 0.6, streak) * 0.45);
    out.multiplyScalar(0.9 + 0.12 * smooth(0, 1, yf) + 0.06 * snoise3(x * 2 / R, y * 0.8, z * 2 / R, seed));
    out.lerp(SAND, (1 - smooth(0, 1.1, y)) * 0.55);
    // grooves the seams sit in read darker
    for (const sa of seamAngles) {
      const d = Math.abs(((a - (sa - yf * twist * 6 / ridges) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      out.lerp(GROOVE, (1 - smooth(0, 0.12, d)) * 0.5 * smooth(0.02, 0.08, yf));
    }
    if (charK > 0) {
      const d = Math.abs(((a - charA + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const burn = (1 - smooth(0.2, 1.2, d)) * smooth(0.05, 0.25, yf) * (1 - smooth(0.4, 0.8, yf)) * smooth(0.35, 0.65, fbm3(x * 0.8, y * 0.4, z * 0.8, seed + 8) + 0.1);
      out.lerp(CHAR, burn * charK);
    }
    if (doors && doorAt(a, y)) out.multiplyScalar(0.4);
  });
  kit.add(g, stoneMat());

  // the dark inside, seen through the doorways and the broken crown
  if (doors || broken) {
    const inner = lathe(YF.filter((yf) => yf <= crown).map((yf) => [1, yf * H] as [number, number]), 16, (a, _c, _j, _r, y) => [radAt(a, y / H) * 0.84, y]);
    paintFn(inner, (_x, y, _z, out) => out.setHex(0x7a6a58).multiplyScalar(0.55 + 0.45 * clamp01(y / H)));
    kit.add(inner, matteBack());
  }

  // teal seams in the grooves, from the root up the shaft, forking near the top
  seamAngles.forEach((sa, si) => {
    const y0 = rr(r, 0.02, 0.06), y1 = rr(r, 0.55, 0.8) * crown;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 14; k++) {
      const yf = lerp(y0, y1, k / 14);
      const a = sa - yf * twist * 6 / ridges + 0.04 * Math.sin(k * 1.3 + si);
      const rad = radAt(a, yf) * 0.995;
      pts.push(V(Math.sin(a) * rad, yf * H, Math.cos(a) * rad));
    }
    kit.add(sweep(pts, { segments: 40, radial: 4, radius: (t) => R * 0.028 * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.3))) }), seamMat());
    // a branch leaving the main seam
    const k0 = ri(r, 7, 11);
    const b0 = pts[k0], ba = sa + (r() < 0.5 ? 1 : -1) * rr(r, 0.35, 0.6);
    const byf = b0.y / H + rr(r, 0.08, 0.14);
    const bpts = [b0, V(Math.sin((sa + ba) / 2) * radAt((sa + ba) / 2, byf - 0.04), (byf - 0.04) * H, Math.cos((sa + ba) / 2) * radAt((sa + ba) / 2, byf - 0.04)),
      V(Math.sin(ba) * radAt(ba, byf) * 0.995, byf * H, Math.cos(ba) * radAt(ba, byf) * 0.995)];
    kit.add(sweep(bpts, { segments: 12, radial: 4, radius: (t) => R * 0.02 * (1 - 0.7 * t) }), seamMat());
  });
  // teal light around the doorways, as in the painting's arched tunnels
  for (const da of doorAngles) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12, d = (t * 2 - 1) * doorW * 1.08;
      const y = doorH * (0.65 + 0.35 * Math.sqrt(Math.max(0, 1 - (d / (doorW * 1.08)) ** 2))) * (Math.abs(d) > doorW ? 0.9 : 1.05);
      const a = da + d;
      pts.push(V(Math.sin(a) * radAt(a, y / H) * 1.005, Math.max(0.05, t === 0 || t === 1 ? 0.05 : y), Math.cos(a) * radAt(a, y / H) * 1.005));
    }
    kit.add(sweep(pts, { segments: 30, radial: 4, radius: () => R * 0.02 }), seamDim());
  }
  // fallen chunks at the foot
  const n = ri(r, 2, 5);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = radAt(a, 0) * rr(r, 1.05, 1.4);
    kit.add(chunk(r, rr(r, 0.25, 0.6) * Math.min(1.6, R), seed + i).translate(Math.sin(a) * d, 0, Math.cos(a) * d), stoneMat());
  }
  return kit.build('azalos-great-tower');
}

/** A rounded fallen chunk of pale stone. */
export function chunk(r: Rng, size: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(size * 0.5, 1);
  displace(g, size * 0.18, 1.8 / size, seed);
  g.scale(1, rr(r, 0.5, 0.75), 1).rotateY(r() * 6).translate(0, size * 0.15, 0);
  return paintFn(g, (x, y, z, out) => out.copy(STONE).multiplyScalar(0.82 + 0.15 * noise3(x * 3, y * 3, z * 3, seed)).lerp(SAND, (1 - smooth(0, size * 0.4, y)) * 0.4));
}

// ================================================================ the flowing wall

/**
 * A curving wall of pale stone, like poured and set rather than laid. Runs along local X from
 * -length/2 to +length/2 and bows towards +Z by `curve` at its middle. The crest is smooth and
 * rolls up and down; the ends round off. One teal line runs along each face in a shallow groove,
 * rising and dipping with the wall. Battle damage: scorch on some stretches, bites out of the crest.
 */
/** A wall's course: a point and its outward side at u in 0..1, its length, and u for a point on it. */
export interface WallPath { at: (u: number) => THREE.Vector3; side: (u: number) => THREE.Vector3; len: number; uOf: (x: number, z: number) => number }

/** A course along an arc of a circle centred at the origin. Angles in radians, 0 = north (-z), clockwise. */
export function arcPath(radius: number, a0: number, a1: number): WallPath {
  const ang = (u: number) => a0 + (a1 - a0) * u;
  return {
    at: (u) => V(Math.sin(ang(u)) * radius, 0, -Math.cos(ang(u)) * radius),
    // same handedness as a straight wall (tangent x side = up): for a clockwise arc that is inward
    side: (u) => V(-Math.sin(ang(u)), 0, Math.cos(ang(u))),
    len: Math.abs(a1 - a0) * radius,
    uOf: (x, z) => { let a = Math.atan2(x, -z); while (a < Math.min(a0, a1) - 0.5) a += Math.PI * 2; return clamp01((a - a0) / (a1 - a0)); },
  };
}

export function flowingWall(length: number, height: number, curve: number, seed = 1, opts: { path?: WallPath; ends?: [boolean, boolean] } = {}): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const path = opts.path;
  const ends = opts.ends ?? [true, true];
  const L = path ? path.len : Math.max(0.6, length), H = Math.max(0.8, height);
  const N = Math.max(10, Math.ceil(L * 5));
  const halfBase = 0.34 + 0.04 * H;
  const pathAt = (u: number) => { if (path) return path.at(u); const x = (u - 0.5) * L; return V(x, 0, curve * (1 - (2 * x / L) ** 2)); };
  const sideAt = (u: number) => { if (path) return path.side(u); const x = (u - 0.5) * L; const t = V(1, 0, (-8 * curve * x) / (L * L)).normalize(); return V(-t.z, 0, t.x); };
  const uOf = (x: number, z: number) => (path ? path.uOf(x, z) : clamp01(x / L + 0.5));
  // how far u is from an end that rounds off (open ends meet a neighbour, so they stay full)
  const endDist = (u: number) => Math.min(ends[0] ? u : 1, ends[1] ? 1 - u : 1) * L;
  // the crest rolls; a bite or two taken out of it by the war, with rounded edges
  const bites = Array.from({ length: Math.round((L / 9) * rr(r, 0.4, 1.3)) }, () => ({ u: rr(r, 0.1, 0.9), w: rr(r, 1.0, 2.2) / L, d: rr(r, 0.2, 0.45) }));
  const crest = (u: number) => {
    let h = H * (0.82 + 0.18 * fbm3(u * L * 0.25, 1.7, 0, seed, 2) + 0.06 * Math.sin(u * L * 0.9 + seed));
    for (const b of bites) h -= H * b.d * Math.exp(-(((u - b.u) / b.w) ** 2));
    return h * (0.35 + 0.65 * smooth(0, 1.4, endDist(u)));
  };
  const thick = (u: number) => 1 + 0.12 * snoise3(u * L * 0.3, 5.1, 0, seed);
  const lean = (u: number) => 0.1 * snoise3(u * L * 0.2, 3.3, 0, seed);
  const P = 11;
  const rings: THREE.Vector3[][] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, C = pathAt(u), S = sideAt(u), h = crest(u), tk = thick(u), ln = lean(u);
    const endK = 0.25 + 0.75 * smooth(0, 0.8, endDist(u));
    const ring: THREE.Vector3[] = [];
    // a rounded loaf in section, a little wider at the foot, flowing out into a skirt
    for (let k = 0; k < P; k++) {
      const a = (k / (P - 1)) * Math.PI; // 0 = one foot, pi/2 = crest, pi = other foot
      const sx = Math.cos(a), sy = Math.sin(a);
      const w = halfBase * tk * endK * (Math.sign(sx) * Math.pow(Math.abs(sx), 0.55));
      const skirt = 1 + 0.35 * Math.pow(1 - sy, 3);
      ring.push(C.clone().addScaledVector(S, w * skirt + ln * sy * sy).setY(-0.2 + (h + 0.2) * Math.pow(sy, 0.6)));
    }
    rings.push(ring);
  }
  const wall = loftOpen(rings);
  displace(wall, 0.04, 1.8, seed);
  const charU = r() < 0.5 ? rr(r, 0.2, 0.8) : -1;
  paintFn(wall, (x, y, z, out) => {
    const u = uOf(x, z), yf = clamp01(y / H);
    out.copy(STONE).lerp(STONE_WARM, smooth(0.35, 0, yf) * 0.5);
    out.lerp(STONE_SHADE, smooth(0.15, 0.6, fbm3(x * 0.8, y * 0.15, z * 0.8, seed + 3)) * 0.4);
    out.multiplyScalar(0.9 + 0.1 * yf + 0.05 * snoise3(x * 2, y * 2, z * 2, seed));
    out.lerp(SAND, (1 - smooth(0, 0.8, y)) * 0.55);
    if (charU >= 0) out.lerp(CHAR, (1 - smooth(0.02, 0.18, Math.abs(u - charU))) * smooth(0.1, 0.4, yf) * 0.55 * smooth(0.35, 0.6, noise3(x * 1.5, y * 1.5, z, seed + 7) + 0.1));
    // the groove the seam lies in
    const sh = seamH(u);
    out.lerp(GROOVE, (1 - smooth(0.02, 0.09, Math.abs(y - sh))) * 0.45);
  });
  kit.add(wall, stoneMat());

  // one teal line along each face, riding the wall's own swell
  function seamH(u: number) { return H * (0.42 + 0.1 * Math.sin(u * L * 0.6 + seed)); }
  for (const side of [1]) {
    const pts: THREE.Vector3[] = [];
    const u0 = ends[0] ? Math.min(0.3, 1.2 / L) : 0.01, u1 = ends[1] ? 1 - Math.min(0.3, 1.2 / L) : 0.99;
    const NS = Math.max(16, Math.round(L * 1.5));
    for (let k = 0; k <= NS; k++) {
      const u = lerp(u0, u1, k / NS), h = crest(u), y = Math.min(seamH(u), h * 0.8);
      const sy = clamp01((y + 0.2) / (h + 0.2)) ** (1 / 0.6);
      const sx = Math.sqrt(Math.max(0, 1 - sy * sy));
      const w = halfBase * thick(u) * Math.pow(sx, 0.55) * (1 + 0.35 * Math.pow(1 - sy, 3)) + 0.012;
      pts.push(pathAt(u).addScaledVector(sideAt(u), side * w + lean(u) * sy * sy).setY(y));
    }
    // the war cut some seams: skip a middle stretch now and then
    // the war cut the seams here and there: break the line into lit stretches
    let k0 = 0;
    while (k0 < pts.length - 2) {
      const k1 = Math.min(pts.length, k0 + Math.max(4, Math.round(rr(r, 5, 14) * 1.5)));
      const part = pts.slice(k0, k1);
      if (part.length >= 3) kit.add(sweep(part, { segments: part.length * 3, radial: 4, radius: () => 0.028 }), seamMat());
      k0 = k1 + (r() < 0.8 ? ri(r, 4, 10) : 0);
    }
  }
  // a few fallen pieces at the foot
  for (let i = 0, n = Math.max(1, Math.round(L / 3)); i < n; i++) {
    const u = rr(r, 0.05, 0.95), side = r() < 0.5 ? 1 : -1;
    const p = pathAt(u).addScaledVector(sideAt(u), side * (halfBase * 1.6 + rr(r, 0.1, 0.5)));
    kit.add(chunk(r, rr(r, 0.25, 0.55), seed + i).translate(p.x, 0, p.z), stoneMat());
  }
  return kit.build('azalos-flowing-wall');
}

/** Skin rings into an open tube (no wrap between the first and last point of a ring), both ends capped. */
function loftOpen(rings: THREE.Vector3[][]): THREE.BufferGeometry {
  const pos: number[] = [];
  const P = rings[0].length;
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < P - 1; k++) {
    const a = rings[i][k], b = rings[i][k + 1], c = rings[i + 1][k + 1], d = rings[i + 1][k];
    tri(a, d, b); tri(b, d, c);
  }
  // end caps: fans from the middle of each end ring
  for (const [ring, flip] of [[rings[0], true], [rings[rings.length - 1], false]] as const) {
    const m = ring.reduce((s, p) => s.add(p), V()).multiplyScalar(1 / ring.length);
    for (let k = 0; k < P - 1; k++) flip ? tri(m, ring[k], ring[k + 1]) : tri(m, ring[k + 1], ring[k]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

// ================================================================ the ruin floor and its seam network

/**
 * The floor's teal channels, as data the pulse can follow. Rings wobble a little and spokes swirl
 * (canon: no straight lines). Radii in metres; spoke angles in degrees where the spoke meets the
 * outer edge, 0 = north (-z), clockwise; swirl in radians per metre.
 */
export interface SeamNet { rings: number[]; spokes: number[]; outer: number; swirl: number }

export function seamNetFor(radius: number): SeamNet {
  // one spoke ends due east, where the defender's niche is
  return { rings: [radius * 0.24, radius * 0.48, radius * 0.72], spokes: [90, 150, 210, 270, 330, 30], outer: radius * 0.9, swirl: 0.1 };
}
/** Radius of ring i at angle a (radians). */
export function ringR(net: SeamNet, i: number, a: number) { return net.rings[i] + 0.06 * Math.sin(3 * a + i * 1.7); }
/** Angle (radians) of spoke k at radius rho. */
export function spokeA(net: SeamNet, k: number, rho: number) { return THREE.MathUtils.degToRad(net.spokes[k]) - net.swirl * (net.outer - rho); }
/** A point on the floor, local x east and y = world z (south). */
export function netPt(rho: number, a: number) { return new THREE.Vector2(Math.sin(a) * rho, -Math.cos(a) * rho); }

/**
 * The raised court: paved slabs in rings, a stepped rim down to the sand, teal channels in
 * concentric rings and spokes, cracked slabs and two scorched craters from the war.
 * Top surface at y = 0.01. `drop` is how far the rim steps down to the sand around it.
 */
export function ruinFloor(radius: number, drop: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const R = Math.max(2, radius);
  const net = seamNetFor(R);
  const K = Math.round(R * 3), S = 160, TOP = 0.01;
  const craters = [0, 1].map(() => { const a = r() * Math.PI * 2, d = rr(r, 0.35, 0.8) * R; return { x: Math.sin(a) * d, z: Math.cos(a) * d, rad: rr(r, 0.9, 1.6) }; });
  const pos: number[] = [];
  const vert = (k: number, s: number) => {
    const th = ((s % S) / S) * Math.PI * 2;
    let rad = (R * k) / K;
    if (k === K) rad *= 1 - 0.03 * noise3(Math.cos(th) * 3, Math.sin(th) * 3, 0, seed + 4);
    const x = Math.sin(th) * rad, z = Math.cos(th) * rad;
    let y = TOP - 0.01 * noise3(x * 0.8, 0, z * 0.8, seed + 8);
    for (const c of craters) { const d = Math.hypot(x - c.x, z - c.z); y -= 0.12 * (1 - smooth(0, c.rad, d)); }
    return V(x, y, z);
  };
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const centre = V(0, TOP, 0);
  for (let s = 0; s < S; s++) {
    tri(centre, vert(1, s), vert(1, s + 1));
    for (let k = 1; k < K; k++) {
      const a = vert(k, s), b = vert(k, s + 1), c = vert(k + 1, s + 1), d = vert(k + 1, s);
      tri(a, d, b); tri(b, d, c);
    }
  }
  const floor = new THREE.BufferGeometry();
  floor.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const slabRing = R / Math.round(R / 1.1);
  paintFn(floor, (x, y, z, out) => {
    const rad = Math.hypot(x, z), th = Math.atan2(x, z);
    const ring = Math.floor(rad / slabRing);
    const perRing = Math.max(6, Math.round((2 * Math.PI * (ring + 0.5) * slabRing) / 1.3));
    const u = ((th / (Math.PI * 2)) * perRing + ring * 0.5 + 100) % 1;
    const v = (rad / slabRing) % 1;
    const joint = Math.min(smooth(0, 0.07, u), smooth(1, 0.93, u), smooth(0, 0.06, v), smooth(1, 0.94, v));
    // each slab its own shade of pale stone
    const slabN = noise3(ring * 7.1, Math.floor(th / (Math.PI * 2) * perRing) * 3.3, 0, seed);
    out.copy(STONE).multiplyScalar(0.9 + 0.12 * slabN);
    out.lerp(STONE_WARM, 0.25 + 0.2 * noise3(x * 0.3, 0, z * 0.3, seed + 1));
    out.multiplyScalar(0.8 + 0.2 * joint);
    // sand drifted across the worn outer ring
    out.lerp(SAND, smooth(0.5, 0.85, noise3(x * 0.25, 2, z * 0.25, seed + 2)) * 0.5 * smooth(0.4, 1, rad / R));
    for (const c of craters) {
      const d = Math.hypot(x - c.x, z - c.z);
      out.lerp(CHAR, (1 - smooth(c.rad * 0.3, c.rad * 1.6, d)) * 0.75 * (0.7 + 0.3 * noise3(x * 3, 0, z * 3, seed + 5)));
    }
  });
  kit.add(floor, stoneMat());

  // the stepped rim, down to the sand
  const rim: number[] = [];
  const steps = [[1.0, 0], [1.0, -drop * 0.5], [1.03, -drop * 0.5], [1.03, -drop - 0.15]];
  for (let s = 0; s < S; s++) {
    const t0 = (s / S) * Math.PI * 2, t1 = ((s + 1) / S) * Math.PI * 2;
    const rk = (t: number) => R * (1 - 0.03 * noise3(Math.cos(t) * 3, Math.sin(t) * 3, 0, seed + 4));
    for (let i = 0; i < steps.length - 1; i++) {
      const [f0, y0] = steps[i], [f1, y1] = steps[i + 1];
      const a = V(Math.sin(t0) * rk(t0) * f0, TOP + y0, Math.cos(t0) * rk(t0) * f0), b = V(Math.sin(t1) * rk(t1) * f0, TOP + y0, Math.cos(t1) * rk(t1) * f0);
      const c = V(Math.sin(t1) * rk(t1) * f1, TOP + y1, Math.cos(t1) * rk(t1) * f1), d = V(Math.sin(t0) * rk(t0) * f1, TOP + y1, Math.cos(t0) * rk(t0) * f1);
      rim.push(a.x, a.y, a.z, d.x, d.y, d.z, b.x, b.y, b.z, b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z);
    }
  }
  const rimG = new THREE.BufferGeometry();
  rimG.setAttribute('position', new THREE.Float32BufferAttribute(rim, 3));
  paintFn(rimG, (x, y, z, out) => out.copy(STONE_SHADE).multiplyScalar(0.85 + 0.15 * noise3(x * 2, y * 4, z * 2, seed + 6)).lerp(SAND, smooth(-drop * 0.4, -drop, y) * 0.5));
  kit.add(rimG, stoneMat());

  // teal channels: a dark groove with a soft glowing line in it
  const LY = TOP + 0.006;
  const circle = (rad: number, a0 = 0, a1 = Math.PI * 2) => {
    const pts: THREE.Vector3[] = [];
    const n = Math.max(12, Math.round(rad * 6));
    for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push(V(Math.sin(a) * rad, LY, Math.cos(a) * rad)); }
    return pts;
  };
  const groove = (pts: THREE.Vector3[], closed = false) => {
    const g = ribbon(pts, 0.13, pts.length * 3, UP, false, closed);
    kit.add(paintFn(g, (x, _y, z, out) => out.copy(GROOVE).lerp(STONE, 0.35).multiplyScalar(0.85 + 0.15 * noise3(x, 0, z, seed))), stoneMat());
    const line = ribbon(pts.map((p) => p.clone().setY(LY + 0.004)), 0.04, pts.length * 3, UP, false, closed);
    kit.add(line, floorSeam());
  };
  net.rings.forEach((_, i) => {
    // the war broke some channels: leave a gap in each ring
    const gapAt = r() * Math.PI * 2, gapLen = rr(r, 0.15, 0.4);
    const pts: THREE.Vector3[] = [];
    const n = Math.round(net.rings[i] * 8);
    for (let k = 0; k <= n; k++) { const t = gapAt + gapLen + ((Math.PI * 2 - gapLen) * k) / n; const q = netPt(ringR(net, i, t), t); pts.push(V(q.x, LY, q.y)); }
    groove(pts);
  });
  net.spokes.forEach((_, k) => {
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= 10; j++) { const rho = net.rings[0] + ((net.outer - net.rings[0]) * j) / 10; const q = netPt(rho, spokeA(net, k, rho)); pts.push(V(q.x, LY, q.y)); }
    groove(pts);
  });
  // cracks across slabs, dark and jagged
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = rr(r, 0.2, 0.95) * R, len = rr(r, 0.8, 2.4), dir = r() * Math.PI;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5 - 0.5;
      pts.push(V(Math.sin(a) * d + Math.cos(dir) * t * len + rr(r, -0.1, 0.1), LY + 0.002, Math.cos(a) * d + Math.sin(dir) * t * len + rr(r, -0.1, 0.1)));
    }
    kit.add(paintFn(ribbon(pts, 0.03, 10, UP, true), (_x, _y, _z, out) => out.copy(STONE_SHADE).multiplyScalar(0.7)), stoneMat());
  }
  const g = kit.build('azalos-ruin-floor');
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = false; });
  return g;
}

/**
 * Path along the seam network, in the floor's local frame (x east, z south, metres from the centre):
 * from a point, in along a radius to the nearest ring, round the ring to the spoke nearest the
 * target, then out along the spoke to the target. Used by seamPulse.
 */
export function seamPath(net: SeamNet, from: THREE.Vector2, to: THREE.Vector2): THREE.Vector2[] {
  const angOf = (p: THREE.Vector2) => Math.atan2(p.x, -p.y); // 0 = north (-z), clockwise
  const wrap = (x: number) => ((x + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const fr = from.length(), fa = angOf(from), ta = angOf(to);
  let ri0 = 0;
  net.rings.forEach((x, i) => { if (Math.abs(x - fr) < Math.abs(net.rings[ri0] - fr)) ri0 = i; });
  let k = 0;
  net.spokes.forEach((d, i) => { if (Math.abs(wrap(THREE.MathUtils.degToRad(d) - ta)) < Math.abs(wrap(THREE.MathUtils.degToRad(net.spokes[k]) - ta))) k = i; });
  const out: THREE.Vector2[] = [from.clone(), netPt(ringR(net, ri0, fa), fa)];
  // round the ring to where the chosen spoke leaves it
  const sa = spokeA(net, k, net.rings[ri0]);
  const d = wrap(sa - fa);
  const steps = Math.max(2, Math.ceil(Math.abs(d) * net.rings[ri0] / 0.5));
  for (let i = 1; i <= steps; i++) { const a = fa + (d * i) / steps; out.push(netPt(ringR(net, ri0, a), a)); }
  // out along the swirling spoke
  const n = Math.max(2, Math.ceil((net.outer - net.rings[ri0]) / 0.4));
  for (let i = 1; i <= n; i++) { const rho = net.rings[ri0] + ((net.outer - net.rings[ri0]) * i) / n; out.push(netPt(rho, spokeA(net, k, rho))); }
  out.push(to.clone());
  return out;
}

// ================================================================ a crack the drone mends

/**
 * A crack in a wall face: a jagged dark split rising from the ground, half filled with teal
 * mending. Built facing -Z (towards the court), about 2.4 m tall, sitting on a wall face at z = 0.
 */
export function mendedCrack(seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const pts: THREE.Vector3[] = [];
  let x = 0;
  for (let k = 0; k <= 8; k++) { x += rr(r, -0.22, 0.22); pts.push(V(x, k * 0.3, -0.02)); }
  const fwd = V(0, 0, -1);
  kit.add(paintFn(ribbon(pts, 0.14, 24, fwd, true), (_x, y, _z, out) => out.copy(CHAR).multiplyScalar(0.7 + 0.2 * (y / 2.4))), stoneMat());
  // the lower half is mended: teal filler laid into the split, still bright where it is fresh
  const mend = pts.slice(0, 5).map((p) => p.clone().setZ(-0.04));
  kit.add(ribbon(mend, 0.07, 16, fwd, true), glow(PALETTE.teal, 1.6));
  // flakes of broken stone at the foot
  for (let i = 0; i < 4; i++) kit.add(chunk(r, rr(r, 0.15, 0.3), seed + i).translate(rr(r, -0.5, 0.5), 0, rr(r, -0.6, -0.2)), stoneMat());
  return kit.build('azalos-crack');
}
