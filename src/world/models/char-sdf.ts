// Sculpted character meshes. A body is described as a list of simple shapes (capsules, ellipsoids,
// rounded boxes) blended with a smooth union, like clay. The blend is meshed once with surface nets
// into one continuous skin, then weighted to the rig's bones so it bends as one piece.
// Clothing is the same idea: body shapes inflated a little and cut off by planes (hems, sleeves).
//
// Phase 2, round 3: this replaces the jointed-doll bodies (tubes and balls per bone), which the
// blind critic and the user both read as mannequins.
import * as THREE from 'three';

export type V3 = [number, number, number];

export interface Prim {
  kind: 'cap' | 'ell' | 'box';
  /** cap: segment start. ell/box: centre. */
  a: V3;
  /** cap: segment end. */
  b?: V3;
  /** cap: radius at a (and b unless r2). box: corner rounding. */
  r?: number;
  r2?: number;
  /** ell: radii. box: half sizes. cap: optional squash about a, in world axes. */
  s?: V3;
  /** ell/box: rotation (Euler XYZ, radians). */
  rot?: V3;
  /** Bone index this shape moves with (rig joint order), or -1 for a rigid mesh. */
  bone: number;
  /** Material slot. */
  mat: number;
  /** Smooth-union width in metres. 0 = hard union. */
  k: number;
  /** Carve this shape out instead of adding it. */
  sub?: boolean;
  /** Free label, used to copy body shapes into clothing layers. */
  tag?: string;
  /** Keep only the side where dot(p, n) < o (hems, sleeve ends, skirt bottoms). */
  clip?: Array<{ n: V3; o: number }>;
  // prepared
  _m?: THREE.Matrix4; _min?: V3; _max?: V3;
}

export interface SdfResult {
  pos: Float32Array; nrm: Float32Array; owner: Int32Array; idx: Uint32Array; triOwner: Int32Array; count: number;
}

// ---------------------------------------------------------------- distance functions


function prep(p: Prim): void {
  if ((p.kind === 'ell' || p.kind === 'box') && p.rot && (p.rot[0] || p.rot[1] || p.rot[2])) {
    p._m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(p.rot[0], p.rot[1], p.rot[2])).invert();
  }
  // bounds for block culling
  let lo: V3, hi: V3;
  if (p.kind === 'cap') {
    const b = p.b ?? p.a, r = Math.max(p.r ?? 0, p.r2 ?? p.r ?? 0);
    const s = p.s ? Math.max(...p.s) : 1;
    lo = [Math.min(p.a[0], b[0]) - r * s, Math.min(p.a[1], b[1]) - r * s, Math.min(p.a[2], b[2]) - r * s];
    hi = [Math.max(p.a[0], b[0]) + r * s, Math.max(p.a[1], b[1]) + r * s, Math.max(p.a[2], b[2]) + r * s];
  } else {
    const s = p.s!, e = Math.max(s[0], s[1], s[2]) + (p.r ?? 0);
    lo = [p.a[0] - e, p.a[1] - e, p.a[2] - e];
    hi = [p.a[0] + e, p.a[1] + e, p.a[2] + e];
  }
  p._min = lo; p._max = hi;
}

