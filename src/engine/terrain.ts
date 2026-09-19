import * as THREE from 'three';
import type { Feature, Ground } from '../level/layout';

// The ground: one big vertex-coloured mesh with a canvas grain texture.
// Height comes from ridges, the Scar and the dunes outside the map edge.

export function hash2(x: number, y: number) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t: number) { return t * t * (3 - 2 * t); }
export function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}

export function distToPolyline(px: number, py: number, pts: [number, number][]) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + dx * t - px, qy = ay + dy * t - py;
    best = Math.min(best, Math.hypot(qx, qy));
  }
  return best;
}

// Keyed from the concept paintings: pale bone-ochre sand, not orange. The light does the warming.
const GROUND_COLOUR: Record<Ground, THREE.Color> = {
  sand: new THREE.Color(0xd3b286),
  packed: new THREE.Color(0xbc9c74),
  path: new THREE.Color(0xc8a87e),
  plaza: new THREE.Color(0xd4c8b0),
  scar: new THREE.Color(0x8e4c32),
  oasis: new THREE.Color(0x8a8858),
  rock: new THREE.Color(0xa88a6c),
};
const sat = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

export class Terrain {
  readonly mesh: THREE.Mesh;
  private kinds: Ground[];
  private ridges: { pts: [number, number][]; width: number; height: number }[] = [];
  private chasms: [number, number, number, number][] = [];
  private plateaus: { x: number; y: number; r: number; h: number }[] = [];
  private trenches: { pts: [number, number][]; w: number; d: number }[] = [];
  readonly margin = 26;

