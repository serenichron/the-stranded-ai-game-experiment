// Shared building blocks for character models: cached materials, cached geometry,
// a seeded random source and a mesh placement helper. Characters only.
import * as THREE from 'three';

export type V3 = [number, number, number];
export const TAU = Math.PI * 2;

// ---------------------------------------------------------------- materials

const mats = new Map<string, THREE.MeshStandardMaterial>();

/** Shared material. Never mutate the result: it is used by every instance. */
export function mat(hex: number, rough = 0.88, metal = 0.04, flat = true, emissive = 0, ei = 0): THREE.MeshStandardMaterial {
  const key = `${hex}|${rough}|${metal}|${flat}|${emissive}|${ei}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: hex, roughness: rough, metalness: metal, flatShading: flat,
      emissive, emissiveIntensity: ei,
    });
    mats.set(key, m);
  }
  return m;
}

/** A per-instance glow. The model drives its intensity (states, channel pulse, death). */
export interface Glow { mat: THREE.MeshStandardMaterial; base: number; crystal: boolean }

export function glow(list: Glow[], hex: number, intensity: number, crystal: boolean, body = 0x2a2420, flat = true): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: body, roughness: 0.4, metalness: 0.1, flatShading: flat,
    emissive: hex, emissiveIntensity: intensity,
  });
  list.push({ mat: m, base: intensity, crystal });
  return m;
}

// ---------------------------------------------------------------- geometry

const geos = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geos.get(key);
  if (!g) { g = make(); geos.set(key, g); }
  return g;
}

export const box = (w: number, h: number, d: number) =>
  cached(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (rt: number, rb: number, h: number, seg = 6) =>
  cached(`cyl${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1));
/** Cylinder hanging down from its pivot: top at y=0, bottom at y=-len. */
export const limb = (rt: number, rb: number, len: number, seg = 6) =>
  cached(`limb${rt},${rb},${len},${seg}`, () => new THREE.CylinderGeometry(rt, rb, len, seg, 1).translate(0, -len / 2, 0));
/** Cylinder growing up from its pivot: base at y=0, tip at y=len. */
export const stalk = (rb: number, rt: number, len: number, seg = 5) =>
  cached(`stalk${rb},${rt},${len},${seg}`, () => new THREE.CylinderGeometry(rt, rb, len, seg, 1).translate(0, len / 2, 0));
export const ball = (r: number, ws = 7, hs = 5) =>
  cached(`ball${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
/** Sphere cap from the top down to thetaLen (radians). */
export const cap = (r: number, thetaLen: number, ws = 8, hs = 5) =>
  cached(`cap${r},${thetaLen},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs, 0, TAU, 0, thetaLen));
export const cone = (r: number, h: number, seg = 5) =>
  cached(`cone${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg, 1));
export const ico = (r: number, detail = 0) =>
  cached(`ico${r},${detail}`, () => new THREE.IcosahedronGeometry(r, detail));
export const octa = (r: number) =>
  cached(`octa${r}`, () => new THREE.OctahedronGeometry(r, 0));
export const ring = (r: number, tube: number, rs = 5, ts = 12, arc = TAU) =>
  cached(`ring${r},${tube},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, tube, rs, ts, arc));
export const lathe = (key: string, pts: Array<[number, number]>, seg = 12) =>
  cached(`lathe${key}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg));

// ---------------------------------------------------------------- placement

export function put(
  parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material,
  p?: V3, r?: V3, s?: V3, name?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, m);
  if (p) mesh.position.set(p[0], p[1], p[2]);
  if (r) mesh.rotation.set(r[0], r[1], r[2]);
  if (s) mesh.scale.set(s[0], s[1], s[2]);
  if (name) mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Small glowing bits should not throw shadows. */
export function lit(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = false;
  return mesh;
}

// ---------------------------------------------------------------- randomness and colour

export function rng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedOf(seed: number | undefined, name: string | undefined, salt: string): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const s = (name ?? '') + salt;
  if (name) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  return (Math.random() * 0xffffffff) >>> 0;
}

export function pick<T>(r: () => number, list: T[]): T {
  return list[Math.floor(r() * list.length) % list.length];
}

/** Shift a colour in HSL. Steps are quantised so a crowd reuses a small set of materials. */
export function shade(hex: number, dh: number, ds: number, dl: number): number {
  const q = (v: number, step: number) => Math.round(v / step) * step;
  const c = new THREE.Color(hex);
  c.offsetHSL(q(dh, 0.01), q(ds, 0.04), q(dl, 0.02));
  return c.getHex();
}
