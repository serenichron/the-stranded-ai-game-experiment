// Creatures and machines: the Tel'sharin, the Aza'los repair drone, the dog.
// Built on the shared rig (char-rig.ts). 1 unit = 1 metre, forward is -Z.
import * as THREE from 'three';
import { PALETTE, type Model, type ModelOpts } from './types';
import {
  TAU, ball, box, cap, cone, cyl, glow, ico, lathe, limb, lit, mat, octa, put, ring, rng,
  seedOf, shade, stalk, type Glow,
} from './char-kit';
import {
  DIM, HIPY, J, LIFT, ROLL, SIDE, SIT, SLIDE, TUBES, add, clamp01, dieCurve, kf,
  makeCharModel, makeRig, restPose, smooth, type Pose, type PoseCtx, type Style,
} from './char-rig';
import { column, tmat, tube } from './char-parts';

const S = [-1, 1] as const; // left, right

// ================================================================= Tel'sharin

/// A dead Maker warrior with machinery grafted into and onto the corpse (canon, spoiler: never said aloud).
// Reference: source/reference-images/telsharin-warden-pair-*.png, the locked design: tall and lean,
// a faceted dome head with a visor of horizontal light slits, grey-green oxidised plates with rust,
// bone ribs showing through a torn chest plate, backward-bending legs on three-toed feet, asymmetric.
// This one is starving, so it stoops, and its light gutters. The game lights it red (designer call).
const TELSHARIN: Style = {
  walkHz: 1.05, stride: 0.5, runHz: 1.4, runStride: 0.7, armSwing: 0.2, life: 0.7,
  sleep: 'crouch', sitHeight: 0.5,
  fallX: 0, fallZ: 1.45, lieLift: 0.3, lieSlide: 0, lieSide: 0.5,
  lengths: { attack: 0.75 },
};

