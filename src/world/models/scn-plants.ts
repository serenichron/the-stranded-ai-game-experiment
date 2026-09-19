// Plants of the desert and the oases. Low-poly, painted with vertex colours.
// Names and roles follow docs/flora-and-fauna.md.
import * as THREE from 'three';
import { Kit, makeRng, rr, ri, lerp, smooth, noise3, snoise3, xf, displace, paint, paintFn, sweep, lump, matte, matte2, glassy, glow, type Rng } from './scn-kit';

export type PlantType = 'spire-root' | 'field-moss' | 'glass-thistle' | 'glow-bloom' | 'twist-weed' | 'reed-cane' | 'sun-date' | 'dust-aloe' | 'digger-tuber';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/** Soft mint glow of the glow-bloom. */
export const GLOW_BLOOM_HEX = 0xa8f0c0;

function orientTo(g: THREE.BufferGeometry, from: THREE.Vector3, to: THREE.Vector3): THREE.BufferGeometry {
  const len = from.distanceTo(to);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, to.clone().sub(from).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(from, q, V(1, 1, 1)));
  return g;
}
/** A thin tapered spike from `from` to `to`. */
function spike(from: THREE.Vector3, to: THREE.Vector3, rad: number, seg = 3): THREE.BufferGeometry {
  return orientTo(new THREE.ConeGeometry(rad, from.distanceTo(to), seg, 1), from, to);
}
function stick(from: THREE.Vector3, to: THREE.Vector3, rad: number, seg = 4): THREE.BufferGeometry {
  return orientTo(new THREE.CylinderGeometry(rad * 0.8, rad, from.distanceTo(to), seg, 1), from, to);
}
const dir = (a: number, tilt: number) => V(Math.sin(a) * Math.sin(tilt), Math.cos(tilt), Math.cos(a) * Math.sin(tilt));

function spireRoot(kit: Kit, r: Rng, seed: number) {
  // The lone landmark: a spire-root standing over buried crystal (canon; prospectors read it).
  // A thick twisted trunk on buttress roots, gnarled limbs spreading like an umbrella, sparse
  // dusty crowns. Its roots are bleached pale where they drink the field. No crystal shows.
  const H = rr(r, 6.2, 7.2), ph = r() * 6;
  const bark = 0x6a5646, pale = 0xb8a88c;
  const trunkPts: THREE.Vector3[] = [];
  for (let k = 0; k <= 8; k++) {
    const f = k / 8;
    trunkPts.push(V(0.35 * Math.sin(f * 2.6 + ph) * f, -0.3 + (H * 0.62) * f, 0.3 * Math.cos(f * 2.1 + ph) * f));
  }
  const trunk = sweep(trunkPts, { segments: 24, radial: 10, twist: 2.2, radius: (t, a) => lerp(0.62, 0.28, Math.pow(t, 0.7)) * (1 + 0.5 * Math.exp(-t * 9)) * (1 + 0.14 * Math.sin(a * 3 + t * 7) + 0.06 * Math.sin(a * 7)) });
  const paintBark = (g: THREE.BufferGeometry, s: number) => paintFn(g, (x, y, z, out) => {
    out.setHex(bark).multiplyScalar(0.8 + 0.3 * noise3(x * 5, y * 1.2, z * 5, s));
    out.lerp(new THREE.Color(pale), (1 - smooth(-0.2, 0.9, y)) * 0.55);
  });
  kit.add(paintBark(trunk, seed), matte());
  // buttress roots, bleached pale, gripping out across the sand
  const nr = ri(r, 5, 7);
  for (let i = 0; i < nr; i++) {
    const a = (i / nr) * Math.PI * 2 + rr(r, -0.3, 0.3), d = rr(r, 1.6, 2.8);
    const rp = [V(Math.sin(a) * 0.3, 0.9, Math.cos(a) * 0.3), V(Math.sin(a) * d * 0.35, 0.28, Math.cos(a) * d * 0.35), V(Math.sin(a + 0.2) * d * 0.7, 0.02, Math.cos(a + 0.2) * d * 0.7), V(Math.sin(a + 0.35) * d, -0.12, Math.cos(a + 0.35) * d)];
    kit.add(paintBark(sweep(rp, { segments: 12, radial: 5, radius: (t) => lerp(0.26, 0.03, t) }), seed + i), matte());
  }
  // limbs: three to five, each forking once, reaching out and up
  const crown = new THREE.CatmullRomCurve3(trunkPts, false, 'centripetal');
  const tips: THREE.Vector3[] = [];
  const nl = ri(r, 3, 5);
  for (let i = 0; i < nl; i++) {
    const t = rr(r, 0.72, 1), b0 = crown.getPointAt(t), a = (i / nl) * Math.PI * 2 + rr(r, -0.4, 0.4) + ph, len = rr(r, 2.0, 3.1);
    const b1 = b0.clone().add(V(Math.sin(a) * len * 0.45, len * 0.35, Math.cos(a) * len * 0.45));
    const b2 = b0.clone().add(V(Math.sin(a + 0.25) * len, len * 0.5, Math.cos(a + 0.25) * len));
    kit.add(paintBark(sweep([b0, b1, b2], { segments: 10, radial: 6, radius: (u) => lerp(0.2, 0.05, u) * (1 + 0.1 * Math.sin(u * 17)) }), seed + 10 + i), matte());
    tips.push(b2);
    const f0 = b1.clone(), fa = a + (r() < 0.5 ? 0.9 : -0.9), fl = len * rr(r, 0.4, 0.6);
    const f2 = f0.clone().add(V(Math.sin(fa) * fl, fl * 0.45, Math.cos(fa) * fl));
    kit.add(paintBark(sweep([f0, f0.clone().lerp(f2, 0.5).add(V(0, 0.15, 0)), f2], { segments: 8, radial: 5, radius: (u) => lerp(0.1, 0.03, u) }), seed + 20 + i), matte());
    tips.push(f2);
  }
  // sparse flat crowns of dusty grey-green, darker underneath
  const leaf = new THREE.Color(0x8a8a5c), under = new THREE.Color(0x565840), dust = new THREE.Color(0xb4a47a);
  tips.forEach((tp, i) => {
    const s = rr(r, 0.55, 0.9);
    const g = new THREE.IcosahedronGeometry(s, 1);
    displace(g, s * 0.3, 1.4 / s, seed + 40 + i);
    g.scale(1.25, 0.42, 1.1).rotateY(r() * 6).translate(tp.x, tp.y + 0.15, tp.z);
    kit.add(paintFn(g, (x, y, z, out) => {
      out.copy(under).lerp(leaf, smooth(tp.y - 0.2, tp.y + 0.35, y)).lerp(dust, smooth(0.55, 0.85, noise3(x * 2, y * 2, z * 2, seed + i)) * 0.4);
    }), matte());
  });
}

