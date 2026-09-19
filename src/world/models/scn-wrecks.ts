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
  Kit, makeRng, rr, ri, lerp, clamp01, smooth, noise3, snoise3, displace, paintFn, sweep, lathe,
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
 * The Maker wreck, drawn from the world map (comms/refs/world-map.png, centre): two halves grown
 * into one. The fore half is angular armour: faceted sage-grey plates that overlap like sleeves
 * and taper to a blade prow, rust-brown ribs showing through the gaps, amber leaking from the
 * deepest seams. The aft half is pale bone-coral, pierced with oval holes, ending in curved
 * finger-prongs that reach up and back. Lies along +X, prow at -X dug into the sand.
 */
export function makerWreck(length: number, seed = 1): THREE.Object3D {
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
