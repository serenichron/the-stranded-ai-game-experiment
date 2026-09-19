// Clickable props. One builder per `prop-*` kind in core/contracts.ts.
// Each returns a Model: origin on the ground at the tile centre, front facing +Z unless noted.
import * as THREE from 'three';
import type { AnimName, EntityKind } from '../../core/contracts';
import { CRYSTAL_HEX, PALETTE, type Model, type ModelOpts } from './types';
import {
  Kit, makeRng, rr, ri, pick, lerp, smooth, noise3, xf, displace, paint, paintFn, sweep, lathe, ribbon, seam, lump,
  matte, matte2, metal, glow, makeGlow, makeCrystal, waterMat, pointLight,
} from './scn-kit';
import { barrelGourd, buildPlant } from './scn-plants';
import { cistern } from './scn-camp';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => xf(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);

/** Collect meshes under a root (for pickables). */
function meshesOf(root: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(o); });
  return out;
}

/** Wraps a root with defaults. Disposes all geometry under it plus any owned materials. */
function makeModel(root: THREE.Object3D, height: number, extra: Partial<Model> & { owned?: THREE.Material[] } = {}): Model {
  const owned = extra.owned ?? [];
  return {
    root,
    height,
    pickables: extra.pickables ?? meshesOf(root),
    update: extra.update ?? (() => {}),
    play: (_a: AnimName) => 0,
    setState: extra.setState,
    dispose: () => {
      root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      owned.forEach((m) => m.dispose());
    },
  };
}

/** A timed tween from the current value to a target. */
class Tween {
  v: number;
  private from: number;
  private to: number;
  private t = 1;
  constructor(v: number, private dur: number) { this.v = v; this.from = v; this.to = v; }
  go(to: number, instant = false) {
    if (instant) { this.v = this.from = this.to = to; this.t = 1; return; }
    this.from = this.v; this.to = to; this.t = 0;
  }
  step(dt: number) {
    if (this.t >= 1) return this.v;
    this.t = Math.min(1, this.t + dt / this.dur);
    this.v = lerp(this.from, this.to, ease(this.t));
    return this.v;
  }
}

// ================================================================ metal pile

function metalPile(seed: number): Model {
  const r = makeRng(seed);
  const kit = new Kit();
  kit.add(paint(xf(lump(r, 1.2, 1), 0, 0, 0, 0, r() * 3, 0, 1, 0.3, 1), 0x6e5a44, { seed, vary: 0.12, ao: 0.3, aoHeight: 0.2 }), matte());
  const cols = [PALETTE.rust, PALETTE.minerMetal, PALETTE.makerMetal, 0x6d665c, PALETTE.rustDark];
  const pm = (g: THREE.BufferGeometry, hex: number) => kit.add(paint(g, hex, { seed: seed + Math.floor(r() * 99), vary: 0.15, freq: 3, ao: 0.35, aoHeight: 0.4, stain: PALETTE.rust, stainAmount: 0.6 }), metal());
  const n = ri(r, 6, 9);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = rr(r, 0, 0.35) * (1 - i / n);
    pm(box(rr(r, 0.3, 0.6), 0.03, rr(r, 0.2, 0.45), Math.cos(a) * d, 0.08 + (i / n) * 0.35, Math.sin(a) * d, rr(r, -0.5, 0.5), r() * 6, rr(r, -0.5, 0.5)), pick(r, cols));
  }
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    pm(xf(new THREE.CylinderGeometry(0.05, 0.05, rr(r, 0.5, 0.9), 6, 1), Math.cos(a) * 0.2, rr(r, 0.1, 0.3), Math.sin(a) * 0.2, rr(r, -0.3, 0.3), r() * 6, Math.PI / 2 + rr(r, -0.4, 0.4)), pick(r, cols));
  }
  // A gear with square teeth.
  const gx = rr(r, -0.2, 0.2), gy = 0.42, gz = rr(r, -0.2, 0.2), rx = rr(r, 0.6, 1.2), ry = r() * 6;
  const gear = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10, 1);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const tooth = box(0.07, 0.05, 0.06, Math.cos(a) * 0.23, 0, Math.sin(a) * 0.23, 0, -a, 0);
    xf(tooth, gx, gy, gz, rx, ry, 0);
    pm(tooth, PALETTE.minerMetal);
  }
  pm(xf(gear, gx, gy, gz, rx, ry, 0), PALETTE.minerMetal);
  pm(box(1.0, 0.1, 0.12, rr(r, -0.1, 0.1), 0.25, rr(r, -0.1, 0.1), rr(r, -0.2, 0.2), r() * 6, rr(r, -0.3, 0.3)), PALETTE.rustDark);
  const root = kit.build('prop-metal-pile');
  return makeModel(root, 0.7);
}

// ================================================================ crystal

