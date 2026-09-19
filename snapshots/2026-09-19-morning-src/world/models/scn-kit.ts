// Shared helpers for procedural props and scenery: seeded random, value noise,
// a material cache, vertex painting, geometry sweeps and a merge kit.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- random

export type Rng = () => number;

/** mulberry32. Same seed, same stream. */
export function makeRng(seed: number): Rng {
  let a = (Math.floor(seed * 9973) ^ 0x2545f491) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rr = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const ri = (r: Rng, a: number, b: number) => Math.floor(rr(r, a, b + 1));
export const pick = <T>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length) % arr.length];
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- noise

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683) + Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/** Value noise, 0..1. */
export function noise3(x: number, y: number, z: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u), x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u), x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}
/** Value noise, -1..1. */
export const snoise3 = (x: number, y: number, z: number, seed = 0) => noise3(x, y, z, seed) * 2 - 1;
/** Fractal noise, roughly -1..1. */
export function fbm3(x: number, y: number, z: number, seed = 0, oct = 3): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += snoise3(x * f, y * f, z * f, seed + i * 31) * a;
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

// ---------------------------------------------------------------- materials

const matCache = new Map<string, THREE.Material>();
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}

/** Matte painted surface. Colour comes from vertex colours. */
export const matte = () => cached('matte', () => withCrease(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 }), 58));
/** Two-sided matte, for cloth, leaves and thin shells. */
export const matte2 = () => cached('matte2', () => withCrease(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }), 70));
/** Worn metal. Colour from vertex colours. */
export const metal = () => cached('metal', () => withCrease(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.45 }), 38));
/** Emissive glow, shared by colour and strength. Do not animate: use glowInstance for that. */
export const glow = (hex: number, intensity = 2) =>
  cached(`glow:${hex}:${intensity}`, () => makeGlow(hex, intensity));
/** A fresh glow material the caller owns (and should dispose). */
export function makeGlow(hex: number, intensity = 2): THREE.MeshStandardMaterial {
  const c = new THREE.Color(hex);
  return new THREE.MeshStandardMaterial({
    color: c.clone().multiplyScalar(0.35), emissive: c, emissiveIntensity: intensity,
    roughness: 0.35, metalness: 0,
  });
}
/** Cut crystal: glossy, lit from inside. Caller owns it. */
export function makeCrystal(hex: number, intensity = 1.6): THREE.MeshStandardMaterial {
  const c = new THREE.Color(hex);
  return new THREE.MeshStandardMaterial({
    color: c.clone().lerp(new THREE.Color(0xffffff), 0.15), emissive: c, emissiveIntensity: intensity,
    roughness: 0.18, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92,
  });
}
/** Inside faces of hollow shells (cracked spires, torn hulls). */
export const matteBack = () => cached('matteBack', () => withCrease(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.BackSide }), 58));
/** Part-crystal plant tissue (glass-thistle). */
export const glassy = () => cached('glassy', () => new THREE.MeshStandardMaterial({
  color: 0xc8c4bc, emissive: 0x8a8aa0, emissiveIntensity: 0.12, roughness: 0.25, metalness: 0.05, flatShading: true,
}));
export const waterMat = () => cached('water', () => new THREE.MeshStandardMaterial({
  color: 0x2f8f86, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.72, depthWrite: false,
}));

/** Edges sharper than this many degrees keep a hard normal; softer ones are smoothed. Crystals stay faceted. */
export function withCrease<M extends THREE.Material>(m: M, deg: number): M { m.userData.crease = deg; return m; }

/**
 * Smooth normals on non-indexed geometry: corners that share a position average the normals of the
 * faces that meet there, except across edges sharper than the crease angle. Area weighted.
 */