function dist(p: Prim, x: number, y: number, z: number): number {
  let d: number;
  if (p.kind === 'cap') {
    const a = p.a, b = p.b ?? p.a;
    let px = x - a[0], py = y - a[1], pz = z - a[2];
    let sc = 1;
    if (p.s) { px /= p.s[0]; py /= p.s[1]; pz /= p.s[2]; sc = Math.min(p.s[0], p.s[1], p.s[2]); }
    const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
    const bb = bx * bx + by * by + bz * bz;
    let t = bb > 0 ? (px * bx + py * by + pz * bz) / bb : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = px - bx * t, qy = py - by * t, qz = pz - bz * t;
    d = (Math.sqrt(qx * qx + qy * qy + qz * qz) - ((p.r ?? 0) + ((p.r2 ?? p.r ?? 0) - (p.r ?? 0)) * t)) * sc;
  } else {
    let tx = x - p.a[0], ty = y - p.a[1], tz = z - p.a[2];
    if (p._m) {
      const e = p._m.elements;
      const rx = e[0] * tx + e[4] * ty + e[8] * tz, ry = e[1] * tx + e[5] * ty + e[9] * tz, rz = e[2] * tx + e[6] * ty + e[10] * tz;
      tx = rx; ty = ry; tz = rz;
    }
    const s = p.s!;
    if (p.kind === 'ell') {
      const ax = tx / s[0], ay = ty / s[1], az = tz / s[2];
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
      const bx = ax / s[0], by = ay / s[1], bz = az / s[2];
      const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
      d = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(s[0], s[1], s[2]);
    } else {
      const pr = p.r ?? 0;
      const qx = Math.abs(tx) - s[0] + pr, qy = Math.abs(ty) - s[1] + pr, qz = Math.abs(tz) - s[2] + pr;
      const mx = qx > 0 ? qx : 0, my = qy > 0 ? qy : 0, mz = qz > 0 ? qz : 0;
      d = Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - pr;
    }
  }
  if (p.clip) for (const c of p.clip) d = Math.max(d, x * c.n[0] + y * c.n[1] + z * c.n[2] - c.o);
  return d;
}

function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** The blended field at a point. `own` receives the index of the shape that owns the surface there. */
function field(prims: Prim[], x: number, y: number, z: number, own?: { i: number }): number {
  let res = 1e9, best = 1e9, bi = -1;
  for (let i = 0; i < prims.length; i++) {
    const p = prims[i];
    // far from this shape's bounds: its distance cannot matter to the blend
    const lo = p._min!, hi = p._max!;
    const ox = Math.max(lo[0] - x, 0, x - hi[0]), oy = Math.max(lo[1] - y, 0, y - hi[1]), oz = Math.max(lo[2] - z, 0, z - hi[2]);
    const out = Math.sqrt(ox * ox + oy * oy + oz * oz);
    if (!p.sub && out > res + p.k + 0.002) continue;
    if (p.sub && out > 0.02) continue;
    const d = dist(p, x, y, z);
    if (p.sub) { res = -smin(-res, d, p.k); continue; }
    res = smin(res, d, p.k);
    if (d < best) { best = d; bi = i; }
  }
  if (own) own.i = bi;
  return res;
}

// ---------------------------------------------------------------- surface nets

