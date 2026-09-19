// The Mi'naa camp, phase 2. Built towards scene-minaa-water-holders.png (a stone cistern, pipes,
// torn canvas on poles, water jars everywhere, huts against the ancient towers) and the hub-town
// gate paintings in ../source/reference-images (stilt huts, ladders, patchwork awnings).
// Canon: modern Mi'naa build patched, salvaged, asymmetric, jury-rigged; rectangular; wooden scaffolding.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE } from './types';
import {
  Kit, makeRng, rr, ri, pick, lerp, clamp01, smooth, noise3, displace, paint, paintFn, sweep, lathe,
  matte, matte2, metal, type Rng,
} from './scn-kit';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const WOOD = 0x7a5a3c;
const CLOTHS = [0xa4502e, 0xc8904a, 0x8c5a3a, 0x9a6a3a, 0xb88a5a];
const SANDSTONE = 0xae9676;

/** A wooden pole between two points. */
export function pole(a: THREE.Vector3, b: THREE.Vector3, rad: number, seg = 5): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(rad * 0.85, rad, len, seg, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
  return g.translate(a.x, a.y, a.z);
}

// ================================================================ torn canvas

/**
 * A sagging, torn canvas: w wide (x), d deep (z), hung at hFront (+z edge) and hBack (-z edge).
 * Holes rot through it, the front hem hangs in tatters, a patch or two of another cloth is sewn on.
 * Returns geometry only (double-sided cloth material), centred on the origin.
 */
export function tornCanvas(r: Rng, w: number, d: number, hFront: number, hBack: number, hex: number, seed: number): THREE.BufferGeometry {
  const NU = Math.max(6, Math.round(w * 4)), NV = Math.max(5, Math.round(d * 4));
  const sag = 0.1 + 0.05 * Math.max(w, d);
  const P = (i: number, j: number) => {
    const u = i / NU, v = j / NV;
    const y = lerp(hBack, hFront, v) - sag * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) + 0.03 * noise3(u * 6, v * 6, 0, seed);
    return V((u - 0.5) * w, y, (v - 0.5) * d);
  };
  const hole = (i: number, j: number) => noise3(i * 0.55, j * 0.55, seed * 0.1, seed) > 0.72 && i > 0 && j > 0 && i < NU - 1 && j < NV - 1;
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    if (hole(i, j)) continue;
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), e = P(i, j + 1);
    tri(a, e, b); tri(b, e, c);
  }
  // tatters hanging from the front hem
  for (let i = 0; i < NU; i++) {
    if (r() < 0.35) continue;
    const a = P(i, NV), b = P(i + 1, NV);
    const len = rr(r, 0.12, 0.45);
    const tip = a.clone().lerp(b, rr(r, 0.3, 0.7)).add(V(rr(r, -0.05, 0.05), -len, rr(r, 0.02, 0.08)));
    tri(a, tip, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const base = new THREE.Color(hex), patchC = new THREE.Color(pick(r, CLOTHS)), stain = new THREE.Color(0x5a3a28), faded = new THREE.Color(0xe0cfae);
  const patch = { x: rr(r, -w * 0.3, w * 0.3), z: rr(r, -d * 0.3, d * 0.3), sx: rr(r, 0.25, 0.5), sz: rr(r, 0.2, 0.4) };
  return paintFn(g, (x, y, z, out) => {
    out.copy(base).lerp(faded, 0.08 + 0.14 * noise3(x * 0.8, 0, z * 0.8, seed + 1));
    if (Math.abs(x - patch.x) < patch.sx && Math.abs(z - patch.z) < patch.sz) out.copy(patchC).multiplyScalar(0.9);
    out.lerp(stain, smooth(0.55, 0.85, noise3(x * 1.7, y, z * 1.7, seed + 2)) * 0.35);
    out.multiplyScalar(0.85 + 0.15 * noise3(x * 4, y * 4, z * 4, seed + 3));
  });
}

/**
 * A canopy of torn canvas on four crooked poles, roped down to stakes. Origin on the ground at the
 * centre; w along x, d along z, the high edge at -z. Use for work shades over the cistern and stalls.
 */
export function canopy(w: number, d: number, h: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const hB = h + 0.35, hF = h;
  const cloth = tornCanvas(r, w, d, hF, hB, pick(r, CLOTHS), seed);
  kit.add(cloth, matte2());
  const corners: [number, number, number][] = [[-w / 2, -d / 2, hB], [w / 2, -d / 2, hB], [w / 2, d / 2, hF], [-w / 2, d / 2, hF]];
  for (const [x, z, top] of corners) {
    const lean = V(rr(r, -0.08, 0.08), 0, rr(r, -0.08, 0.08));
    kit.add(paint(pole(V(x + lean.x, -0.2, z + lean.z), V(x, top + 0.12, z), 0.05), WOOD, { seed, vary: 0.15, ao: 0.3, aoHeight: 0.6 }), matte());
    // a guy rope out to a stake
    const out = V(Math.sign(x) * 0.9, 0, Math.sign(z) * 0.7);
    const stake = V(x + out.x, 0.05, z + out.z);
    kit.add(paint(sweep([V(x, top, z), V(x + out.x * 0.5, top * 0.5 + 0.05, z + out.z * 0.5), stake], { segments: 8, radial: 3, radius: () => 0.012 }), 0x8a6a48, { seed, ao: 0 }), matte());
    kit.add(paint(pole(stake.clone().setY(-0.1), stake.clone().setY(0.18), 0.025, 4), WOOD, { seed, ao: 0 }), matte());
  }
  return kit.build('canopy');
}

// ================================================================ water

/** Rough-cut sandstone block, rounded a little by wear. */
function block(r: Rng, w: number, h: number, d: number, seed: number): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.12);
  displace(g, Math.min(w, h, d) * 0.06, 3, seed);
  return paintFn(g.toNonIndexed(), (x, y, z, out) => {
    out.setHex(SANDSTONE).multiplyScalar(0.8 + 0.22 * noise3(x * 3 + seed, y * 3, z * 3, seed) + 0.08 * (r() - 0.5));
    // grime creeps up from the ground and down from the edges
    out.multiplyScalar(0.78 + 0.22 * smooth(-h / 2, h / 2, y));
  });
}

