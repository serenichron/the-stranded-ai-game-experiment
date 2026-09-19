// The Tel'sharin (ded-waka), phase 3. A dead Maker warrior with machinery fused into it: a dark
// skinned core from char-people.ts, and on top of it hard, faceted armour plates on every bone.
// The plates are convex hulls cut from ellipsoids, flat shaded, so each face catches the low sun.
//
// References: source/reference-images/telsharin-warden-pair-variant-a.png, -b.png, -c-weathered.png.
// Canon (locked): faceted angular dome head, horizontal slits with lights inside, three-pronged feet,
// backward-bending digitigrade legs, bone and coral in dark grey-green oxidised metal, asymmetric.
// The game lights it red, not amber (user decision, PALETTE.telsharinRed).
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { PALETTE, type Model, type ModelOpts } from './types';
import { ball, box, cone, cyl, glow, ico, lit, put, ring, rng } from './char-kit';
import { J, add, kf } from './char-rig';
import { tube } from './char-parts';
import { smat } from './char-shade';
import { buildSculpted, M } from './char-people';
import type { V3 } from './char-sdf';

type Cut = { n: V3; o: number };

const hulls = new Map<string, THREE.BufferGeometry>();
const hashOf = (k: string) => { let h = 2166136261; for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619); return h >>> 0; };

/**
 * A faceted chunk: the convex hull of points on an ellipsoid (centre `c`, radii `rad`), keeping only
 * the side of each cut where dot(p, n) < o. Low `res` gives big flat facets. `jit` roughens the radii.
 */