export function buildTelsharin(opts: ModelOpts): Model {
  const r = rng(seedOf(opts.seed, opts.name, 'telsharin'));
  const rig = makeRig({
    thigh: 0.5, shin: 0.5, meta: 0.3, footH: 0.04, hipW: 0.13,
    spineLen: 0.62, shoulderW: 0.25, upperArm: 0.4, foreArm: 0.4, neck: 0.12,
  });
  // asymmetry in the frame itself: the right shoulder sits wider and a little lower
  rig.rArm.position.set(0.29, 0.6, 0.01);
  const glows: Glow[] = [];
  // oxidised grey-green Maker metal, rust and verdigris, flat-shaded so the plates read as facets
  // low metalness: there is no sky reflection to catch, so real metal renders near black here
  const m = tmat('maker', 0x8a9c86, { rough: 0.6, metal: 0.12, flat: true });
  const dk = tmat('maker', 0x5c6a5c, { rough: 0.65, metal: 0.1, flat: true });
  const ox = tmat('maker', 0x96a484, { rough: 0.8, metal: 0.08, flat: true });
  const bone = tmat('bone', 0xd2c4a2, { rough: 0.9, flat: true });
  const boneDk = tmat('bone', 0xa2957a, { rough: 0.9, flat: true });
  // kept below the bloom threshold so the red stays red and does not wash to orange (round 1 critic)
  const seam = glow(glows, PALETTE.telsharinRed, 1.6, false, 0x4a0e08);

  // ---- pelvis: plated hips with a red seam at the waist
  const hp = rig.hips;
  put(hp, column('tel-pelvis', [[-0.12, 0.1], [-0.05, 0.15], [0.04, 0.155], [0.1, 0.12]], 8), m, undefined, undefined, [1.15, 1, 0.8]);
  lit(put(hp, cyl(0.125, 0.125, 0.025, 8), seam, [0, 0.1, 0], undefined, [1.1, 1, 0.8]));
  for (const s of S) put(hp, ico(0.08, 0), dk, [s * 0.15, -0.02, 0], undefined, [0.8, 1.2, 0.9]);

  // ---- torso. Spine-local +Y up the spine, -Z the chest.
  const sp = rig.spine;
  put(sp, column('tel-waist', [[0, 0.1], [0.12, 0.095], [0.22, 0.11]], 8), dk, undefined, undefined, [1.1, 1, 0.85]);
  // right half of the chest: a whole plate. Left half: torn open, bone ribs and a red heart showing.
  put(sp, column('tel-chestR', [[0.2, 0.13], [0.34, 0.18], [0.5, 0.19], [0.62, 0.14]], 7), m, [0.03, 0, 0], [0, 0.3, 0], [1.2, 1, 0.78]);
  lit(put(sp, ico(0.08, 0), seam, [-0.06, 0.4, -0.05]));
  for (let i = 0; i < 4; i++) put(sp, ring(0.13 - i * 0.006, 0.014, 4, 8, Math.PI * 0.8), bone, [-0.03, 0.3 + i * 0.07, -0.02], [Math.PI / 2, 0, Math.PI * 0.55], [1.1, 1, 1]);
  put(sp, box(0.04, 0.34, 0.03), bone, [0, 0.42, -0.14], [0.08, 0, 0]); // sternum
  // a stitched gash across the plate
  for (let i = 0; i < 5; i++) put(sp, box(0.01, 0.04, 0.012), boneDk, [0.06 + i * 0.03, 0.3 - i * 0.012, -0.15], [0, 0, 0.9]);
  // back: a bone spine ridge in a glowing seam, knuckled plates either side
  lit(put(sp, box(0.035, 0.5, 0.03), seam, [0, 0.36, 0.15]));
  for (let i = 0; i < 5; i++) put(sp, ico(0.035, 0), bone, [0, 0.16 + i * 0.1, 0.17]);
  for (const s of S) put(sp, ico(0.14, 0), ox, [s * 0.1, 0.42, 0.1], [0, 0, s * 0.2], [0.8, 1.3, 0.45]);
  // shoulders: a big faceted pauldron on the right, a sensor pod on the left (warden art)
  put(sp, ico(0.15, 0), m, [0.28, 0.6, 0], [0.2, 0.3, -0.35], [1.2, 0.8, 1.1]);
  put(sp, ico(0.1, 0), ox, [-0.25, 0.6, 0], [0, 0, 0.3], [1.1, 0.8, 1]);
  put(sp, cyl(0.04, 0.04, 0.09, 8), dk, [-0.24, 0.72, 0.06], [Math.PI / 2, 0, 0]);
  lit(put(sp, cyl(0.022, 0.022, 0.095, 8), seam, [-0.24, 0.72, 0.06], [Math.PI / 2, 0, 0]));
  coral(sp, bone, boneDk, [0.34, 0.68, 0.08], 1.1, r);
  coral(sp, boneDk, bone, [-0.12, 0.2, 0.16], 0.9, r);
  // neck: cables and a bone column
  put(sp, column('tel-neck', [[0.58, 0.06], [0.72, 0.045]], 6), boneDk);

  // ---- head: a faceted dome, no face. A dark visor band with three red slits, one longer.
  const hd = rig.head;
  const dome = new THREE.SphereGeometry(1, 7, 5);
  put(hd, dome, m, [0, 0.14, -0.01], [0, 0.2, 0], [0.12, 0.17, 0.15]);
  put(hd, box(0.2, 0.07, 0.1), dk, [0, 0.12, -0.09], [0.1, 0, 0]);
  const slits: Array<[number, number, number]> = [[0.14, 0.15, 0.01], [0.118, 0.1, -0.03], [0.1, 0.06, 0.035]];
  for (const [y, w, x] of slits) lit(put(hd, box(w, 0.013, 0.02), seam, [x, y, -0.145], [0.1, 0, 0]));
  put(hd, cyl(0.03, 0.03, 0.05, 8), dk, [0.12, 0.16, 0.02], [0, 0, Math.PI / 2]); // side sensor
  put(hd, cone(0.03, 0.18, 4), bone, [-0.06, 0.28, 0.06], [-1.0, 0, 0.35]); // a bone horn grown through the dome

  // feeding tubes, from a seam under the chest plate: hang limp, twitch when starving, reach out on 'attack'
  const tubes = new THREE.Object3D();
  tubes.position.set(0, 0.28, -0.13);
  sp.add(tubes);
  const tubeBase = [-0.06, -0.02, 0.02, 0.06];
  const tubePivots: THREE.Object3D[] = [];
  const tubeLen = [0.42, 0.36, 0.46, 0.38];
  for (let i = 0; i < 4; i++) {
    const pv = new THREE.Object3D();
    pv.rotation.order = 'YXZ';
    pv.position.x = tubeBase[i];
    tubes.add(pv);
    put(pv, stalk(0.016, 0.009, tubeLen[i]), i % 2 ? boneDk : ox);
    lit(put(pv, ball(0.014, 4, 3), seam, [0, tubeLen[i], 0]));
    tubePivots.push(pv);
  }

  // ---- arms: long and lean, red light at the joints. The right forearm is a heavy gauntlet.
  for (const s of S) {
    const arm = s < 0 ? rig.lArm : rig.rArm;
    const fore = s < 0 ? rig.lFore : rig.rFore;
    const hand = s < 0 ? rig.lHand : rig.rHand;
    put(arm, tube('tel-arm', 0.4, [[0, 0.07], [0.3, 0.065], [1, 0.05]], 7), s < 0 ? dk : m);
    lit(put(fore, ball(0.026, 6, 4), seam, [0, 0, -0.03]));
    if (s > 0) {
      put(fore, tube('tel-gauntlet', 0.4, [[0, 0.07], [0.35, 0.09], [0.85, 0.085], [1, 0.06]], 7), m);
      for (let i = 0; i < 3; i++) lit(put(fore, box(0.02, 0.02, 0.02), seam, [0.06, -0.12 - i * 0.07, -0.06]));
    } else {
      put(fore, tube('tel-fore', 0.4, [[0, 0.05], [0.3, 0.055], [1, 0.035]], 7), dk);
      put(fore, tube('tel-foreb', 0.36, [[0, 0.025], [1, 0.02]], 5), bone, [0.03, -0.02, 0.03]); // bone showing
    }
    // hand: a narrow palm and three long fingers
    put(hand, box(0.07, 0.08, 0.035), dk, [0, -0.04, 0]);
    for (const k of [-1, 0, 1]) put(hand, cone(0.012, 0.13, 4), boneDk, [k * 0.024, -0.14, -0.01], [Math.PI + 0.1, 0, 0]);
  }

  // ---- legs: backward-bending, a long foot, three toes spread like a bird's (canon, locked)
  for (const s of S) {
    const leg = s < 0 ? rig.lLeg : rig.rLeg;
    const shin = s < 0 ? rig.lShin : rig.rShin;
    const foot = s < 0 ? rig.lFoot : rig.rFoot;
    put(leg, tube('tel-thigh', 0.5, [[0, 0.1], [0.35, 0.095], [1, 0.06]], 7), m);
    lit(put(shin, ball(0.03, 6, 4), seam, [0, 0, -0.05]));
    put(shin, tube('tel-shin', 0.5, [[0, 0.06], [0.3, 0.07], [1, 0.045]], 7), dk);
    put(shin, tube('tel-shinb', 0.44, [[0, 0.03], [1, 0.022]], 5), bone, [0, -0.02, 0.05]);
    lit(put(foot, ball(0.022, 5, 4), seam, [0, 0, 0.03]));
    put(foot, tube('tel-meta', 0.3, [[0, 0.05], [1, 0.04]], 6), dk);
    for (const yaw of [-0.55, 0, 0.55]) {
      const toe = put(foot, cone(0.03, 0.24, 4), boneDk, [-Math.sin(yaw) * 0.1, -0.31, -Math.cos(yaw) * 0.1], [-Math.PI / 2, yaw, 0]);
      toe.rotation.order = 'YXZ';
    }
    put(foot, cone(0.025, 0.12, 4), boneDk, [0, -0.3, 0.07], [Math.PI / 2 + 0.2, 0, 0]); // heel spur
  }

  let state: 'awake' | 'asleep' | 'starving' = 'awake';
  let level = 1;

  const post = (o: Pose, c: PoseCtx) => {
    const k = c.clock;
    if (c.anim === 'idle' || c.anim === 'talk') {
      // twitches: a dead thing kept moving by machinery
      const tw = Math.pow(Math.max(0, Math.sin(k * 0.9) * Math.sin(k * 2.7 + 1)), 8);
      add(o, J.head, 0, 0.5 * tw, -0.2 * tw);
      if (state === 'starving') {
        add(o, J.head, 0.04 * Math.sin(k * 31) * Math.sin(k * 3), 0.05 * Math.sin(k * 17));
        add(o, J.spine, -0.1);
        o[TUBES] += 0.12 * (0.5 + 0.5 * Math.sin(k * 1.7));
      }
    }
    if (c.anim === 'channel') { add(o, J.lArm, -0.9); add(o, J.rArm, -0.9); }
    if (c.anim === 'attack') {
      const T = [0, 0.35, 0.5, 0.7, 1];
      add(o, J.spine, kf(c.p, T, [0, 0.15, -0.35, -0.3, 0]));
      add(o, J.lArm, kf(c.p, T, [0, 0.4, 1.3, 1.1, 0]));
      add(o, J.head, kf(c.p, T, [0, 0.1, 0.3, 0.3, 0]));
    }
    if (c.anim === 'die') {
      const f = dieCurve(c.p);
      add(o, J.spine, 0.35 * f);
      add(o, J.lArm, 0.6 * f, 0, 1.3 * f);
      add(o, J.lLeg, 0, 0, 0.15 * f);
    }
  };

  const frame = (cur: Pose, c: PoseCtx) => {
    const ext = clamp01(cur[TUBES]);
    const k = c.clock;
    const starving = state === 'starving';
    for (let i = 0; i < 4; i++) {
      const pv = tubePivots[i];
      const sway = 0.06 * Math.sin(k * (1.3 + i * 0.4) + i * 2);
      const twitch = starving ? 0.35 * Math.pow(Math.abs(Math.sin(k * (4 + i * 1.7) + i)), 6) * Math.sign(Math.sin(k * 9 + i)) : 0;
      // hanging down the chest (x = PI) to reaching straight out forward (x = 1.5 PI)
      pv.rotation.x = Math.PI + 0.15 + (Math.PI / 2 - 0.3) * ext + sway + twitch;
      pv.rotation.y = (tubeBase[i] * 3) * (1 - ext) + twitch * 0.6 + 0.05 * Math.sin(k * 3 + i);
      pv.scale.y = 0.8 + 1.1 * ext;
    }
  };

  const glowLevel = (k: number, dt: number) => {
    let want = 0.88 + 0.12 * Math.sin(k * 1.3);
    if (state === 'asleep') want = 0.03;
    level += (want - level) * Math.min(1, dt * 1.5);
    if (state === 'starving') {
      const f = Math.sin(k * 13.1) * Math.sin(k * 7.7 + 1.3) * Math.sin(k * 3.1);
      return f > 0.12 ? 1 : 0.2 + 0.15 * Math.abs(Math.sin(k * 40));
    }
    return level;
  };

  return makeCharModel({
    name: 'telsharin', rig, style: TELSHARIN, glows, height: 2.15, scale: 1.08,
    phase: r() * 20,
    rest: restPose({
      // digitigrade: thigh forward, shin sharply back, the long foot near upright on its toes
      lLeg: [0.5, 0, -0.06], lShin: [-1.15, 0, 0], lFoot: [0.8, 0, 0],
      rLeg: [0.42, 0, 0.06], rShin: [-1.05, 0, 0], rFoot: [0.76, 0, 0],
      // starving stoop: head low and forward, arms hanging long
      spine: [-0.28, 0.08, -0.04], head: [0.35, 0, -0.08],
      lArm: [0.15, 0, -0.12], lFore: [0.25, 0, 0], rArm: [0.2, 0, 0.1], rFore: [0.3, 0, 0],
    }),
    post, frame, glowLevel,
    restAnim: () => (state === 'asleep' ? 'sleep' : 'idle'),
    setState(s, ctl) {
      const was = state;
      if (s === 'asleep' || s === 'hibernating') {
        state = 'asleep';
        if (ctl.anim() !== 'die') ctl.play('sleep');
      } else if (s === 'awake' || s === 'starving') {
        state = s;
        if (was === 'asleep' && ctl.anim() === 'sleep') ctl.play('wake');
      }
    },
  });
}