/** A cut crystal cluster: hexagonal shards with pointed tips. */
/** A double-terminated hexagonal shard, lying along +X. */
function shard(len: number, rad: number): THREE.BufferGeometry {
  const prof: [number, number][] = [[0.001, -len / 2], [rad, -len * 0.3], [rad * 1.05, len * 0.25], [0.001, len / 2]];
  const g = lathe(prof, 6);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/**
 * A loose crystal: a shard somebody dropped, lying half sunk in a patch of disturbed sand,
 * with a chip or two beside it. Canon: no crystal sticks out of the ground, deposits stay buried,
 * so a crystal on the surface is always a loose piece. It glows faintly; no light of its own
 * (every added point light costs every lit pixel in the scene).
 */
function crystal(opts: ModelOpts, seed: number): Model {
  const r = makeRng(seed);
  const hex = CRYSTAL_HEX[opts.colour ?? 'azure'];
  const isVoid = opts.colour === 'void';
  const mat = makeCrystal(hex, isVoid ? 2 : 0.9);
  mat.userData.glow = true;
  const root = new THREE.Group();
  root.name = 'prop-crystal';
  // a shallow scuffed hollow of darker sand
  const bed = new Kit();
  const hollow = new THREE.CircleGeometry(0.42, 18).rotateX(-Math.PI / 2).translate(0, 0.012, 0);
  bed.add(paintFn(hollow, (x, _y, z, out) => out.setHex(0x9a7a58).multiplyScalar(0.85 + 0.2 * Math.hypot(x, z) / 0.42 + 0.1 * noise3(x * 6, 0, z * 6, seed))), matte());
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2, d = rr(r, 0.25, 0.4);
    bed.add(paint(xf(lump(r, rr(r, 0.07, 0.12), 0), Math.cos(a) * d, 0.02, Math.sin(a) * d, r(), r(), 0, 1, 0.6, 1), 0x8a7058, { seed: seed + i, vary: 0.1, ao: 0 }), matte());
  }
  root.add(bed.build('bed'));
  const ck = new Kit();
  const main = shard(rr(r, 0.34, 0.44), rr(r, 0.05, 0.065));
  main.rotateZ(rr(r, 0.12, 0.25)).rotateY(r() * Math.PI * 2).translate(0, 0.035, 0);
  ck.add(main, mat);
  for (let i = 0; i < ri(r, 1, 2); i++) {
    const c = shard(rr(r, 0.1, 0.16), rr(r, 0.02, 0.03));
    const a = r() * Math.PI * 2;
    c.rotateZ(rr(r, -0.2, 0.3)).rotateY(r() * 6).translate(Math.cos(a) * 0.2, 0.015, Math.sin(a) * 0.2);
    ck.add(c, mat);
  }
  const cluster = ck.build('crystal', false);
  root.add(cluster);
  const ph = r() * 6;
  const baseI = mat.emissiveIntensity;
  return makeModel(root, 0.35, {
    owned: [mat],
    update: (_dt, t) => {
      // a slow breath of light, as if something inside it is still awake
      const p = 0.5 + 0.5 * Math.sin(t * 1.3 + ph);
      mat.emissiveIntensity = baseI * (0.7 + 0.45 * p);
    },
  });
}

// ================================================================ symbol door

/**
 * An Aza'los door in a curving pale-stone frame. The door lies in the XY plane, so it blocks
 * passage along Z. Frame is about 1.9 m wide, 3.05 m tall, 0.45 m deep. Opening about 1.1 m.
 * States: 'sealed' | 'open'. Open irises the two leaves back into the frame over 1.2 s.
 */
function symbolDoor(seed: number): Model {
  const r = makeRng(seed);
  const root = new THREE.Group();
  root.name = 'prop-symbol-door';
  const kit = new Kit();
  const stone = (g: THREE.BufferGeometry, s = seed) => paint(g, PALETTE.stone, { vary: 0.07, freq: 1.2, seed: s, ao: 0.4, aoHeight: 1.0, dust: PALETTE.sand, dustHeight: 0.5, stain: 0xb7a17f, stainAmount: 0.45 });
  const Z = V(0, 0, 1);
  const framePts = [V(-0.74, -0.15, 0), V(-0.76, 1.2, 0), V(-0.68, 2.12, 0), V(-0.37, 2.78, 0), V(0, 3.02, 0), V(0.37, 2.78, 0), V(0.68, 2.12, 0), V(0.76, 1.2, 0), V(0.74, -0.15, 0)];
  const frame = sweep(framePts, { segments: 30, radial: 8, up: Z, radius: (t, a) => lerp(0.2, 0.3, Math.pow(Math.abs(t - 0.5) * 2, 3)) * (1 + 0.1 * Math.sin(a * 3 + t * 13)) });
  displace(frame, 0.03, 2.5, seed);
  kit.add(stone(frame), matte());
  for (const sx of [-1, 1]) {
    const foot = lathe([[0.42, -0.05], [0.36, 0.1], [0.3, 0.3], [0.26, 0.55]], 9);
    xf(foot, sx * 0.75, 0, 0);
    displace(foot, 0.03, 2.5, seed + 1);
    kit.add(stone(foot, seed + 1), matte());
  }
  // A curling tendril over the crown.
  const tp = [V(-0.35, 2.85, 0.1), V(-0.1, 3.25, 0.05), V(0.2, 3.3, 0), V(0.3, 3.12, -0.02), V(0.18, 3.05, 0)];
  kit.add(stone(sweep(tp, { segments: 12, radial: 5, radius: (t) => 0.09 * (1 - 0.8 * t) })), matte());
  // Frame seams, front and back.
  const curve = new THREE.CatmullRomCurve3(framePts, false, 'centripetal');
  for (const zs of [1, -1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = lerp(0.06, 0.94, i / 16), p = curve.getPointAt(t);
      const rad = lerp(0.2, 0.3, Math.pow(Math.abs(t - 0.5) * 2, 3));
      pts.push(p.add(V(0, 0, zs * (rad * 0.93 + 0.02))));
    }
    kit.add(seam(pts, 0.03, 36), glow(PALETTE.teal, 1.8));
  }
  root.add(kit.build('frame'));

  // Leaves. Each pivots at its outer edge and shrinks into the frame to open.
  const glyphMat = makeGlow(PALETTE.teal, 1.8);
  const leafW = 0.58, topY = 2.9, shoulder = 1.8;
  const leaves: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const sh = new THREE.Shape();
    // in pivot space: x = 0 at the frame, x = leafW * -side at the centre line
    const cx = -side * leafW;
    sh.moveTo(0, -0.05);
    sh.lineTo(0, shoulder);
    sh.quadraticCurveTo(0.02 * -side, topY - 0.3, cx, topY);
    sh.lineTo(cx, -0.05);
    sh.lineTo(0, -0.05);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 8 });
    g.translate(0, 0, -0.05);
    const lk = new Kit();
    lk.add(paintFn(g, (x, y, z, out) => {
      out.setHex(0xbfb49c).multiplyScalar(0.9 + 0.08 * noise3(x * 3, y * 3, z * 3, seed) - 0.12 * (1 - smooth(0, 1, y)));
    }), matte());
    // Glyphs on both faces: rings, hooks and a flowing stem. No letters.
    for (const zs of [1, -1]) {
      const n = Z.clone().multiplyScalar(zs), zz = zs * 0.056;
      const gx = cx * 0.5;
      const ring = (x: number, y: number, rad: number) => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; pts.push(V(x + Math.cos(a) * rad, y + Math.sin(a) * rad, zz)); }
        lk.add(ribbon(pts, 0.035, 24, n, false, true), glyphMat);
      };
      ring(gx, 1.55, 0.13);
      ring(gx + rr(r, -0.08, 0.08), 0.75, 0.06);
      const stem: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) {
        const y = lerp(0.3, 2.45, i / 8);
        stem.push(V(gx + 0.1 * Math.sin(i * 1.3 + side), y, zz));
      }
      lk.add(ribbon(stem, 0.035, 30, n), glyphMat);
      const hook: THREE.Vector3[] = [];
      for (let i = 0; i <= 7; i++) {
        const a = i * 0.75, rad = 0.16 * (1 - i / 10);
        hook.push(V(gx + Math.cos(a) * rad * -side, 2.1 + Math.sin(a) * rad, zz));
      }
      lk.add(ribbon(hook, 0.03, 16, n), glyphMat);
      // the seam where the leaves meet
      lk.add(ribbon([V(cx + side * 0.02, 0.1, zz), V(cx + side * 0.02, 1.5, zz), V(cx + side * 0.02, topY - 0.15, zz)], 0.03, 12, n, false), glyphMat);
    }
    const leaf = lk.build(`leaf-${side}`);
    const pivot = new THREE.Group();
    pivot.position.set(side * leafW, 0, 0);
    pivot.add(leaf);
    root.add(pivot);
    leaves.push(pivot);
  }
  const open = new Tween(0, 1.2);
  let state = 'sealed', first = true;
  const apply = () => {
    for (const lf of leaves) {
      lf.scale.x = lerp(1, 0.05, open.v);
      lf.visible = open.v < 0.995;
    }
  };
  return makeModel(root, 3.05, {
    owned: [glyphMat],
    setState: (s: string) => {
      if (s !== 'sealed' && s !== 'open') return;
      const instant = first;
      first = false;
      if (s === state && !instant) return;
      state = s;
      open.go(s === 'open' ? 1 : 0, instant);
      apply();
    },
    update: (dt, t) => {
      open.step(dt);
      apply();
      glyphMat.emissiveIntensity = lerp(1.6 + 0.35 * Math.sin(t * 1.3), 3.2, Math.sin(open.v * Math.PI));
    },
  });
}