/**
 * The spring, walled into a cistern of cut stone. An old iron pipe comes over the south wall and
 * pours into it (the water is pumped up from below the miner ruin). A gauge on a post, a valve
 * wheel, wet dark stone at the waterline. Origin at the centre on the ground.
 * Returns the static stone and iron, plus the moving parts for the prop to animate.
 */
export function cistern(seed = 1): { root: THREE.Group; water: THREE.Mesh; stream: THREE.Mesh; ripples: THREE.Mesh[]; streamMat: THREE.ShaderMaterial; ripMats: THREE.MeshBasicMaterial[] } {
  const r = makeRng(seed);
  const kit = new Kit();
  const W = 2.8, D = 2.2, T = 0.42, H = 0.72;
  const courses = 2, ch = H / courses;
  const wet = new THREE.Color(0x6a5a48);
  // the walls, course by course, joints staggered
  for (let c = 0; c < courses; c++) {
    const y = ch * (c + 0.5);
    const runs: [THREE.Vector3, THREE.Vector3, number][] = [
      [V(-W / 2, y, -D / 2 + T / 2), V(W / 2, y, -D / 2 + T / 2), 0],
      [V(-W / 2, y, D / 2 - T / 2), V(W / 2, y, D / 2 - T / 2), 0],
      [V(-W / 2 + T / 2, y, -D / 2 + T), V(-W / 2 + T / 2, y, D / 2 - T), 1],
      [V(W / 2 - T / 2, y, -D / 2 + T), V(W / 2 - T / 2, y, D / 2 - T), 1],
    ];
    for (const [a, b, axis] of runs) {
      const len = a.distanceTo(b);
      let u = c % 2 ? -0.3 : 0;
      while (u < len - 0.05) {
        const bl = Math.min(len - Math.max(0, u), rr(r, 0.55, 0.85));
        const s = Math.max(0, u), e = Math.min(len, u + bl);
        u += bl + 0.02;
        if (e - s < 0.15) continue;
        const mid = a.clone().lerp(b, (s + e) / 2 / len);
        const g = axis ? block(r, T, ch - 0.02, e - s - 0.02, seed + c * 31 + Math.round(u * 10)) : block(r, e - s - 0.02, ch - 0.02, T, seed + c * 31 + Math.round(u * 10));
        g.translate(mid.x, mid.y, mid.z);
        kit.add(g, matte());
      }
    }
  }
  // a darker floor inside and wet stone at the waterline
  const floor = new THREE.PlaneGeometry(W - T * 2, D - T * 2).rotateX(-Math.PI / 2).translate(0, 0.05, 0);
  kit.add(paintFn(floor, (_x, _y, _z, out) => out.copy(wet).multiplyScalar(0.6)), matte());
  // the pipe: from the south-west, over the south wall, bending down into the basin
  const px = -0.55;
  const pipePts = [V(px - 0.6, 0.35, D / 2 + 1.3), V(px - 0.1, 0.9, D / 2 + 0.5), V(px, 1.02, D / 2 - 0.1), V(px, 0.95, D / 2 - 0.45), V(px, 0.78, D / 2 - 0.55)];
  const iron = 0x4a423a;
  kit.add(paint(sweep(pipePts, { segments: 24, radial: 8, radius: () => 0.085 }), iron, { seed, vary: 0.1, ao: 0, stain: PALETTE.rust, stainAmount: 0.6, freq: 3 }), metal());
  for (const t of [0.15, 0.45]) {
    const c = new THREE.CatmullRomCurve3(pipePts);
    const p = c.getPointAt(t), tan = c.getTangentAt(t);
    const fl = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 10).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), tan)).translate(p.x, p.y, p.z);
    kit.add(paint(fl, iron, { seed, ao: 0, stain: PALETTE.rust, stainAmount: 0.7 }), metal());
  }
  // valve wheel on the pipe
  const vp = new THREE.CatmullRomCurve3(pipePts).getPointAt(0.3);
  kit.add(paint(new THREE.TorusGeometry(0.16, 0.022, 5, 14).rotateY(Math.PI / 2).translate(vp.x - 0.14, vp.y + 0.08, vp.z), 0x6a4a30, { seed, ao: 0 }), metal());
  kit.add(paint(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 5).rotateZ(Math.PI / 2).translate(vp.x - 0.06, vp.y + 0.08, vp.z), iron, { seed, ao: 0 }), metal());
  // a gauge on a post by the east wall (the painting has one)
  const gx = W / 2 + 0.25, gz = D / 2 - 0.3;
  kit.add(paint(new THREE.CylinderGeometry(0.03, 0.035, 1.3, 6).translate(gx, 0.65, gz), iron, { seed, ao: 0.3 }), metal());
  kit.add(paint(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 14).rotateX(Math.PI / 2).translate(gx, 1.32, gz + 0.03), 0x8a6a3a, { seed, ao: 0 }), metal());
  kit.add(paint(new THREE.CircleGeometry(0.085, 14).translate(gx, 1.32, gz + 0.06), 0xe8dcc0, { seed, ao: 0 }), matte());
  // a plank walkway along the west side, and a dipping cup on the wall
  for (let i = 0; i < 5; i++) {
    kit.add(paint(new THREE.BoxGeometry(0.2, 0.04, 0.9).translate(-W / 2 - 0.35, 0.03, -0.9 + i * 0.44).rotateY(rr(r, -0.04, 0.04)), 0x8a6a48, { seed: seed + i, vary: 0.15, ao: 0 }), matte());
  }
  const root = new THREE.Group();
  root.add(kit.build('cistern'));
  // water surface
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W - T * 2 + 0.02, D - T * 2 + 0.02).rotateX(-Math.PI / 2).translate(0, 0.58, 0), new THREE.MeshStandardMaterial({ color: 0x4a9a92, emissive: 0x163c3a, emissiveIntensity: 0.4, roughness: 0.75, metalness: 0, transparent: true, opacity: 0.88 }));
  water.receiveShadow = true;
  root.add(water);
  // the falling stream: a narrow ribbon with scrolling streaks
  const streamMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT; varying vec2 vUv;
      void main() {
        float s = sin(vUv.y * 38.0 + uT * 14.0 + sin(vUv.x * 9.0) * 2.0) * 0.5 + 0.5;
        float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
        vec3 c = mix(vec3(0.55, 0.78, 0.8), vec3(0.92, 0.97, 0.96), s);
        gl_FragColor = vec4(c, (0.45 + 0.4 * s) * edge);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const spout = pipePts[pipePts.length - 1];
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(0.1, spout.y - 0.58).translate(spout.x, (spout.y + 0.58) / 2, spout.z), streamMat);
  stream.renderOrder = 3;
  root.add(stream);
  const ripMats: THREE.MeshBasicMaterial[] = [], ripples: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.MeshBasicMaterial({ color: 0xd8f0e8, transparent: true, opacity: 0, depthWrite: false });
    const rp = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.1, 24).rotateX(-Math.PI / 2).translate(spout.x, 0.59, spout.z), m);
    rp.raycast = () => {};
    ripMats.push(m); ripples.push(rp); root.add(rp);
  }
  return { root, water, stream, ripples, streamMat, ripMats };
}