const CORNERS: V3[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES: Array<[number, number]> = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

export function mesh(prims: Prim[], cell: number): SdfResult {
  for (const p of prims) prep(p);
  // grid bounds from the union of shape bounds
  const lo: V3 = [1e9, 1e9, 1e9], hi: V3 = [-1e9, -1e9, -1e9];
  for (const p of prims) {
    if (p.sub) continue;
    for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p._min![a]); hi[a] = Math.max(hi[a], p._max![a]); }
  }
  for (let a = 0; a < 3; a++) { lo[a] -= cell * 2; hi[a] += cell * 2; }
  const nx = Math.ceil((hi[0] - lo[0]) / cell) + 1, ny = Math.ceil((hi[1] - lo[1]) / cell) + 1, nz = Math.ceil((hi[2] - lo[2]) / cell) + 1;
  const vals = new Float32Array(nx * ny * nz);
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  // Blocks of B cells. Each near-surface block keeps only the shapes that can change the field inside it,
  // so most samples test a handful of shapes instead of every one (phase 2: 1.5 s per body was too slow).
  const B = 4;
  const bx = Math.ceil(nx / B), by = Math.ceil(ny / B), bz = Math.ceil(nz / B);
  const lists: Array<{ ps: Prim[]; ix: number[] } | null> = new Array(bx * by * bz).fill(null);
  const idxOf = new Map<Prim, number>(prims.map((q, i) => [q, i]));
  const kmax = prims.reduce((m, q) => Math.max(m, q.k), 0);
  const listFor = (bi: number, bj: number, bk: number, dc: number) => {
    const key = bi + bx * (bj + by * bk);
    let L = lists[key];
    if (L) return L;
    const x0 = lo[0] + bi * B * cell, y0 = lo[1] + bj * B * cell, z0 = lo[2] + bk * B * cell;
    const x1 = x0 + B * cell, y1 = y0 + B * cell, z1 = z0 + B * cell;
    const diag = Math.sqrt(3) * B * cell + 2 * cell;
    const reach = Math.max(dc, 0) + diag + kmax + 0.004;
    L = { ps: [], ix: [] };
    for (const q of prims) {
      const a = q._min!, b = q._max!;
      const ox = Math.max(a[0] - x1, 0, x0 - b[0]), oy = Math.max(a[1] - y1, 0, y0 - b[1]), oz = Math.max(a[2] - z1, 0, z0 - b[2]);
      const bd = Math.sqrt(ox * ox + oy * oy + oz * oz);
      if (bd <= (q.sub ? q.k + diag : reach)) { L.ps.push(q); L.ix.push(idxOf.get(q)!); }
    }
    lists[key] = L;
    return L;
  };
  const blockDc = new Float32Array(bx * by * bz);
  for (let bk = 0; bk < bz; bk++) for (let bj = 0; bj < by; bj++) for (let bi = 0; bi < bx; bi++) {
    const cx = lo[0] + (bi * B + B / 2) * cell, cy = lo[1] + (bj * B + B / 2) * cell, cz = lo[2] + (bk * B + B / 2) * cell;
    const dc = field(prims, cx, cy, cz);
    blockDc[bi + bx * (bj + by * bk)] = dc;
    const far = Math.abs(dc) > cell * B * 1.25;
    const L = far ? null : listFor(bi, bj, bk, dc);
    for (let k = bk * B; k < Math.min(bk * B + B, nz); k++) for (let j = bj * B; j < Math.min(bj * B + B, ny); j++) for (let i = bi * B; i < Math.min(bi * B + B, nx); i++) {
      vals[at(i, j, k)] = L ? field(L.ps, lo[0] + i * cell, lo[1] + j * cell, lo[2] + k * cell) : dc;
    }
  }
  /** The field near a surface point, using its block's short list. */
  const fieldNear = (x: number, y: number, z: number, own?: { i: number }) => {
    const bi = Math.min(bx - 1, Math.max(0, Math.floor((x - lo[0]) / cell / B)));
    const bj = Math.min(by - 1, Math.max(0, Math.floor((y - lo[1]) / cell / B)));
    const bk = Math.min(bz - 1, Math.max(0, Math.floor((z - lo[2]) / cell / B)));
    const L = listFor(bi, bj, bk, blockDc[bi + bx * (bj + by * bk)]);
    const d = field(L.ps, x, y, z, own);
    if (own) own.i = own.i >= 0 ? L.ix[own.i] : 0;
    return d;
  };
  // one vertex per cell that the surface passes through
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cellIdx = new Int32Array(cx * cy * cz).fill(-1);
  const P: number[] = [];
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let mask = 0;
    const v: number[] = [];
    for (let c = 0; c < 8; c++) {
      const val = vals[at(i + CORNERS[c][0], j + CORNERS[c][1], k + CORNERS[c][2])];
      v.push(val);
      if (val < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [e0, e1] of EDGES) {
      const a = v[e0], b = v[e1];
      if ((a < 0) === (b < 0)) continue;
      const t = a / (a - b);
      const c0 = CORNERS[e0], c1 = CORNERS[e1];
      sx += c0[0] + (c1[0] - c0[0]) * t; sy += c0[1] + (c1[1] - c0[1]) * t; sz += c0[2] + (c1[2] - c0[2]) * t;
      n++;
    }
    cellIdx[i + cx * (j + cy * k)] = P.length / 3;
    P.push(lo[0] + (i + sx / n) * cell, lo[1] + (j + sy / n) * cell, lo[2] + (k + sz / n) * cell);
  }
  const count = P.length / 3;
  const pos = new Float32Array(P);
  const nrm = new Float32Array(count * 3);
  const owner = new Int32Array(count);
  const own = { i: 0 };
  const e = cell * 0.5;
  for (let v = 0; v < count; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    let gx = fieldNear(x + e, y, z) - fieldNear(x - e, y, z);
    let gy = fieldNear(x, y + e, z) - fieldNear(x, y - e, z);
    let gz = fieldNear(x, y, z + e) - fieldNear(x, y, z - e);
    let gl = Math.hypot(gx, gy, gz) || 1;
    gx /= gl; gy /= gl; gz /= gl;
    // one Newton step onto the surface
    const d = fieldNear(x, y, z, own);
    if (Math.abs(d) < cell) { x -= gx * d; y -= gy * d; z -= gz * d; }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    nrm[v * 3] = gx; nrm[v * 3 + 1] = gy; nrm[v * 3 + 2] = gz;
    owner[v] = own.i;
  }
  // a quad across every grid edge the surface crosses
  const I: number[] = [];
  const T: number[] = [];
  const cid = (i: number, j: number, k: number) => cellIdx[i + cx * (j + cy * k)];
  const quad = (a: number, b: number, c: number, d: number) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // orient by the field normal
    const ax = pos[b * 3] - pos[a * 3], ay = pos[b * 3 + 1] - pos[a * 3 + 1], az = pos[b * 3 + 2] - pos[a * 3 + 2];
    const bx = pos[c * 3] - pos[a * 3], by = pos[c * 3 + 1] - pos[a * 3 + 1], bz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const fx = ay * bz - az * by, fy = az * bx - ax * bz, fz = ax * by - ay * bx;
    const dot = fx * (nrm[a * 3] + nrm[c * 3]) + fy * (nrm[a * 3 + 1] + nrm[c * 3 + 1]) + fz * (nrm[a * 3 + 2] + nrm[c * 3 + 2]);
    if (dot >= 0) I.push(a, b, c, a, c, d); else I.push(a, c, b, a, d, c);
    // the quad's material: whichever owner most of its corners share
    const os = [owner[a], owner[b], owner[c], owner[d]];
    let o = os[0], bestN = 0;
    for (const x of os) { const n = os.filter((y) => y === x).length; if (n > bestN) { bestN = n; o = x; } }
    T.push(o, o);
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const s0 = vals[at(i, j, k)] < 0;
    if (i < cx && j > 0 && k > 0 && j < ny - 1 && k < nz - 1 && s0 !== (vals[at(i + 1, j, k)] < 0))
      quad(cid(i, j - 1, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i, j - 1, k));
    if (j < cy && i > 0 && k > 0 && i < nx - 1 && k < nz - 1 && s0 !== (vals[at(i, j + 1, k)] < 0))
      quad(cid(i - 1, j, k - 1), cid(i - 1, j, k), cid(i, j, k), cid(i, j, k - 1));
    if (k < cz && i > 0 && j > 0 && i < nx - 1 && j < ny - 1 && s0 !== (vals[at(i, j, k + 1)] < 0))
      quad(cid(i - 1, j - 1, k), cid(i, j - 1, k), cid(i, j, k), cid(i - 1, j, k));
  }
  return { pos, nrm, owner, idx: new Uint32Array(I), triOwner: new Int32Array(T), count };
}

