// Three star-vessel wrecks, one per tradition (phase 2). Built from canon text and the world map
// (comms/refs/world-map.png), plus scene-crashed-starvessel-night.png in the source archive.
//   Maker: bone-and-coral in dark grey-green oxidised metal, asymmetric, amber leaking from seams.
//   Miner: blocky, utilitarian, modular sections, dark grey-brown, visible engines.
//   Aza'los: smooth, flowing, crystalline, grown not built, no engines or weapons, teal from cracks.
// Every wreck lies along local +X, origin on the ground at its middle.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE } from './types';
import {
  Kit, makeRng, rr, ri, lerp, clamp01, smooth, noise3, snoise3, displace, paintFn, sweep, lathe, loft,
  matte, matte2, matteBack, metal, glow, makeCrystal, withCrease, type Rng,
} from './scn-kit';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

let _hullMat: THREE.MeshStandardMaterial | null = null;
/** Maker hull metal: oxidised, a little sheen, soft creases so ridges keep an edge. */
const makerMat = () => _hullMat ??= withCrease(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.35 }), 45);
let _boneMat: THREE.MeshStandardMaterial | null = null;
const boneMat = () => _boneMat ??= withCrease(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), 60);

// ================================================================ Maker

/**
 * The Maker wreck, phase 3 rebuild from the ship beside the rift on the world map
 * (comms/refs/world-map.png, test-output/crop-maker.png). The user: "looks nothing like the map".
 * The map ship is a long, low arrowhead, wide and flat in section, not a round tube:
 *   - fore 60%: faceted dark grey-green armour plates with real thickness, overlapping like scales
 *     (each rear edge lifted over the next plate), a blade prow dug into the sand;
 *   - torn holes along the hull: plate torn, the hull under it torn smaller, ribs and a dark inside;
 *   - Tel'sharin light (red, user decision C-004) leaking from the seams under the plate steps and
 *     round the torn rims;
 *   - aft 40%: the metal grows into pale porous bone-coral, ending in ribbed finger-prongs that curl
 *     up and back, with coral spines rising from the upper back;
 *   - rolled onto its west flank and sunk, sand drifted against the low side and the prow.
 * Lies along +X, prow at -X. The deck faces +Z. Origin on the ground at its middle.
 */