// ================================================================ jars, blocks, pipes

/** A cluster of water holders: dented metal canisters with handles, and round clay jars. */
export function jars(seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const n = ri(r, 3, 6);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, dd = i === 0 ? 0 : rr(r, 0.3, 0.7);
    const x = Math.cos(a) * dd, z = Math.sin(a) * dd;
    if (r() < 0.55) {
      // canister: grey-blue metal gone to rust at the seams
      const h = rr(r, 0.45, 0.8), rad = rr(r, 0.14, 0.22);
      const g = lathe([[0.001, 0], [rad * 0.95, 0], [rad, 0.04], [rad, h * 0.8], [rad * 0.78, h * 0.93], [rad * 0.4, h], [rad * 0.42, h + 0.05], [0.001, h + 0.05]], 12, (ang, _c, _j, rd, y) => [rd * (1 + 0.04 * noise3(Math.cos(ang) * 3, y * 4, Math.sin(ang) * 3, seed + i)), y]);
      kit.add(paint(g.translate(x, 0, z), pick(r, [0x7c8a8c, 0x6a7a80, 0x8a8a7c]), { seed: seed + i, vary: 0.1, ao: 0.3, aoHeight: 0.3, stain: PALETTE.rust, stainAmount: 0.45, freq: 3 }), metal());
      kit.add(paint(new THREE.TorusGeometry(rad * 0.55, 0.018, 4, 10, Math.PI).translate(x, h + 0.05, z), 0x4a423a, { seed, ao: 0 }), metal());
    } else {
      // clay jar
      const h = rr(r, 0.4, 0.65), rad = rr(r, 0.17, 0.26);
      const g = lathe([[0.001, 0], [rad * 0.55, 0], [rad, h * 0.35], [rad * 0.9, h * 0.7], [rad * 0.45, h * 0.88], [rad * 0.5, h], [rad * 0.38, h], [0.001, h * 0.9]], 12);
      kit.add(paint(g.translate(x, 0, z), pick(r, [0xb07a48, 0xa06a40, 0xc08a58]), { seed: seed + i, vary: 0.1, ao: 0.35, aoHeight: 0.3 }), matte());
    }
  }
  return kit.build('jars');
}