export function smoothNormals(g: THREE.BufferGeometry, creaseDeg: number): THREE.BufferGeometry {
  const p = g.attributes.position as THREE.BufferAttribute;
  const n = p.count, faces = n / 3;
  const fn = new Float32Array(faces * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let f = 0; f < faces; f++) {
    a.fromBufferAttribute(p, f * 3); b.fromBufferAttribute(p, f * 3 + 1); c.fromBufferAttribute(p, f * 3 + 2);
    c.sub(b); a.sub(b); c.cross(a); // area-weighted face normal
    fn[f * 3] = c.x; fn[f * 3 + 1] = c.y; fn[f * 3 + 2] = c.z;
  }
  const groups = new Map<string, number[]>();
  const key = (i: number) => Math.round(p.getX(i) * 1e3) + ',' + Math.round(p.getY(i) * 1e3) + ',' + Math.round(p.getZ(i) * 1e3);
  const keys: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const k = key(i); keys[i] = k;
    let l = groups.get(k); if (!l) groups.set(k, (l = [])); l.push(i);
  }
  const cos = Math.cos(THREE.MathUtils.degToRad(creaseDeg));
  const out = new Float32Array(n * 3);
  const len = (f: number) => Math.hypot(fn[f * 3], fn[f * 3 + 1], fn[f * 3 + 2]) || 1;
  for (let i = 0; i < n; i++) {
    const f = Math.floor(i / 3), lf = len(f);
    let x = 0, y = 0, z = 0;
    for (const j of groups.get(keys[i])!) {
      const g2 = Math.floor(j / 3), lg = len(g2);
      const d = (fn[f * 3] * fn[g2 * 3] + fn[f * 3 + 1] * fn[g2 * 3 + 1] + fn[f * 3 + 2] * fn[g2 * 3 + 2]) / (lf * lg);
      if (g2 !== f && d < cos) continue;
      x += fn[g2 * 3]; y += fn[g2 * 3 + 1]; z += fn[g2 * 3 + 2];
    }
    const l = Math.hypot(x, y, z) || 1;
    out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return g;
}

// ---------------------------------------------------------------- transforms

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** Scale, then rotate (XYZ euler), then move. Mutates and returns geo. */
export function xf<G extends THREE.BufferGeometry>(geo: G, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): G {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  geo.applyMatrix4(_m);
  return geo;
}

// ---------------------------------------------------------------- deform and paint

/** Push vertices by 3D noise. Position based, so shared seams stay closed. */
export function displace<G extends THREE.BufferGeometry>(geo: G, amp: number, freq: number, seed: number, mask?: (x: number, y: number, z: number) => number): G {
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = amp * (mask ? mask(x, y, z) : 1);
    if (k === 0) continue;
    const fx = x * freq, fy = y * freq, fz = z * freq;
    p.setXYZ(i,
      x + snoise3(fx, fy, fz, seed) * k,
      y + snoise3(fx + 17.3, fy, fz, seed + 1) * k,
      z + snoise3(fx, fy + 9.1, fz + 5.7, seed + 2) * k);
  }
  p.needsUpdate = true;
  return geo;
}

export interface PaintOpts {
  /** Per-face brightness variation, 0..1. */
  vary?: number;
  /** Noise frequency for the variation. */
  freq?: number;
  seed?: number;
  /** Darkness at the base (fake ambient occlusion), 0..1. */
  ao?: number;
  /** Height over which the base darkening fades out. */
  aoHeight?: number;
  /** y of the ground for AO. */
  aoBase?: number;
  /** A second colour blended in by noise (stains, lichen, rust). */
  stain?: number;
  stainAmount?: number;
  /** Blend towards this colour near the ground (dust, sand). */
  dust?: number;
  dustHeight?: number;
}

const _ca = new THREE.Color(), _cb = new THREE.Color(), _cc = new THREE.Color(), _cd = new THREE.Color();

/**
 * Write a colour attribute. The geometry becomes non-indexed so each face can carry its
 * own painterly tint. Returns the (possibly new) geometry.
 */