export function makerWreck(length: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const L = Math.max(8, length);
  const x0 = -L / 2;
  const uJoin = 0.6;
  const Wmax = L * 0.13, Hmax = L * 0.085;
  const hullC = new THREE.Color(0x56675b), hullDark = new THREE.Color(0x323d35), verdi = new THREE.Color(0x7f9788);
  const wornC = new THREE.Color(0x9aa894), rustC = new THREE.Color(0x7a4a30), rustDark = new THREE.Color(0x3a2418);
  const boneC = new THREE.Color(0xbdb59e), boneDark = new THREE.Color(0x877f69), boneGreen = new THREE.Color(0x8d9a86);
  const red = glow(PALETTE.telsharinRed, 2.3);

  // ---- the hull surface: centre line, plan width W(u), height H(u), a faceted 10-sided section
  const xAt = (u: number) => x0 + u * L;
  const yc = (u: number) => Hmax * 0.1 - Hmax * 0.8 * Math.pow(1 - smooth(0, 0.3, u), 2) + Hmax * 0.3 * smooth(0.6, 1, u);
  const zc = (u: number) => 0.035 * L * Math.sin(u * Math.PI * 1.3);
  const W = (u: number) => (u <= uJoin
    ? Wmax * (0.05 + 0.95 * Math.pow(smooth(0, 0.52, u), 0.75)) * (1 + 0.1 * smooth(0.46, 0.58, u))
    : Wmax * 1.1 * (1 - 0.58 * smooth(uJoin, 1, u)));
  const H = (u: number) => Hmax * (0.14 + 0.86 * smooth(0, 0.45, u)) * (1 - 0.45 * smooth(0.78, 1, u));
  // [z factor, y factor] round the section; the dorsal ridge sits a little off centre (asymmetric)
  const PROF: [number, number][] = [[0.08, 1], [0.47, 0.8], [0.83, 0.42], [1, 0.02], [0.72, -0.42], [0, -0.55], [-0.72, -0.42], [-1, 0.02], [-0.8, 0.44], [-0.42, 0.82]];
  const NP = PROF.length;
  const centre = (u: number) => V(xAt(u), yc(u), zc(u));
  /** A point on the hull at length fraction u, section index jf (0..10, wraps), radial scale k. */
  const S = (u: number, jf: number, k: number, round = 0) => {
    const j = ((jf % NP) + NP) % NP, j0 = Math.floor(j), f = j - j0, a = PROF[j0], b = PROF[(j0 + 1) % NP];
    let pz = lerp(a[0], b[0], f), py = lerp(a[1], b[1], f);
    if (round > 0) { // blend towards an ellipse for the grown rear
      const ang = Math.atan2(py, pz), rz = Math.cos(ang), ry = Math.sin(ang) * (py > 0 ? 1 : 0.6);
      pz = lerp(pz, rz, round); py = lerp(py, ry, round);
    }
    const side = pz < 0 ? 0.9 : 1; // one flank a little narrower
    return V(xAt(u), yc(u) + py * H(u) * k, zc(u) + pz * W(u) * k * side);
  };

  // ---- torn holes, in (u, section index) space, jagged by noise
  // the map draws long rust-red slots down the hull with ribs inside (C-014): stretched along it,
  // narrow round it; one wide tear across the back is kept (old item 4)
  const holes = [
    { u: 0.31, j: 0.9, ru: 0.055, rj: 0.8 },  // the back torn open (old item 4)
    { u: 0.22, j: 2.4, ru: 0.09, rj: 0.26 },
    { u: 0.4, j: 7.7, ru: 0.1, rj: 0.28 },
    { u: 0.47, j: 2.9, ru: 0.06, rj: 0.22 },
    { u: 0.12, j: 8.4, ru: 0.05, rj: 0.2 },
  ];
  for (let i = 0; i < 3; i++) holes.push({ u: rr(r, 0.14, 0.54), j: rr(r, 0, 10), ru: rr(r, 0.025, 0.04), rj: rr(r, 0.12, 0.18) });
  const holeField = (u: number, j: number) => {
    let m = 9;
    for (const h of holes) {
      let dj = Math.abs(j - h.j) % NP; dj = Math.min(dj, NP - dj);
      m = Math.min(m, Math.hypot((u - h.u) / h.ru, dj / h.rj));
    }
    return m * (1 + 0.28 * snoise3(u * 60, j * 2.2, 0, seed + 3));
  };

  // ---- a slab builder: a patch of the hull surface with thickness, walls on every open edge
  const bufs = new Map<THREE.Material, { pos: number[]; col: number[] }>();
  const bufFor = (m: THREE.Material) => { let b = bufs.get(m); if (!b) bufs.set(m, (b = { pos: [], col: [] })); return b; };
  const _a = V(), _b = V(), _n = V();
  const tri = (b: { pos: number[]; col: number[] }, p: THREE.Vector3[], c: THREE.Color[], dir: THREE.Vector3) => {
    _a.subVectors(p[1], p[0]); _b.subVectors(p[2], p[0]); _n.crossVectors(_a, _b);
    const o = _n.dot(dir) < 0 ? [0, 2, 1] : [0, 1, 2];
    for (const i of o) { b.pos.push(p[i].x, p[i].y, p[i].z); b.col.push(c[i].r, c[i].g, c[i].b); }
  };
  const quad = (b: { pos: number[]; col: number[] }, p: THREE.Vector3[], c: THREE.Color[], dir: THREE.Vector3) => {
    tri(b, [p[0], p[1], p[2]], [c[0], c[1], c[2]], dir);
    tri(b, [p[0], p[2], p[3]], [c[0], c[2], c[3]], dir);
  };
  const hullPaint = (p: THREE.Vector3, wear: number, out: THREE.Color) => {
    const n1 = noise3(p.x * 0.35, p.y * 0.35, p.z * 0.35, seed), n2 = noise3(p.x * 1.3, p.y * 2.6, p.z * 1.3, seed + 5);
    out.copy(hullC).lerp(hullDark, smooth(0.35, 0.75, n1) * 0.55);
    out.lerp(verdi, smooth(0.62, 0.85, n2) * 0.5);                            // oxidised streaks
    out.lerp(rustC, smooth(0.7, 0.9, noise3(p.x * 0.9, p.y * 0.9, p.z * 0.9, seed + 9)) * 0.55);
    out.lerp(wornC, wear * 0.75);                                                // worn plate edges catch the light
    out.multiplyScalar(0.92 + 0.12 * snoise3(p.x * 6, p.y * 6, p.z * 6, seed + 2));
  };
  type Slab = { ns: number; nt: number; j: (s: number) => number; u: (t: number) => number; k: (s: number, t: number) => number; thick: number; round?: (t: number) => number; skip?: (s: number, t: number) => boolean; paint: (p: THREE.Vector3, s: number, t: number, outer: boolean, out: THREE.Color) => void; mat: THREE.Material; lip?: [THREE.Color, THREE.Color]; jitter?: number; wrap?: boolean };
  const slab = (o: Slab) => {
    const b = bufFor(o.mat);
    // jitter moves inner grid vertices off the grid lines, so cut edges come out ragged, not stepped
    const jit = (i: number, jj: number, c: number) => (o.jitter && jj > 0 && jj < o.nt && (o.wrap || (i > 0 && i < o.ns)) ? snoise3((i % o.ns) * 0.71 + c * 13, jj * 0.53, c, seed + 99) * o.jitter : 0);
    const P = (i: number, jj: number, outer: boolean) => { const s = (i + jit(i, jj, 0)) / o.ns, t = (jj + jit(i, jj, 1)) / o.nt, u = o.u(t); return S(u, o.j(s), o.k(s, t) - (outer ? 0 : o.thick), o.round?.(t) ?? 0); };
    const C = (i: number, jj: number, outer: boolean, p: THREE.Vector3) => { const c = new THREE.Color(); o.paint(p, i / o.ns, jj / o.nt, outer, c); return c; };
    const present = (i: number, jj: number) => i >= 0 && jj >= 0 && i < o.ns && jj < o.nt && !(o.skip && o.skip((i + 0.5) / o.ns, (jj + 0.5) / o.nt));
    for (let jj = 0; jj < o.nt; jj++) for (let i = 0; i < o.ns; i++) {
      if (!present(i, jj)) continue;
      const cm = centre(o.u((jj + 0.5) / o.nt));
      const corners = [[i, jj], [i + 1, jj], [i + 1, jj + 1], [i, jj + 1]];
      const po = corners.map(([a, c]) => P(a, c, true)), pi = corners.map(([a, c]) => P(a, c, false));
      const mo = po.reduce((m, v) => m.add(v), V()).multiplyScalar(0.25);
      quad(b, po, po.map((p, q) => C(corners[q][0], corners[q][1], true, p)), mo.clone().sub(cm));
      quad(b, pi, pi.map((p, q) => C(corners[q][0], corners[q][1], false, p)), cm.clone().sub(mo));
      // walls where the neighbour is missing: the plate's cut or torn edge, lit like a lip
      const nb = [[i, jj - 1, 0, 1], [i + 1, jj, 1, 2], [i, jj + 1, 2, 3], [i - 1, jj, 3, 0]];
      for (const [ni, nj, e0, e1] of nb) {
        if (present(ni, nj)) continue;
        const w = [po[e0], po[e1], pi[e1], pi[e0]];
        const dir = w[0].clone().add(w[1]).multiplyScalar(0.5).sub(mo);
        const lip = o.lip ? o.lip[0] : new THREE.Color().copy(wornC).lerp(rustC, 0.35), deep = o.lip ? o.lip[1] : new THREE.Color().copy(rustDark);
        quad(b, w, [lip, lip, deep, deep], dir);
      }
    }
  };

  // ---- the armour: five plate bands, seven panels round each, scales lifted at their rear edge
  const cuts = [0, 0.13, 0.25, 0.36, 0.47, uJoin];
  const panels: [number, number][] = [[0.02, 1.98], [2.02, 2.98], [3.02, 3.98], [4.02, 5.98], [6.02, 6.98], [7.02, 7.98], [8.02, 9.98]];
  const hm = hardMetal();
  for (let bnd = 0; bnd < cuts.length - 1; bnd++) {
    const ua = cuts[bnd] + (bnd ? 0.004 : 0.012), ub = cuts[bnd + 1] + (bnd < cuts.length - 2 ? 0.014 : 0.0);
    for (const [ja, jb] of panels) {
      const ns = Math.max(3, Math.round((jb - ja) * 4)), nt = Math.max(4, Math.round((ub - ua) * 70));
      slab({
        ns, nt, mat: hm, thick: 0.035, jitter: 0.3,
        j: (s) => lerp(ja, jb, s), u: (t) => lerp(ua, ub, t),
        // lift towards the rear edge, and a shallow ridge down each plate: knuckled, grown plates
        k: (s, t) => 1 + 0.055 * t * t + 0.012 * Math.sin(s * Math.PI),
        skip: (s, t) => holeField(lerp(ua, ub, t), lerp(ja, jb, s)) < 1,
        paint: (p, s, t, outer, out) => {
          if (!outer) { out.copy(rustDark); return; }
          const edge = 1 - smooth(0, 0.16, Math.min(s, 1 - s, t * 1.6, 1 - t));
          const rim = 1 - smooth(1, 1.4, holeField(lerp(ua, ub, t), lerp(ja, jb, s)));
          hullPaint(p, Math.max(edge * 0.7, rim), out);
          if (rim > 0.3) out.lerp(rustC, (rim - 0.3) * 0.6);
        },
      });
    }
  }
  // the hull under the plates: torn smaller than the plate above it, so each hole shows a stepped rim
  const uu0 = 0.01, uu1 = uJoin + 0.03, NU = 64, NJ = 40;
  slab({
    ns: NJ, nt: NU, mat: hm, thick: 0.05, jitter: 0.4, wrap: true,
    j: (s) => s * NP, u: (t) => lerp(uu0, uu1, t), k: () => 0.94,
    skip: (s, t) => holeField(lerp(uu0, uu1, t), s * NP) < 0.93,
    paint: (p, _s, _t, outer, out) => { out.copy(outer ? rustC : rustDark).lerp(rustDark, 0.35 + 0.3 * noise3(p.x * 2, p.y * 2, p.z * 2, seed + 7)); },
  });
  // the dark inside, seen through the holes
  {
    const rings: THREE.Vector3[][] = [];
    for (let i = 0; i <= 30; i++) { const u = lerp(uu0, uu1, i / 30), ring: THREE.Vector3[] = []; for (let j = 0; j < 20; j++) ring.push(S(u, (j / 20) * NP, 0.86)); rings.push(ring); }
    kit.add(paintFn(loft(rings, { centres: rings.map((_, i) => centre(lerp(uu0, uu1, i / 30))) }), (_x, y, _z, out) => out.copy(rustDark).multiplyScalar(0.45 + 0.25 * smooth(-1, 1.5, y))), matteBack());
  }
  // ribs inside, every half metre, seen through the holes and the plate gaps
  for (let u = 0.05; u < uJoin; u += 0.028) {
    const ring: THREE.Vector3[] = [];
    for (let j = 0; j <= 20; j++) ring.push(S(u, (j / 20) * NP, 0.905));
    kit.add(paintFn(sweep(ring, { segments: 30, radial: 4, radius: () => 0.07 }), (_x, _y, _z, out) => out.copy(rustC).multiplyScalar(0.85)), metal());
  }
  // red light in the seams under each lifted plate edge (upper side only), and round the big tears
  for (let bnd = 1; bnd < cuts.length - 1; bnd++) {
    if (r() < 0.25) continue;
    const u = cuts[bnd] + 0.002, ja = rr(r, 8.2, 9.6), jb = ja + rr(r, 1.4, 3.2), pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) pts.push(S(u, lerp(ja, jb, k / 8), 1.0));
    kit.add(sweep(pts, { segments: 16, radial: 4, radius: () => 0.07 }), red);
  }
  // round the big tears the light follows the torn edge itself (found by searching the jagged field),
  // just under the plate, and only along part of it, so it reads as a leak and not a drawn ring
  for (const h of holes.slice(0, 3)) {
    const pts: THREE.Vector3[] = [], a0 = rr(r, 0, 6.28), span = rr(r, 1.6, 2.6);
    for (let k = 0; k <= 14; k++) {
      const a = a0 + (k / 14) * span, ca = Math.cos(a), sa = Math.sin(a);
      let lo = 0.2, hi = 2.2;
      for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (holeField(h.u + ca * h.ru * m, h.j + sa * h.rj * m) < 1) lo = m; else hi = m; }
      pts.push(S(h.u + ca * h.ru * lo * 0.97, h.j + sa * h.rj * lo * 0.97, 0.985));
    }
    kit.add(sweep(pts, { segments: 28, radial: 4, radius: (t) => 0.035 * (0.5 + Math.sin(Math.PI * t)) }), red);
  }
  // the blade prow, pushed into the sand: a faceted wedge off the first section
  {
    const tip = V(x0 - L * 0.07, yc(0) - Hmax * 0.35, zc(0));
    const top = S(0.03, 0, 1.05), lc = S(0.03, 3, 1.05), rc = S(0.03, 7, 1.05), keel = S(0.03, 5, 1.05);
    const b = bufFor(hm), cols = (p: THREE.Vector3) => { const c = new THREE.Color(); hullPaint(p, 0.2, c); return c; };
    const mid = centre(0.03);
    for (const f of [[tip, top, lc], [tip, rc, top], [tip, lc, keel], [tip, keel, rc]]) {
      const m = f[0].clone().add(f[1]).add(f[2]).multiplyScalar(1 / 3);
      tri(b, f, f.map(cols), m.sub(mid.clone().lerp(tip, 0.5)));
    }
  }

  // ---- the grown rear: the metal becomes an openwork bone-coral shell (the map draws it pale
  // grey-green and full of holes; phase 2's smooth white bulb read as a whale's carcass)
  const b0 = 0.55;
  // pores in metres, so they stay round however the section stretches; bigger towards the tail
  const perim = (u: number) => 2.6 * (W(u) + H(u));
  const pores = Array.from({ length: 46 }, (_, i) => {
    const u = lerp(0.61, 0.99, (i + r()) / 46);
    return { u, j: rr(r, 0, NP), rad: lerp(0.3, 0.75, smooth(0.62, 1, u)) * rr(r, 0.7, 1.25) };
  });
  const poreField = (u: number, j: number) => {
    let m = 9;
    const pm = perim(u) / NP;
    for (const h of pores) {
      let dj = Math.abs(j - h.j) % NP; dj = Math.min(dj, NP - dj);
      m = Math.min(m, Math.hypot((u - h.u) * L, dj * pm) / h.rad);
    }
    return m * (1 + 0.2 * snoise3(u * 40, j * 1.7, 3, seed + 11));
  };
  const boneM = boneMat();
  const bonePaint = (p: THREE.Vector3, u: number, rim: number, out: THREE.Color) => {
    out.copy(boneC).lerp(boneDark, smooth(0.4, 0.8, noise3(p.x * 0.8, p.y * 0.8, p.z * 0.8, seed)) * 0.55);
    out.lerp(boneGreen, 0.35 + (1 - smooth(b0 + 0.03, 0.74, u)) * 0.5);     // grey-green, greener where it grew from the metal
    out.lerp(hullC, (1 - smooth(b0, b0 + 0.05, u)) * 0.85);
    out.lerp(boneDark, rim * 0.4);                                           // pores darken at their lips
    out.multiplyScalar(0.86 + 0.12 * snoise3(p.x * 5, p.y * 5, p.z * 5, seed + 1));
  };
  slab({
    ns: 84, nt: 64, mat: boneM, thick: 0.14, jitter: 0.45, wrap: true,
    j: (s) => s * NP, u: (t) => lerp(b0, 1, t),
    round: (t) => smooth(0, 0.35, t) * 0.8,
    // coral ridges running aft, lumps, and a swelling collar where bone meets metal
    k: (s, t) => {
      const u = lerp(b0, 1, t), jf = s * NP;
      return 1.03 + 0.045 * Math.abs(Math.sin(jf * Math.PI * 1.6 + u * 9)) + 0.05 * snoise3(u * 14, jf * 0.9, 1, seed + 21) + 0.07 * (1 - smooth(b0, b0 + 0.06, u));
    },
    skip: (s, t) => poreField(lerp(b0, 1, t), s * NP) < 1,
    lip: [boneC.clone().multiplyScalar(0.95), boneDark.clone().multiplyScalar(0.7)],
    paint: (p, s, t, outer, out) => {
      const u = lerp(b0, 1, t);
      if (!outer) { out.copy(boneDark).multiplyScalar(0.6); return; }
      bonePaint(p, u, 1 - smooth(1, 1.5, poreField(u, s * NP)), out);
    },
  });
  // the dim inside of the bone, seen through the pores (brown, not black: light gets in)
  {
    const rings: THREE.Vector3[][] = [], cs: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) { const u = lerp(b0, 1, i / 24), ring: THREE.Vector3[] = []; for (let j = 0; j < 24; j++) ring.push(S(u, (j / 24) * NP, 0.8, smooth(0, 0.35, i / 24) * 0.8)); rings.push(ring); cs.push(centre(u)); }
    kit.add(paintFn(loft(rings, { centres: cs }), (_x, y, _z, out) => out.copy(boneDark).lerp(rustDark, 0.5).multiplyScalar(0.55 + 0.3 * smooth(-1, 2.5, y))), matteBack());
  }

  // ---- coral: gnarled, knuckled, thick at the root, ringed like the map's fingers
  const coral = (pts: THREE.Vector3[], rad0: number, s: number, rings = 6) => {
    const cr = makeRng(s);
    const jig = pts.map((p, i) => (i === 0 ? p.clone() : p.clone().add(V(rr(cr, -1, 1), rr(cr, -1, 1), rr(cr, -1, 1)).multiplyScalar(rad0 * 0.6))));
    const g = sweep(jig, { segments: 30, radial: 8, radius: (t) => rad0 * (1 - 0.7 * Math.pow(t, 0.8)) * (1 + 0.28 * Math.pow(Math.max(0, Math.sin(t * Math.PI * rings)), 3)) });
    displace(g, rad0 * 0.12, 3 / rad0, s);
    kit.add(paintFn(g, (x, y, z, o2) => o2.copy(boneC).lerp(boneGreen, 0.3).lerp(boneDark, 0.45 * noise3(x * 2, y * 2, z * 2, s)).multiplyScalar(0.84 + 0.18 * smooth(0, 6, y))), boneM);
    const tipP = jig[jig.length - 1];
    kit.add(paintFn(new THREE.IcosahedronGeometry(rad0 * 0.3, 1).translate(tipP.x, tipP.y, tipP.z), (_x, _y, _z, o2) => o2.copy(boneC)), boneM);
    return jig;
  };
  // finger-prongs from the rear rim, curling up and back, of different lengths like a claw
  const nf = ri(r, 5, 6);
  for (let i = 0; i < nf; i++) {
    const jf = lerp(7.4, 12.4, i / (nf - 1)) + rr(r, -0.2, 0.2);
    const base = S(0.97, jf, 0.95, 0.8), c = centre(0.97), out = base.clone().sub(c).normalize();
    const len = Hmax * rr(r, 1.0, 1.7) * (out.y > 0.6 ? 1.3 : 0.85);
    const p1 = base.clone().add(V(len * 0.35, len * 0.05, 0)).addScaledVector(out, len * 0.3);
    const p2 = base.clone().add(V(len * 0.62, len * 0.45, 0)).addScaledVector(out, len * 0.45);
    const p3 = base.clone().add(V(len * 0.55, len * 0.9, 0)).addScaledVector(out, len * 0.3);
    const j = coral([base, p1, p2, p3], Hmax * 0.24, seed + i, 5);
    if (r() < 0.7) coral([j[2], j[2].clone().add(V(len * 0.3, len * 0.15, 0)).addScaledVector(out, len * 0.25), j[2].clone().add(V(len * 0.42, len * 0.45, 0)).addScaledVector(out, len * 0.2)], Hmax * 0.1, seed + 50 + i, 3);
  }
  // spines rising from the upper back, leaning aft, the biggest near the join, each from a bone collar
  for (let k = 0; k < 4; k++) {
    const u = lerp(0.4, 0.64, k / 3) + rr(r, -0.015, 0.015), jf = rr(r, -0.6, 0.9);
    const base = S(u, jf, 0.97, u > b0 ? 0.5 : 0), h = Hmax * rr(r, 1.0, 1.6) * (k === 2 ? 1.3 : 1);
    const lean = rr(r, 0.35, 0.6);
    coral([base, base.clone().add(V(h * 0.12, h * 0.45, 0)), base.clone().add(V(h * lean * 0.6, h * 0.85, rr(r, -0.2, 0.2))), base.clone().add(V(h * lean, h * 1.05, 0))], Hmax * 0.16, seed + 70 + k, 5);
    const collar = new THREE.IcosahedronGeometry(Hmax * 0.26, 2).scale(1.5, 0.55, 1.1);
    displace(collar, Hmax * 0.05, 2, seed + 80 + k);
    kit.add(paintFn(collar.translate(base.x, base.y, base.z), (x, y, z, o2) => bonePaint(V(x, y, z), 0.62, 0.2, o2)), boneM);
  }

  // ---- roll the whole ship onto its +Z flank and dip the nose, then sink it
  const roll = 0.34, pitch = 0.035;
  const M = new THREE.Matrix4().makeTranslation(0, 0.55, 0)
    .multiply(new THREE.Matrix4().makeRotationX(roll))
    .multiply(new THREE.Matrix4().makeRotationZ(pitch));
  for (const [mat, b] of bufs) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    kit.add(g, mat);
  }
  const built = kit.build('maker-wreck');
  built.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.applyMatrix4(M); });

  // ---- sand drifted up the low flank and over the prow; plates thrown off in the crash
  const extra = new Kit();
  const ground = 0.6; // levelbuild sinks the wreck 0.6 m, so local y 0.6 is the ground
  for (let i = 0; i < 9; i++) {
    const u = i < 7 ? lerp(0.04, 0.9, i / 6) : (i === 7 ? -0.02 : 0.02), side = i < 7 ? 1 : (i === 7 ? 0 : -1);
    const g = new THREE.IcosahedronGeometry(1, 2);
    displace(g, 0.18, 1.6, seed + 60 + i);
    // low drifts in the ground's own colours (terrain packed 0xbc9c74 to sand 0xd3b286), so they
    // read as the ground heaped up against the hull and not as pale blobs laid on it
    const sx = rr(r, 1.8, 2.8), sy = rr(r, 0.3, 0.5), sz = rr(r, 1.0, 1.4);
    g.scale(sx, sy, sz).translate(xAt(u) + (i >= 7 ? -1.2 : 0), ground - sy * 0.45, side * W(Math.max(0.05, u)) * 0.95 + (side ? 0.5 : 0));
    const packed = new THREE.Color(0xbc9c74), sandC = new THREE.Color(0xd3b286);
    extra.add(paintFn(g, (x, y, z, out) => out.copy(packed).lerp(sandC, smooth(ground - 0.1, ground + 0.4, y) * 0.7).multiplyScalar(0.96 + 0.08 * snoise3(x * 3, y * 3, z * 3, seed))), matte());
  }
  for (let i = 0; i < 8; i++) {
    const w = rr(r, 0.5, 1.2), d = rr(r, 0.35, 0.8);
    const g = new THREE.BoxGeometry(w, 0.07, d, 4, 1, 2).toNonIndexed();
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < p.count; v++) p.setY(v, p.getY(v) + (p.getX(v) / w) ** 2 * 0.25); // bent plates
    g.rotateX(rr(r, -0.4, 0.4)).rotateY(r() * 6).translate(rr(r, x0, x0 + L * 0.6), ground + 0.05, (r() < 0.5 ? -1 : 1) * rr(r, Wmax * 1.3, Wmax * 2.4));
    extra.add(paintFn(g, (x, y, z, out) => hullPaint(V(x, y, z), 0.3, out)), hardMetal());
  }
  const extraG = extra.build('maker-wreck-sand');
  for (const c of [...extraG.children]) built.add(c);
  return built;
}

