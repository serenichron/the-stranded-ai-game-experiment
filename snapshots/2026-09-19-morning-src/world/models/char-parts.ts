// Body-part geometry for characters: lathe profiles for torsos and limbs, heads with real planes,
// cloth panels, textured materials, and the parts that sway (cloth, hair, tubes).
// Units are metres. Limbs hang down their joint's -Y. Faces look down -Z.
import * as THREE from 'three';
import { tex } from './char-tex';

// ---------------------------------------------------------------- textured materials

const tmats = new Map<string, THREE.MeshStandardMaterial>();

export interface TOpts {
  rough?: number; metal?: number; flat?: boolean; double?: boolean;
  /** Texture repeat along u (round) and v (along). */
  rep?: [number, number];
  emissive?: number; ei?: number; emissiveMap?: string;
}

/** Shared textured material. `key` names a texture in char-tex, or '' for none. Never mutate the result. */
export function tmat(key: string, hex: number, o: TOpts = {}): THREE.MeshStandardMaterial {
  const rep = o.rep ?? [1, 1];
  const id = `${key}|${hex}|${o.rough ?? 0.9}|${o.metal ?? 0}|${o.flat ? 1 : 0}|${o.double ? 1 : 0}|${rep}|${o.emissive ?? 0}|${o.ei ?? 0}|${o.emissiveMap ?? ''}`;
  let m = tmats.get(id);
  if (m) return m;
  let map: THREE.Texture | null = null;
  if (key) {
    const base = tex(key);
    if (rep[0] === 1 && rep[1] === 1) map = base;
    else { map = base.clone(); map.repeat.set(rep[0], rep[1]); map.needsUpdate = true; }
  }
  let em: THREE.Texture | null = null;
  if (o.emissiveMap) {
    const base = tex(o.emissiveMap);
    em = rep[0] === 1 && rep[1] === 1 ? base : base.clone();
    if (em !== base) { em.repeat.set(rep[0], rep[1]); em.needsUpdate = true; }
  }
  m = new THREE.MeshStandardMaterial({
    color: hex, map, roughness: o.rough ?? 0.9, metalness: o.metal ?? 0,
    flatShading: !!o.flat, side: o.double ? THREE.DoubleSide : THREE.FrontSide,
    emissive: o.emissive ?? 0, emissiveIntensity: o.ei ?? 0, emissiveMap: em,
  });
  m.name = `char:${key || 'plain'}`;
  tmats.set(id, m);
  return m;
}

// ---------------------------------------------------------------- lathe profiles

const geos = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geos.get(key);
  if (!g) { g = make(); geos.set(key, g); }
  return g;
}

/**
 * A limb that hangs down from its pivot. `prof` is a list of [t, radius] with t from 0 (pivot)
 * to 1 (far end). Both ends are closed. v of the UV runs 0 at the pivot to 1 at the end.
 */
export function tube(key: string, len: number, prof: Array<[number, number]>, seg = 10): THREE.BufferGeometry {
  return cached(`tube:${key}:${len}:${seg}`, () => {
    const pts: THREE.Vector2[] = [];
    const last = prof[prof.length - 1], first = prof[0];
    pts.push(new THREE.Vector2(0.0001, -len * last[0] - last[1] * 0.35));
    for (let i = prof.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(prof[i][1], -len * prof[i][0]));
    pts.push(new THREE.Vector2(0.0001, -len * first[0] + first[1] * 0.35));
    const g = new THREE.LatheGeometry(pts, seg);
    flipV(g);
    return g;
  });
}

/** Same as tube but grows upwards from the pivot (torsos, necks). v runs 0 at the bottom. */
export function column(key: string, prof: Array<[number, number]>, seg = 12, openTop = false, openBottom = false): THREE.BufferGeometry {
  return cached(`col:${key}:${seg}:${openTop}:${openBottom}`, () => {
    const pts: THREE.Vector2[] = [];
    if (!openBottom) pts.push(new THREE.Vector2(0.0001, prof[0][0] - prof[0][1] * 0.2));
    for (const [y, r] of prof) pts.push(new THREE.Vector2(r, y));
    const top = prof[prof.length - 1];
    if (!openTop) pts.push(new THREE.Vector2(0.0001, top[0] + top[1] * 0.2));
    return new THREE.LatheGeometry(pts, seg);
  });
}