// ================================================================ archive

/**
 * The Keeper's archive fragment: a carved tablet on an organic plinth, tilted towards +Z.
 * States: 'dormant' (faint) | 'lit' (azure-white pulse) | 'taken' (tablet gone).
 */
function archive(seed: number): Model {
  const r = makeRng(seed);
  const root = new THREE.Group();
  root.name = 'prop-archive';
  const kit = new Kit();
  const plinth = lathe([[0.38, -0.03], [0.34, 0.06], [0.22, 0.2], [0.15, 0.45], [0.16, 0.66], [0.26, 0.82], [0.33, 0.9], [0.28, 0.95], [0, 0.93]], 12, (a, _c, j, rad, y) => [rad * (1 + 0.06 * Math.sin(a * 3)), j >= 6 ? y + Math.cos(a) * -0.06 : y]);
  displace(plinth, 0.02, 3, seed);
  kit.add(paint(plinth, PALETTE.stone, { vary: 0.07, seed, ao: 0.45, aoHeight: 0.6, dust: PALETTE.sand, dustHeight: 0.3, stain: 0xb7a17f, stainAmount: 0.4 }), matte());
  const sp: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const y = lerp(0.1, 0.8, i / 6), a = 0.3 + i * 0.5;
    const rad = y < 0.45 ? lerp(0.3, 0.155, (y - 0.1) / 0.35) : lerp(0.155, 0.27, (y - 0.45) / 0.37);
    sp.push(V(Math.sin(a) * (rad + 0.015), y, Math.cos(a) * (rad + 0.015)));
  }
  kit.add(seam(sp, 0.018, 20), glow(PALETTE.teal, 1.2));
  root.add(kit.build('plinth'));

  const plateMat = makeGlow(0xcfe8ff, 0.25);
  const pk = new Kit();
  const sh = new THREE.Shape();
  sh.absellipse(0, 0, 0.2, 0.15, 0, Math.PI * 2, false, 0);
  const plateG = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: false, curveSegments: 16 });
  pk.add(paint(plateG, 0x9fa6a8, { vary: 0.06, seed, ao: 0 }), metal());
  const n = V(0, 0, 1);
  const lines: THREE.Vector3[][] = [];
  for (let k = 0; k < 3; k++) {
    const y = lerp(-0.07, 0.07, k / 2), pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 5; i++) pts.push(V(lerp(-0.13, 0.13, i / 5) * (k === 1 ? 1 : 0.8), y + 0.012 * Math.sin(i * 1.7 + k + r()), 0.037));
    lines.push(pts);
  }
  lines.forEach((pts) => pk.add(ribbon(pts, 0.014, 14, n), plateMat));
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ring.push(V(Math.cos(a) * 0.175, Math.sin(a) * 0.128, 0.037)); }
  pk.add(ribbon(ring, 0.01, 30, n, false, true), plateMat);
  const plate = pk.build('tablet');
  plate.position.set(0, 0.97, 0.02);
  plate.rotation.x = -0.95;
  root.add(plate);
  const light = pointLight(0xbfe0ff, 0, 3, 0, 1.25, 0.2);
  root.add(light);
  let state = 'dormant';
  const level = new Tween(0.25, 0.8);
  return makeModel(root, 1.15, {
    owned: [plateMat],
    setState: (s: string) => {
      if (s !== 'dormant' && s !== 'lit' && s !== 'taken') return;
      state = s;
      plate.visible = s !== 'taken';
      level.go(s === 'lit' ? 1 : s === 'dormant' ? 0.25 : 0);
    },
    update: (dt, t) => {
      const v = level.step(dt);
      const pulse = state === 'lit' ? 0.75 + 0.25 * Math.sin(t * 2.2) : 1;
      plateMat.emissiveIntensity = 0.2 + v * 2.2 * pulse;
      light.intensity = state === 'taken' ? 0 : Math.max(0, v - 0.25) * 1.6 * pulse;
    },
  });
}