/** The phase 2 Maker wreck, kept for side-by-side shots only (not used in the level). */
export function makerWreckP2(length: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const L = Math.max(8, length), R = L * 0.085;
  const sage = new THREE.Color(0x6f8478), sageDark = new THREE.Color(0x3d4a3c), verd = new THREE.Color(0x587060);
  const boneC = new THREE.Color(0xa49e88), boneDark = new THREE.Color(0x76725e), rustC = new THREE.Color(0x7a4a30), rustDark = new THREE.Color(0x3a2418);
  const amber = glow(PALETTE.makerAmber, 1.4);
  const x0 = -L / 2, xJoin = x0 + L * 0.58, x1 = L / 2;
  // the spine: nose low in the sand, rising gently to the bone half
  const spineY = (x: number) => R * 0.55 + ((x - x0) / L) * R * 0.9 - R * 1.1 * Math.pow(1 - smooth(x0, x0 + L * 0.3, x), 2);
  const spineZ = (x: number) => 0.05 * L * Math.sin(((x - x0) / L) * Math.PI * 1.2);
  const P = (x: number) => V(x, spineY(x), spineZ(x));
  const SIDES = 8, ROT = Math.PI / SIDES;
  // profile of the armour: a blade at the prow, full by a third of the way, slightly waisted at the join
  const armR = (x: number) => {
    const t = (x - x0) / (xJoin - x0);
    return R * (0.08 + 0.92 * Math.pow(smooth(0, 0.42, t), 0.7)) * (1 - 0.08 * smooth(0.8, 1, t));
  };
  const paintArmour = (g: THREE.BufferGeometry, s: number) => paintFn(g, (x, y, z, out) => {
    out.copy(sage).lerp(verd, smooth(0.4, 0.75, noise3(x * 0.8, y * 0.8, z * 0.8, s)) * 0.6);
    out.lerp(sageDark, (1 - smooth(-R * 0.2, R * 1.6, y)) * 0.6);
    out.lerp(rustC, smooth(0.66, 0.88, noise3(x * 2.2, y * 2.2, z * 2.2, s + 4)) * 0.45);
    out.multiplyScalar(0.9 + 0.1 * snoise3(x * 5, y * 5, z * 5, s));
  });
  // the core: a dark rust tube with raised ribs, seen through every gap
  const core: THREE.Vector3[] = [];
  const c0 = x0 + L * 0.06;
  for (let x = c0; x <= xJoin + 0.2; x += 0.5) core.push(P(x));
  kit.add(paintFn(sweep(core, { segments: core.length * 2, radial: 10, up: UP, radius: (t) => armR(lerp(c0, xJoin, t)) * 0.8 }), (x, _y, _z, out) => out.copy(rustDark).lerp(rustC, 0.5 + 0.5 * Math.sin(x * 9))), matte());
  for (let x = x0 + L * 0.1; x < xJoin; x += 0.38) {
    const ring: THREE.Vector3[] = [];
    const c = P(x), rr0 = armR(x) * 0.84;
    for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI * 2; ring.push(V(c.x, c.y + Math.sin(a) * rr0, c.z + Math.cos(a) * rr0)); }
    kit.add(paintFn(sweep(ring, { segments: 16, radial: 4, radius: () => R * 0.05 }), (_x, _y, _z, out) => out.copy(rustC).multiplyScalar(0.9)), metal());
  }
  // the armour sleeves: each a faceted shell, a touch wider at its rear edge, with a gap after it
  const cuts = [x0, x0 + L * 0.2, x0 + L * 0.33, x0 + L * 0.45, xJoin];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a0 = cuts[i] + (i ? 0.12 : 0), a1 = cuts[i + 1] - 0.14;
    const pts: THREE.Vector3[] = [];
    const n = Math.max(4, Math.round((a1 - a0) / 0.4));
    for (let k = 0; k <= n; k++) pts.push(P(lerp(a0, a1, k / n)));
    const openTop = i === 2; // one sleeve torn open along its back
    const g = sweep(pts, {
      segments: n * 2, radial: SIDES, up: UP, capStart: i === 0,
      radius: (t, a) => armR(lerp(a0, a1, t)) * (1.0 + 0.07 * t) * (1 + 0.03 * Math.cos((a + ROT) * 2)),
      skip: openTop ? (ii, jj) => { const a = (jj / SIDES) * Math.PI * 2; return Math.sin(a) > 0.3 && ii > 2 && ii < n * 2 - 2; } : undefined,
    });
    kit.add(paintArmour(g, seed + i), hardMetal());
    if (openTop) kit.add(paintFn(sweep(pts, { segments: n * 2, radial: SIDES, up: UP, radius: (t) => armR(lerp(a0, a1, t)) * 0.99 }), (_x, _y, _z, out) => out.copy(rustDark)), matteBack());
    // amber in the seam behind this sleeve, faint, on the upper side only
    if (i < cuts.length - 2 && r() < 0.8) {
      const c = P(a1 + 0.07), rr0 = armR(a1) * 0.9, arc: THREE.Vector3[] = [];
      const s0 = rr(r, 0.2, 0.9), span = rr(r, 1.2, 2.2);
      for (let k = 0; k <= 6; k++) { const a = s0 + (k / 6) * span; arc.push(V(c.x, c.y + Math.sin(a) * rr0, c.z + Math.cos(a) * rr0)); }
      kit.add(sweep(arc, { segments: 10, radial: 4, radius: () => R * 0.05 }), amber);
    }
  }
  // the blade prow, pushed into the sand
  const tip = P(x0);
  const blade = new THREE.ConeGeometry(R * 0.35, L * 0.12, 4).rotateZ(Math.PI / 2).rotateX(Math.PI / 4).scale(1, 0.45, 1).translate(tip.x - L * 0.04, tip.y - R * 0.15, tip.z);
  kit.add(paintArmour(blade, seed + 20), hardMetal());
  // ---- the bone half: a flaring porous shell, then finger-prongs
  const bpts: THREE.Vector3[] = [];
  for (let x = xJoin - 0.3; x <= x1; x += 0.25) bpts.push(P(x));
  const boneR = (t: number, a: number) => R * (0.8 + 0.3 * smooth(0.2, 1, t)) * (1 + 0.1 * Math.sin(a * 3 + t * 5)) * (1 - 0.15 * Math.max(0, -Math.sin(a)));
  // oval holes: a cell pattern, stretched along the hull, on a fine grid so edges read round
  const S2 = bpts.length * 3, RAD2 = 30;
  const holes = Array.from({ length: 11 }, () => ({ u: rr(r, 0.12, 0.95), a: rr(r, -0.4, Math.PI + 0.4), ru: rr(r, 0.05, 0.085), ra: rr(r, 0.24, 0.4) }));
  const hole = (i: number, j: number) => { const u = i / S2, a = (j / RAD2) * Math.PI * 2; return holes.some((h) => ((u - h.u) / h.ru) ** 2 + ((Math.atan2(Math.sin(a - h.a), Math.cos(a - h.a))) / h.ra) ** 2 < 1); };
  const shell = sweep(bpts, { segments: S2, radial: RAD2, up: UP, radius: boneR, skip: hole });
  displace(shell, R * 0.05, 1.4 / R, seed + 31);
  kit.add(paintFn(shell, (x, y, z, out) => out.copy(boneC).lerp(boneDark, smooth(0.45, 0.8, noise3(x * 1.1, y * 1.1, z * 1.1, seed)) * 0.5).lerp(sage, (1 - smooth(xJoin, xJoin + 1.2, x)) * 0.5).multiplyScalar(0.8 + 0.25 * smooth(0, R * 2, y))), boneMat());
  kit.add(paintFn(sweep(bpts, { segments: S2, radial: RAD2, up: UP, radius: (t, a) => boneR(t, a) * 0.9 }), (_x, y, _z, out) => out.setHex(0x5e4e3e).multiplyScalar(0.6 + 0.4 * smooth(0, R * 2, y))), matteBack());
  // finger-prongs from the rear rim, curling up and back like antlers
  const rim = P(x1);
  const nf = ri(r, 5, 6);
  for (let i = 0; i < nf; i++) {
    const a = lerp(-0.2, Math.PI + 0.2, i / (nf - 1)) + rr(r, -0.12, 0.12);
    const base = rim.clone().add(V(0, Math.sin(a) * R * 1.2, Math.cos(a) * R * 1.2));
    const out = V(0, Math.sin(a), Math.cos(a));
    const len = R * rr(r, 1.4, 2.4) * (Math.sin(a) > 0.5 ? 1.2 : 0.85);
    const pts = [base, base.clone().add(V(len * 0.35, 0, 0)).addScaledVector(out, len * 0.3), base.clone().add(V(len * 0.55, len * 0.45, 0)).addScaledVector(out, len * 0.45), base.clone().add(V(len * 0.45, len * 0.95, 0)).addScaledVector(out, len * 0.35)];
    const g = sweep(pts, { segments: 14, radial: 7, radius: (t) => R * 0.18 * (1 - 0.55 * t) });
    kit.add(paintFn(g, (x, y, z, o2) => o2.copy(boneC).multiplyScalar(0.8 + 0.25 * noise3(x * 3, y * 3, z * 3, seed + i))), boneMat());
    const knob = new THREE.IcosahedronGeometry(R * 0.14, 1).translate(pts[3].x, pts[3].y, pts[3].z);
    kit.add(paintFn(knob, (_x, _y, _z, o2) => o2.copy(boneC)), boneMat());
  }
  // small bone prongs on the back where the halves join
  for (let k = 0; k < 3; k++) {
    const b0 = P(xJoin - 0.4 + k * 0.5).add(V(0, R * 1.05, rr(r, -0.3, 0.3)));
    const h = R * rr(r, 0.7, 1.2);
    const g = sweep([b0, b0.clone().add(V(h * 0.2, h * 0.6, 0)), b0.clone().add(V(h * 0.1, h, rr(r, -0.2, 0.2)))], { segments: 8, radial: 6, radius: (t) => R * 0.1 * (1 - 0.6 * t) });
    kit.add(paintFn(g, (_x, _y, _z, out) => out.copy(boneC).multiplyScalar(0.9)), boneMat());
  }
  // amber deep inside the bone, seen through its holes
  const mid = (xJoin + x1) / 2;
  const glowCore = new THREE.CylinderGeometry(R * 0.35, R * 0.5, x1 - xJoin, 8).rotateZ(Math.PI / 2).translate(mid, spineY(mid), spineZ(mid));
  void glowCore; // (an amber core showed through the holes as red blocks; the seams carry the amber instead)
  // plates and chunks thrown off in the crash
  for (let i = 0; i < 8; i++) {
    const g = new THREE.BoxGeometry(rr(r, 0.4, 1.1), 0.08, rr(r, 0.3, 0.7)).toNonIndexed();
    g.rotateX(rr(r, -0.4, 0.4)).rotateY(r() * 6).translate(rr(r, x0, xJoin), 0.05, (r() < 0.5 ? -1 : 1) * rr(r, R * 1.4, R * 3));
    kit.add(paintArmour(g, seed + 40 + i), hardMetal());
  }
  return kit.build('maker-wreck');
}