function fieldMoss(kit: Kit, r: Rng, seed: number) {
  const n = ri(r, 3, 6);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = rr(r, 0, 0.45), s = rr(r, 0.35, 0.8);
    const g = new THREE.IcosahedronGeometry(0.5, 0);
    displace(g, 0.12, 3, seed + i);
    xf(g, Math.cos(a) * d, -0.02, Math.sin(a) * d, 0, r() * 6, 0, s, rr(r, 0.12, 0.2), s * rr(r, 0.7, 1));
    kit.add(paint(g, 0x7f7d4a, { seed: seed + i, vary: 0.18, freq: 4, ao: 0.2, aoHeight: 0.1, stain: 0x9a8a50, stainAmount: 0.6 }), matte());
  }
}

function glassThistle(kit: Kit, r: Rng, seed: number) {
  const n = ri(r, 5, 8);
  kit.add(paint(xf(lump(r, 0.35, 0), 0, 0, 0, 0, 0, 0, 1, 0.3, 1), 0x6c6a58, { seed, vary: 0.1, ao: 0.2 }), matte());
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, tilt = rr(r, 0.05, 0.45), len = rr(r, 0.45, 0.9);
    const base = V(Math.sin(a) * 0.05, 0, Math.cos(a) * 0.05);
    const tip = base.clone().addScaledVector(dir(a, tilt), len);
    // brittle bone-grey stems, glassy only at the tips (they read as loose crystals when they all glowed)
    kit.add(paint(stick(base, tip, 0.022, 4), 0x9a9282, { seed, vary: 0.1, ao: 0.3, aoHeight: 0.3 }), matte());
    const head = xf(new THREE.OctahedronGeometry(rr(r, 0.03, 0.05), 0), tip.x, tip.y, tip.z, r(), r(), r(), 1, 1.5, 1);
    kit.add(head, glassy());
    for (let k = 0; k < 2; k++) {
      const sa = r() * Math.PI * 2;
      kit.add(paint(spike(tip, tip.clone().addScaledVector(dir(sa, rr(r, 0.4, 1.2)), rr(r, 0.1, 0.18)), 0.012), 0xb0a894, { seed, ao: 0 }), matte());
    }
  }
}