/** Cut stone blocks, stacked or tumbled, left over from building the cistern. */
export function blocks(seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const n = ri(r, 3, 6);
  for (let i = 0; i < n; i++) {
    const w = rr(r, 0.5, 0.8), h = rr(r, 0.3, 0.4), d = rr(r, 0.35, 0.5);
    const g = block(r, w, h, d, seed + i);
    const stacked = i > 1 && r() < 0.6;
    g.rotateY(rr(r, -0.4, 0.4)).translate(rr(r, -0.6, 0.6), h / 2 + (stacked ? 0.36 : 0), rr(r, -0.4, 0.4));
    kit.add(g, matte());
  }
  return kit.build('blocks');
}

/** An iron pipe run on crossed wooden trestles, rusting at every joint. Points on the ground, lifted to `h`. */
export function pipeRun(pts: THREE.Vector3[], h: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const up = pts.map((p) => p.clone().setY(p.y + h));
  kit.add(paint(sweep(up, { segments: Math.max(12, up.length * 8), radial: 8, radius: () => 0.085 }), 0x4a423a, { seed, vary: 0.1, ao: 0, stain: PALETTE.rust, stainAmount: 0.6, freq: 2.5 }), metal());
  const c = new THREE.CatmullRomCurve3(up);
  const len = c.getLength();
  for (let s = 0.8; s < len - 0.3; s += rr(r, 1.6, 2.2)) {
    const p = c.getPointAt(s / len), tan = c.getTangentAt(s / len);
    const side = V(-tan.z, 0, tan.x).normalize().multiplyScalar(0.3);
    for (const k of [1, -1]) kit.add(paint(pole(p.clone().setY(p.y - h - 0.05).addScaledVector(side, k), p.clone().add(V(0, 0.06, 0)).addScaledVector(side, -k * 0.2), 0.035, 4), WOOD, { seed, ao: 0.3, aoHeight: 0.5 }), matte());
    const fl = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 10).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), tan)).translate(p.x, p.y, p.z);
    kit.add(paint(fl, 0x4a423a, { seed, ao: 0, stain: PALETTE.rust, stainAmount: 0.8 }), metal());
  }
  return kit.build('pipe');
}

// ================================================================ a hut against a tower

/**
 * A stilt hut built against an Aza'los tower, as in the paintings: a plank platform on crooked
 * posts at `h`, a small patched hut on it with a single-pitch roof, and a ladder down.
 * Origin on the ground at the platform's centre; the tower side is -z, the ladder at +z.
 */