// ---------------------------------------------------------------- geometry

/** Parent of each rig joint, in rig order: hips spine head lArm lFore rArm rFore lLeg lShin lFoot rLeg rShin rFoot. */
export const BONE_PARENT = [-1, 0, 1, 1, 3, 1, 5, 0, 7, 8, 0, 10, 11];

/**
 * Turn a meshed field into geometry with one group per material slot.
 * With `skin`, each vertex is weighted to the bones of the shapes near it: the owning shape's bone,
 * plus its parent and children when their shapes are close (elbows, knees, shoulders bend smoothly).
 */
export function toGeometry(prims: Prim[], r: SdfResult, skin: boolean, fall = 0.028): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(r.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(r.nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(r.count * 2), 2));
  // group triangles by material slot
  const nt = r.idx.length / 3;
  const order = [...Array(nt).keys()].sort((a, b) => prims[r.triOwner[a]].mat - prims[r.triOwner[b]].mat);
  const idx = new Uint32Array(r.idx.length);
  let start = 0, cur = -1;
  order.forEach((t, n) => {
    idx[n * 3] = r.idx[t * 3]; idx[n * 3 + 1] = r.idx[t * 3 + 1]; idx[n * 3 + 2] = r.idx[t * 3 + 2];
    const m = prims[r.triOwner[t]].mat;
    if (m !== cur) {
      if (cur >= 0) g.addGroup(start * 3, (n - start) * 3, cur);
      cur = m; start = n;
    }
  });
  if (cur >= 0) g.addGroup(start * 3, (nt - start) * 3, cur);
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  if (skin) {
    const si = new Uint16Array(r.count * 4), sw = new Float32Array(r.count * 4);
    const acc = new Float32Array(BONE_PARENT.length);
    for (let v = 0; v < r.count; v++) {
      const x = r.pos[v * 3], y = r.pos[v * 3 + 1], z = r.pos[v * 3 + 2];
      const ob = prims[r.owner[v]]?.bone ?? 0;
      acc.fill(0);
      let dmin = 1e9;
      const ds: number[] = [];
      for (let i = 0; i < prims.length; i++) {
        const p = prims[i];
        if (p.sub || p.bone < 0) { ds.push(1e9); continue; }
        const b = p.bone;
        if (b !== ob && BONE_PARENT[b] !== ob && BONE_PARENT[ob] !== b) { ds.push(1e9); continue; }
        const lo = p._min!, hi = p._max!;
        const ox = Math.max(lo[0] - x, 0, x - hi[0]), oy = Math.max(lo[1] - y, 0, y - hi[1]), oz = Math.max(lo[2] - z, 0, z - hi[2]);
        if (ox * ox + oy * oy + oz * oz > fall * fall * 36) { ds.push(1e9); continue; } // too far to weigh anything
        const d = dist(p, x, y, z);
        ds.push(d);
        if (d < dmin) dmin = d;
      }
      for (let i = 0; i < prims.length; i++) if (ds[i] < 1e8) acc[prims[i].bone] += Math.exp(-(ds[i] - dmin) / fall);
      const top = [...acc.keys()].filter((b) => acc[b] > 1e-3).sort((a, b) => acc[b] - acc[a]).slice(0, 4);
      if (!top.length) top.push(ob);
      const tot = top.reduce((s, b) => s + acc[b], 0) || 1;
      top.forEach((b, n) => { si[v * 4 + n] = b; sw[v * 4 + n] = (acc[b] || 1) / tot; });
    }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  }
  g.computeBoundingSphere();
  return g;
}

const cache = new Map<string, THREE.BufferGeometry>();

/** Build (or reuse) a sculpted geometry. `key` must change whenever the shapes change. */
export function sculpt(key: string, prims: Prim[], cell: number, skin: boolean): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) {
    const t0 = performance.now();
    const m = mesh(prims, cell);
    const t1 = performance.now();
    g = toGeometry(prims, m, skin);
    if ((globalThis as { __sdfLog?: boolean }).__sdfLog) console.log('[sdf]', key, 'prims', prims.length, 'verts', m.count, 'mesh ms', Math.round(t1 - t0), 'geo ms', Math.round(performance.now() - t1));
    cache.set(key, g);
  }
  return g;
}