let _hard: THREE.MeshStandardMaterial | null = null;
/** Faceted armour: a low crease keeps every plate face flat and every edge hard. */
const hardMetal = () => _hard ??= withCrease(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.35 }), 20);

// ================================================================ Miner

/**
 * A miner hull, half buried (phase 3 rebuild, C-007). The world map (crop-wrecks-west.png) draws the
 * miner ships grey-olive and angular: a chamfered hull in segments, a raised spine, tall tail fins,
 * one end torn open with the tan inside showing. Canon: blocky, angular, visible engines, modular,
 * dark grey-brown. Every panel is a real plate with a seam round it, so the low sun catches the edges.
 * Lies along +X, the torn bow at -X, engines at +X. Origin on the ground at its middle.
 */
export function minerHull(length: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const mat = minerMat();
  const L = Math.max(6, length);
  const olive = new THREE.Color(0x8c8870), oliveDark = new THREE.Color(0x58554a), paintC = new THREE.Color(0xa8a288);
  const rustC = new THREE.Color(0x8e5a3c), rustDark = new THREE.Color(0x4a2c1c), tan = new THREE.Color(0xb88d5c), inside = new THREE.Color(0x2c2620);
  const hullPaint = (x: number, y: number, z: number, out: THREE.Color, wear = 0) => {
    out.copy(olive).lerp(oliveDark, smooth(0.4, 0.8, noise3(x * 0.4, y * 0.4, z * 0.4, seed)) * 0.5);
    out.lerp(paintC, smooth(0.62, 0.8, noise3(x * 0.25, y * 0.9, z * 0.25, seed + 3)) * 0.6);    // old paint in patches
    out.lerp(rustC, smooth(0.62, 0.88, noise3(x * 1.2, y * 1.2, z * 1.2, seed + 1)) * 0.7);     // rust bloom
    out.lerp(rustC, smooth(0.55, 0.0, y + 0.4) * 0.4);                                           // rust low down, where sand sat
    out.lerp(paintC, wear * 0.6);
    out.multiplyScalar(0.92 + 0.12 * snoise3(x * 5, y * 5, z * 5, seed + 2));
  };
  // the section: a chamfered box, 8 corners (z, y), wider than tall
  const HW = 1.25, HH = 1.05, CH = 0.42;
  const SEC: [number, number][] = [[-HW + CH, HH], [HW - CH, HH], [HW, HH - CH], [HW, -HH + CH], [HW - CH, -HH], [-HW + CH, -HH], [-HW, -HH + CH], [-HW, HH - CH]];
  // the section is convex, so a face's outward direction is its midpoint seen from the axis
  const outward = (k: number) => { const a = SEC[k], b = SEC[(k + 1) % 8]; return V(0, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2).normalize(); };
  /** A plate: a quad on the hull face k, from x a..b and face fraction s0..s1, standing out by `lift`, `thick` deep. */
  const plate = (k: number, a: number, b: number, s0: number, s1: number, lift: number, thick: number) => {
    const A = SEC[k], B = SEC[(k + 1) % 8], n = outward(k);
    const at = (x: number, s: number, d: number) => V(x, lerp(A[1], B[1], s), lerp(A[0], B[0], s)).addScaledVector(n, d);
    const o = [at(a, s0, lift), at(b, s0, lift), at(b, s1, lift), at(a, s1, lift)];
    const i = [at(a, s0, lift - thick), at(b, s0, lift - thick), at(b, s1, lift - thick), at(a, s1, lift - thick)];
    const box = new THREE.BufferGeometry();
    const pos: number[] = [];
    const q = (p: THREE.Vector3[]) => { pos.push(p[0].x, p[0].y, p[0].z, p[1].x, p[1].y, p[1].z, p[2].x, p[2].y, p[2].z, p[0].x, p[0].y, p[0].z, p[2].x, p[2].y, p[2].z, p[3].x, p[3].y, p[3].z); };
    q(o); q([o[0], o[1], i[1], i[0]]); q([o[1], o[2], i[2], i[1]]); q([o[2], o[3], i[3], i[2]]); q([o[3], o[0], i[0], i[3]]);
    box.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return orientOut(box, n);
  };
  // flip any face that points into the hull (face normal against the plate's outward direction)
  const orientOut = (g: THREE.BufferGeometry, n: THREE.Vector3) => {
    const p = g.attributes.position as THREE.BufferAttribute, e1 = V(), e2 = V(), fn = V(), c = V();
    const centroid = V();
    for (let i = 0; i < p.count; i++) centroid.add(V(p.getX(i), p.getY(i), p.getZ(i)));
    centroid.multiplyScalar(1 / p.count).addScaledVector(n, -0.5);
    for (let t = 0; t < p.count; t += 3) {
      const a = V(p.getX(t), p.getY(t), p.getZ(t)), b = V(p.getX(t + 1), p.getY(t + 1), p.getZ(t + 1)), cc = V(p.getX(t + 2), p.getY(t + 2), p.getZ(t + 2));
      e1.subVectors(b, a); e2.subVectors(cc, a); fn.crossVectors(e1, e2);
      c.copy(a).add(b).add(cc).multiplyScalar(1 / 3).sub(centroid);
      if (fn.dot(c) < 0) { p.setXYZ(t + 1, cc.x, cc.y, cc.z); p.setXYZ(t + 2, b.x, b.y, b.z); }
    }
    return g;
  };

  // ---- modules: 4, the chain buckled at each joint
  const nMod = 4, gap = 0.34, modL = (L - 1.4 - gap * (nMod - 1)) / nMod;
  let x = -L / 2;
  const modFrames: THREE.Matrix4[] = [];
  let yaw = 0, pitch = 0.05;
  for (let m = 0; m < nMod; m++) {
    const x0 = x, x1 = x + modL;
    const parts: THREE.BufferGeometry[] = [];
    const cols: ((x: number, y: number, z: number, out: THREE.Color) => void)[] = [];
    const tornBow = m === 0;
    // the core under the plates: darker, so every seam between plates shows as a dark line
    const core = new THREE.BufferGeometry(), cp: number[] = [];
    for (let k = 0; k < 8; k++) {
      const A = SEC[k], B = SEC[(k + 1) % 8], a0 = x0 + (tornBow ? 0.9 : 0), a1 = x1;
      const P = [V(a0, A[1], A[0]), V(a1, A[1], A[0]), V(a1, B[1], B[0]), V(a0, B[1], B[0])].map((v) => V(v.x, v.y * 0.985, v.z * 0.985));
      cp.push(P[0].x, P[0].y, P[0].z, P[1].x, P[1].y, P[1].z, P[2].x, P[2].y, P[2].z, P[0].x, P[0].y, P[0].z, P[2].x, P[2].y, P[2].z, P[3].x, P[3].y, P[3].z);
    }
    core.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    parts.push(orientCore(core)); cols.push((_x, _y, _z, out) => out.copy(oliveDark).multiplyScalar(0.55));
    // plates: 2 or 3 along each face, split across the wide faces; the torn bow loses plates
    const along = modL > 2.2 ? 3 : 2;
    for (let k = 0; k < 8; k++) {
      const across = k === 0 || k === 3 || k === 7 || k === 4 ? 2 : 1;
      for (let i = 0; i < along; i++) for (let j = 0; j < across; j++) {
        const a = lerp(x0, x1, i / along) + 0.045, b = lerp(x0, x1, (i + 1) / along) - 0.045;
        if (tornBow && (a < x0 + 0.9 || (k <= 2 && i === 1 && r() < 0.7))) continue;   // torn away
        if (!tornBow && r() < 0.05) continue;                                          // a lost plate
        const s0 = j / across + 0.04, s1 = (j + 1) / across - 0.04;
        parts.push(plate(k, a, b, s0, s1, 0.05 + rr(r, -0.012, 0.012), 0.07));
        const px = (a + b) / 2, wear = r() < 0.3 ? 0.4 : 0;
        cols.push((xx, yy, zz, out) => hullPaint(xx + px, yy, zz, out, wear));
      }
    }
    // a hatch on the south flank of the second and third modules
    if (m === 1 || m === 2) {
      const hx = lerp(x0, x1, rr(r, 0.35, 0.65));
      parts.push(plate(3, hx - 0.38, hx + 0.38, 0.22, 0.8, 0.1, 0.05)); cols.push((_x, _y, _z, out) => out.copy(oliveDark).lerp(rustC, 0.35));
    }
    // the dorsal spine on the middle modules: a narrow raised box with its own plates
    if (m === 1 || m === 2) {
      const sp = new THREE.BoxGeometry(modL * 0.86, 0.36, 0.9).toNonIndexed().translate((x0 + x1) / 2, HH + 0.18, rr(r, -0.1, 0.1));
      parts.push(sp); cols.push((xx, yy, zz, out) => hullPaint(xx, yy, zz, out, 0.2));
      for (let i = 0; i < 3; i++) {
        const vx = lerp(x0, x1, 0.2 + i * 0.3);
        parts.push(new THREE.BoxGeometry(0.28, 0.12, 0.7).toNonIndexed().translate(vx, HH + 0.42, 0)); cols.push((_x, _y, _z, out) => out.copy(oliveDark));
      }
    }
    // the torn bow: ribs across the open end, the dark inside, and a lit tan bulkhead further in
    if (tornBow) {
      for (let i = 0; i < 3; i++) {
        const rx = x0 + 0.15 + i * 0.32, ring: THREE.Vector3[] = [];
        for (let k = 0; k <= 8; k++) { const c = SEC[k % 8]; ring.push(V(rx, c[1] * 0.93, c[0] * 0.93)); }
        const rib = sweep(ring, { segments: 24, radial: 4, radius: () => 0.07 });
        parts.push(rib); cols.push((_x, _y, _z, out) => out.copy(rustC).multiplyScalar(0.8));
      }
      const wallG = new THREE.BufferGeometry(), wp: number[] = [];
      const bx = x0 + 1.25;
      for (let k = 0; k < 8; k++) { const A = SEC[k], B = SEC[(k + 1) % 8]; wp.push(bx, 0, 0, bx, A[1] * 0.95, A[0] * 0.95, bx, B[1] * 0.95, B[0] * 0.95); }
      wallG.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      parts.push(orientTo(wallG, V(-1, 0, 0))); cols.push((_x, y, _z, out) => out.copy(tan).lerp(rustDark, smooth(0.6, -0.8, y) * 0.6));
      // the inside of the hull, seen past the torn plates
      const inG = new THREE.BufferGeometry(), ip: number[] = [];
      for (let k = 0; k < 8; k++) {
        const A = SEC[k], B = SEC[(k + 1) % 8];
        const P = [V(x0, A[1] * 0.96, A[0] * 0.96), V(bx, A[1] * 0.96, A[0] * 0.96), V(bx, B[1] * 0.96, B[0] * 0.96), V(x0, B[1] * 0.96, B[0] * 0.96)];
        ip.push(P[0].x, P[0].y, P[0].z, P[2].x, P[2].y, P[2].z, P[1].x, P[1].y, P[1].z, P[0].x, P[0].y, P[0].z, P[3].x, P[3].y, P[3].z, P[2].x, P[2].y, P[2].z);
      }
      inG.setAttribute('position', new THREE.Float32BufferAttribute(ip, 3));
      parts.push(inG); cols.push((_x, y, _z, out) => out.copy(inside).lerp(tan, smooth(-0.5, 1.2, y) * 0.3));
    }
    // this module's frame: the chain buckles a few degrees at each joint, and sinks towards the bow
    const M = new THREE.Matrix4().makeTranslation(x0, 0, 0)
      .multiply(new THREE.Matrix4().makeRotationY(yaw))
      .multiply(new THREE.Matrix4().makeRotationZ(pitch))
      .multiply(new THREE.Matrix4().makeRotationX(rr(r, -0.06, 0.06)))
      .multiply(new THREE.Matrix4().makeTranslation(-x0, 0, 0));
    modFrames.push(M);
    parts.forEach((p, i) => {
      p.applyMatrix4(M);
      const f = cols[i];
      // the torn bow's bulkhead and inside are seen from both sides
      kit.add(paintFn(p, (xx, yy, zz, out) => f(xx, yy, zz, out)), m === 0 && i >= parts.length - 2 ? matte2() : mat);
    });
    // the collar to the next module: a short, smaller section with a tan band (the map's joints)
    if (m < nMod - 1) {
      const cx = x1 + gap / 2, ring: THREE.Vector3[][] = [];
      for (const dx of [-gap / 2 - 0.1, gap / 2 + 0.1]) ring.push(SEC.map(([z, y]) => V(cx + dx, y * 0.9, z * 0.9)));
      const col = loft(ring, { closed: true });
      col.applyMatrix4(M);
      kit.add(paintFn(col, (_x, _y, _z, out) => out.copy(tan).lerp(rustC, 0.3)), mat);
    }
    yaw += rr(r, -0.07, 0.07);
    pitch -= rr(r, 0.015, 0.035);
    x = x1 + gap;
  }
  // core faces point away from the hull axis (y = 0, z = 0)
  function orientCore(g: THREE.BufferGeometry) {
    const p = g.attributes.position as THREE.BufferAttribute, e1 = V(), e2 = V(), fn = V(), c = V();
    for (let t = 0; t < p.count; t += 3) {
      const a = V(p.getX(t), p.getY(t), p.getZ(t)), b = V(p.getX(t + 1), p.getY(t + 1), p.getZ(t + 1)), cc = V(p.getX(t + 2), p.getY(t + 2), p.getZ(t + 2));
      e1.subVectors(b, a); e2.subVectors(cc, a); fn.crossVectors(e1, e2);
      c.set(0, a.y + b.y + cc.y, a.z + b.z + cc.z);
      if (fn.dot(c) < 0) { p.setXYZ(t + 1, cc.x, cc.y, cc.z); p.setXYZ(t + 2, b.x, b.y, b.z); }
    }
    return g;
  }
  function orientTo(g: THREE.BufferGeometry, n: THREE.Vector3) {
    const p = g.attributes.position as THREE.BufferAttribute, e1 = V(), e2 = V(), fn = V();
    for (let t = 0; t < p.count; t += 3) {
      const a = V(p.getX(t), p.getY(t), p.getZ(t)), b = V(p.getX(t + 1), p.getY(t + 1), p.getZ(t + 1)), cc = V(p.getX(t + 2), p.getY(t + 2), p.getZ(t + 2));
      e1.subVectors(b, a); e2.subVectors(cc, a); fn.crossVectors(e1, e2);
      if (fn.dot(n) < 0) { p.setXYZ(t + 1, cc.x, cc.y, cc.z); p.setXYZ(t + 2, b.x, b.y, b.z); }
    }
    return g;
  }

  // ---- the stern: engine block, three nozzles, two tall fins and two swept wings
  const last = modFrames[nMod - 1];
  const ex = x;
  const eb = new THREE.BoxGeometry(1.1, 2.0, 2.3, 2, 2, 2).toNonIndexed().translate(ex + 0.35, 0, 0);
  const sternParts: [THREE.BufferGeometry, (x: number, y: number, z: number, o: THREE.Color) => void, THREE.Material][] = [];
  sternParts.push([eb, (xx, yy, zz, o) => hullPaint(xx, yy, zz, o, 0.1), mat]);
  for (const [zy, zz] of [[-0.45, -0.62], [-0.45, 0.62], [0.5, 0]] as const) {
    const noz = lathe([[0.42, 0], [0.36, 0.25], [0.48, 0.8], [0.54, 0.95], [0.48, 0.95], [0.4, 0.82], [0.3, 0.3], [0.001, 0.2]], 14);
    noz.rotateZ(-Math.PI / 2).translate(ex + 0.9, zy, zz);
    sternParts.push([noz, (x2, _y, _z, o) => o.copy(olive).lerp(rustDark, smooth(ex + 1.5, ex + 1.85, x2) * 0.9).lerp(rustC, 0.25), mat]);
  }
  const fin = (h: number, len: number) => new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(len, 0), new THREE.Vector2(len * 0.95, h * 0.35), new THREE.Vector2(len * 0.55, h)]), { depth: 0.1, bevelEnabled: false });
  // tall tail fins, splayed: the map's ships all carry them
  for (const side of [-1, 1]) {
    const f = fin(rr(r, 1.5, 1.9), 1.9).toNonIndexed();
    f.translate(-1.9, 0, -0.05).rotateX(side * 0.28).translate(ex + 0.5, HH - 0.1, side * 0.55);
    sternParts.push([f, (xx, yy, zz, o) => hullPaint(xx, yy, zz, o, 0.25), mat]);
  }
  // swept wings, low on the flanks; one snapped short
  for (const side of [-1, 1]) {
    const f = fin(side > 0 ? 1.0 : 1.7, 2.1).toNonIndexed();
    f.translate(-2.1, 0, -0.05).rotateX(side * Math.PI / 2).translate(ex + 0.4, -0.35, side * HW);
    sternParts.push([f, (xx, yy, zz, o) => hullPaint(xx, yy, zz, o, 0.15), mat]);
  }
  for (const [g, f, m] of sternParts) { g.applyMatrix4(last); kit.add(paintFn(g, f), m); }

  const built = kit.build('miner-hull');
  // half buried: the whole ship sinks, nose deeper (done by the module pitch), and rolls a little
  const sink = rr(r, 0.75, 0.95);
  const W0 = new THREE.Matrix4().makeTranslation(0, HH - sink, 0).multiply(new THREE.Matrix4().makeRotationX(0.12));
  built.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.applyMatrix4(W0); });

  // ---- sand heaped against both flanks and over the bow; panels thrown off lying about
  const extra = new Kit();
  const packed = new THREE.Color(0xbc9c74), sandC = new THREE.Color(0xd3b286);
  // low drifts, mostly on the upwind (north-west, -Z) flank: the ground heaped against the hull
  for (let i = 0; i < 6; i++) {
    const g = new THREE.IcosahedronGeometry(1, 2);
    displace(g, 0.12, 1.6, seed + 60 + i);
    const side = i < 4 ? -1 : 1, u = i < 4 ? lerp(-0.42, 0.3, i / 3) : lerp(-0.2, 0.2, i - 4);
    g.scale(rr(r, 1.4, 2.0), rr(r, 0.22, 0.34), rr(r, 0.7, 0.95)).translate(u * L, -0.12, side * (HW + 0.35));
    extra.add(paintFn(g, (xx, y, zz, out) => out.copy(packed).lerp(sandC, smooth(-0.2, 0.3, y) * 0.7).multiplyScalar(0.96 + 0.08 * snoise3(xx * 3, y * 3, zz * 3, seed))), matte());
  }
  const bowDrift = new THREE.IcosahedronGeometry(1, 2);
  displace(bowDrift, 0.2, 1.4, seed + 90);
  bowDrift.scale(1.3, 0.45, 1.5).translate(-L / 2 - 0.3, -0.12, 0.1);
  extra.add(paintFn(bowDrift, (xx, y, zz, out) => out.copy(packed).lerp(sandC, smooth(-0.2, 0.4, y) * 0.7).multiplyScalar(0.96 + 0.08 * snoise3(xx * 3, y * 3, zz * 3, seed))), matte());
  for (let i = 0; i < 7; i++) {
    const w = rr(r, 0.5, 1.1), d = rr(r, 0.4, 0.9);
    const g = new THREE.BoxGeometry(w, 0.06, d, 3, 1, 2).toNonIndexed();
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < p.count; v++) p.setY(v, p.getY(v) + (p.getX(v) / w) ** 2 * 0.2);
    g.rotateX(rr(r, -0.3, 0.3)).rotateY(r() * 6).translate(rr(r, -L / 2 - 1.5, L / 2), 0.03, (r() < 0.5 ? -1 : 1) * rr(r, HW + 1.2, HW + 3.2));
    extra.add(paintFn(g, (xx, yy, zz, out) => hullPaint(xx, yy, zz, out, 0.2)), mat);
  }
  const eg = extra.build('miner-hull-sand');
  for (const c of [...eg.children]) built.add(c);
  return built;
}