  constructor(readonly W: number, readonly H: number, features: Feature[]) {
    this.kinds = new Array(W * H).fill('sand');
    for (const f of features) {
      if (f.t === 'ridge') this.ridges.push({ pts: f.pts, width: f.width, height: f.height });
      if (f.t === 'chasm') this.chasms.push(f.rect);
      if (f.t === 'trench') this.trenches.push({ pts: f.pts, w: f.width, d: f.depth });
      if (f.t === 'floor-disc' && f.raise) this.plateaus.push({ x: f.at[0], y: f.at[1], r: f.r, h: f.raise });
      if (f.t !== 'ground') continue;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const cx = x + 0.5, cy = y + 0.5;
        let hit = false;
        if (f.rect) { const [rx, ry, rw, rh] = f.rect; hit = cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh; }
        if (f.circle) hit = Math.hypot(cx - f.circle[0], cy - f.circle[1]) <= f.circle[2];
        if (f.line) hit = distToPolyline(cx, cy, f.line) <= (f.width ?? 1) / 2 + (hash2(x, y) - 0.5) * 0.5;
        if (hit) this.kinds[y * W + x] = f.kind;
      }
    }
    this.mesh = this.build();
  }

  kindAt(x: number, y: number): Ground {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.W || yi >= this.H) return 'sand';
    return this.kinds[yi * this.W + xi];
  }

  /** Height in world units at level coords (x east, y south). */
  heightAt(x: number, y: number): number {
    let h = (fbm(x * 0.18, y * 0.18, 3) - 0.5) * 0.28;
    for (const r of this.ridges) {
      const d = distToPolyline(x, y, r.pts);
      const reach = r.width * 0.5 + 1.6;
      if (d < reach) {
        const k = smooth(1 - d / reach);
        h += r.height * k * (0.65 + 0.55 * fbm(x * 0.45 + 11, y * 0.45 - 7, 3));
      }
    }
    // dunes past the edge. With a Scar on the north edge, its far lip is the edge instead.
    const northEdge = this.chasms.length ? -15 : 0;
    const out = Math.max(0, -x, x - this.W, northEdge - y, y - this.H);
    if (out > 0) {
      // a rim of dunes close to the map, then low rolling plain out to the horizon
      const rim = 6.5 * smooth(sat(out / 14)) * (1 - 0.82 * smooth(sat((out - 26) / 40)));
      h += rim * (0.6 + 0.6 * fbm(x * 0.09 + 3, y * 0.09, 3)) + smooth(sat(out / 40)) * (fbm(x * 0.03, y * 0.03, 3) - 0.35) * 5;
    }
    // crash trenches: a gouge with a berm of thrown sand either side
    for (const tr of this.trenches) {
      const d = distToPolyline(x, y, tr.pts), hw = tr.w / 2;
      if (d < hw + 1.6) h += -tr.d * (1 - smooth(sat(d / hw))) + tr.d * 0.45 * Math.exp(-(((d - hw - 0.35) / 0.55) ** 2)) * (0.7 + 0.6 * fbm(x * 0.5, y * 0.5, 2));
    }
    // raised courts: dead flat on top, so feet meet the floor; a short ramp of sand all round
    for (const p of this.plateaus) {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < p.r + 1.8) h = d <= p.r ? p.h : h + (p.h - h) * (1 - smooth(sat((d - p.r) / 1.8)));
    }
    for (const [, ry, , rh] of this.chasms) {
      // The Scar, as the world map draws it: a narrow zigzag fissure across the whole continent,
      // steep-walled and dark, the land carrying on beyond it. It ignores the x range.
      // jagged: the lip line is broken by noise, and the walls drop in two uneven shelves
      const d = Math.abs(y - this.scarCentre(x, ry, rh)) + (vnoise(x * 2.1, y * 2.1) - 0.5) * 0.7, w = this.scarHalf(x);
      if (d < w + 0.6) {
        const shelf = 0.35 + 0.3 * vnoise(x * 0.7, 3.3);
        const k1 = smooth(sat((w + 0.6 - d) / 0.6)) * shelf;             // a broken ledge just inside the lip
        const k2 = smooth(sat((w - 0.2 - d) / 0.45));                    // then the long drop
        h -= k1 * 1.6 + k2 * (15 + fbm(x * 0.2, y * 0.2) * 6);
      }
    }
    return h;
  }

  /** Centre line of the Scar at x (level y). Zigzag: a slow wander plus sharp jags. */
  scarCentre(x: number, ry = this.chasms[0]?.[1] ?? 0, rh = this.chasms[0]?.[3] ?? 4) {
    const tri = (t: number) => Math.abs(((t % 2) + 2) % 2 - 1) * 2 - 1;
    return ry + rh * 0.42 + (fbm(x * 0.05, 3.7, 3) - 0.5) * 2.2 + tri(x * 0.23 + fbm(x * 0.1, 8, 2) * 1.5) * 0.45;
  }
  /** Half width of the Scar's mouth at x. */
  scarHalf(x: number) { return 0.9 + 1.1 * fbm(x * 0.09 + 9, 1.3, 3) + 0.25 * vnoise(x * 1.1, 4.2); }
  /** Distance from the Scar's lip (negative inside it). Infinity when the level has no Scar. */
  scarLip(x: number, y: number) {
    if (!this.chasms.length) return Infinity;
    return Math.abs(y - this.scarCentre(x)) - this.scarHalf(x);
  }

  private build(): THREE.Mesh {
    const m = this.margin, step = 0.5;
    const x0 = -m, y0 = -m, x1 = this.W + m, y1 = this.H + m;
    const nx = Math.round((x1 - x0) / step) + 1, ny = Math.round((y1 - y0) / step) + 1;
    const pos = new Float32Array(nx * ny * 3);
    const col = new Float32Array(nx * ny * 4);
    const uv = new Float32Array(nx * ny * 2);
    const c = new THREE.Color(), tmp = new THREE.Color();
    const rockC = new THREE.Color(0xa8866a), rockDark = new THREE.Color(0x806250), duneC = new THREE.Color(0xd2b690);
    const chasmC = new THREE.Color(0x1e0c08);
    const strataA = new THREE.Color(0x9a4c2e), strataB = new THREE.Color(0x7c5c42);
    const hazeC = new THREE.Color(0xd0b496);
    const scarRust = new THREE.Color(0x8a4430), scarViolet = new THREE.Color(0x5e3a42);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * step, y = y0 + j * step;
      const h = this.heightAt(x, y);
      const k = (j * nx + i);
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = y;
      uv[k * 2] = x / 6; uv[k * 2 + 1] = y / 6;
      // blend ground kinds from the four nearest tiles for soft borders
      c.setRGB(0, 0, 0);
      let wsum = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const sx = x + ox * 0.7, sy = y + oy * 0.7;
        const w = ox === 0 && oy === 0 ? 2 : 1;
        c.r += GROUND_COLOUR[this.kindAt(sx, sy)].r * w;
        c.g += GROUND_COLOUR[this.kindAt(sx, sy)].g * w;
        c.b += GROUND_COLOUR[this.kindAt(sx, sy)].b * w;
        wsum += w;
      }
      c.multiplyScalar(1 / wsum);
      const n = fbm(x * 0.6, y * 0.6, 3);
      c.multiplyScalar(0.88 + n * 0.24);
      // ridges and dunes: rock where steep and high
      if (h > 0.5) {
        const rk = Math.min(1, (h - 0.5) / 2.2);
        tmp.copy(rockC).lerp(rockDark, fbm(x * 1.3, y * 1.3, 2));
        const out = Math.max(0, -x, x - this.W, -y, y - this.H);
        c.lerp(out > 1 ? duneC : tmp, rk * (out > 1 ? 0.6 : 0.9));
      }
      // the Scar's lips: violet-rust right at the edge, rust-brown beyond, broken up, fading into sand
      const lip = this.scarLip(x, y);
      if (lip < 7) {
        const e = lip + (fbm(x * 0.4, y * 0.4, 3) - 0.5) * 3;
        c.lerp(scarRust, (1 - smooth(sat(e / 7))) * 0.9);
        c.lerp(scarViolet, (1 - smooth(sat((e + 0.3) / 2.2))) * 0.8);
      }
      if (h < -0.3) {
        // the Scar: layered rust and ochre strata, darkening with depth
        const band = Math.sin(h * 2.4 + fbm(x * 0.12, 3.1, 2) * 0.8) * 0.5 + 0.5;
        tmp.copy(strataA).lerp(strataB, band);
        c.lerp(tmp, Math.min(1, (-h - 0.3) / 1.2));
        c.lerp(chasmC, Math.min(0.97, Math.max(0, (-h - 0.6) / 2.6)));
      }
      // the world past the map fades into warm haze
      const far = Math.max(0, -x, x - this.W, -15 - y, y - this.H);
      if (far > 2) c.lerp(hazeC, Math.min(0.25, (far - 2) / 60));
      // alpha carries the cracked-earth mask for the surface layer: packed, rocky and dead ground crack
      const kd = this.kindAt(x, y);
      const crack = Math.max(kd === 'packed' ? 0.8 : kd === 'rock' ? 0.9 : kd === 'path' ? 0.35 : h > 0.5 ? 0.7 : 0, 1 - smooth(sat(this.scarLip(x, y) / 8)));
      col[k * 4] = c.r; col[k * 4 + 1] = c.g; col[k * 4 + 2] = c.b; col[k * 4 + 3] = crack;
    }
    const idx: number[] = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.96, metalness: 0,
      map: grainTexture(), bumpMap: grainTexture(), bumpScale: 0.6,
    });
    mat.userData.surface = 'ground';
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }
}