function chunk(key: string, c: V3, rad: V3, cuts: Cut[] = [], res: [number, number] = [8, 6], jit = 0, extra: V3[] = [], stagger = true): THREE.BufferGeometry {
  let g = hulls.get(key);
  if (g) return g;
  const r = rng(hashOf(key));
  const [nu, nv] = res;
  const keep = (p: V3) => cuts.every((q) => p[0] * q.n[0] + p[1] * q.n[1] + p[2] * q.n[2] < q.o);
  const grid: V3[][] = [];
  for (let i = 0; i <= nv; i++) {
    const th = (Math.PI * i) / nv;
    const row: V3[] = [];
    for (let j = 0; j < nu; j++) {
      const ph = (2 * Math.PI * (j + (stagger ? (i % 2) * 0.5 : 0))) / nu;
      const k = 1 + jit * (r() - 0.5);
      row.push([c[0] + rad[0] * Math.sin(th) * Math.cos(ph) * k, c[1] + rad[1] * Math.cos(th) * k, c[2] + rad[2] * Math.sin(th) * Math.sin(ph) * k]);
    }
    grid.push(row);
  }
  const pts: V3[] = [];
  const cross = (a: V3, b: V3) => {
    // where the segment a-b leaves the kept region, add the crossing point so cut edges are clean
    const ka = keep(a), kb = keep(b);
    if (ka === kb) return;
    let lo = 0, hi = 1;
    for (let it = 0; it < 14; it++) {
      const m = (lo + hi) / 2;
      const p: V3 = [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, a[2] + (b[2] - a[2]) * m];
      if (keep(p) === ka) lo = m; else hi = m;
    }
    const t = ka ? lo : hi;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  };
  for (let i = 0; i <= nv; i++) {
    for (let j = 0; j < nu; j++) {
      const p = grid[i][j];
      if (keep(p)) pts.push(p);
      cross(p, grid[i][(j + 1) % nu]);
      if (i < nv) { cross(p, grid[i + 1][j]); cross(p, grid[i + 1][(j + 1) % nu]); }
    }
  }
  pts.push(...extra.filter(keep));
  g = new ConvexGeometry(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  hulls.set(key, g);
  return g;
}

/** A plate along a limb bone from `y0` down to `y1` (both negative), fattened over the limb radius. */
function limbPlate(key: string, y0: number, y1: number, rx: number, rz: number, z = 0, res: [number, number] = [8, 6], jit = 0.03): THREE.BufferGeometry {
  const mid = (y0 + y1) / 2, half = Math.abs(y0 - y1) / 2;
  return chunk(key, [0, mid, z], [rx, half * 1.18, rz], [{ n: [0, 1, 0], o: y0 }, { n: [0, -1, 0], o: -y1 }], res, jit, [], false);
}

/** States: 'awake' | 'starving' | 'asleep' (hibernating). */
export function buildTelsharinSculpted(opts: ModelOpts): Model {
  return buildSculpted('telsharin', 'male', 'telsharin', opts, 'telsharin', undefined, (spec, c) => {
    const { rig, B } = c;
    const d = B.dims, yS = d.spineLen;
    const seam = glow(c.glows, PALETTE.telsharinRed, 1.6, false, 0x4a0e08);
    const bone = smat('bone', 0xd2c4a2, { rough: 0.9, flat: true, scale: 4 });
    const plate = smat('warden', 0x8c9a92, { rough: 0.55, metal: 0.15, flat: true, scale: 3.5 });
    const plate2 = smat('warden', 0x6a766e, { rough: 0.6, metal: 0.15, flat: true, scale: 5 });
    const core = c.mats[M.skin];
    const visorM = smat('', 0x0f0d0c, { rough: 0.35, metal: 0.3, flat: true });
    const P = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material) => put(parent, g, m);

    // ---- head: a faceted dome, taller than wide, the face coming to a blunt point at the chin
    const H = B.head, hy = H.h * 0.72, cy = hy + 0.01;
    const hr: V3 = [H.w, H.h, H.d];
    P(rig.head, chunk('tel-dome', [0, cy, 0.004], hr, [], [7, 5], 0.06, [[0, cy - H.h * 1.08, -H.d * 0.62], [0, cy + H.h * 1.04, -0.01]]), plate);
    // a darker brow plate and a crest ridge, so the dome reads as plated, not as one egg
    P(rig.head, chunk('tel-brow', [0, cy + 0.01, 0.0], [H.w * 1.04, H.h * 1.02, H.d * 1.05], [{ n: [0, -1, 0], o: -(cy + H.h * 0.28) }, { n: [0, 0, 1], o: -H.d * 0.15 }], [9, 7], 0.04), plate2);
    // the visor: one dark slit across the face, a row of lights inside it (canon); a short second slit below
    const vy = cy - H.h * 0.05;
    P(rig.head, chunk('tel-visor', [0, cy, 0.004], [H.w * 1.035, H.h * 1.03, H.d * 1.05], [{ n: [0, 1, 0], o: vy + 0.017 }, { n: [0, -1, 0], o: -(vy - 0.017) }, { n: [0, 0, 1], o: -H.d * 0.42 }, { n: [1, 0, 0], o: H.w * 0.78 }, { n: [-1, 0, 0], o: H.w * 0.78 }], [26, 18]), visorM);
    const onDome = (x: number, y: number, k = 1.05) => {
      const q = 1 - (x / (H.w * k)) ** 2 - ((y - cy) / (H.h * k)) ** 2;
      return -H.d * k * Math.sqrt(Math.max(0, q));
    };
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 0.019;
      lit(put(rig.head, ball(0.0075, 6, 4), seam, [x, vy, onDome(x, vy, 1.06) - 0.002], undefined, [1, 0.8, 0.6]));
    }
    lit(put(rig.head, box(0.03, 0.006, 0.01), seam, [0.03, vy - 0.04, onDome(0.03, vy - 0.04, 1.02)], [0, -0.3, 0]));
    // round sensor pods at the sides of the head: two on the right, one on the left (asymmetric)
    for (const [x, y, z, rr] of [[1, 0.0, 0.01, 0.024], [1, -0.05, 0.02, 0.018], [-1, -0.01, 0.01, 0.02]] as Array<[number, number, number, number]>) {
      put(rig.head, cyl(rr, rr, 0.035, 10), plate2, [x * H.w * 0.98, cy + y, z], [0, 0, Math.PI / 2]);
      lit(put(rig.head, cyl(rr * 0.45, rr * 0.45, 0.037, 8), seam, [x * H.w * 0.99, cy + y, z], [0, 0, Math.PI / 2]));
    }
    // a bone horn grown through the back of the dome
    put(rig.head, cone(0.026, 0.17, 5), bone, [-0.04, cy + H.h * 0.8, 0.05], [-0.9, 0, 0.35]);
    // a collar of cables round the neck
    put(rig.spine, ring(B.neckR * 1.6, 0.012, 5, 12), plate2, [0, yS + 0.03, 0.005], [Math.PI / 2, 0, 0]);

    // ---- chest: the right plate whole, the left torn away over the ribs, a back plate, a sternum ridge
    const cc: V3 = [0, yS * 0.64, 0.0], cr: V3 = [B.chestW + 0.04, yS * 0.36, B.chestD + 0.04];
    const front: Cut = { n: [0, 0, 1], o: 0.025 };
    P(rig.spine, chunk('tel-chestR', cc, cr, [{ n: [-1, 0, 0], o: 0.012 }, { n: [0, -1, 0], o: -yS * 0.4 }, front], [9, 7], 0.1), plate);
    P(rig.spine, chunk('tel-chestLlow', cc, cr, [{ n: [1, 0, 0], o: -0.012 }, { n: [0, -1, 0], o: -yS * 0.38 }, { n: [0, 1, 0], o: yS * 0.53 }, front], [9, 7], 0.14), plate);
    P(rig.spine, chunk('tel-chestLtop', cc, cr, [{ n: [1, 0, 0], o: -0.012 }, { n: [0, -1, 0], o: -yS * 0.82 }, front, { n: [-0.4, 0, 1], o: -0.02 }], [9, 7], 0.14), plate);
    P(rig.spine, chunk('tel-back', cc, [cr[0] * 0.98, cr[1], cr[2] * 0.95], [{ n: [0, 0, -1], o: -0.01 }, { n: [0, -1, 0], o: -yS * 0.36 }], [9, 7], 0.08), plate2);
    P(rig.spine, chunk('tel-sternum', [0.004, yS * 0.66, -cr[2] - 0.006], [0.02, yS * 0.2, 0.02], [], [5, 4]), plate2);
    // bone ribs and a sternum inside the torn hole (warden art), rigid so they stay crisp
    for (let i = 0; i < 4; i++) put(rig.spine, ring(B.chestW * 0.95, 0.0105, 5, 12, 1.05), bone, [0.0, yS * (0.57 + i * 0.07), -0.01], [Math.PI / 2, 0, Math.PI * 1.02 + 0.3], [1, (B.chestD * 1.08) / (B.chestW * 0.95), 1]);
    put(rig.spine, cyl(0.014, 0.012, yS * 0.3, 6), bone, [-0.02, yS * 0.68, -B.chestD - 0.012]);
    // a yoke plate over the shoulders and the upper back
    P(rig.spine, chunk('tel-yoke', [0, yS - 0.03, 0.01], [d.shoulderW + 0.03, 0.075, B.chestD + 0.035], [{ n: [0, -1, 0], o: -(yS - 0.05) }, { n: [0, 0, -1], o: 0.02 }], [10, 6], 0.06), plate2);
    // the red light inside the torn hole, and a red seam down the back plate
    lit(put(rig.spine, ico(0.045, 0), seam, [-B.chestW * 0.45, yS * 0.66, -B.chestD * 0.55]));
    lit(put(rig.spine, box(0.022, yS * 0.55, 0.02), seam, [0.01, yS * 0.62, cr[2] + 0.004]));
    // the waist: exposed ribbed segments between the chest armour and the hips
    for (let i = 0; i < 3; i++) put(rig.spine, ring(B.waistW + 0.02 - i * 0.004, 0.014, 5, 14), plate2, [0, 0.07 + i * 0.055, 0.004], [Math.PI / 2, 0, 0], [1, (B.waistD + 0.02) / (B.waistW + 0.02), 1]);
    // hips: an armoured pelvis and a front plate, a red seam round the waist
    P(rig.hips, chunk('tel-pelvis', [0, -0.03, 0.0], [B.hipW + 0.04, 0.12, B.hipD + 0.04], [{ n: [0, 1, 0], o: 0.055 }, { n: [0, -1, 0], o: 0.1 }], [9, 6], 0.08), plate);
    P(rig.hips, chunk('tel-cod', [0, -0.1, -B.hipD - 0.02], [0.06, 0.085, 0.03], [], [6, 4], 0.05), plate2);
    lit(put(rig.hips, cyl(B.hipW + 0.035, B.hipW + 0.035, 0.012, 16), seam, [0, 0.05, 0], undefined, [1, 1, (B.hipD + 0.04) / (B.hipW + 0.04)]));

    // ---- arms: a big pauldron right, a smaller one left with a sensor pod, plated limbs, glowing elbows
    for (const s of [-1, 1]) {
      const arm = s < 0 ? rig.lArm : rig.rArm, fore = s < 0 ? rig.lFore : rig.rFore;
      const big = s > 0;
      const pr: V3 = big ? [0.1, 0.066, 0.1] : [0.075, 0.05, 0.075];
      P(arm, chunk(`tel-paul${s}`, [s * 0.025, 0.0, 0], pr, [{ n: [0, -1, 0], o: big ? 0.035 : 0.025 }, { n: [-s, 0, 0], o: 0.05 }], [9, 6], 0.06), plate);
      if (big) P(arm, chunk('tel-paul2', [0.035, -0.06, 0], [0.095, 0.05, 0.095], [{ n: [0, -1, 0], o: 0.085 }, { n: [0, 1, 0], o: 0.02 }, { n: [-1, 0, 0], o: 0.03 }], [9, 5], 0.05), plate2);
      P(arm, limbPlate(`tel-uarm${s}`, -0.08, -d.upperArm + 0.06, B.armR + 0.013, B.armR + 0.012), plate);
      put(fore, ball(B.elbowR + 0.012, 8, 6), core, [0, 0, 0]);
      lit(put(fore, ring(B.elbowR + 0.013, 0.005, 4, 12), seam, [0, 0, 0], [0, 0, Math.PI / 2]));
      if (big) {
        // the right forearm: a heavy gauntlet with three red studs
        P(fore, limbPlate('tel-gaunt', -0.04, -d.foreArm + 0.02, B.foreR + 0.036, B.foreR + 0.032, 0, [8, 6], 0.08), plate2);
        for (let i = 0; i < 3; i++) lit(put(fore, box(0.016, 0.016, 0.016), seam, [0.075, -0.1 - i * 0.075, -0.04]));
      } else {
        P(fore, limbPlate('tel-fore-1', -0.05, -d.foreArm + 0.04, B.foreR + 0.012, B.foreR + 0.011), plate);
      }
    }
    // the sensor pod on the left shoulder: a block with three lenses facing forward (variant a)
    const pod = new THREE.Object3D();
    pod.position.set(-d.shoulderW - 0.01, yS + 0.08, 0.03);
    pod.rotation.set(0.1, 0.25, 0);
    rig.spine.add(pod);
    P(pod, chunk('tel-pod', [0, 0, 0.01], [0.055, 0.05, 0.05], [], [6, 4], 0.05), plate2);
    for (const [x, y] of [[-0.022, 0.015], [0.022, 0.015], [0, -0.02]] as Array<[number, number]>) {
      put(pod, cyl(0.017, 0.017, 0.03, 10), core, [x, y, -0.045], [Math.PI / 2, 0, 0]);
      lit(put(pod, cyl(0.01, 0.01, 0.032, 8), seam, [x, y, -0.047], [Math.PI / 2, 0, 0]));
    }
    // bone coral grown out through the right shoulder
    for (let i = 0; i < 5; i++) put(rig.spine, cone(0.014 + i * 0.002, 0.09, 4), bone, [d.shoulderW + 0.06 + i * 0.01, yS + 0.08 - i * 0.02, 0.06 + i * 0.015], [-0.4 + i * 0.2, 0, -0.5 - i * 0.2]);

    // ---- legs: thigh plates, knee caps pointing forward, shin plates running back, glowing hocks
    for (const s of [-1, 1]) {
      const leg = s < 0 ? rig.lLeg : rig.rLeg, shin = s < 0 ? rig.lShin : rig.rShin, foot = s < 0 ? rig.lFoot : rig.rFoot;
      P(leg, limbPlate(`tel-thigh${s}`, -0.03, -d.thigh + 0.05, B.thighR + 0.016, B.thighR + 0.02, -0.008, [8, 6], 0.06), plate);
      P(shin, chunk(`tel-knee${s}`, [0, -0.005, -B.kneeR - 0.01], [0.058, 0.075, 0.048], [], [6, 5], 0.1), plate2);
      lit(put(shin, ball(0.02, 6, 4), seam, [s * 0.045, -0.02, -0.02]));
      P(shin, limbPlate(`tel-shin${s}`, -0.07, -d.shin + 0.05, B.calfR + 0.012, B.calfR + 0.016, 0.006, [7, 6], 0.06), plate);
      put(foot, ball(B.ankleR + 0.014, 8, 6), core, [0, 0, 0]);
      lit(put(foot, ring(B.ankleR + 0.015, 0.005, 4, 12), seam, [0, 0, 0], [0, 0, Math.PI / 2]));
      P(foot, limbPlate(`tel-meta${s}`, -0.03, -d.meta + 0.03, 0.034, 0.038, 0, [6, 5], 0.06), plate2);
    }

    // ---- feeding tubes from under the chest plate: limp, twitching when starving, reaching out on attack
    const dk = smat('maker', 0x55624f, { rough: 0.65, metal: 0.1, flat: true, scale: 3 });
    const tubes = new THREE.Object3D();
    tubes.position.set(0, yS * 0.38, -B.chestD * 0.75);
    rig.spine.add(tubes);
    const base = [-0.05, -0.017, 0.017, 0.05], len = [0.42, 0.36, 0.46, 0.38];
    const pivots: THREE.Object3D[] = [];
    for (let i = 0; i < 4; i++) {
      const pv = new THREE.Object3D();
      pv.rotation.order = 'YXZ';
      pv.position.x = base[i];
      tubes.add(pv);
      const m = put(pv, tube('tel-feed-' + i, len[i], [[0, 0.016], [0.8, 0.012], [1, 0.009]], 6), i % 2 ? bone : dk);
      m.userData.keep = true;
      lit(put(pv, ball(0.013, 5, 4), seam, [0, -len[i], 0]));
      pivots.push(pv);
    }

    // ---- stance: upright and lean as in the warden art, a slight stoop, head pushed forward
    spec.rest = spec.rest.slice() as Float32Array;
    const setR = (j: number, x: number, y = 0, z = 0) => { spec.rest[j * 3] = x; spec.rest[j * 3 + 1] = y; spec.rest[j * 3 + 2] = z; };
    setR(J.lLeg, 0.62, 0, -0.08); setR(J.lShin, -1.45); setR(J.lFoot, 1.08);
    setR(J.rLeg, 0.55, 0, 0.08); setR(J.rShin, -1.35); setR(J.rFoot, 1.04);
    setR(J.spine, -0.2, 0.06, -0.03); setR(J.head, 0.28, 0, -0.08);
    setR(J.lArm, 0.1, 0, -0.12); setR(J.lFore, 0.3); setR(J.rArm, 0.14, 0, 0.14); setR(J.rFore, 0.35);

    let state: 'awake' | 'asleep' | 'starving' = 'awake';
    let level = 1;
    spec.post = (o, cx) => {
      const k = cx.clock;
      if (cx.anim === 'idle' || cx.anim === 'talk') {
        // twitches: a dead thing kept moving by machinery
        const tw = Math.pow(Math.max(0, Math.sin(k * 0.9) * Math.sin(k * 2.7 + 1)), 8);
        add(o, J.head, 0, 0.5 * tw, -0.2 * tw);
        if (state === 'starving') {
          add(o, J.head, 0.04 * Math.sin(k * 31) * Math.sin(k * 3), 0.05 * Math.sin(k * 17));
          add(o, J.spine, -0.1);
          o[44] += 0.12 * (0.5 + 0.5 * Math.sin(k * 1.7));
        }
      }
      if (cx.anim === 'attack') {
        const T = [0, 0.35, 0.5, 0.7, 1];
        add(o, J.spine, kf(cx.p, T, [0, 0.15, -0.35, -0.3, 0]));
        add(o, J.rArm, kf(cx.p, T, [0, 1.6, 0.6, 0.5, 0]), 0, kf(cx.p, T, [0, 0.3, -0.2, -0.2, 0]));
        add(o, J.head, kf(cx.p, T, [0, 0.1, 0.3, 0.3, 0]));
        o[44] += kf(cx.p, T, [0, 0.1, 1, 1, 0]);
      }
    };
    spec.frame = (cur, cx) => {
      const ext = Math.max(0, Math.min(1, cur[44]));
      const k = cx.clock;
      for (let i = 0; i < 4; i++) {
        const tw = state === 'starving' ? 0.35 * Math.pow(Math.abs(Math.sin(k * (4 + i * 1.7) + i)), 6) * Math.sign(Math.sin(k * 9 + i)) : 0;
        pivots[i].rotation.x = 0.15 + (Math.PI / 2 - 0.3) * ext + 0.06 * Math.sin(k * (1.3 + i * 0.4) + i * 2) + tw;
        pivots[i].rotation.y = base[i] * 3 * (1 - ext) + tw * 0.6;
        pivots[i].scale.y = 0.8 + 1.1 * ext;
      }
    };
    spec.glowLevel = (k, dt) => {
      let want = 0.88 + 0.12 * Math.sin(k * 1.3);
      if (state === 'asleep') want = 0.03;
      level += (want - level) * Math.min(1, dt * 1.5);
      if (state === 'starving') {
        const f = Math.sin(k * 13.1) * Math.sin(k * 7.7 + 1.3) * Math.sin(k * 3.1);
        return f > 0.12 ? 1 : 0.2 + 0.15 * Math.abs(Math.sin(k * 40));
      }
      return level;
    };
    spec.restAnim = () => (state === 'asleep' ? 'sleep' : 'idle');
    spec.setState = (st, ctl) => {
      const was = state;
      if (st === 'asleep' || st === 'hibernating') { state = 'asleep'; if (ctl.anim() !== 'die') ctl.play('sleep'); }
      else if (st === 'awake' || st === 'starving') { state = st; if (was === 'asleep' && ctl.anim() === 'sleep') ctl.play('wake'); }
    };
    spec.seat = undefined;
    spec.scale = 1.05;
  });
}