function flipV(g: THREE.BufferGeometry): void {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  uv.needsUpdate = true;
}

/** A skirt or robe: an open lathe that flares downwards from the waist. Double-sided material. */
export function skirt(key: string, top: number, bottom: number, len: number, flare = 0.5, seg = 14): THREE.BufferGeometry {
  return cached(`skirt:${key}:${top}:${bottom}:${len}:${flare}:${seg}`, () => {
    const pts: THREE.Vector2[] = [];
    const n = 5;
    for (let i = n; i >= 0; i--) {
      const t = i / n;
      const r = top + (bottom - top) * Math.pow(t, flare);
      pts.push(new THREE.Vector2(r, -len * t));
    }
    const g = new THREE.LatheGeometry(pts, seg);
    flipV(g);
    return g;
  });
}

// ---------------------------------------------------------------- heads

export interface HeadShape {
  w: number; h: number; d: number;
  /** 0 round chin, 1 square heavy jaw. */
  jaw: number;
  /** Chin pushed forward, in unit-sphere terms. */
  chin: number;
  brow: number;
  cheek: number;
  /** Back of skull length multiplier. */
  back: number;
  /** Top of the skull pulled up and back (Iskari, Sehari). */
  crown: number;
  /** Eye socket depth. */
  socket: number;
  seg?: number;
}

/** A skull with brow, sockets, cheekbones and a jaw. Origin at the middle of the head. */
export function headGeo(key: string, s: HeadShape): THREE.BufferGeometry {
  return cached(`head:${key}`, () => {
    const seg = s.seg ?? 16;
    const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.8));
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const front = Math.max(0, -z); // 1 at the face
      // jaw: taper below the cheek line, squarer with `jaw`
      if (y < -0.1) {
        const t = (-y - 0.1) / 0.9;
        x *= 1 - (0.55 - 0.35 * s.jaw) * Math.pow(t, 1.3);
        z = z < 0 ? z - s.chin * t * t * front : z * (1 - 0.35 * t);
      }
      // brow ridge
      const browBand = Math.exp(-Math.pow((y - 0.22) / 0.12, 2));
      z -= s.brow * browBand * Math.pow(front, 3);
      // eye sockets
      const sock = Math.exp(-Math.pow((y - 0.05) / 0.1, 2)) * Math.exp(-Math.pow((Math.abs(x) - 0.36) / 0.16, 2));
      z += s.socket * sock * front;
      // cheekbones
      const cheekBand = Math.exp(-Math.pow((y + 0.12) / 0.14, 2)) * Math.pow(Math.min(1, Math.abs(x) * 1.4), 2);
      x *= 1 + s.cheek * cheekBand * (0.5 + 0.5 * front);
      // flat temples: pull the sides in above the cheek
      if (y > 0 && Math.abs(x) > 0.75) x = Math.sign(x) * (0.75 + (Math.abs(x) - 0.75) * 0.5);
      // back of the skull and crown
      if (z > 0) z *= s.back;
      if (y > 0.3) { y += s.crown * (y - 0.3) * (0.4 + Math.max(0, z)); z += s.crown * 0.5 * (y - 0.3); }
      p.setXYZ(i, x * s.w, y * s.h, z * s.d);
    }
    g.computeVertexNormals();
    return g;
  });
}

// ---------------------------------------------------------------- cloth panels

/** A cloth panel hanging from its top edge, curved round a body of radius `curve`. Double-sided material. */
export function panel(key: string, w: number, h: number, curve = 0, taper = 1, hs = 4): THREE.BufferGeometry {
  return cached(`panel:${key}:${w}:${h}:${curve}:${taper}:${hs}`, () => {
    const ws = 4;
    const g = new THREE.PlaneGeometry(w, h, ws, hs);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      const y = p.getY(i) - h / 2; // top edge at y = 0
      const t = -y / h;
      x *= 1 + (taper - 1) * t;
      // ragged hem: the bottom row gets a little jitter
      const hem = t > 0.99 ? Math.sin(x * 57) * 0.02 * h : 0;
      let z = 0;
      if (curve > 0) { const a = x / curve; z = curve - Math.cos(a) * curve; x = Math.sin(a) * curve; }
      p.setXYZ(i, x, y + hem, z);
    }
    g.computeVertexNormals();
    return g;
  });
}