function glowBloom(kit: Kit, r: Rng, seed: number) {
  const nl = ri(r, 4, 6);
  for (let i = 0; i < nl; i++) {
    const a = (i / nl) * Math.PI * 2 + r() * 0.5;
    const leaf = new THREE.ConeGeometry(0.06, rr(r, 0.25, 0.35), 4, 1);
    leaf.scale(1, 1, 0.35);
    leaf.translate(0, 0.15, 0);
    xf(leaf, 0, 0.02, 0, 0, a, 0);
    leaf.applyMatrix4(new THREE.Matrix4().makeRotationAxis(V(Math.cos(a), 0, -Math.sin(a)), rr(r, 1.0, 1.3)));
    kit.add(paint(leaf, 0x5f6e48, { seed, vary: 0.15, ao: 0.3, aoHeight: 0.2 }), matte());
  }
  const ns = ri(r, 3, 4);
  for (let i = 0; i < ns; i++) {
    const a = r() * Math.PI * 2, len = rr(r, 0.28, 0.5);
    const tip = dir(a, rr(r, 0.1, 0.4)).multiplyScalar(len);
    kit.add(paint(stick(V(0, 0, 0), tip, 0.012, 3), 0x6f7a50, { seed, ao: 0 }), matte());
    kit.add(xf(new THREE.IcosahedronGeometry(rr(r, 0.045, 0.065), 0), tip.x, tip.y + 0.02, tip.z, r(), r(), 0, 1, 1.3, 1), glow(GLOW_BLOOM_HEX, 1.1));
  }
}

function twistWeed(kit: Kit, r: Rng, seed: number) {
  const n = ri(r, 4, 6);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, h = rr(r, 0.35, 0.8);
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 5; k++) {
      const f = k / 5, w = 0.12 * f;
      pts.push(V(Math.sin(a) * 0.25 * f + Math.sin(k * 2.3 + i) * w, h * f + (k === 5 ? -0.08 : 0), Math.cos(a) * 0.25 * f + Math.cos(k * 1.9 + i) * w));
    }
    const g = sweep(pts, { segments: 8, radial: 3, radius: (t) => lerp(0.03, 0.007, t) * (1 + 0.5 * Math.abs(Math.sin(t * 12))) });
    kit.add(paint(g, 0x7a7470, { seed: seed + i, vary: 0.15, ao: 0.3, aoHeight: 0.3, stain: 0x6a5a66, stainAmount: 0.7 }), matte());
  }
  for (let i = 0; i < 2; i++) {
    const a = r() * Math.PI * 2;
    kit.add(paint(xf(lump(r, 0.14, 0), Math.cos(a) * 0.15, 0.03, Math.sin(a) * 0.15, 0, 0, 0, 1, 0.4, 1), 0x6a6260, { seed, vary: 0.1 }), matte());
  }
}

function reedCane(kit: Kit, r: Rng, seed: number) {
  const n = ri(r, 10, 15);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = rr(r, 0, 0.3), len = rr(r, 1.3, 2.2);
    const base = V(Math.cos(a) * d, -0.05, Math.sin(a) * d);
    const tip = base.clone().addScaledVector(dir(a + rr(r, -0.5, 0.5), rr(r, 0.02, 0.25)), len);
    const mid = base.clone().lerp(tip, 0.55).add(V(rr(r, -0.06, 0.06), 0, rr(r, -0.06, 0.06)));
    const col = new THREE.Color(0x8a8a4c).lerp(new THREE.Color(0xb0a066), r() * 0.6);
    kit.add(paint(stick(base, mid, 0.022, 3), col.getHex(), { seed, vary: 0.08, ao: 0.35, aoHeight: 0.6 }), matte());
    kit.add(paint(spike(mid, tip, 0.017, 3), col.getHex(), { seed, vary: 0.08, ao: 0 }), matte());
    if (r() < 0.35) kit.add(paint(xf(new THREE.OctahedronGeometry(0.035, 0), tip.x, tip.y - 0.12, tip.z, 0, 0, 0, 1, 3, 1), 0x7a5634, { seed, ao: 0 }), matte());
  }
  kit.add(paint(xf(lump(r, 0.6, 0), 0, 0, 0, 0, 0, 0, 1, 0.25, 1), 0x5a5a38, { seed, vary: 0.1, ao: 0.2 }), matte());
}

