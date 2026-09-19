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
  matte, matteBack, metal, glow, withCrease, type Rng,
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
  const red = glow(PALETTE.telsharinRed, 1.5);

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
  const holes = [
    { u: 0.31, j: 1.0, ru: 0.05, rj: 0.95 },  // the back torn open (old item 4)
    { u: 0.17, j: 2.5, ru: 0.03, rj: 0.55 },
    { u: 0.43, j: 7.6, ru: 0.035, rj: 0.6 },
    { u: 0.53, j: 9.1, ru: 0.026, rj: 0.55 },
    { u: 0.08, j: 3.3, ru: 0.02, rj: 0.35 },
  ];
  for (let i = 0; i < 4; i++) holes.push({ u: rr(r, 0.12, 0.56), j: rr(r, 0, 10), ru: rr(r, 0.01, 0.016), rj: rr(r, 0.18, 0.3) });
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
    skip: (s, t) => holeField(lerp(uu0, uu1, t), s * NP) < 0.72,
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
    kit.add(sweep(pts, { segments: 16, radial: 4, radius: () => 0.045 }), red);
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
  const roll = 0.28, pitch = 0.03;
  const M = new THREE.Matrix4().makeTranslation(0, 0.95, 0)
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
 * A miner hull, half buried: a chain of dark grey-brown box modules joined by collar rings, panel
 * lines and hatches, a rust bloom where the paint is gone, an engine block at the stern with three
 * nozzles. Canon: blocky, utilitarian, modular sections, visible engines. The world map draws them
 * as long chains of boxes.
 */
export function minerHull(length: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const metal = minerMat;
  const L = Math.max(5, length);
  // the map paints them grey-brown and mid-toned, not black
  const base = new THREE.Color(0x857a6c), dark = new THREE.Color(0x4a423a), rustC = new THREE.Color(0x8e5a3c), paintC = new THREE.Color(0x9a8c74);
  const paintMod = (g: THREE.BufferGeometry, s: number, w: number, h: number) => paintFn(g, (x, y, z, out) => {
    out.copy(base).lerp(paintC, smooth(0.4, 0.7, noise3(x * 0.6, y * 0.6, z * 0.6, s)) * 0.6);
    out.lerp(rustC, smooth(0.55, 0.85, noise3(x * 1.4, y * 1.4, z * 1.4, s + 1)) * 0.65);
    // panel lines: dark grooves on a rough grid
    const px = Math.abs(((x / (w / 3)) % 1 + 1) % 1 - 0.5), py = Math.abs(((y / (h / 2)) % 1 + 1) % 1 - 0.5);
    out.lerp(dark, (smooth(0.46, 0.5, px) + smooth(0.46, 0.5, py)) * 0.4);
    out.multiplyScalar(0.8 + 0.2 * smooth(-h / 2, h / 2, y));
  });
  const n = Math.max(3, Math.round(L / 2.4));
  const modL = L / n - 0.25;
  let x = -L / 2;
  const sink = rr(r, 0.9, 1.3);
  for (let i = 0; i < n; i++) {
    const w = modL, h = rr(r, 2.0, 2.6) - (i === 0 ? 0.3 : 0), d = rr(r, 2.2, 2.6);
    const tilt = (i - n / 2) * 0.02 + rr(r, -0.03, 0.03);
    const g = new RoundedBoxGeometry(w, h, d, 2, 0.12);
    displace(g, 0.03, 1.2, seed + i);
    g.rotateZ(tilt).rotateX(rr(r, -0.05, 0.05)).translate(x + w / 2, h / 2 - sink + i * 0.08, rr(r, -0.1, 0.1));
    kit.add(paintMod(g.toNonIndexed(), seed + i, w, h), metal());
    // a collar ring to the next module
    if (i < n - 1) {
      const c = new THREE.CylinderGeometry(0.85, 0.85, 0.35, 12).rotateZ(Math.PI / 2).translate(x + w + 0.12, h * 0.45 - sink, 0);
      kit.add(paintMod(c.toNonIndexed(), seed + 20 + i, 0.35, 1.7), metal());
    }
    // hatches and a ladder on some modules
    if (r() < 0.6) {
      const hatch = new RoundedBoxGeometry(0.7, 0.9, 0.08, 1, 0.04).translate(x + w * rr(r, 0.3, 0.7), h * 0.5 - sink + 0.1, d / 2 + 0.03);
      kit.add(paintFn(hatch.toNonIndexed(), (_x, _y, _z, out) => out.copy(dark).lerp(rustC, 0.3)), metal());
    }
    x += w + 0.25;
  }
  // swept fins on the first module and the stern, as the map draws them
  for (const [fx, side] of [[-L / 2 + 0.8, 1], [-L / 2 + 0.8, -1], [L / 2 - 0.6, 1], [L / 2 - 0.6, -1]] as const) {
    const b = 1.2 - sink;
    const g = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.5, 0), new THREE.Vector2(1.8, 1.6)]), { depth: 0.08, bevelEnabled: false });
    g.rotateX(side * Math.PI / 2).translate(fx - 0.9, b + 0.1, side * 1.15);
    kit.add(paintMod(g.toNonIndexed(), seed + 70, 1.5, 1.6), metal());
  }
  // the engine block at the stern: three nozzles, blackened inside
  const ex = L / 2 + 0.2;
  const eb = new RoundedBoxGeometry(1.2, 2.2, 2.6, 2, 0.15).translate(ex, 1.1 - sink + 0.3, 0);
  kit.add(paintMod(eb.toNonIndexed(), seed + 40, 1.2, 2.2), metal());
  for (const [zy, zz] of [[0.3, -0.75], [0.3, 0.75], [1.3, 0]] as const) {
    const noz = lathe([[0.45, 0], [0.38, 0.3], [0.5, 0.9], [0.56, 1.0], [0.5, 1.0], [0.44, 0.9], [0.32, 0.3], [0.001, 0.2]], 14);
    noz.rotateZ(-Math.PI / 2).translate(ex + 0.55, zy - sink + 0.3 + 0.6, zz);
    kit.add(paintFn(noz, (x2, _y, _z, out) => out.copy(base).lerp(dark, smooth(ex + 1.2, ex + 1.5, x2) * 0.8).lerp(rustC, 0.25)), metal());
  }
  // sand drifted against the upwind side
  for (let i = 0; i < 5; i++) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    displace(g, 0.25, 1.5, seed + 60 + i);
    g.scale(rr(r, 1.4, 2.2), rr(r, 0.5, 0.8), rr(r, 0.9, 1.3)).translate(lerp(-L / 2, L / 2, i / 4), -0.3, -1.6 + rr(r, -0.3, 0.2));
    kit.add(paintFn(g, (_x, _y, _z, out) => out.setHex(PALETTE.sand).multiplyScalar(0.95)), matte());
  }
  return kit.build('miner-hull');
}