// ================================================================ chest

/** A miner salvage crate, 0.9 x 0.55 x 0.6 m. States: 'closed' | 'open'. Lid hinges at the back (-Z). */
function chest(seed: number): Model {
  const r = makeRng(seed);
  const root = new THREE.Group();
  root.name = 'prop-chest';
  const W = 0.9, H = 0.5, D = 0.55;
  // salvage-brown and weathered green-grey: the old dark miner metal read as a black square from above
  const body = rr(r, 0, 1) < 0.5 ? 0x8a7458 : 0x7a7a62;
  const pm = (g: THREE.BufferGeometry, hex: number, s = seed) => paint(g, hex, { seed: s, vary: 0.1, freq: 3, ao: 0.35, aoHeight: 0.3, stain: PALETTE.rust, stainAmount: 0.5 });
  const kit = new Kit();
  const bg = box(W, H, D, 0, H / 2, 0);
  const band = new THREE.Color(0xa8864a), c0 = new THREE.Color(body);
  kit.add(paintFn(bg, (x, y, z, out) => {
    out.copy(Math.abs(y - 0.3) < 0.05 ? band : c0).multiplyScalar(0.85 + 0.15 * y / H + 0.08 * noise3(x * 5, y * 5, z * 5, seed));
  }), metal());
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add(pm(box(0.05, H + 0.02, 0.05, sx * (W / 2 - 0.01), H / 2, sz * (D / 2 - 0.01)), PALETTE.rustDark), metal());
  for (const sx of [-1, 1]) kit.add(pm(box(0.03, 0.05, 0.2, sx * (W / 2 + 0.03), H * 0.65, 0), 0x3a3430), metal());
  kit.add(paint(box(W - 0.08, 0.02, D - 0.08, 0, H + 0.001, 0), 0x6a5844, { seed, ao: 0 }), matte());
  root.add(kit.build('crate'));
  const lk = new Kit();
  lk.add(pm(box(W + 0.03, 0.08, D + 0.03, 0, 0.04, D / 2 + 0.015), body, seed + 1), metal());
  lk.add(pm(box(W + 0.05, 0.02, 0.06, 0, 0.085, D / 2), PALETTE.rustDark, seed + 2), metal());
  lk.add(pm(box(0.12, 0.08, 0.03, 0, 0.0, D + 0.03), 0x3a3430, seed + 3), metal());
  const lid = new THREE.Group();
  lid.add(lk.build('lid'));
  lid.position.set(0, H, -D / 2 - 0.015);
  root.add(lid);
  const open = new Tween(0, 0.5);
  let first = true;
  return makeModel(root, 0.62, {
    setState: (s: string) => {
      if (s !== 'open' && s !== 'closed') return;
      open.go(s === 'open' ? 1 : 0, first);
      first = false;
      lid.rotation.x = -1.9 * open.v;
    },
    update: (dt) => { lid.rotation.x = -1.9 * open.step(dt); },
  });
}

// ================================================================ spring

/** A small spring pool, about 2.2 m across, reeds on one side. */
function spring(seed: number): Model {
  // phase 2: the spring walled into a cistern with a pipe pouring into it (scene-minaa-water-holders.png)
  const c = cistern(seed);
  const root = c.root;
  root.name = 'prop-spring';
  const pick0 = meshesOf(root).filter((m) => !c.ripples.includes(m as THREE.Mesh) && m !== c.stream);
  return makeModel(root, 0.8, {
    owned: [c.streamMat, ...c.ripMats],
    pickables: pick0,
    update: (_dt, t) => {
      c.streamMat.uniforms.uT.value = t;
      c.ripples.forEach((rp, i) => {
        const k = ((t + i * 0.6) % 1.2) / 1.2;
        rp.scale.setScalar(1 + k * 4);
        c.ripMats[i].opacity = 0.45 * (1 - k);
      });
    },
  });
}

// ================================================================ lamp