export function paint(geo: THREE.BufferGeometry, hex: number, o: PaintOpts = {}): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const vary = o.vary ?? 0.12, freq = o.freq ?? 1.3, seed = o.seed ?? 7;
  const ao = o.ao ?? 0.35, aoH = o.aoHeight ?? 0.9, aoB = o.aoBase ?? 0;
  _ca.setHex(hex);
  if (o.stain !== undefined) _cb.setHex(o.stain);
  if (o.dust !== undefined) _cd.setHex(o.dust);
  for (let f = 0; f < p.count; f += 3) {
    const cx = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3;
    const cy = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
    const cz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3;
    for (let k = 0; k < 3; k++) {
      const vx = p.getX(f + k), vy = p.getY(f + k), vz = p.getZ(f + k);
      _cc.setHex(hex);
      if (o.stain !== undefined) {
        const s = smooth(0.1, 0.7, noise3(vx * freq * 0.7 + 3, vy * freq * 0.7, vz * freq * 0.7, seed + 5)) * (o.stainAmount ?? 0.5);
        _cc.lerp(_cb, s);
      }
      // mostly per corner, a little per face: soft colour flow with a hint of brushwork
      const n = snoise3(vx * freq, vy * freq, vz * freq, seed) * 0.8 + snoise3(cx * freq, cy * freq, cz * freq, seed) * 0.2;
      _ca.copy(_cc).multiplyScalar(1 + n * vary);
      if (o.dust !== undefined) _ca.lerp(_cd, (1 - smooth(0, o.dustHeight ?? 0.5, vy - aoB)) * 0.6);
      const a = 1 - ao * (1 - smooth(0, aoH, vy - aoB));
      col[(f + k) * 3] = _ca.r * a;
      col[(f + k) * 3 + 1] = _ca.g * a;
      col[(f + k) * 3 + 2] = _ca.b * a;
      _ca.setHex(hex);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Paint with a function of the vertex position. */
export function paintFn(geo: THREE.BufferGeometry, fn: (x: number, y: number, z: number, out: THREE.Color) => void): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  // per corner, so colour flows smoothly across faces (phase 1 painted per face, which read as a mosaic)
  for (let i = 0; i < p.count; i++) {
    fn(p.getX(i), p.getY(i), p.getZ(i), c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// ---------------------------------------------------------------- lofts and sweeps

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _n = new THREE.Vector3();

/**
 * Skin a list of rings. Each ring has the same vertex count. Faces are turned to point away
 * from the local ring centre, so any star-shaped cross-section comes out facing outward.
 */
export function loft(rings: THREE.Vector3[][], o: { closed?: boolean; capStart?: boolean; capEnd?: boolean; skip?: (i: number, j: number) => boolean; centres?: THREE.Vector3[] } = {}): THREE.BufferGeometry {
  const closed = o.closed ?? true;
  const R = rings[0].length;
  const pos: number[] = [];
  const centres = o.centres ?? rings.map((ring) => {
    const c = new THREE.Vector3();
    ring.forEach((v) => c.add(v));
    return c.multiplyScalar(1 / ring.length);
  });
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ref: THREE.Vector3, away = true) => {
    _v1.subVectors(b, a); _v2.subVectors(c, a); _n.crossVectors(_v1, _v2);
    if (_n.lengthSq() < 1e-12) return;
    _v3.set((a.x + b.x + c.x) / 3 - ref.x, (a.y + b.y + c.y) / 3 - ref.y, (a.z + b.z + c.z) / 3 - ref.z);
    const flip = (_n.dot(_v3) < 0) === away;
    if (flip) pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    else pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const mid = new THREE.Vector3();
  for (let i = 0; i < rings.length - 1; i++) {
    mid.addVectors(centres[i], centres[i + 1]).multiplyScalar(0.5);
    const jn = closed ? R : R - 1;
    for (let j = 0; j < jn; j++) {
      if (o.skip && o.skip(i, j)) continue;
      const j2 = (j + 1) % R;
      const a = rings[i][j], b = rings[i][j2], c = rings[i + 1][j2], d = rings[i + 1][j];
      tri(a, b, d, mid);
      tri(b, c, d, mid);
    }
  }
  if (o.capStart) {
    const c = centres[0];
    for (let j = 0; j < R; j++) tri(c, rings[0][j], rings[0][(j + 1) % R], centres[1] ?? c);
  }
  if (o.capEnd) {
    const n = rings.length - 1, c = centres[n];
    for (let j = 0; j < R; j++) tri(c, rings[n][j], rings[n][(j + 1) % R], centres[n - 1] ?? c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

export interface SweepOpts {
  segments: number;
  radial: number;
  /** Radius at curve parameter t (0..1) and ring angle a. */
  radius: (t: number, a: number) => number;
  /** Fixed up vector for the frames. Leave out to use parallel-transport frames. */
  up?: THREE.Vector3;
  capStart?: boolean;
  capEnd?: boolean;
  skip?: (i: number, j: number) => boolean;
  /** Extra ring rotation along the length, radians. */
  twist?: number;
}

/** A tube along a smooth curve through `points`, with a radius that can change. */
export function sweep(points: THREE.Vector3[], o: SweepOpts): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const S = o.segments, R = o.radial;
  const frames = o.up ? null : curve.computeFrenetFrames(S, false);
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const rings: THREE.Vector3[][] = [], centres: THREE.Vector3[] = [];
  for (let i = 0; i <= S; i++) {
    const t = i / S;
    const P = curve.getPointAt(t);
    if (o.up) {
      curve.getTangentAt(t, T);
      N.crossVectors(T, o.up);
      if (N.lengthSq() < 1e-6) N.set(1, 0, 0);
      N.normalize();
      B.crossVectors(N, T).normalize();
    } else {
      N.copy(frames!.normals[i]);
      B.copy(frames!.binormals[i]);
    }
    const ring: THREE.Vector3[] = [];
    for (let j = 0; j < R; j++) {
      const a = (j / R) * Math.PI * 2 + (o.twist ?? 0) * t;
      const r = o.radius(t, a);
      ring.push(P.clone().addScaledVector(N, Math.cos(a) * r).addScaledVector(B, Math.sin(a) * r));
    }
    rings.push(ring);
    centres.push(P);
  }
  return loft(rings, { closed: true, capStart: o.capStart, capEnd: o.capEnd, skip: o.skip, centres });
}

/**
 * A lathe from a (radius, y) profile listed bottom to top. `shape` can bend each vertex:
 * it gets the column angle and the profile index and returns [radius, y].
 */
export function lathe(profile: [number, number][], segs: number, shape?: (angle: number, col: number, j: number, r: number, y: number) => [number, number], phiStart = 0, phiLength = Math.PI * 2, skip?: (col: number, j: number) => boolean): THREE.BufferGeometry {
  const full = Math.abs(phiLength - Math.PI * 2) < 1e-6;
  const pos: number[] = [];
  const P = profile.length;
  const vert = (col: number, j: number, out: THREE.Vector3) => {
    const c = col % segs;
    const ang = phiStart + (col / segs) * phiLength;
    const angC = phiStart + (c / segs) * phiLength;
    let [r, y] = profile[j];
    if (shape) [r, y] = shape(full ? angC : ang, full ? c : col, j, r, y);
    const a = full ? angC : ang;
    return out.set(Math.sin(a) * r, y, Math.cos(a) * r);
  };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  const push = (p: THREE.Vector3, q: THREE.Vector3, s: THREE.Vector3) => {
    _v1.subVectors(q, p); _v2.subVectors(s, p); _n.crossVectors(_v1, _v2);
    if (_n.lengthSq() < 1e-12) return;
    pos.push(p.x, p.y, p.z, q.x, q.y, q.z, s.x, s.y, s.z);
  };
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < P - 1; j++) {
      if (skip && skip(i, j)) continue;
      vert(i, j, a); vert(i + 1, j, b); vert(i + 1, j + 1, c); vert(i, j + 1, d);
      // profile runs bottom to top, angle grows anticlockwise seen from above: this winding faces out.
      push(a, b, d);
      push(b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** A flat ribbon lying on a surface, following 3D points, facing `normal`. */
export function ribbon(points: THREE.Vector3[], width: number, segments: number, normal = new THREE.Vector3(0, 1, 0), taper = true, closed = false): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  const pos: number[] = [];
  const T = new THREE.Vector3(), S = new THREE.Vector3();
  const L: THREE.Vector3[] = [], Rr: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const P = curve.getPointAt(t);
    curve.getTangentAt(t, T);
    S.crossVectors(T, normal).normalize();
    const w = (taper && !closed ? Math.sin(Math.PI * (0.08 + 0.84 * t)) : 1) * width * 0.5;
    L.push(P.clone().addScaledVector(S, -w));
    Rr.push(P.clone().addScaledVector(S, w));
  }
  for (let i = 0; i < segments; i++) {
    const a = L[i], b = Rr[i], c = Rr[i + 1], d = L[i + 1];
    for (const [p, q, s] of [[a, b, d], [b, c, d]] as const) {
      _v1.subVectors(q, p); _v2.subVectors(s, p); _n.crossVectors(_v1, _v2);
      if (_n.dot(normal) < 0) pos.push(p.x, p.y, p.z, s.x, s.y, s.z, q.x, q.y, q.z);
      else pos.push(p.x, p.y, p.z, q.x, q.y, q.z, s.x, s.y, s.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** A thin glowing seam tube along points. */
export function seam(points: THREE.Vector3[], radius = 0.035, segments = 20): THREE.BufferGeometry {
  return sweep(points, { segments, radial: 4, radius: (t) => radius * (0.35 + 0.65 * Math.sin(Math.PI * t)) });
}

/** A rough stone lump. */
export function lump(r: Rng, size: number, detail = 0): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(size * 0.5, detail);
  const seed = Math.floor(r() * 1e6);
  displace(g, size * 0.22, 2.2 / size, seed);
  return g;
}

// ---------------------------------------------------------------- merge kit

function prep(geo: THREE.BufferGeometry, crease = 0): THREE.BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'color') g.deleteAttribute(k);
  if (!g.attributes.color) {
    const n = g.attributes.position.count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  }
  if (crease > 0) smoothNormals(g, crease); else g.computeVertexNormals();
  return g;
}

/** Prepare one geometry the way the Kit does (for instanced meshes): non-indexed, coloured, normals by crease. */
export function prepFor(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.BufferGeometry {
  return prep(geo, (mat.userData.crease as number | undefined) ?? 0);
}

/** Collects pieces by material, then merges each bucket into one mesh. */
export class Kit {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material): this {
    let list = this.buckets.get(mat);
    if (!list) this.buckets.set(mat, (list = []));
    list.push(prep(geo, (mat.userData.crease as number | undefined) ?? 0));
    return this;
  }
  /** Meshes merged per material. Glow meshes do not cast shadows. */
  build(name = 'piece', shadows = true): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    for (const [mat, list] of this.buckets) {
      const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!g) continue;
      if (list.length > 1) list.forEach((x) => x.dispose());
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      const emissive = (mat as THREE.MeshStandardMaterial).emissiveIntensity > 0 && (mat as THREE.MeshStandardMaterial).emissive?.getHex() !== 0;
      const transparent = mat.transparent;
      mesh.castShadow = shadows && !emissive && !transparent;
      mesh.receiveShadow = !transparent;
      group.add(mesh);
    }
    this.buckets.clear();
    return group;
  }
}

/** A small point light that never casts shadows. */
export function pointLight(hex: number, intensity: number, distance: number, x = 0, y = 0, z = 0): THREE.PointLight {
  const l = new THREE.PointLight(hex, intensity, distance, 2);
  l.castShadow = false;
  l.position.set(x, y, z);
  return l;
}