function sunDate(kit: Kit, r: Rng, seed: number) {
  const H = rr(r, 3.1, 3.7), lean = rr(r, 0.2, 0.6), la = r() * Math.PI * 2;
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 4; k++) {
    const f = k / 4;
    pts.push(V(Math.cos(la) * lean * f * f, -0.1 + (H + 0.1) * f, Math.sin(la) * lean * f * f));
  }
  const trunk = sweep(pts, { segments: 14, radial: 6, radius: (t) => lerp(0.17, 0.11, t) * (1 + 0.14 * Math.abs(Math.sin(t * 40))) });
  kit.add(paint(trunk, 0x7a5e42, { seed, vary: 0.1, freq: 4, ao: 0.4, aoHeight: 0.8, stain: 0x9a7a52, stainAmount: 0.4 }), matte());
  const crown = pts[4].clone();
  // Fronds: folded strips drooping out from the crown.
  const nf = ri(r, 7, 9);
  const pos: number[] = [];
  for (let i = 0; i < nf; i++) {
    const a = (i / nf) * Math.PI * 2 + r() * 0.4, len = rr(r, 1.3, 1.8), rise = rr(r, 0.2, 0.55);
    const out = V(Math.sin(a), 0, Math.cos(a)), side = V(Math.cos(a), 0, -Math.sin(a));
    const rows: THREE.Vector3[][] = [];
    for (let k = 0; k <= 6; k++) {
      const f = k / 6;
      const c = crown.clone().addScaledVector(out, len * f).add(V(0, rise * Math.sin(f * Math.PI * 0.8) - 0.9 * f * f * len * 0.5, 0));
      const w = 0.24 * Math.sin(Math.PI * Math.min(1, f * 1.1 + 0.05)) * (k % 2 ? 1 : 0.75);
      rows.push([c.clone().addScaledVector(side, -w).add(V(0, -0.05, 0)), c.clone().add(V(0, 0.03, 0)), c.clone().addScaledVector(side, w).add(V(0, -0.05, 0))]);
    }
    for (let k = 0; k < 6; k++) for (let s = 0; s < 2; s++) {
      const a0 = rows[k][s], b0 = rows[k][s + 1], c0 = rows[k + 1][s + 1], d0 = rows[k + 1][s];
      pos.push(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, d0.x, d0.y, d0.z, b0.x, b0.y, b0.z, c0.x, c0.y, c0.z, d0.x, d0.y, d0.z);
    }
  }
  let fr: THREE.BufferGeometry = new THREE.BufferGeometry();
  fr.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const g0 = new THREE.Color(0x5f7a3c), g1 = new THREE.Color(0xa39a52);
  fr = paintFn(fr, (x, y, z, out) => {
    const d = Math.hypot(x - crown.x, z - crown.z);
    out.copy(g0).lerp(g1, smooth(0.5, 1.6, d)).multiplyScalar(0.92 + 0.12 * snoise3(x * 5, y * 5, z * 5, seed));
  });
  kit.add(fr, matte2());
  // Date clusters under the crown.
  const nc = ri(r, 2, 3);
  for (let i = 0; i < nc; i++) {
    const a = r() * Math.PI * 2;
    const g = xf(lump(r, 0.22, 0), crown.x + Math.sin(a) * 0.18, crown.y - 0.2, crown.z + Math.cos(a) * 0.18, 0, 0, 0, 1, 1.5, 1);
    kit.add(paint(g, 0xa0562a, { seed: seed + i, vary: 0.2, freq: 8, ao: 0 }), matte());
  }
}

function dustAloe(kit: Kit, r: Rng, seed: number) {
  const n = ri(r, 7, 10);
  const c0 = new THREE.Color(0x7d9080), c1 = new THREE.Color(0x9b5a3a);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4, len = rr(r, 0.35, 0.6);
    const leaf = new THREE.ConeGeometry(0.07, len, 4, 1);
    leaf.scale(1, 1, 0.45);
    leaf.translate(0, len / 2, 0);
    leaf.rotateY(a);
    leaf.applyMatrix4(new THREE.Matrix4().makeRotationAxis(V(Math.cos(a), 0, -Math.sin(a)), rr(r, 0.35, 1.1)));
    kit.add(paintFn(leaf, (x, y, z, out) => { out.copy(c0).lerp(c1, smooth(0.25, 0.5, y) * 0.6).multiplyScalar(0.7 + 0.3 * smooth(0, 0.3, y) + 0.08 * snoise3(x * 6, y * 6, z * 6, seed)); }), matte());
  }
  if (r() < 0.5) {
    const tip = V(rr(r, -0.1, 0.1), rr(r, 0.8, 1.1), rr(r, -0.1, 0.1));
    kit.add(paint(stick(V(0, 0.1, 0), tip, 0.015, 3), 0x7a6a4a, { seed, ao: 0 }), matte());
    kit.add(paint(xf(new THREE.ConeGeometry(0.04, 0.18, 5), tip.x, tip.y + 0.06, tip.z), 0xc0703a, { seed, ao: 0 }), matte());
  }
}