/** A Mi'naa lamp on a pole, lantern hanging off an arm to +X. States: 'lit' | 'out'. */
function lamp(seed: number): Model {
  const r = makeRng(seed);
  const root = new THREE.Group();
  root.name = 'prop-lamp';
  const kit = new Kit();
  const wood = 0x6f5236;
  const H = 2.3;
  kit.add(paint(xf(new THREE.CylinderGeometry(0.04, 0.055, H, 6, 1), 0, H / 2, 0), wood, { seed, vary: 0.12, ao: 0.4, aoHeight: 0.5 }), matte());
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + r();
    kit.add(paint(xf(lump(r, 0.22, 0), Math.cos(a) * 0.12, 0.05, Math.sin(a) * 0.12, 0, 0, 0, 1, 0.7, 1), 0x8a7a66, { seed, vary: 0.1 }), matte());
  }
  kit.add(paint(xf(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 5, 1), 0.24, H - 0.08, 0, 0, 0, Math.PI / 2 - 0.12), PALETTE.minerMetal, { seed, ao: 0 }), metal());
  kit.add(paint(box(0.08, 0.3, 0.02, 0.03, H - 0.25, 0.05, 0, 0, 0.1), pick(r, [PALETTE.rust, 0x5f8a82]), { seed, ao: 0 }), matte2());
  root.add(kit.build('pole'));
  // Lantern: hangs from the arm end and sways.
  const lanternPivot = new THREE.Group();
  lanternPivot.position.set(0.48, H - 0.05, 0);
  root.add(lanternPivot);
  const lk = new Kit();
  lk.add(paint(xf(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 3, 1), 0, -0.09, 0), 0x2a2420, { seed, ao: 0 }), metal());
  lk.add(paint(xf(new THREE.ConeGeometry(0.12, 0.1, 6, 1), 0, -0.22, 0), PALETTE.minerMetal, { seed, ao: 0, stain: PALETTE.rust, stainAmount: 0.5 }), metal());
  lk.add(paint(xf(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 6, 1), 0, -0.47, 0), PALETTE.minerMetal, { seed, ao: 0 }), metal());
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    lk.add(paint(xf(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 3, 1), Math.cos(a) * 0.085, -0.36, Math.sin(a) * 0.085), 0x2a2420, { seed, ao: 0 }), metal());
  }
  const flameMat = makeGlow(0xffb35a, 1.5);
  lk.add(xf(new THREE.CylinderGeometry(0.05, 0.065, 0.17, 6, 1), 0, -0.36, 0), flameMat);
  lanternPivot.add(lk.build('lantern'));
  const light = pointLight(0xffa860, 1.4, 6, 0, -0.36, 0);
  lanternPivot.add(light);
  let lit = true;
  const level = new Tween(1, 0.3);
  const ph = r() * 10;
  return makeModel(root, 2.4, {
    owned: [flameMat],
    setState: (s: string) => {
      if (s !== 'lit' && s !== 'out') return;
      lit = s === 'lit';
      level.go(lit ? 1 : 0);
    },
    update: (dt, t) => {
      const v = level.step(dt);
      const fl = 0.84 + 0.1 * noise3(t * 5 + ph, 0, 0, seed) + 0.06 * noise3(t * 13 + ph, 1, 0, seed);
      flameMat.emissiveIntensity = 0.05 + 1.5 * v * fl;
      light.intensity = 1.4 * v * fl;
      lanternPivot.rotation.z = 0.04 * Math.sin(t * 0.9 + ph);
      lanternPivot.rotation.x = 0.03 * Math.sin(t * 0.7 + ph * 2);
    },
  });
}

// ================================================================ tent

/** A patched Mi'naa canvas tent. Ridge along X (2.4 m), 2.1 m wide, 1.6 m tall, open end at +X. */
function tent(seed: number): Model {
  const r = makeRng(seed);
  const kit = new Kit();
  const L = 2.4, Wd = 2.1, H = 1.5;
  const NU = 8, NV = 8;
  const at = (i: number, j: number) => {
    const u = i / NU, v = (j / NV) * 2 - 1;
    const sag = 0.1 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.abs(v));
    const wr = 0.018 * Math.sin(u * 23 + j * 1.7) * Math.sin(Math.PI * Math.abs(v));
    return V((u - 0.5) * L, Math.max(0, H * Math.pow(1 - Math.abs(v), 1.1) - sag + wr), (v * Wd) / 2);
  };
  const pos: number[] = [];
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
  }
  // Closed back end (-X), a little bowed in.
  const back = [V(-L / 2, 0, -Wd / 2), V(-L / 2 + 0.08, H * 0.5, 0), V(-L / 2, 0, Wd / 2), V(-L / 2, H, 0)];
  pos.push(back[0].x, back[0].y, back[0].z, back[1].x, back[1].y, back[1].z, back[3].x, back[3].y, back[3].z);
  pos.push(back[1].x, back[1].y, back[1].z, back[2].x, back[2].y, back[2].z, back[3].x, back[3].y, back[3].z);
  pos.push(back[0].x, back[0].y, back[0].z, back[2].x, back[2].y, back[2].z, back[1].x, back[1].y, back[1].z);
  let cloth: THREE.BufferGeometry = new THREE.BufferGeometry();
  cloth.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const canvas = new THREE.Color(0x9a7b58), patches = [0x8a5a3c, 0x6f8a80, 0xb49a72, 0x7a6a4a].map((h) => new THREE.Color(h));
  const cells = new Map<string, number>();
  cloth = paintFn(cloth, (x, y, z, out) => {
    const key = `${Math.floor((x + L / 2) / 0.5)}:${Math.floor((z + Wd / 2) / 0.55)}`;
    let p = cells.get(key);
    if (p === undefined) { p = r() < 0.28 ? ri(r, 0, patches.length - 1) : -1; cells.set(key, p); }
    out.copy(p >= 0 ? patches[p] : canvas);
    out.multiplyScalar((0.9 + 0.1 * noise3(x * 4, y * 4, z * 4, seed)) * (0.7 + 0.3 * smooth(0, H, y)));
  });
  kit.add(cloth, matte2());
  const wood = 0x6f5236;
  const wp = (g: THREE.BufferGeometry) => kit.add(paint(g, wood, { seed, vary: 0.1, ao: 0 }), matte());
  for (const x of [-L / 2 - 0.02, L / 2 + 0.02]) wp(xf(new THREE.CylinderGeometry(0.03, 0.035, H + 0.2, 5, 1), x, (H + 0.2) / 2, 0));
  wp(xf(new THREE.CylinderGeometry(0.025, 0.025, L + 0.1, 5, 1), 0, H + 0.02, 0, 0, 0, Math.PI / 2));
  // Guy ropes and pegs.
  for (const sx of [-1, 1]) {
    const top = V(sx * (L / 2 + 0.02), H + 0.15, 0), peg = V(sx * (L / 2 + 0.6), 0, 0);
    const len = top.distanceTo(peg);
    const rope = new THREE.CylinderGeometry(0.008, 0.008, len, 3, 1);
    rope.applyMatrix4(new THREE.Matrix4().compose(top.clone().add(peg).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, top.clone().sub(peg).normalize()), V(1, 1, 1)));
    kit.add(paint(rope, 0xb8a27c, { seed, ao: 0 }), matte());
    wp(xf(new THREE.CylinderGeometry(0.02, 0.01, 0.2, 4, 1), peg.x, 0.05, 0));
  }
  // Rolled flaps at the open end, stones on the skirt, a bedroll inside.
  // Door flaps pulled back and pinned against the sides at the open end.
  for (const sz of [-1, 1]) {
    const p0 = V(L / 2, H, 0), p1 = V(L / 2, 0, sz * Wd / 2), p2 = V(L / 2 - 0.55, 0.05, sz * (Wd / 2 - 0.08));
    const out = V(0, 0.35, sz).normalize().multiplyScalar(0.03);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute([p0, p1, p2].flatMap((p) => [p.x + out.x, p.y + out.y, p.z + out.z]), 3));
    kit.add(paint(fg, 0x8a6a4a, { seed, vary: 0.1, ao: 0.2, aoHeight: 0.6 }), matte2());
  }
  kit.add(paint(box(L - 0.2, 0.01, Wd - 0.5, 0, 0.012, 0), 0x3a2e24, { seed, vary: 0.1, ao: 0 }), matte());
  for (let i = 0; i < 6; i++) {
    const x = lerp(-L / 2 + 0.2, L / 2 - 0.2, i / 5), sz = i % 2 ? 1 : -1;
    kit.add(paint(xf(lump(r, 0.18, 0), x, 0.03, sz * (Wd / 2 + 0.05), 0, r() * 3, 0, 1, 0.6, 1), 0x8a7a66, { seed: seed + i }), matte());
  }
  kit.add(paint(xf(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 7, 1), 0.2, 0.13, 0.25, Math.PI / 2, 0.2, 0), pick(r, [0x6f8a80, PALETTE.rust]), { seed, vary: 0.1, ao: 0.2 }), matte());
  const root = kit.build('prop-tent');
  return makeModel(root, 1.7);
}