// ---------------------------------------------------------------- sway

/**
 * A part that hangs and lags behind: cloth panels, hair, tubes. The rig drives it every frame.
 * `pivot` rotates. Its local -Y is the hanging direction.
 */
export interface Sway {
  pivot: THREE.Object3D;
  /** 0 keeps the rest angle, 1 hangs straight down in the world. */
  hang: number;
  /** Rest rotation (x, z) when not hanging. */
  rest: [number, number];
  /** How much it trails behind motion. */
  drag: number;
  stiff: number;
  damp: number;
  /** Keep x at or above this (front panels pushed by a forward thigh). */
  minX?: () => number;
  maxX?: () => number;
  /** Wind flutter amplitude. */
  flutter?: number;
  // runtime
  ax?: number; az?: number; vx?: number; vz?: number;
  prev?: THREE.Vector3; vel?: THREE.Vector3;
}

export function swayPivot(parent: THREE.Object3D, p: [number, number, number], rest: [number, number] = [0, 0]): THREE.Object3D {
  const o = new THREE.Object3D();
  o.position.set(p[0], p[1], p[2]);
  o.rotation.set(rest[0], 0, rest[1]);
  parent.add(o);
  return o;
}

const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _d = new THREE.Vector3();

export function stepSway(list: Sway[], dt: number, clock: number): void {
  if (dt <= 0) return;
  for (const s of list) {
    const par = s.pivot.parent!;
    s.pivot.getWorldPosition(_w);
    if (!s.prev) { s.prev = _w.clone(); s.vel = new THREE.Vector3(); s.ax = s.rest[0]; s.az = s.rest[1]; s.vx = 0; s.vz = 0; }
    // smoothed world velocity of the pivot
    _d.copy(_w).sub(s.prev).divideScalar(dt);
    s.vel!.lerp(_d, Math.min(1, dt * 12));
    s.prev.copy(_w);
    // desired world direction: down, trailing against the motion, with a little wind
    const fl = s.flutter ?? 0.15;
    _d.set(
      -s.vel!.x * s.drag + fl * 0.5 * Math.sin(clock * 2.3 + _w.x),
      -1,
      -s.vel!.z * s.drag + fl * 0.3 * Math.sin(clock * 1.7 + _w.z * 1.3),
    ).normalize();
    // into the parent's frame
    par.getWorldQuaternion(_q).invert();
    _d.applyQuaternion(_q);
    const hx = Math.atan2(-_d.z, -_d.y);
    const hz = Math.asin(Math.max(-1, Math.min(1, _d.x)));
    let tx = s.rest[0] + (hx - s.rest[0]) * s.hang;
    const tz = s.rest[1] + (hz - s.rest[1]) * s.hang;
    // wrap to the nearest turn so a lying body does not spin the cloth round
    while (tx - s.ax! > Math.PI) tx -= Math.PI * 2;
    while (tx - s.ax! < -Math.PI) tx += Math.PI * 2;
    s.vx! += (tx - s.ax!) * s.stiff * dt;
    s.vz! += (tz - s.az!) * s.stiff * dt;
    const k = Math.exp(-s.damp * dt);
    s.vx! *= k; s.vz! *= k;
    s.ax! += s.vx! * dt;
    s.az! += s.vz! * dt;
    if (s.minX) { const m = s.minX(); if (s.ax! < m) { s.ax = m; s.vx = Math.max(0, s.vx!); } }
    if (s.maxX) { const m = s.maxX(); if (s.ax! > m) { s.ax = m; s.vx = Math.min(0, s.vx!); } }
    s.pivot.rotation.x = s.ax!;
    s.pivot.rotation.z = s.az!;
  }
}