/**
 * The land past the play area, out to the horizon: one coarse mesh, same height function.
 * Where the fine terrain already covers the ground, this one tucks underneath it.
 */
export function buildFarGround(t: Terrain, reach = 420, step = 6): THREE.Mesh {
  const m = t.margin;
  const x0 = -reach, x1 = t.W + reach, y0 = -reach, y1 = t.H + reach;
  const nx = Math.ceil((x1 - x0) / step) + 1, ny = Math.ceil((y1 - y0) / step) + 1;
  const pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3);
  const sand = new THREE.Color(0xd2b690), dusk = new THREE.Color(0xb89a86), rock = new THREE.Color(0x9a7a66), c = new THREE.Color();
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * step, y = y0 + j * step, k = j * nx + i;
    let h = t.heightAt(x, y);
    // inside the fine terrain: sink well below it; in the overlap band: just under it
    const inX = x > -m && x < t.W + m, inY = y > -m && y < t.H + m;
    if (inX && inY) {
      const edge = Math.min(x + m, t.W + m - x, y + m, t.H + m - y);
      h -= edge > step * 1.5 ? 6 : 0.45;
    }
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = y;
    const n = fbm(x * 0.02, y * 0.02, 3), n2 = fbm(x * 0.11 + 5, y * 0.11, 2);
    c.copy(sand).lerp(dusk, smooth(sat((n - 0.35) * 2.2)) * 0.7).lerp(rock, smooth(sat((n2 - 0.62) * 4)) * 0.6);
    c.multiplyScalar(0.92 + n2 * 0.16);
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  const idx: number[] = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  mesh.name = 'far-ground';
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  mesh.userData.noMerge = true;
  return mesh;
}