// ================================================================ sign

/** A salvage signboard of mismatched plates on two posts. Scratched marks, no real text. Faces +Z. */
function sign(seed: number): Model {
  const r = makeRng(seed);
  const kit = new Kit();
  const wood = 0x6f5236;
  for (const sx of [-1, 1]) kit.add(paint(box(0.08, 1.75, 0.08, sx * 0.48, 0.85, 0, 0, rr(r, -0.2, 0.2), rr(r, -0.03, 0.03)), wood, { seed, vary: 0.1, ao: 0.4, aoHeight: 0.5 }), matte());
  const plates = [
    [-0.25, 1.42, 0.55, 0.36], [0.24, 1.44, 0.5, 0.4], [0.0, 1.12, 1.08, 0.34],
  ];
  plates.forEach(([x, y, w, h], i) => {
    const g = box(w, h, 0.03, x, y, 0.06 + i * 0.008, 0, 0, rr(r, -0.06, 0.06));
    kit.add(paint(g, pick(r, [PALETTE.rust, 0x6d665c, 0x5f8a82, 0x8c7a5a]), { seed: seed + i, vary: 0.12, freq: 4, ao: 0, stain: PALETTE.rustDark, stainAmount: 0.5 }), metal());
    for (const [bx, by] of [[-w / 2 + 0.04, h / 2 - 0.04], [w / 2 - 0.04, -h / 2 + 0.04]]) kit.add(paint(box(0.025, 0.025, 0.02, x + bx, y + by, 0.08 + i * 0.008), 0x3a3430, { seed, ao: 0 }), metal());
  });
  // Scratched marks in little clusters, like tallies and signs.
  const scratch = 0xd9c9a8;
  for (let c = 0; c < 3; c++) {
    const cx = lerp(-0.34, 0.34, c / 2) + rr(r, -0.05, 0.05), cy = c === 1 ? 1.1 : 1.43;
    const ns = ri(r, 3, 5);
    for (let k = 0; k < ns; k++) {
      const len = rr(r, 0.08, 0.2), ang = pick(r, [0, Math.PI / 2, 0.6, -0.6, Math.PI / 2 + rr(r, -0.2, 0.2)]);
      kit.add(paint(box(len, 0.014, 0.01, cx + rr(r, -0.08, 0.08), cy + rr(r, -0.08, 0.08), 0.1, 0, 0, ang), scratch, { seed, ao: 0, vary: 0.1 }), matte());
    }
  }
  kit.add(paint(box(0.06, 0.28, 0.02, 0.5, 1.55, 0.06, 0, 0, 0.15), PALETTE.rust, { seed, ao: 0 }), matte2());
  const root = kit.build('prop-sign');
  return makeModel(root, 1.8);
}

// ================================================================ lever (crystal socket)

/** An Aza'los crystal socket on a pedestal. States: 'off' (dim) | 'on' (teal glow). */
function lever(seed: number): Model {
  const r = makeRng(seed);
  const root = new THREE.Group();
  root.name = 'prop-lever';
  const kit = new Kit();
  const ped = lathe([[0.4, -0.03], [0.32, 0.07], [0.18, 0.28], [0.12, 0.6], [0.15, 0.84], [0.25, 0.97], [0.23, 1.04], [0.13, 1.0], [0, 0.97]], 12, (a, _c, _j, rad, y) => [rad * (1 + 0.07 * Math.sin(a * 3 + y * 4)), y]);
  displace(ped, 0.015, 3, seed);
  kit.add(paint(ped, PALETTE.stone, { vary: 0.07, seed, ao: 0.45, aoHeight: 0.6, dust: PALETTE.sand, dustHeight: 0.3, stain: 0xb7a17f, stainAmount: 0.4 }), matte());
  root.add(kit.build('pedestal'));
  const seamMat = makeGlow(PALETTE.teal, 0.15);
  const sk = new Kit();
  for (let s = 0; s < 2; s++) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 7; i++) {
      const y = lerp(0.08, 0.92, i / 7), a = s * Math.PI + i * 0.45;
      const rad = y < 0.6 ? lerp(0.3, 0.125, smooth(0.05, 0.6, y)) : lerp(0.125, 0.24, (y - 0.6) / 0.35);
      pts.push(V(Math.sin(a) * (rad + 0.012), y, Math.cos(a) * (rad + 0.012)));
    }
    sk.add(seam(pts, 0.018, 20), seamMat);
  }
  root.add(sk.build('seams'));
  const crystalMat = makeCrystal(PALETTE.teal, 0.25);
  const ck = new Kit();
  const shard = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 6, 1);
  const t1 = xf(new THREE.ConeGeometry(0.06, 0.1, 6, 1), 0, 0.15, 0);
  const t2 = xf(new THREE.ConeGeometry(0.06, 0.08, 6, 1), 0, -0.14, 0, Math.PI, 0, 0);
  [shard, t1, t2].forEach((g) => ck.add(g, crystalMat));
  const cr = ck.build('socket-crystal');
  cr.position.set(0, 1.12, 0);
  root.add(cr);
  const light = pointLight(PALETTE.teal, 0, 4, 0, 1.3, 0);
  root.add(light);
  const level = new Tween(0, 0.5);
  let on = false;
  const ph = r() * 6;
  return makeModel(root, 1.3, {
    owned: [seamMat, crystalMat],
    setState: (s: string) => {
      if (s !== 'on' && s !== 'off') return;
      on = s === 'on';
      level.go(on ? 1 : 0);
    },
    update: (dt, t) => {
      const v = level.step(dt);
      const p = 0.85 + 0.15 * Math.sin(t * 2 + ph);
      crystalMat.emissiveIntensity = 0.25 + v * 2.2 * p;
      seamMat.emissiveIntensity = 0.15 + v * 1.7 * p;
      light.intensity = v * 1.5 * p;
      cr.rotation.y += dt * (0.1 + v * 0.5);
      cr.position.y = 1.12 + v * (0.04 + 0.02 * Math.sin(t * 1.5 + ph));
    },
  });
}