// ================================================================= Aza'los guardian

const GUARDIAN: Style = {
  walkHz: 1.0, stride: 0, runHz: 1.3, runStride: 0, armSwing: 0.2, life: 0.6,
  sleep: 'hover', sitHeight: 0.55, hover: 0.62,
  fallX: 0, fallZ: -1.2, lieLift: 0.1, lieSlide: 0, lieSide: -0.3,
};

export function buildGuardian(opts: ModelOpts): Model {
  const r = rng(seedOf(opts.seed, opts.name, 'guardian'));
  const rig = makeRig({
    thigh: 0, shin: 0, meta: 0, footH: 0, hipW: 0,
    spineLen: 0.8, shoulderW: 0.33, upperArm: 0.42, foreArm: 0.5, neck: 0.12,
  });
  const glows: Glow[] = [];
  // smooth shading: Aza'los forms are curves, never facets or corners
  const st = mat(PALETTE.stone, 0.55, 0.08, false);
  const inlay = mat(0xb5aa92, 0.6, 0.1, false);
  const dark = mat(0x9d927c, 0.6, 0.1, false);
  const cry = glow(glows, PALETTE.teal, 2.0, true, PALETTE.tealDeep, false);

  put(rig.hips, lathe('guardian-tail', [[0, -0.55], [0.05, -0.47], [0.1, -0.33], [0.15, -0.17], [0.19, -0.02], [0.2, 0.08], [0.16, 0.17], [0, 0.21]], 16), st);
  put(rig.hips, ring(0.27, 0.022, 6, 28), inlay, [0, 0.1, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3 + 0.5;
    lit(put(rig.hips, ball(0.03, 8, 6), cry, [0.27 * Math.cos(a), 0.1, 0.27 * Math.sin(a)], undefined, undefined, 'crystal'));
  }

  const sp = rig.spine;
  put(sp, ball(0.27, 14, 10), st, [0, 0.4, 0], undefined, [1, 1.35, 0.78]);
  lit(put(sp, ball(0.075, 10, 8), cry, [0, 0.45, -0.19], undefined, [0.75, 1.25, 0.6], 'crystal'));
  lit(put(sp, ring(0.13, 0.01, 4, 18, Math.PI * 1.2), cry, [0, 0.45, -0.165], [0, 0, -Math.PI * 0.1], [1, 1.3, 1]));
  put(sp, ring(0.2, 0.04, 8, 24), inlay, [0, 0.74, 0], [Math.PI / 2, 0, 0]);
  put(sp, cyl(0.06, 0.09, 0.16, 10), dark, [0, 0.82, 0]);
  for (const s of S) {
    put(sp, ball(0.1, 10, 8), st, [s * 0.33, 0.78, 0], undefined, [1, 0.85, 1]);
    put(sp, ball(0.18, 10, 8), st, [s * 0.14, 0.74, 0.2], [0.4, 0, s * 0.35], [0.35, 1.3, 0.2]); // petal fins
  }

  const hd = rig.head;
  put(hd, ball(0.13, 14, 10), st, [0, 0.16, 0], undefined, [0.85, 1.2, 1]);
  put(hd, ring(0.16, 0.022, 6, 16, Math.PI), inlay, [0, 0.16, 0.01], [0, Math.PI / 2, 0]);
  lit(put(hd, ball(0.035, 10, 8), cry, [0, 0.17, -0.11], undefined, [1.8, 0.55, 0.6], 'crystal'));

  for (const s of S) {
    const arm = s < 0 ? rig.lArm : rig.rArm;
    const fore = s < 0 ? rig.lFore : rig.rFore;
    put(arm, limb(0.055, 0.045, 0.42, 10), st);
    put(fore, ball(0.055, 10, 8), inlay);
    // forearm is a curved blade sweeping down and forward
    const g = new THREE.Object3D();
    g.rotation.y = Math.PI / 2;
    fore.add(g);
    put(g, ring(0.3, 0.032, 6, 14, 1.7), st, [0.3, 0, 0], [0, 0, Math.PI]);
    lit(put(g, ball(0.03, 8, 6), cry, [0.339, -0.297, 0], undefined, undefined, 'crystal'));
  }

  let state: 'dormant' | 'active' | 'broken' = 'active';
  let level = 1;

  const post = (o: Pose, c: PoseCtx) => {
    const k = c.clock;
    if (state === 'broken') {
      o[HIPY] += -0.3; o[ROLL] += 0.3;
      add(o, J.spine, -0.3, 0, 0.1); add(o, J.head, -0.4, 0.3);
      add(o, J.rArm, -0.1, 0, 0.5); add(o, J.rFore, -0.3);
      add(o, J.lArm, 0.2);
      return;
    }
    const bob = c.anim === 'sleep' ? 0.01 : 0.045;
    o[HIPY] += bob * Math.sin(k * 1.3 + 0.5);
    if (c.anim === 'walk') add(o, J.spine, -0.12);
    if (c.anim === 'run') add(o, J.spine, -0.28);
    if (c.anim === 'crouch') o[HIPY] -= 0.06;
    if (c.anim === 'die') {
      const f = dieCurve(c.p);
      o[HIPY] -= 0.4 * f;
      add(o, J.rArm, 0.6 * f, 0, -1.0 * f); // it falls to its right: keep that blade out of the ground
    }
  };

  const glowLevel = (k: number, dt: number) => {
    if (state === 'broken') {
      const f = Math.sin(k * 11.3) * Math.sin(k * 4.1 + 2);
      return f > 0.7 ? 0.5 : 0.06;
    }
    const want = state === 'dormant' ? 0.12 : 0.9 + 0.1 * Math.sin(k * 1.1);
    level += (want - level) * Math.min(1, dt * 1.2);
    return level;
  };

  return makeCharModel({
    name: 'guardian', rig, style: GUARDIAN, glows, height: 1.95,
    phase: r() * 20,
    rest: restPose({ lArm: [0, 0, -0.14], rArm: [0, 0, 0.14] }),
    post, glowLevel,
    restAnim: () => (state === 'dormant' ? 'sleep' : 'idle'),
    setState(s, ctl) {
      const was = state;
      if (s === 'dormant') {
        state = 'dormant';
        if (ctl.anim() !== 'die') ctl.play('sleep');
      } else if (s === 'active') {
        state = 'active';
        if (was === 'dormant' && ctl.anim() === 'sleep') ctl.play('wake');
        else if (was === 'broken') ctl.play('idle');
      } else if (s === 'broken') {
        state = 'broken';
        if (ctl.anim() !== 'die') ctl.play('idle');
      }
    },
  });
}

// ================================================================= dog

// The rig is reused sideways: the spine points forward, arms are forelegs, legs are hind legs.
const DOG: Style = {
  walkHz: 2.4, stride: 0.45, runHz: 2.8, runStride: 0.7, armSwing: 0.35, life: 1,
  sleep: 'sit', sitHeight: 0.17,
  fallX: 0, fallZ: 1.45, lieLift: 0.08, lieSlide: 0, lieSide: 0.4,
  lengths: { attack: 0.55, hit: 0.35 },
};

export function buildDog(opts: ModelOpts): Model {
  const r = rng(seedOf(opts.seed, opts.name, 'dog'));
  const rig = makeRig({
    thigh: 0.22, shin: 0.22, meta: 0.16, footH: 0.03, hipW: 0.07,
    spineLen: 0.5, shoulderW: 0.075, upperArm: 0.24, foreArm: 0.25, neck: 0.06,
  });
  // head sits up and forward of the chest (spine-local +Z is world up once the spine is laid flat)
  rig.head.position.set(0, 0.56, 0.16);
  rig.lArm.position.z = -0.05;
  rig.rArm.position.z = -0.05;
  const glows: Glow[] = [];
  // sun-dark (the dog event text): a darker coat than the sand, so the dogs read at game zoom
  const coatHex = shade(0x6f5640, (r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.08);
  // short sun-dark fur with a darker saddle, smooth-shaded (phase 2)
  const coat = tmat('fur', coatHex, { rough: 0.95, rep: [2, 1] });
  const back = tmat('fur', shade(coatHex, 0, -0.04, -0.14), { rough: 0.95, rep: [2, 1] });
  const belly = tmat('fur', shade(coatHex, 0, -0.04, 0.1), { rough: 0.95, rep: [2, 1] });
  const muzzle = tmat('fur', 0x5a4b3c, { rough: 0.9 });
  const nose = mat(0x1e1a18, 0.5);
  const eye = mat(0x1a1410, 0.3, 0, true, 0x6a4a20, 0.3);

  // body along spine-local +Y (world forward)
  const sp = rig.spine;
  put(sp, ball(0.12, 12, 9), coat, [0, 0.22, 0], undefined, [0.85, 1.9, 0.95]);
  put(sp, ball(0.13, 12, 9), coat, [0, 0.44, -0.03], undefined, [0.9, 1.0, 1.15]);
  put(sp, ball(0.1, 12, 9), back, [0, 0.3, 0.06], undefined, [0.7, 2.0, 0.5]);
  put(sp, ball(0.08, 12, 9), belly, [0, 0.38, -0.1], undefined, [0.7, 1.3, 0.6]);
  put(rig.hips, ball(0.1, 12, 9), coat, [0, 0, 0.02], undefined, [0.9, 0.95, 1.1]);

  const hd = rig.head;
  put(hd, limb(0.055, 0.075, 0.2, 6), coat, [0, 0, 0.02], [-0.7, 0, 0]); // neck
  put(hd, ball(0.08, 7, 5), coat, [0, 0.02, 0], undefined, [0.95, 0.9, 1.05]);
  put(hd, cone(0.05, 0.16, 5), muzzle, [0, -0.01, -0.12], [-Math.PI / 2, 0, 0]);
  put(hd, ball(0.018, 5, 4), nose, [0, 0.0, -0.2]);
  // lower jaw hinges open on 'attack'
  const jaw = new THREE.Object3D();
  jaw.position.set(0, -0.035, -0.04);
  hd.add(jaw);
  put(jaw, box(0.05, 0.02, 0.13), muzzle, [0, -0.005, -0.065]);
  for (const s of S) {
    lit(put(hd, ball(0.012, 4, 3), eye, [s * 0.038, 0.035, -0.068]));
    // one ear stands, one has flopped: tatty rather than fierce
    put(hd, cone(0.03, 0.09, 4), back, [s * 0.045, 0.085, 0.02], s < 0 ? [0, 0, 0.3] : [0.3, 0, -1.1]);
  }

  // forelegs
  for (const s of S) {
    const arm = s < 0 ? rig.lArm : rig.rArm;
    const fore = s < 0 ? rig.lFore : rig.rFore;
    put(arm, limb(0.045, 0.03, 0.24, 5), coat);
    put(fore, limb(0.025, 0.02, 0.25, 5), coat);
    put(fore, ball(0.028, 5, 4), muzzle, [0, -0.25, -0.015], undefined, [1, 0.7, 1.3]);
  }
  // hind legs
  for (const s of S) {
    const leg = s < 0 ? rig.lLeg : rig.rLeg;
    const shin = s < 0 ? rig.lShin : rig.rShin;
    const foot = s < 0 ? rig.lFoot : rig.rFoot;
    put(leg, limb(0.065, 0.04, 0.22, 5), coat);
    put(shin, limb(0.035, 0.025, 0.22, 5), coat);
    put(foot, limb(0.022, 0.02, 0.16, 5), coat);
    put(foot, ball(0.028, 5, 4), muzzle, [0, -0.165, -0.02], undefined, [1, 0.7, 1.3]);
  }
  // tail, carried low
  const tail = new THREE.Object3D();
  tail.position.set(0, 0.03, 0.1);
  tail.rotation.order = 'YXZ';
  rig.hips.add(tail);
  put(tail, limb(0.028, 0.012, 0.32, 5), coat);

  const pose = (o: Pose, c: PoseCtx): boolean => {
    const k = c.clock;
    const legs = (ph: number, amp: number, hind: number[], fore: number[]) => {
      // hind: phase offsets for left/right hind; fore: for left/right front
      for (let i = 0; i < 2; i++) {
        const q = ph + hind[i];
        const leg = i ? J.rLeg : J.lLeg, shin = i ? J.rShin : J.lShin, foot = i ? J.rFoot : J.lFoot;
        add(o, leg, amp * Math.sin(q));
        add(o, shin, -0.4 * Math.max(0, Math.cos(q)));
        add(o, foot, 0.25 * Math.max(0, Math.cos(q)));
        const qf = ph + fore[i];
        const arm = i ? J.rArm : J.lArm, fa = i ? J.rFore : J.lFore;
        add(o, arm, amp * Math.sin(qf));
        add(o, fa, -0.7 * Math.max(0, Math.cos(qf)));
      }
    };
    switch (c.anim) {
      case 'walk': {
        const ph = TAU * DOG.walkHz * c.at;
        legs(ph, DOG.stride, [0, Math.PI], [Math.PI, 0]); // trot: diagonal pairs
        add(o, J.head, 0.05 * Math.sin(ph * 2), 0.05 * Math.sin(ph));
        add(o, J.spine, 0, 0, 0.03 * Math.sin(ph));
        return true;
      }
      case 'run': {
        const ph = TAU * DOG.runHz * c.at;
        legs(ph, DOG.runStride, [0, 0.35], [Math.PI, Math.PI + 0.35]); // gallop
        add(o, J.spine, 0.12 * Math.sin(ph));
        add(o, J.head, -0.12 * Math.sin(ph) - 0.15);
        o[HIPY] += 0.04 * Math.max(0, Math.sin(ph * 2));
        return true;
      }
      case 'attack': {
        const T = [0, 0.3, 0.45, 0.6, 1];
        const q = (v: number[]) => kf(c.p, T, v);
        // gather, lunge, snap, recover
        add(o, J.lLeg, q([0, 0.35, -0.3, -0.3, 0])); add(o, J.rLeg, q([0, 0.35, -0.3, -0.3, 0]));
        add(o, J.lShin, q([0, -0.5, 0.2, 0.2, 0])); add(o, J.rShin, q([0, -0.5, 0.2, 0.2, 0]));
        add(o, J.lArm, q([0, -0.2, 0.7, 0.5, 0])); add(o, J.rArm, q([0, -0.2, 0.6, 0.5, 0]));
        add(o, J.spine, q([0, -0.08, 0.15, 0.1, 0]));
        add(o, J.head, q([0, -0.25, 0.2, -0.1, 0]));
        o[SLIDE] += q([0, 0.08, -0.35, -0.3, 0]);
        o[TUBES] += q([0, 0.3, 1, 0.2, 0]);
        return true;
      }
      case 'hit': {
        const e = kf(c.p, [0, 0.2, 1], [0, 1, 0]);
        add(o, J.head, -0.3 * e, 0.4 * e);
        add(o, J.spine, 0.1 * e, 0, 0.15 * e);
        add(o, J.lShin, -0.3 * e); add(o, J.rShin, -0.3 * e);
        o[SLIDE] += 0.12 * e; o[ROLL] += 0.1 * e;
        return true;
      }
      case 'die': {
        const f = dieCurve(c.p);
        add(o, J.head, 0.3 * f, 0, 0);
        add(o, J.lArm, 0.3 * f); add(o, J.rArm, 0.5 * f);
        add(o, J.lLeg, -0.2 * f); add(o, J.rLeg, 0.2 * f);
        add(o, J.lShin, -0.3 * smooth(c.p / 0.3) * (1 - f)); add(o, J.rShin, -0.3 * smooth(c.p / 0.3) * (1 - f));
        o[ROLL] += DOG.fallZ * f; o[LIFT] += DOG.lieLift * f; o[SIDE] += DOG.lieSide * f;
        o[DIM] += smooth(c.p);
        return true;
      }
      case 'sleep': {
        // curled on the ground, head on the forepaws
        const br = 0.02 * Math.sin(k * 1.4);
        add(o, J.lLeg, 1.3, 0, -0.2); add(o, J.rLeg, 1.2, 0, 0.2);
        add(o, J.lShin, -2.0); add(o, J.rShin, -1.9);
        add(o, J.lFoot, 0.6); add(o, J.rFoot, 0.6);
        add(o, J.lArm, 1.45, 0, 0.05); add(o, J.rArm, 1.35, 0, -0.1);
        add(o, J.lFore, 0.1); add(o, J.rFore, 0.2);
        add(o, J.spine, br, 0.1, 0.25);
        add(o, J.head, -0.55, 0.3);
        o[SIT] += 1;
        return true;
      }
      case 'crouch': {
        // stalking, belly low
        const sw = 0.03 * Math.sin(k * 1.5);
        add(o, J.lLeg, 0.5); add(o, J.rLeg, 0.45);
        add(o, J.lShin, -0.8); add(o, J.rShin, -0.75);
        add(o, J.lFoot, 0.3); add(o, J.rFoot, 0.3);
        add(o, J.lArm, 0.3); add(o, J.rArm, 0.25);
        add(o, J.lFore, -0.6); add(o, J.rFore, -0.55);
        add(o, J.spine, 0.1 + sw); add(o, J.head, -0.25);
        return true;
      }
      default: {
        // idle, talk, channel: panting, glancing about, weight shifting
        const br = Math.sin(k * 5.5);
        add(o, J.spine, 0.01 * br, 0, 0.02 * Math.sin(k * 0.5));
        add(o, J.head, 0.04 * Math.sin(k * 0.37), 0.35 * Math.sin(k * 0.23) * Math.sin(k * 0.09));
        o[TUBES] += 0.25 + 0.1 * br;
        return true;
      }
    }
  };

  const frame = (cur: Pose, c: PoseCtx) => {
    jaw.rotation.x = 0.5 * clamp01(cur[TUBES]);
    const k = c.clock;
    let lift = -0.5, wag = 0.12 * Math.sin(k * 3);
    if (c.anim === 'run') { lift = -1.1; wag = 0.1 * Math.sin(k * 16); }
    else if (c.anim === 'walk') { wag = 0.2 * Math.sin(k * 6); }
    else if (c.anim === 'sleep') { lift = -0.2; wag = 1.2; }
    else if (c.anim === 'hit' || c.anim === 'die' || c.anim === 'crouch') { lift = 0.2; wag = 0; }
    tail.rotation.x += (lift - tail.rotation.x) * 0.15;
    tail.rotation.y += (wag - tail.rotation.y) * 0.25;
  };

  return makeCharModel({
    name: 'dog', rig, style: DOG, glows, height: 0.8,
    phase: r() * 20,
    rest: restPose({
      spine: [-Math.PI / 2, 0, 0],
      head: [Math.PI / 2 - 0.2, 0, 0],
      lArm: [Math.PI / 2 - 0.25, 0, 0], rArm: [Math.PI / 2 - 0.25, 0, 0],
      lFore: [0.3, 0, 0], rFore: [0.3, 0, 0],
      lLeg: [0.45, 0, 0], lShin: [-1.0, 0, 0], lFoot: [0.55, 0, 0],
      rLeg: [0.45, 0, 0], rShin: [-1.0, 0, 0], rFoot: [0.55, 0, 0],
    }),
    pose, frame,
  });
}



/** A knot of branching bone-coral: the Maker body grew it while it was alive (canon). */
function coral(parent: THREE.Object3D, a: THREE.Material, b: THREE.Material, p: [number, number, number], k: number, r: () => number): void {
  const g = new THREE.Object3D();
  g.position.set(p[0], p[1], p[2]);
  parent.add(g);
  for (let i = 0; i < 6; i++) {
    const ang = r() * Math.PI * 2, tilt = 0.4 + r() * 0.8;
    put(g, cone(0.02 * k, (0.08 + r() * 0.08) * k, 4), i % 2 ? a : b, [Math.cos(ang) * 0.02 * k, 0, Math.sin(ang) * 0.02 * k], [Math.sin(ang) * tilt, 0, -Math.cos(ang) * tilt]);
  }
  put(g, ico(0.03 * k, 0), a, [0, 0.01, 0]);
}

// ================================================================= Aza'los repair drone

// Small, teal, precise (canon: Aza'los machines are precise, teal, clean). It tends the cracks in
// the ruin with a thin mending beam. Pale stone shell, no straight lines, a teal lens at the front,
// two slender tool arms underneath. It hovers and moves in small exact steps.
const DRONE: Style = {
  walkHz: 1.0, stride: 0, runHz: 1.3, runStride: 0, armSwing: 0, life: 0.5,
  sleep: 'hover', sitHeight: 0.35, hover: 1.05,
  fallX: 0, fallZ: 0.9, lieLift: 0.12, lieSlide: 0, lieSide: 0,
  lengths: { attack: 0.5, hit: 0.3, die: 1.4 },
};

export function buildDrone(opts: ModelOpts): Model {
  const r = rng(seedOf(opts.seed, opts.name, 'drone'));
  const rig = makeRig({
    thigh: 0, shin: 0, meta: 0, footH: 0, hipW: 0,
    spineLen: 0.05, shoulderW: 0.09, upperArm: 0.2, foreArm: 0.22, neck: 0,
  });
  // arms hang from the belly, not the top of the body
  rig.lArm.position.set(-0.09, -0.08, -0.04);
  rig.rArm.position.set(0.09, -0.08, -0.04);
  rig.head.position.set(0, 0.0, -0.2);
  const glows: Glow[] = [];
  const shellM = tmat('iskari', 0xd6ccb8, { rough: 0.5, metal: 0.05 });
  const inlay = tmat('iskari', 0xc9bca2, { rough: 0.55 });
  const cry = glow(glows, PALETTE.teal, 2.2, true, PALETTE.tealDeep, false);
  const seam = glow(glows, 0x5fe0d0, 1.3, false, 0x1f6f6a, false);
  const beamM = glow(glows, 0x7ff0e0, 3.0, true, 0x2a8a80, false);
  beamM.transparent = true;
  beamM.opacity = 0.85;

  // body: a smooth teardrop lying along the forward axis
  const sp = rig.spine;
  const body = lathe('drone-body', [[0, -0.28], [0.06, -0.24], [0.12, -0.14], [0.15, -0.02], [0.14, 0.08], [0.1, 0.17], [0.05, 0.22], [0, 0.24]], 18);
  put(sp, body, shellM, [0, 0, 0], [-Math.PI / 2, 0, 0], [1, 1, 0.8]);
  // teal seams: two rings round the body
  lit(put(sp, ring(0.148, 0.007, 4, 28), seam, [0, 0, -0.04], undefined, [1, 0.8, 1]));
  lit(put(sp, ring(0.12, 0.006, 4, 24), seam, [0, 0, 0.1], undefined, [1, 0.8, 1]));
  // a crescent fin on the back, like the ruin's arches
  put(sp, ring(0.16, 0.018, 6, 20, Math.PI * 0.9), inlay, [0, 0.1, 0.02], [0, Math.PI / 2, 0], [1, 1, 0.6]);
  lit(put(sp, ring(0.16, 0.006, 4, 20, Math.PI * 0.9), seam, [0, 0.105, 0.02], [0, Math.PI / 2, 0], [1, 1, 0.6]));
  // side petals
  for (const s of S) put(sp, ball(0.1, 12, 8), inlay, [s * 0.14, 0.01, 0.04], [0, s * 0.4, s * 0.5], [0.25, 0.7, 1.2]);
  // a trailing stem under the tail, three small crystals round it
  put(sp, lathe('drone-stem', [[0, -0.2], [0.02, -0.17], [0.04, -0.05], [0.03, 0]], 10), shellM, [0, -0.1, 0.12]);
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    lit(put(sp, octa(0.012), cry, [Math.cos(a) * 0.035, -0.22, 0.12 + Math.sin(a) * 0.035], undefined, [1, 1.6, 1], 'crystal'));
  }

  // the lens: the drone's eye
  const hd = rig.head;
  put(hd, ring(0.055, 0.012, 6, 18), inlay, [0, 0, -0.01]);
  lit(put(hd, octa(0.045), cry, [0, 0, -0.02], [0, 0, Math.PI / 4], [1, 1, 0.5], 'crystal'));

  // tool arms: slender curves ending in fine teal tips
  const tips: THREE.Object3D[] = [];
  for (const s of S) {
    const arm = s < 0 ? rig.lArm : rig.rArm;
    const fore = s < 0 ? rig.lFore : rig.rFore;
    put(arm, ball(0.022, 8, 6), inlay);
    put(arm, limb(0.014, 0.011, 0.2, 6), shellM);
    put(fore, ball(0.016, 8, 6), inlay);
    const g = new THREE.Object3D();
    g.rotation.y = Math.PI / 2;
    fore.add(g);
    put(g, ring(0.13, 0.009, 5, 12, 1.5), shellM, [0.13, 0, 0], [0, 0, Math.PI]);
    const tip = new THREE.Object3D();
    tip.position.set(0, -0.22, -0.06);
    fore.add(tip);
    lit(put(tip, ball(0.012, 6, 4), cry, [0, 0, 0], undefined, undefined, 'crystal'));
    tips.push(tip);
  }
  // the mending beam, from the right tool tip, forward and down
  const beam = new THREE.Object3D();
  tips[1].add(beam);
  const beamMesh = lit(put(beam, cyl(0.006, 0.01, 1, 6).clone().translate(0, -0.5, 0), beamM, [0, 0, 0]));
  beamMesh.userData.keep = true;
  beam.rotation.x = Math.PI / 2 + 0.6;
  beam.scale.set(0.001, 0.001, 0.001);
  const spark = lit(put(beam, ball(0.03, 6, 4), beamM, [0, -1, 0]));
  spark.userData.keep = true;

  let state: 'tending' | 'hostile' | 'dead' = 'tending';
  let level = 1;
  // precise movement: it holds still, then makes one small exact adjustment
  let dartT = -1, dartFrom = [0, 0], dartTo = [0, 0];

  const post = (o: Pose, c: PoseCtx) => {
    const k = c.clock;
    const hostile = state === 'hostile';
    o[HIPY] += 0.035 * Math.sin(k * 1.6);
    const period = hostile ? 0.9 : 2.2;
    const cyc = Math.floor(k / period);
    if (cyc !== dartT) {
      dartT = cyc;
      dartFrom = dartTo;
      const rr = Math.sin(cyc * 12.9898) * 43758.5453;
      const q = rr - Math.floor(rr);
      dartTo = [(q - 0.5) * (hostile ? 0.5 : 0.8), (((q * 7) % 1) - 0.5) * 0.25];
    }
    const e = smooth(((k % period) / period) * 4);
    const yaw = dartFrom[0] + (dartTo[0] - dartFrom[0]) * e;
    const pitch = dartFrom[1] + (dartTo[1] - dartFrom[1]) * e;
    if (c.anim === 'idle' || c.anim === 'talk') add(o, J.head, pitch * 0.4, yaw * 0.6);
    add(o, J.spine, 0, yaw * 0.3);
    // tool arms hang forward, folded
    add(o, J.lArm, 0.5, 0, -0.1); add(o, J.rArm, 0.5, 0, 0.1);
    add(o, J.lFore, 0.6); add(o, J.rFore, 0.6);
    if (c.anim === 'walk' || c.anim === 'run') add(o, J.spine, -0.18);
    if (c.anim === 'channel') {
      add(o, J.rArm, 0.7 + 0.05 * Math.sin(k * 9)); add(o, J.rFore, -0.2);
      add(o, J.lArm, 0.3); add(o, J.spine, -0.2 + 0.02 * Math.sin(k * 3));
      add(o, J.head, 0.25);
    }
    if (c.anim === 'attack') {
      const T = [0, 0.3, 0.45, 1];
      add(o, J.spine, kf(c.p, T, [0, 0.15, -0.35, 0]));
      add(o, J.rArm, kf(c.p, T, [0, -0.3, 1.0, 0])); add(o, J.lArm, kf(c.p, T, [0, -0.3, 0.9, 0]));
      o[SLIDE] += kf(c.p, T, [0, 0.1, -0.25, 0]);
    }
    if (c.anim === 'hit') {
      const e2 = kf(c.p, [0, 0.2, 1], [0, 1, 0]);
      add(o, J.spine, 0.35 * e2, 0.3 * e2, 0.3 * e2);
      o[SLIDE] += 0.2 * e2; o[HIPY] += 0.08 * e2;
    }
    if (c.anim === 'die' || state === 'dead') {
      const f = state === 'dead' && c.anim !== 'die' ? 1 : dieCurve(c.p);
      // drops out of the air onto its side, arms folding in
      o[HIPY] -= 0.92 * f;
      add(o, J.spine, 0.3 * f, 0.6 * f, 0.9 * f);
      add(o, J.lArm, -0.4 * f); add(o, J.rArm, -0.4 * f);
      o[DIM] += c.anim === 'die' ? smooth(c.p) : 1;
    }
  };

  const frame = (_cur: Pose, c: PoseCtx) => {
    const on = c.anim === 'channel' ? 0.8 + 0.2 * Math.sin(c.clock * 30) : c.anim === 'attack' ? (c.p > 0.3 && c.p < 0.75 ? 1.3 : 0) : 0;
    const len = c.anim === 'attack' ? 3.5 : 0.9;
    const want = on > 0 ? len : 0.001;
    beam.scale.y += (want - beam.scale.y) * 0.4;
    beam.scale.x = beam.scale.z = on > 0 ? on : 0.001;
    beam.visible = beam.scale.y > 0.01;
  };

  const glowLevel = (k: number, dt: number) => {
    if (state === 'dead') return 0;
    const want = state === 'hostile' ? 1.35 + 0.15 * Math.sin(k * 6) : 0.85 + 0.1 * Math.sin(k * 1.1);
    level += (want - level) * Math.min(1, dt * 2);
    return level;
  };

  return makeCharModel({
    name: 'drone', rig, style: DRONE, glows, height: 1.4, scale: 1.35,
    phase: r() * 20,
    rest: restPose({}),
    post, frame, glowLevel,
    setState(s) {
      if (s === 'dead' || s === 'broken') state = 'dead';
      else if (s === 'hostile' || s === 'active' || s === 'awake') state = 'hostile';
      else if (s === 'tending' || s === 'friendly' || s === 'dormant' || s === 'asleep') state = 'tending';
    },
  });
}