// ================================================================ Aza'los

/**
 * An Aza'los star-vessel, grown not built (phase 3 rebuild, C-010). Canon: smooth, flowing,
 * crystalline, no engines or weapons, half-buried, teal seeping from cracks. The fallen-orbital title
 * art (an Aza'los vessel, per the reference README) lies broken in two with teal crystal bursting
 * from the break. So: a long pale hull with raised grown ribs that twist along it and meet at an
 * upturned prow; the hull snapped two thirds back, the rear half rolled and pulled away; a cluster of
 * teal crystal inside the break; the prow dug into the end of its furrow.
 * Lies along +X, prow at -X. Origin on the ground at its middle.
 */
export function azalosVessel(length: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const L = Math.max(6, length), R = L * 0.13;
  const pearl = new THREE.Color(0xe0d8c6), shade = new THREE.Color(0xb4b2a4), groove = new THREE.Color(0x8e8a7c);
  const rust = new THREE.Color(0xb07a52), sandC = new THREE.Color(0xd3b286);
  const shellM = crystalShellMat();
  // the centre line: the prow dips into the sand, the body rises a little, the tail sweeps up
  const C = (t: number) => V((t - 0.5) * L, R * (0.25 + 0.3 * Math.sin(Math.PI * t)) - R * 0.5 * Math.pow(1 - smooth(0, 0.22, t), 2) + R * 0.25 * smooth(0.8, 1, t), 0.04 * L * Math.sin(t * Math.PI * 1.6));
  const T0 = V(), Nn = V(), Bn = V();
  const frame = (t: number) => {
    const a = C(Math.max(0, t - 0.005)), b = C(Math.min(1, t + 0.005));
    T0.subVectors(b, a).normalize(); Nn.crossVectors(T0, UP).normalize(); Bn.crossVectors(Nn, T0).normalize();
  };
  // body: a pointed prow (the ribs meet there), full at a third, tapering to a rounded tail
  const body = (t: number) => Math.pow(smooth(0, 0.3, t), 0.8) * (1 - 0.55 * smooth(0.55, 1, t)) + 0.02;
  // grown ribs: narrow raised ridges that twist slowly along the hull; 7 of them, uneven
  const NR = 7;
  const rib = (t: number, a: number) => {
    const ph = a * NR + t * 4.2 + Math.sin(t * 7) * 0.4;
    return Math.pow(Math.abs(Math.cos(ph / 2)), 8) * (0.8 + 0.4 * Math.sin(a * 3 + 1.3));
  };
  const rad = (t: number, a: number) => {
    const low = Math.sin(a) < 0 ? 0.62 : 1;                            // flatter underside
    return R * body(t) * (1 + 0.17 * rib(t, a)) * low;
  };
  const P = (t: number, a: number, k = 1) => {
    frame(t);
    const rr0 = rad(t, a) * k;
    return C(t).addScaledVector(Nn, Math.cos(a) * rr0).addScaledVector(Bn, Math.sin(a) * rr0 * 0.85);
  };
  const paintHull = (x: number, y: number, z: number, out: THREE.Color, t: number, a: number) => {
    out.copy(pearl).lerp(shade, smooth(0.45, 0.8, noise3(x * 0.35, y * 0.35, z * 0.35, seed)) * 0.4);
    out.lerp(groove, (1 - smooth(0.02, 0.35, rib(t, a))) * 0.3);                  // grooves between ribs darker
    out.lerp(pearl.clone().multiplyScalar(1.05), smooth(0.5, 0.95, rib(t, a)) * 0.6); // rib crowns catch light
    out.lerp(rust, smooth(0.66, 0.86, noise3(x * 0.8, y * 1.6, z * 0.8, seed + 4)) * 0.35); // mineral stains
    out.lerp(sandC, (1 - smooth(-0.1, 0.9, y)) * 0.55);                          // sand-scoured low down
  };

  // ---- the two halves, each a shell with a jagged break edge; NT rings, NA columns
  const NT = 90, NA = 48, tBreak = 0.6, gap = 0.035;
  const jag = Array.from({ length: NA }, (_, j) => 0.022 * snoise3(j * 0.9, 0, 0, seed + 7) + 0.012 * snoise3(j * 3.1, 1, 0, seed + 8));
  const cutFront = (j: number) => tBreak + jag[j];
  const cutRear = (j: number) => tBreak + gap + jag[j] * 0.8 + 0.01;
  const half = (front: boolean, M: THREE.Matrix4) => {
    const rings: THREE.Vector3[][] = [], inner: THREE.Vector3[][] = [], cs: THREE.Vector3[] = [], ts: number[] = [];
    for (let i = 0; i <= NT; i++) {
      const t = i / NT; ts.push(t);
      const ring: THREE.Vector3[] = [], inn: THREE.Vector3[] = [];
      for (let j = 0; j < NA; j++) { const a = (j / NA) * Math.PI * 2; ring.push(P(t, a)); inn.push(P(t, a, 0.9)); }
      rings.push(ring); inner.push(inn); cs.push(C(t));
    }
    const keep = (i: number, j: number) => { const t = (ts[i] + ts[i + 1]) / 2; return front ? t < cutFront(j) : t > cutRear(j); };
    const shell = loft(rings, { centres: cs, skip: (i, j) => !keep(i, j) });
    displace(shell, R * 0.012, 1.8 / R, seed);
    const tAt = (x: number) => clamp01(x / L + 0.5);
    paintFn(shell, (x, y, z, out) => { const t = tAt(x); frame(t); const d = V(x, y, z).sub(C(t)); paintHull(x, y, z, out, t, Math.atan2(d.dot(Bn), d.dot(Nn))); });
    shell.applyMatrix4(M);
    kit.add(shell, shellM);
    const inn = loft(inner, { centres: cs, skip: (i, j) => !keep(i, j) });
    kit.add(paintFn(inn.applyMatrix4(M), (_x, y, _z, out) => out.copy(groove).multiplyScalar(0.55 + 0.25 * smooth(-1, 3, y))), matteBack());
    // the broken edge: a thick lip along the jagged cut, bright where it caught the light
    const lip: THREE.Vector3[] = [];
    for (let j = 0; j <= NA; j++) { const jj = j % NA, a = (jj / NA) * Math.PI * 2, t = front ? cutFront(jj) : cutRear(jj); lip.push(P(t, a, 0.95)); }
    const lipG = sweep(lip, { segments: NA * 3, radial: 5, radius: () => R * 0.05 });
    kit.add(paintFn(lipG.applyMatrix4(M), (_x, _y, _z, out) => out.copy(pearl).multiplyScalar(0.92)), shellM);
    // teal seams in two grooves on the upper flanks (the old crystal ridges), stopping at the break
    for (const a0 of [Math.PI / 2 - 0.62, Math.PI / 2 + 0.5]) {
      const pts: THREE.Vector3[] = [];
      const t0 = front ? 0.1 : tBreak + gap + 0.05, t1 = front ? tBreak - 0.04 : 0.9;
      for (let k = 0; k <= 16; k++) { const t = lerp(t0, t1, k / 16); pts.push(P(t, a0 - t * 4.2 / NR, 1.005)); }
      kit.add(sweep(pts, { segments: 48, radial: 3, radius: (u) => R * 0.018 * (0.5 + Math.sin(Math.PI * u)) }).applyMatrix4(M), glow(0x7fd8cc, 0.45));
    }
  };
  const I4 = new THREE.Matrix4();
  half(true, I4);
  // the rear half: pulled back, rolled onto its flank, dropped into the sand
  const pivot = C(tBreak);
  const MR = new THREE.Matrix4().makeTranslation(pivot.x + 0.9, pivot.y - R * 0.18, pivot.z + 0.35)
    .multiply(new THREE.Matrix4().makeRotationY(0.16))
    .multiply(new THREE.Matrix4().makeRotationX(0.42))
    .multiply(new THREE.Matrix4().makeRotationZ(-0.05))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  half(false, MR);

  // ---- teal crystal inside the break: a cluster pointing out of the front half's broken end
  const cryM = makeCrystalOnce();
  frame(tBreak - 0.02);
  const cc = C(tBreak - 0.03);
  for (let i = 0; i < 9; i++) {
    const a = rr(r, 0, Math.PI * 2), s = R * rr(r, 0.12, 0.3) * (i < 3 ? 1.5 : 1);
    const dir = T0.clone().multiplyScalar(rr(r, 0.4, 1)).addScaledVector(Nn, Math.cos(a) * 0.6).addScaledVector(Bn, Math.sin(a) * 0.6 + 0.25).normalize();
    const g = new THREE.OctahedronGeometry(1, 0).scale(s * 0.45, s * 2.2, s * 0.45);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
    const base = cc.clone().addScaledVector(Nn, Math.cos(a) * R * 0.35 * body(tBreak)).addScaledVector(Bn, Math.sin(a) * R * 0.3 * body(tBreak));
    g.translate(base.x + dir.x * s, base.y + dir.y * s, base.z + dir.z * s);
    kit.add(g, cryM);
  }
  // shards spilled in the gap and on the sand, lying down (canon: no crystal stands out of the ground)
  for (let i = 0; i < 6; i++) {
    const g = new THREE.OctahedronGeometry(1, 0).scale(0.12, 0.45, 0.12).rotateZ(Math.PI / 2 + rr(r, -0.3, 0.3)).rotateY(r() * 6);
    g.translate(pivot.x + rr(r, -0.6, 1.6), 0.1, pivot.z + rr(r, -R * 1.4, R * 1.4));
    kit.add(g, cryM);
  }
  // ---- folded fin-wings on the front half, like the petals of a closed seed
  for (const s of [-1, 1]) {
    const t = 0.42, root = P(t, Math.PI / 2 + s * 1.15, 0.97);
    const wing = sweep([root, root.clone().add(V(-L * 0.08, R * 0.3, s * R * 0.65)), root.clone().add(V(-L * 0.2, R * 0.12, s * R * 0.95))], { segments: 16, radial: 6, radius: (u) => R * 0.1 * (1 - u) + 0.02 });
    wing.scale(1, 0.55, 1);
    kit.add(paintFn(wing, (x, y, z, out) => out.copy(pearl).multiplyScalar(0.86 + 0.14 * noise3(x, y, z, seed + 5))), shellM);
  }
  // ---- sand heaped at the prow (it ploughed the furrow) and drifted into the break
  const packed = new THREE.Color(0xbc9c74);
  const drift = (x: number, z: number, sx: number, sy: number, sz: number, s: number) => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    displace(g, 0.14, 1.6, s);
    g.scale(sx, sy, sz).translate(x, 0.5 - sy * 0.4, z);
    kit.add(paintFn(g, (x2, y2, z2, out) => out.copy(packed).lerp(sandC, smooth(0.3, 0.8, y2) * 0.7).multiplyScalar(0.96 + 0.08 * snoise3(x2 * 3, y2 * 3, z2 * 3, s))), matte());
  };
  drift(-L / 2 - 0.4, 0, 2.2, 0.75, R * 1.3, seed + 60);
  drift(-L / 2 + 1.6, R * 0.9, 1.8, 0.45, 1.2, seed + 61);
  drift(pivot.x + 0.5, -R * 0.9, 1.6, 0.4, 1.3, seed + 62);
  drift(pivot.x + 0.4, R * 1.1, 1.4, 0.35, 1.0, seed + 63);
  return kit.build('azalos-vessel');
}

let _vcry: THREE.MeshStandardMaterial | null = null;
/** Teal crystal for the vessel's break: lit from inside, not as bright as a lamp. */
function makeCrystalOnce() {
  if (!_vcry) { _vcry = makeCrystal(PALETTE.teal, 0.9); _vcry.userData.glow = true; }
  return _vcry;
}

let _miner: THREE.MeshStandardMaterial | null = null;
/** Old hull plate: dull, barely metallic (there is no sky to reflect, so real metal reads black). */
const minerMat = () => _miner ??= withCrease(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.12 }), 35);

let _shell: THREE.MeshStandardMaterial | null = null;
/** Grown Aza'los shell: smooth, faintly glossy like old nacre. */
function crystalShellMat() {
  if (!_shell) { _shell = withCrease(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 }), 70); _shell.userData.surface = 'stone'; }
  return _shell;
}

export type { Rng };