// ================================================================ the defender's niche

/**
 * An alcove in the ruin wall where a defensive-line Iskari sleeps at its post (canon: most
 * defensive-line Iskari are dormant in deep ruins, frozen mid-stride). Opens towards -Z.
 * Inside: an apse 1.7 m wide, 2.9 m tall, 0.9 m deep, so the defender stands on the tile centre.
 * States: 'dark' (seam barely alive), 'lit' (the activation code arrives: the seam blazes and
 * pulses), 'empty' (the figure has gone; the seam settles to a low glow).
 */
function niche(seed: number): Model {
  const r = makeRng(seed);
  const root = new THREE.Group();
  const kit = new Kit();
  const stone = 0xcfc4ae, shade = 0x9c907c;
  const W = 0.85, SPRING = 2.05, FACE = -0.35, DEPTH = 0.55;
  // the face: a slab with rounded sides and a domed top, the arch cut through it
  const outer = new THREE.Shape();
  outer.moveTo(-1.85, -0.1);
  outer.bezierCurveTo(-2.0, 1.4, -1.9, 3.0, -1.35, 3.85);
  outer.quadraticCurveTo(0, 4.7, 1.35, 3.85);
  outer.bezierCurveTo(1.9, 3.0, 2.0, 1.4, 1.85, -0.1);
  outer.lineTo(-1.85, -0.1);
  const hole = new THREE.Path();
  hole.moveTo(-W, -0.1);
  hole.lineTo(-W, SPRING);
  hole.absarc(0, SPRING, W, Math.PI, 0, true);
  hole.lineTo(W, -0.1);
  hole.lineTo(-W, -0.1);
  outer.holes.push(hole);
  const face = new THREE.ExtrudeGeometry(outer, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, curveSegments: 20 });
  face.translate(0, 0, FACE - DEPTH / 2 + 0.15);
  displace(face, 0.03, 1.6, seed);
  kit.add(paintFn(face, (x, y, z, out) => {
    out.setHex(stone).multiplyScalar(0.86 + 0.14 * noise3(x * 1.3, y * 1.3, z * 1.3, seed));
    const d = Math.hypot(x, Math.max(0, y - SPRING));
    if (d < W + 0.35 && y < SPRING + W + 0.35) out.multiplyScalar(0.92); // worn round the opening
    out.lerp(new THREE.Color(PALETTE.sand), (1 - smooth(0, 0.7, y)) * 0.5);
  }), matte());
  // the apse: a half cylinder with a quarter-dome, darker inside
  const prof: [number, number][] = [[W + 0.02, -0.05], [W + 0.02, SPRING]];
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; prof.push([(W + 0.02) * Math.cos(a), SPRING + (W + 0.02) * Math.sin(a)]); }
  const apse = lathe(prof, 16, undefined, -Math.PI / 2, Math.PI);
  apse.translate(0, 0, FACE + 0.1);
  kit.add(paintFn(apse, (x, y, _z, out) => out.setHex(shade).multiplyScalar(0.55 + 0.25 * smooth(0, 2.9, y) + 0.08 * noise3(x * 3, y * 3, 0, seed + 2))), matte2());
  // mass behind, so the alcove reads as dug into a thick wall from outside too
  const back = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI, 0, Math.PI / 2); // the rear quarter only
  back.scale(1.9, 3.7, 1.15).translate(0, 0, FACE + 0.2);
  displace(back, 0.08, 1.2, seed + 3);
  kit.add(paintFn(back, (x, y, z, out) => out.setHex(stone).multiplyScalar(0.84 + 0.14 * noise3(x, y, z, seed + 4)).lerp(new THREE.Color(PALETTE.sand), (1 - smooth(0, 0.8, y)) * 0.5)), matte());
  // a worn sill the figure stands just behind
  const sill = lathe([[0.01, 0], [1.05, 0], [1.1, 0.08], [1.0, 0.16], [0.01, 0.16]], 16, undefined, Math.PI / 2, Math.PI);
  sill.scale(1, 1, 0.55).translate(0, 0, FACE + 0.02);
  kit.add(paintFn(sill, (x, y, z, out) => out.setHex(stone).multiplyScalar(0.8 + 0.12 * noise3(x * 3, y * 3, z * 3, seed + 5))), matte());
  // rubble at the foot
  for (let i = 0; i < 3; i++) {
    const g = lump(r, rr(r, 0.2, 0.4), 1);
    xf(g, rr(r, -1.7, 1.7) * (i === 1 ? 1 : 1), 0.06, FACE - rr(r, 0.4, 0.9), 0, r() * 6, 0, 1, 0.6, 1);
    kit.add(paint(g, stone, { vary: 0.1, seed: seed + i, ao: 0.3, dust: PALETTE.sand }), matte());
  }
  root.add(kit.build('niche'));
  // the seam that frames the arch, on the face; it is what lights when the code arrives
  const seamM = makeGlow(PALETTE.teal, 0.12);
  seamM.userData.glow = true;
  const pts: THREE.Vector3[] = [V(-W - 0.2, 0.1, FACE - 0.22)];
  for (let i = 0; i <= 16; i++) { const a = Math.PI - (i / 16) * Math.PI; pts.push(V(Math.cos(a) * (W + 0.2), SPRING + Math.sin(a) * (W + 0.2) + (i === 0 || i === 16 ? -0.2 : 0), FACE - 0.22)); }
  pts.push(V(W + 0.2, 0.1, FACE - 0.22));
  const sk = new Kit();
  sk.add(sweep(pts, { segments: 60, radial: 5, radius: () => 0.045 }), seamM);
  // a second, finer line inside the apse, the one that wakes the figure
  const inner: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI; inner.push(V(Math.cos(a) * 0.7, SPRING + 0.45 + Math.sin(a) * 0.3, FACE + 0.1 + Math.sin(a) * 0.7)); }
  sk.add(sweep(inner, { segments: 24, radial: 4, radius: () => 0.025 }), seamM);
  const seams = sk.build('niche-seam', false);
  root.add(seams);
  const level = new Tween(0.12, 0.8);
  let mode = 'dark';
  return makeModel(root, 3.2, {
    owned: [seamM],
    setState: (s: string) => {
      if (s !== 'dark' && s !== 'lit' && s !== 'empty') return;
      mode = s;
      level.go(s === 'lit' ? 2.6 : s === 'empty' ? 0.4 : 0.12, s === 'dark');
    },
    update: (dt, t) => {
      const v = level.step(dt);
      const pulse = mode === 'lit' ? 0.75 + 0.25 * Math.sin(t * 6) + 0.1 * Math.sin(t * 17) : 1;
      seamM.emissiveIntensity = v * pulse;
    },
  });
}