// ================================================================ Aza'los

/**
 * An Aza'los star-vessel, grown not built: a long smooth seed-shaped shell of pale pearl stone,
 * crystal ridges along its flanks, two folded fin-wings, no engines and no weapons. Half sunk in
 * the sand. A crack runs down its side and teal light leaks from it, faint, centuries later.
 */
export function azalosVessel(length: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const L = Math.max(5, length), R = L * 0.16;
  const pearl = new THREE.Color(0xdcd4c4), shade = new THREE.Color(0xa8b0a8), sand = new THREE.Color(PALETTE.sand);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push(V((u - 0.5) * L, R * (0.1 + 0.35 * Math.sin(u * Math.PI)) - R * 0.25 * u, 0.05 * L * Math.sin(u * Math.PI * 2))); }
  const crackA = rr(r, 0.1, 0.5);
  const rad = (t: number, a: number) => {
    const body = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.55) * (1 - 0.25 * t);
    const flute = 1 + 0.05 * Math.cos(a * 6 + t * 3);                      // shallow grown flutes
    const flat = 1 - 0.18 * Math.max(0, -Math.sin(a));
    return R * Math.max(0.02, body) * flute * flat;
  };
  const shell = sweep(pts, { segments: 44, radial: 20, radius: rad, up: UP, capStart: false });
  displace(shell, R * 0.02, 1.5 / R, seed);
  paintFn(shell, (x, y, z, out) => {
    out.copy(pearl).lerp(shade, smooth(0.45, 0.8, noise3(x * 0.4, y * 0.4, z * 0.4, seed)) * 0.4);
    out.multiplyScalar(0.8 + 0.25 * smooth(-R, R, y) + 0.05 * snoise3(x * 2, y * 2, z * 2, seed));
    out.lerp(sand, (1 - smooth(-0.3, 0.6, y)) * 0.6);
  });
  kit.add(shell, crystalShellMat());
  // crystal ridges: slim faceted keels flowing along the upper flanks
  const curve = new THREE.CatmullRomCurve3(pts);
  const frame = (t: number, a: number, k = 1) => {
    const P = curve.getPointAt(t), T = curve.getTangentAt(t);
    const N = new THREE.Vector3().crossVectors(T, UP).normalize(), B = new THREE.Vector3().crossVectors(N, T).normalize();
    return P.addScaledVector(N, Math.cos(a) * rad(t, a) * k).addScaledVector(B, Math.sin(a) * rad(t, a) * k);
  };
  for (const a of [Math.PI / 2 - 0.55, Math.PI / 2 + 0.55]) {
    const ridge: THREE.Vector3[] = [];
    for (let k = 0; k <= 12; k++) ridge.push(frame(lerp(0.12, 0.85, k / 12), a, 1.01));
    kit.add(sweep(ridge, { segments: 40, radial: 3, radius: (t) => R * 0.05 * Math.sin(Math.PI * t) + 0.01 }), glow(0x7fd8cc, 0.35));
  }
  // folded fin-wings, like the petals of a closed seed
  for (const s of [-1, 1]) {
    const t = 0.55, root = frame(t, Math.PI / 2 + s * 1.2, 0.98);
    const wing = sweep([root, root.clone().add(V(-L * 0.12, R * 0.35, s * R * 0.9)), root.clone().add(V(-L * 0.3, R * 0.15, s * R * 1.3))], { segments: 14, radial: 6, radius: (u) => R * 0.12 * (1 - u) + 0.02 });
    wing.scale(1, 0.55, 1);
    paintFn(wing, (x, y, z, out) => out.copy(pearl).multiplyScalar(0.85 + 0.15 * noise3(x, y, z, seed + 5)));
    kit.add(wing, crystalShellMat());
  }
  // the crack down the flank, teal leaking from it
  const crack: THREE.Vector3[] = [];
  // a jagged crack, not a wave: straight runs with sudden turns
  let ca = crackA;
  for (let k = 0; k <= 12; k++) { if (k % 2) ca += rr(r, -0.35, 0.35); crack.push(frame(lerp(0.28, 0.74, k / 12), ca, 1.005)); }
  kit.add(sweep(crack, { segments: 36, radial: 4, radius: (t) => R * 0.018 * (0.4 + Math.sin(Math.PI * t)) }), glow(PALETTE.teal, 1.3));
  return kit.build('azalos-vessel');
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