/**
 * Hairline cracks branching off the Scar's lips, as on the world map: dark, jagged, tapering,
 * laid on the ground. One mesh.
 */
export function buildScarCracks(t: Terrain, seed = 5): THREE.Mesh | null {
  if (!Number.isFinite(t.scarLip(0, 0))) return null;
  const pos: number[] = [];
  let s = seed;
  const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 34; i++) {
    const x0 = -20 + R() * (t.W + 40);
    const side = R() < 0.5 ? -1 : 1;
    let x = x0, y = t.scarCentre(x0) + side * (t.scarHalf(x0) - 0.1);
    let dir = side * (Math.PI / 2) + (R() - 0.5) * 1.2; // away from the fissure, angle from +x
    const len = 2 + R() * 6, n = Math.ceil(len / 0.35);
    let prev: [number, number] | null = null;
    for (let k = 0; k <= n; k++) {
      const w = 0.16 * (1 - k / n) + 0.015;
      const nx = -Math.sin(dir), ny = Math.cos(dir);
      const cur: [number, number] = [x, y];
      if (prev) {
        const [px, py] = prev, pw = 0.16 * (1 - (k - 1) / n) + 0.015;
        const q = (ax: number, ay: number) => [ax, t.heightAt(ax, ay) + 0.025, ay];
        const a = q(px + nx * pw, py + ny * pw), b = q(px - nx * pw, py - ny * pw), c = q(x + nx * w, y + ny * w), d = q(x - nx * w, y - ny * w);
        pos.push(...a, ...c, ...b, ...b, ...c, ...d);
      }
      prev = cur;
      dir += (R() - 0.5) * 0.9;
      x += Math.cos(dir) * 0.35; y += Math.sin(dir) * 0.35;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: 0x2a1a18, roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, m);
  mesh.name = 'scar-cracks';
  mesh.receiveShadow = true;
  mesh.userData.noMerge = true;
  return mesh;
}

let grainTex: THREE.CanvasTexture | null = null;
/** Soft sand grain and wind ripples, greyscale around mid-grey so vertex colours stay true. */
export function grainTexture() {
  if (grainTex) return grainTex;
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const ripple = Math.sin((x * 0.9 + y * 0.35 + fbm(x * 0.02, y * 0.02, 3) * 60) * 0.18) * 0.5 + 0.5;
    const n = fbm(x * 0.05, y * 0.05, 4) * 0.55 + hash2(x, y) * 0.25 + ripple * 0.2;
    const v = Math.round(228 + (n - 0.5) * 60);
    const i = (y * S + x) * 4;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTex = new THREE.CanvasTexture(cv);
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  grainTex.anisotropy = 8;
  return grainTex;
}