/**
 * A standing stone in the ruin, carved with the Keeper mark (LORE-INVENTIONS: three nested
 * rings, one broken). Pale Aza'los stone, rounded top, flared foot. Face towards +Z.
 */
function stele(seed: number): Model {
  const r = makeRng(seed);
  const kit = new Kit();
  const stone = PALETTE.stone;
  const outline = new THREE.Shape();
  outline.moveTo(-0.62, -0.05);
  outline.bezierCurveTo(-0.5, 0.35, -0.42, 0.9, -0.44, 1.35);
  outline.quadraticCurveTo(-0.36, 1.9, 0.02, 1.98);
  outline.quadraticCurveTo(0.4, 1.9, 0.45, 1.3);
  outline.bezierCurveTo(0.44, 0.9, 0.52, 0.35, 0.64, -0.05);
  outline.lineTo(-0.62, -0.05);
  const slab = new THREE.ExtrudeGeometry(outline, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 16 });
  slab.translate(0, 0, -0.13);
  displace(slab, 0.025, 2.2, seed);
  kit.add(paintFn(slab, (x, y, z, out) => {
    out.setHex(stone).multiplyScalar(0.84 + 0.12 * noise3(x * 3, y * 3, z * 3, seed) + 0.06 * smooth(0, 2, y));
    out.lerp(new THREE.Color(PALETTE.sand), (1 - smooth(0, 0.5, y)) * 0.5);
  }), matte());
  // the mark: three rings carved into the face, the middle one broken; faint teal in the deepest groove
  const cx = 0, cy = 1.15, fz = 0.2;
  const ring = (rad: number, a0: number, a1: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 28; i++) { const a = lerp(a0, a1, i / 28); pts.push(V(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, fz)); }
    return ribbon(pts, 0.035, 40, V(0, 0, 1), false);
  };
  const groove = 0x6e6454;
  kit.add(paint(ring(0.34, 0, Math.PI * 2), groove, { seed, ao: 0, vary: 0.08 }), matte());
  const gap = rr(r, 0.6, 1.2);
  kit.add(paint(ring(0.23, gap + 0.5, gap + Math.PI * 2), groove, { seed, ao: 0, vary: 0.08 }), matte());
  kit.add(ring(0.12, 0, Math.PI * 2), glow(PALETTE.teal, 0.7));
  // chips knocked off the edge in the war
  for (let i = 0; i < 3; i++) kit.add(paint(xf(lump(r, rr(r, 0.1, 0.18), 0), rr(r, -0.7, 0.7), 0.03, rr(r, 0.2, 0.5), r(), r(), 0, 1, 0.6, 1), stone, { seed: seed + i, vary: 0.1, ao: 0.2 }), matte());
  return makeModel(kit.build('prop-stele'), 2.0);
}

// ================================================================ entry

export function buildProp(kind: EntityKind, opts: ModelOpts = {}): Model {
  const seed = opts.seed ?? 1;
  let m: Model;
  switch (kind) {
    case 'prop-metal-pile': m = metalPile(seed); break;
    case 'prop-crystal': m = crystal(opts, seed); break;
    case 'prop-symbol-door': m = symbolDoor(seed); break;
    case 'prop-archive': m = archive(seed); break;
    case 'prop-chest': m = chest(seed); break;
    case 'prop-spring': m = spring(seed); break;
    case 'prop-barrel-gourd': m = makeModel(barrelGourd(seed), 0.9); break;
    case 'prop-lamp': m = lamp(seed); break;
    case 'prop-tent': m = tent(seed); break;
    case 'prop-sign': m = opts.look === 'stele' ? stele(seed) : sign(seed); break;
    case 'prop-lever': m = lever(seed); break;
    case 'prop-niche': m = niche(seed); break;
    default: {
      console.warn(`[props] no prop builder for ${kind}`);
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xff00ff }));
      g.position.y = 0.2;
      const root = new THREE.Group();
      root.add(g);
      m = makeModel(root, 0.4);
    }
  }
  if (opts.name) m.root.name = opts.name;
  return m;
}