export function stiltHut(h: number, seed = 1): THREE.Object3D {
  const r = makeRng(seed);
  const kit = new Kit();
  const W = 2.4, D = 1.8;
  const wood = (g: THREE.BufferGeometry, hex = WOOD) => kit.add(paint(g, hex, { seed: seed + Math.floor(r() * 99), vary: 0.15, ao: 0.25, aoHeight: 0.6 }), matte());
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]]) wood(pole(V(x + rr(r, -0.1, 0.1), -0.2, z + rr(r, -0.1, 0.1)), V(x, h, z), 0.07));
  wood(pole(V(-W / 2, 0.3, D / 2), V(W / 2, h - 0.3, D / 2), 0.04, 4));
  wood(pole(V(W / 2, 0.3, -D / 2), V(-W / 2, h - 0.3, -D / 2), 0.04, 4));
  for (let i = 0; i < 7; i++) wood(new THREE.BoxGeometry(W + 0.2, 0.05, 0.24).translate(0, h, -D / 2 + 0.12 + i * 0.26).rotateY(rr(r, -0.02, 0.02)), 0x9a7a52);
  // the hut: patched panels on three sides, a doorway facing the ladder
  const hw = W * 0.8, hd = D * 0.75, hh = 1.7;
  const panel = (x: number, z: number, pw: number, ph: number, ry: number) => {
    const col = pick(r, [0x8a7a5a, PALETTE.rust, 0x6d665c, 0x9a7a52, 0x5f8a82]);
    const metalish = col === PALETTE.rust || col === 0x6d665c || col === 0x5f8a82;
    const g = new THREE.BoxGeometry(pw, ph, 0.04).rotateY(ry).translate(x, h + ph / 2, z);
    kit.add(paint(g, col, { seed: seed + Math.floor(r() * 99), vary: 0.12, ao: 0.3, aoHeight: 0.5, stain: metalish ? PALETTE.rustDark : undefined, stainAmount: 0.4 }), metalish ? metal() : matte());
  };
  for (let i = 0; i < 3; i++) panel(-hw / 2 + hw * (i + 0.5) / 3, -hd / 2, hw / 3 + 0.03, hh - rr(r, 0, 0.1), 0);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) panel(s * hw / 2, -hd / 2 + hd * (i + 0.5) / 2, hd / 2 + 0.03, hh - 0.15 - rr(r, 0, 0.1), Math.PI / 2);
  panel(-hw * 0.3, hd / 2, hw * 0.4, hh - 0.25, 0);
  panel(hw * 0.36, hd / 2, hw * 0.28, hh - 0.25, 0);
  const roof = new THREE.BoxGeometry(hw + 0.4, 0.04, hd + 0.5).rotateX(-0.22).translate(0, h + hh + 0.05, 0.05);
  kit.add(paintFn(roof, (x, _y, z, out) => out.setHex(PALETTE.rust).multiplyScalar((Math.sin(x * 40) > 0 ? 1.05 : 0.88) * (0.85 + 0.2 * noise3(x * 2, 0, z * 2, seed)))), metal());
  // the ladder
  const lz = D / 2 + 0.45;
  for (const s of [-0.22, 0.22]) wood(pole(V(s, -0.1, lz + 0.35), V(s, h + 0.5, D / 2 + 0.05), 0.035, 4));
  for (let y = 0.35; y < h; y += 0.32) {
    const t = y / (h + 0.6);
    wood(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4).rotateZ(Math.PI / 2).translate(0, y, lerp(lz + 0.35, D / 2 + 0.05, t)));
  }
  return kit.build('stilt-hut');
}

/** Corrugated sheet metal, w by h, ridges running vertically, faced towards +z. */
export function corrugated(w: number, h: number, hex: number, seed: number): THREE.BufferGeometry {
  const nx = Math.max(4, Math.round(w * 14));
  const g = new THREE.PlaneGeometry(w, h, nx, 1).toNonIndexed();
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.025 * Math.sin((p.getX(i) / w) * nx * Math.PI));
  const c = new THREE.Color(hex), rust = new THREE.Color(PALETTE.rust), dark = new THREE.Color(PALETTE.rustDark);
  return paintFn(g, (x, y, _z, out) => {
    out.copy(c).lerp(rust, smooth(0.45, 0.8, noise3(x * 1.5, y * 1.5, 0, seed)) * 0.7);
    // rust runs down from the top edge and the nail lines
    out.lerp(dark, smooth(0.6, 1, noise3(x * 8, y * 0.6, 0, seed + 1)) * smooth(-h / 2, h / 2, y) * 0.5);
    out.multiplyScalar(0.85 + 0.2 * clamp01(0.5 + y / h));
  });
}