function diggerTuber(kit: Kit, r: Rng, seed: number) {
  kit.add(paint(xf(lump(r, 0.35, 0), 0, 0.02, 0, 0, r() * 3, 0, 1, 0.45, 1), 0x8a6a48, { seed, vary: 0.15, ao: 0.2, aoHeight: 0.1 }), matte());
  const n = ri(r, 3, 5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5, h = rr(r, 0.18, 0.32);
    const tip = V(Math.sin(a) * 0.12, h, Math.cos(a) * 0.12);
    kit.add(paint(stick(V(0, 0.05, 0), tip, 0.012, 3), 0x6f7a48, { seed, ao: 0 }), matte());
    const leaf = new THREE.IcosahedronGeometry(1, 0);
    leaf.scale(0.08, 0.018, 0.14);
    leaf.translate(0, 0, 0.1);
    leaf.rotateX(-0.35);
    leaf.rotateY(a);
    leaf.translate(tip.x, tip.y, tip.z);
    kit.add(paint(leaf, 0x667a40, { seed: seed + i, vary: 0.15, ao: 0 }), matte());
  }
}

/** The water-hoarding barrel-gourd: squat, ribbed, spined. About 0.85 m tall. */
export function barrelGourd(seed = 1): THREE.Group {
  const r = makeRng(seed);
  const kit = new Kit();
  const prof: [number, number][] = [[0.05, -0.05], [0.3, 0.02], [0.42, 0.2], [0.44, 0.4], [0.38, 0.6], [0.22, 0.74], [0.08, 0.8], [0, 0.82]];
  const ribs = 8;
  const s = rr(r, 0.9, 1.1);
  const body = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 16);
  const p = body.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(x, z);
    const k = (1 + 0.1 * Math.cos(a * ribs)) * s;
    p.setXYZ(i, x * k, p.getY(i) * s, z * k);
  }
  kit.add(paint(body, 0x7d8a5e, { seed, vary: 0.1, freq: 3, ao: 0.4, aoHeight: 0.35, stain: 0xa08a58, stainAmount: 0.5 }), matte());
  for (let rb = 0; rb < ribs; rb++) {
    const a = (rb / ribs) * Math.PI * 2;
    for (const [rad, y] of [[0.46, 0.28], [0.42, 0.52], [0.3, 0.68]]) {
      const b = V(Math.sin(a) * rad * s * 1.08, y * s, Math.cos(a) * rad * s * 1.08);
      kit.add(paint(spike(b, b.clone().add(V(Math.sin(a) * 0.08, 0.03, Math.cos(a) * 0.08)), 0.012, 3), 0xd6c8a0, { seed, ao: 0 }), matte());
    }
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = xf(new THREE.IcosahedronGeometry(1, 0), Math.sin(a) * 0.05, 0.84 * s, Math.cos(a) * 0.05, 0, a, 0, 0.04, 0.015, 0.07);
    kit.add(paint(petal, 0xb0623a, { seed, ao: 0 }), matte());
  }
  return kit.build('barrel-gourd');
}

export function buildPlant(type: PlantType, seed = 1): THREE.Object3D {
  const r = makeRng(seed * 7 + type.length);
  const kit = new Kit();
  switch (type) {
    case 'spire-root': spireRoot(kit, r, seed); break;
    case 'field-moss': fieldMoss(kit, r, seed); break;
    case 'glass-thistle': glassThistle(kit, r, seed); break;
    case 'glow-bloom': glowBloom(kit, r, seed); break;
    case 'twist-weed': twistWeed(kit, r, seed); break;
    case 'reed-cane': reedCane(kit, r, seed); break;
    case 'sun-date': sunDate(kit, r, seed); break;
    case 'dust-aloe': dustAloe(kit, r, seed); break;
    case 'digger-tuber': diggerTuber(kit, r, seed); break;
  }
  const g = kit.build(`plant-${type}`);
  const s = rr(r, 0.88, 1.12);
  g.scale.setScalar(s);
  g.rotation.y = r() * Math.PI * 2;
  return g;
}
