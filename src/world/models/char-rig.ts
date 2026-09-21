// A small procedural rig for characters: Object3D joints, pose arrays, crossfaded
// animations, auto-grounding from leg angles, and glow control.
//
// Sign conventions (character faces -Z, its right is +X):
//   spine / head rotation.x < 0  leans forward
//   arm / leg rotation.x > 0     swings the limb forward
//   shin rotation.x < 0          bends the knee
//   fore rotation.x > 0          bends the elbow
import * as THREE from 'three';
import type { AnimName } from '../../core/contracts';
import type { Model } from './types';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TAU, type Glow, type V3 } from './char-kit';
import { stepSway, type Sway } from './char-parts';

// ---------------------------------------------------------------- pose layout

export const J = {
  hips: 0, spine: 1, head: 2,
  lArm: 3, lFore: 4, rArm: 5, rFore: 6,
  lLeg: 7, lShin: 8, lFoot: 9, rLeg: 10, rShin: 11, rFoot: 12,
} as const;
export type JointName = keyof typeof J;
export const NJ = 13;
/** Extra channels after the joint rotations. */
export const HIPY = 39;  // added to the grounded hip height
export const FALL = 40;  // whole-body pitch about the feet (lying down)
export const LIFT = 41;  // whole-body raise (body thickness when lying)
export const SLIDE = 42; // whole-body z offset
export const ROLL = 43;  // whole-body roll about the feet
export const TUBES = 44; // Tel'sharin feeding tubes / dog jaw, 0..1
export const PULSE = 45; // channel pulse on meshes named 'crystal'
export const DIM = 46;   // 0..1, fades every per-instance glow (death)
export const SIT = 47;   // 0..1, hips go to style.sitHeight instead of leg height
export const SIDE = 48;  // whole-body x offset
export const SEAT = 49;  // 0..1, hips go to the seat height (setState('seated'))
export const POSE_LEN = 50;

/** Seat surface height for setState('seated'): the salvage crate top. */
export const SEAT_TOP = 0.62;
/** Anims that keep the seated legs. Anything else stands the character up first. */
const SEATED_ANIMS = new Set<AnimName>(['idle', 'talk', 'hit', 'channel']);
export type Pose = Float32Array;

// ---------------------------------------------------------------- rig

export interface Dims {
  thigh: number; shin: number; meta: number; footH: number; hipW: number;
  spineLen: number; shoulderW: number; upperArm: number; foreArm: number; neck: number;
}

export interface Rig {
  body: THREE.Group;
  hips: THREE.Object3D; spine: THREE.Object3D; head: THREE.Object3D;
  lArm: THREE.Object3D; lFore: THREE.Object3D; lHand: THREE.Object3D;
  rArm: THREE.Object3D; rFore: THREE.Object3D; rHand: THREE.Object3D;
  lLeg: THREE.Object3D; lShin: THREE.Object3D; lFoot: THREE.Object3D;
  rLeg: THREE.Object3D; rShin: THREE.Object3D; rFoot: THREE.Object3D;
  joints: THREE.Object3D[];
  dims: Dims;
}

export function makeRig(d: Dims): Rig {
  const o = (parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const j = new THREE.Bone(); // bones, so sculpted skins can follow them
    j.position.set(x, y, z);
    parent.add(j);
    return j;
  };
  const body = new THREE.Group();
  const hips = o(body);
  const spine = o(hips);
  const head = o(spine, 0, d.spineLen + d.neck, 0);
  const lArm = o(spine, -d.shoulderW, d.spineLen, 0);
  const rArm = o(spine, d.shoulderW, d.spineLen, 0);
  const lFore = o(lArm, 0, -d.upperArm, 0);
  const rFore = o(rArm, 0, -d.upperArm, 0);
  const lHand = o(lFore, 0, -d.foreArm, 0);
  const rHand = o(rFore, 0, -d.foreArm, 0);
  const lLeg = o(hips, -d.hipW, 0, 0);
  const rLeg = o(hips, d.hipW, 0, 0);
  const lShin = o(lLeg, 0, -d.thigh, 0);
  const rShin = o(rLeg, 0, -d.thigh, 0);
  const lFoot = o(lShin, 0, -d.shin, 0);
  const rFoot = o(rShin, 0, -d.shin, 0);
  return {
    body, hips, spine, head, lArm, lFore, lHand, rArm, rFore, rHand,
    lLeg, lShin, lFoot, rLeg, rShin, rFoot,
    joints: [hips, spine, head, lArm, lFore, rArm, rFore, lLeg, lShin, lFoot, rLeg, rShin, rFoot],
    dims: d,
  };
}

export function restPose(r: Partial<Record<JointName, V3>>): Pose {
  const p = new Float32Array(POSE_LEN);
  for (const k of Object.keys(r) as JointName[]) {
    const v = r[k]!;
    p[J[k] * 3] = v[0]; p[J[k] * 3 + 1] = v[1]; p[J[k] * 3 + 2] = v[2];
  }
  return p;
}

// ---------------------------------------------------------------- style

export interface Style {
  walkHz: number; stride: number;
  runHz: number; runStride: number;
  armSwing: number;
  /** Idle motion amount. 1 for people, near 0 for Iskari. */
  life: number;
  quadRun?: boolean;
  idleCrouch?: number;
  sleep: 'sit' | 'crouch' | 'hover';
  sitHeight: number;
  /** If set, hips float at this height instead of standing on legs. */
  hover?: number;
  // how the body lies after 'die'
  fallX: number; fallZ: number; lieLift: number; lieSlide: number; lieSide: number;
  lengths?: Partial<Record<AnimName, number>>;
  /** Hip roll and twist in the walk (wider for female bodies). */
  hipSway?: number;
  /** Shoulder counter-twist in the walk (wider for male bodies). */
  shoulderSway?: number;
}

export interface PoseCtx {
  anim: AnimName; at: number; p: number; clock: number;
  /** Ground speed in metres per second, measured from the root's own motion. */
  speed: number;
}

// ---------------------------------------------------------------- helpers

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
export function add(o: Pose, j: number, x: number, y = 0, z = 0): void {
  o[j * 3] += x; o[j * 3 + 1] += y; o[j * 3 + 2] += z;
}
/** Keyframes with smoothstep between them. */
export function kf(p: number, ts: number[], vs: number[]): number {
  if (p <= ts[0]) return vs[0];
  for (let i = 1; i < ts.length; i++) {
    if (p <= ts[i]) return vs[i - 1] + (vs[i] - vs[i - 1]) * smooth((p - ts[i - 1]) / (ts[i] - ts[i - 1]));
  }
  return vs[vs.length - 1];
}
/** 0 standing, 1 lying. Accelerates like a fall, with a small settle. */
export function dieCurve(p: number): number {
  const q = clamp01((p - 0.15) / 0.5);
  if (p <= 0.65) return q * q;
  const u = (p - 0.65) / 0.35;
  return 1 - 0.07 * Math.sin(u * Math.PI) * (1 - u);
}

// ---------------------------------------------------------------- generic humanoid poses

function legsCycle(o: Pose, ph: number, amp: number, knee: number, base: number): void {
  for (let side = 0; side < 2; side++) {
    const q = ph + side * Math.PI;
    const s = Math.sin(q), c = Math.cos(q);
    const leg = side ? J.rLeg : J.lLeg, shin = side ? J.rShin : J.lShin, foot = side ? J.rFoot : J.lFoot;
    const thigh = amp * s;
    const bend = -(base + knee * Math.max(0, c));
    add(o, leg, thigh);
    add(o, shin, bend);
    add(o, foot, -(thigh + bend) * 0.6);
  }
}

function idle(o: Pose, c: PoseCtx, st: Style): void {
  const L = st.life, k = c.clock;
  const br = Math.sin(k * 1.7);
  const cr = st.idleCrouch ?? 0;
  add(o, J.spine, 0.02 * br * L - 0.2 * cr, 0.04 * Math.sin(k * 0.31) * L, 0.015 * Math.sin(k * 0.5) * L);
  add(o, J.head, -0.015 * br * L + 0.18 * cr + 0.03 * Math.sin(k * 0.43) * L, 0.22 * Math.sin(k * 0.27) * Math.sin(k * 0.11) * L);
  add(o, J.lArm, 0.03 * br * L, 0, -0.02 * br * L);
  add(o, J.rArm, 0.03 * br * L, 0, 0.02 * br * L);
  add(o, J.hips, 0, 0, 0.02 * Math.sin(k * 0.5) * L);
  if (cr) {
    add(o, J.lLeg, 0.35 * cr, 0, -0.05); add(o, J.lShin, -0.62 * cr); add(o, J.lFoot, 0.27 * cr);
    add(o, J.rLeg, 0.22 * cr, 0, 0.05); add(o, J.rShin, -0.45 * cr); add(o, J.rFoot, 0.23 * cr);
    add(o, J.lArm, 0.18 * cr); add(o, J.rArm, 0.12 * cr);
    add(o, J.lFore, 0.3 * cr); add(o, J.rFore, 0.35 * cr);
  }
}

function walk(o: Pose, c: PoseCtx, st: Style): void {
  const ph = TAU * st.walkHz * c.at;
  const s = Math.sin(ph);
  legsCycle(o, ph, st.stride, 0.95, 0.06);
  add(o, J.lArm, -st.armSwing * s); add(o, J.rArm, st.armSwing * s);
  add(o, J.lFore, 0.25 + 0.1 * Math.max(0, -s)); add(o, J.rFore, 0.25 + 0.1 * Math.max(0, s));
  // hips roll over the stance leg and twist with the stride; shoulders counter-twist
  const hs = st.hipSway ?? 0.04, ss = st.shoulderSway ?? 0.05;
  // weight: the hips drop at each footfall (legs apart) and rise as the legs pass
  o[HIPY] += 0.028 * Math.cos(2 * ph) - 0.012;
  add(o, J.hips, 0, hs * 1.2 * s, hs * Math.cos(ph) * 0.8);
  add(o, J.spine, -0.06, (0.08 + ss) * s - hs * 1.2 * s, -hs * Math.cos(ph) * 0.6);
  add(o, J.head, 0.04, -0.06 * s, hs * Math.cos(ph) * 0.3);
}

function run(o: Pose, c: PoseCtx, st: Style): void {
  const ph = TAU * st.runHz * c.at;
  const s = Math.sin(ph);
  if (st.quadRun) {
    // A bounding four-legged run: forelimbs together, hind limbs together.
    add(o, J.spine, -1.3 + 0.06 * Math.sin(ph * 2));
    add(o, J.head, 1.05 - 0.06 * Math.sin(ph * 2));
    const a = 0.5, b = 0.55;
    add(o, J.lArm, 1.3 + a * Math.sin(ph), 0, -0.05);
    add(o, J.rArm, 1.3 + a * Math.sin(ph + 0.5), 0, 0.05);
    add(o, J.lFore, 0.15 + 0.5 * Math.max(0, Math.cos(ph)));
    add(o, J.rFore, 0.15 + 0.5 * Math.max(0, Math.cos(ph + 0.5)));
    for (let side = 0; side < 2; side++) {
      const q = ph + Math.PI + side * 0.5;
      const leg = side ? J.rLeg : J.lLeg, shin = side ? J.rShin : J.lShin, foot = side ? J.rFoot : J.lFoot;
      add(o, leg, 1.0 + b * Math.sin(q));
      add(o, shin, -1.45 - 0.35 * Math.max(0, Math.cos(q)));
      add(o, foot, 0.5);
    }
    return;
  }
  legsCycle(o, ph, st.runStride, 1.5, 0.25);
  add(o, J.lLeg, 0.1); add(o, J.rLeg, 0.1);
  add(o, J.lArm, -st.armSwing * 1.7 * s, 0, -0.08); add(o, J.rArm, st.armSwing * 1.7 * s, 0, 0.08);
  add(o, J.lFore, 1.35); add(o, J.rFore, 1.35);
  add(o, J.spine, -0.22, 0.12 * s);
  add(o, J.head, 0.14, -0.1 * s);
}

function attack(o: Pose, c: PoseCtx): void {
  const T = [0, 0.35, 0.5, 0.62, 1];
  const k = (v: number[]) => kf(c.p, T, v);
  add(o, J.rArm, k([0, 2.5, 0.35, 0.35, 0]), 0, k([0, 0.35, -0.25, -0.25, 0]));
  add(o, J.rFore, k([0, 1.1, 0.1, 0.1, 0]));
  add(o, J.lArm, k([0, -0.25, 0.35, 0.3, 0]), 0, k([0, -0.2, -0.1, -0.1, 0]));
  add(o, J.lFore, k([0, 0.6, 0.4, 0.4, 0]));
  add(o, J.spine, k([0, 0.06, -0.22, -0.2, 0]), k([0, -0.35, 0.35, 0.3, 0]));
  add(o, J.head, k([0, 0, 0.15, 0.12, 0]), k([0, 0.2, -0.25, -0.2, 0]));
  add(o, J.lLeg, k([0, -0.05, 0.4, 0.4, 0])); add(o, J.lShin, k([0, -0.1, -0.35, -0.35, 0]));
  add(o, J.rLeg, k([0, 0.05, -0.25, -0.25, 0])); add(o, J.rShin, k([0, -0.15, -0.1, -0.1, 0]));
  o[TUBES] += k([0, 0.1, 1, 1, 0]);
}

function hit(o: Pose, c: PoseCtx): void {
  const e = kf(c.p, [0, 0.22, 1], [0, 1, 0]);
  // the blow lands: knocked back half a step, knees give a little
  o[SLIDE] += 0.14 * e;
  o[HIPY] -= 0.05 * e;
  add(o, J.spine, 0.3 * e, 0.1 * e);
  add(o, J.head, 0.3 * e, 0, 0.12 * e);
  add(o, J.lArm, 0.5 * e, 0, -0.1 * e); add(o, J.lFore, 1.0 * e);
  add(o, J.rArm, 0.4 * e, 0, 0.1 * e); add(o, J.rFore, 0.9 * e);
  add(o, J.lLeg, 0.15 * e); add(o, J.lShin, -0.28 * e);
  add(o, J.rLeg, 0.1 * e); add(o, J.rShin, -0.22 * e);
}

function die(o: Pose, c: PoseCtx, st: Style): void {
  const p = c.p, f = dieCurve(p), b = smooth(p / 0.25) * (1 - f);
  add(o, J.lLeg, 0.5 * b + 0.12 * f, 0, -0.12 * f); add(o, J.lShin, -0.9 * b - 0.25 * f);
  add(o, J.rLeg, 0.35 * b - 0.05 * f, 0, 0.1 * f); add(o, J.rShin, -0.7 * b - 0.1 * f);
  add(o, J.spine, -0.35 * b + 0.05 * f, 0, 0.05 * f);
  const flail = Math.sin(clamp01((p - 0.15) / 0.55) * Math.PI);
  add(o, J.lArm, 0.3 * b + 0.9 * flail + 0.25 * f, 0, -1.0 * f);
  add(o, J.rArm, 0.2 * b + 0.7 * flail + 0.5 * f, 0, 0.8 * f);
  add(o, J.lFore, 0.4 * b + 0.3 * f); add(o, J.rFore, 0.5 * b + 0.2 * f);
  add(o, J.head, -0.2 * b + 0.15 * f, 0.5 * f);
  o[FALL] += st.fallX * f; o[ROLL] += st.fallZ * f;
  o[LIFT] += st.lieLift * f; o[SLIDE] += st.lieSlide * f; o[SIDE] += st.lieSide * f;
  o[DIM] += smooth(p);
}

function channel(o: Pose, c: PoseCtx): void {
  const k = c.clock, s = Math.sin(k * 2.2);
  add(o, J.lArm, 2.35 + 0.06 * s, 0, -0.35); add(o, J.rArm, 2.35 - 0.06 * s, 0, 0.35);
  add(o, J.lFore, 0.35); add(o, J.rFore, 0.35);
  add(o, J.spine, 0.08 + 0.02 * Math.sin(k * 1.3));
  add(o, J.head, 0.22);
  add(o, J.lLeg, 0, 0, -0.08); add(o, J.rLeg, 0, 0, 0.08);
  o[PULSE] += 1;
}

function sleep(o: Pose, c: PoseCtx, st: Style): void {
  const br = Math.sin(c.clock * 1.1) * 0.03;
  if (st.sleep === 'crouch') {
    add(o, J.lLeg, 0.9, 0, -0.05); add(o, J.lShin, -0.9); add(o, J.lFoot, 0.3);
    add(o, J.rLeg, 0.85, 0, 0.05); add(o, J.rShin, -0.85); add(o, J.rFoot, 0.3);
    add(o, J.spine, -0.55 + br, 0, 0.08); add(o, J.head, -0.45 - br, 0.2);
    add(o, J.lArm, 0.55, 0, 0.1); add(o, J.lFore, 0.2);
    add(o, J.rArm, 0.45, 0, -0.05); add(o, J.rFore, 0.3);
    return;
  }
  if (st.sleep === 'hover') {
    add(o, J.spine, -0.35 + br * 0.5); add(o, J.head, -0.5);
    add(o, J.lArm, 0.15, 0, 0.1); add(o, J.rArm, 0.15, 0, -0.1);
    add(o, J.lFore, 0.2); add(o, J.rFore, 0.2);
    o[SIT] += 1;
    return;
  }
  add(o, J.lLeg, 1.95, 0, -0.1); add(o, J.lShin, -1.35); add(o, J.lFoot, 0.3);
  add(o, J.rLeg, 1.5, 0, 0.15); add(o, J.rShin, -0.15); add(o, J.rFoot, 0.1);
  add(o, J.spine, -0.5 + br); add(o, J.head, -0.4 - br, 0.25);
  add(o, J.lArm, 0.9, 0, -0.1); add(o, J.lFore, 0.5);
  add(o, J.rArm, 0.25, 0, 0.25); add(o, J.rFore, 0.4);
  o[SIT] += 1;
}

function talk(o: Pose, c: PoseCtx, st: Style): void {
  idle(o, c, { ...st, idleCrouch: 0 });
  const k = c.clock, L = Math.max(st.life, 0.5);
  add(o, J.rArm, (0.45 + 0.2 * Math.sin(k * 2.1)) * L, 0, 0.15 * L);
  add(o, J.rFore, (1.1 + 0.35 * Math.sin(k * 3.3 + 1)) * L);
  add(o, J.lArm, 0.12 * L); add(o, J.lFore, 0.35 * L);
  add(o, J.head, 0.06 * Math.sin(k * 2.7) * L, 0.12 * Math.sin(k * 0.9) * L);
  add(o, J.spine, 0, 0.05 * Math.sin(k * 0.9) * L);
}

function crouch(o: Pose, c: PoseCtx, st: Style): void {
  const sw = Math.sin(c.clock * 1.2) * 0.03;
  // 0 standing still, 1 sneaking along
  const m = clamp01(c.speed / 1.1);
  const ph = TAU * st.walkHz * 0.78 * c.at;
  if (m > 0.01) {
    // short steps, knees already bent, feet kept low and flat
    legsCycle(o, ph, st.stride * 0.42 * m, 0.45, 0.95);
    o[HIPY] += 0.012 * Math.cos(2 * ph) * m - 0.01 * m;
    add(o, J.hips, 0, 0.05 * m * Math.sin(ph), 0.03 * m * Math.cos(ph));
  }
  // the still crouch fades out as the step takes over, so the two never fight
  const k = 1 - m;
  add(o, J.lLeg, 1.05 * k + 0.62 * m, 0, -0.06); add(o, J.lShin, -1.65 * k - 0.9 * m); add(o, J.lFoot, 0.6 * k + 0.4 * m);
  add(o, J.rLeg, 0.85 * k + 0.5 * m, 0, 0.06); add(o, J.rShin, -1.45 * k - 0.85 * m); add(o, J.rFoot, 0.6 * k + 0.4 * m);
  add(o, J.spine, -0.45 + sw, sw); add(o, J.head, 0.35 - sw);
  const s = Math.sin(ph) * m;
  add(o, J.lArm, 0.4 - 0.18 * s); add(o, J.rArm, 0.25 + 0.18 * s);
  add(o, J.lFore, 0.8); add(o, J.rFore, 0.8);
}

export function basePose(o: Pose, c: PoseCtx, st: Style): void {
  switch (c.anim) {
    case 'idle': idle(o, c, st); break;
    case 'walk': walk(o, c, st); break;
    case 'run': run(o, c, st); break;
    case 'attack': attack(o, c); break;
    case 'hit': hit(o, c); break;
    case 'die': die(o, c, st); break;
    case 'channel': channel(o, c); break;
    case 'sleep': sleep(o, c, st); break;
    case 'talk': talk(o, c, st); break;
    case 'crouch': crouch(o, c, st); break;
    case 'wake': break; // mixed by the model from sleep and idle
  }
}

// ---------------------------------------------------------------- the model

export interface CharCtl { play(a: AnimName): number; anim(): AnimName }

export interface CharSpec {
  name: string;
  rig: Rig;
  style: Style;
  rest: Pose;
  height: number;
  scale?: number;
  glows: Glow[];
  /** Time offset so a crowd does not breathe in step. */
  phase?: number;
  /** Replace the generic pose. Return true when handled. */
  pose?: (o: Pose, c: PoseCtx) => boolean;
  /** Tweak the pose after the generic one (kind flavour, states). */
  post?: (o: Pose, c: PoseCtx) => void;
  /** Runs after joints are posed: tubes, tails, anything not in the pose array. */
  frame?: (cur: Pose, c: PoseCtx, dt: number) => void;
  /** State multiplier on all per-instance glows. */
  glowLevel?: (clock: number, dt: number) => number;
  setState?: (state: string, ctl: CharCtl) => void;
  /** What to return to after a one-shot. Defaults to 'idle'. */
  restAnim?: () => AnimName;
  /**
   * Humanoids only: enables setState('seated' | 'standing').
   * hipDrop is the hip joint height above the seat (pelvis thickness).
   * stoop leans the upper body; knees puts the forearms on the knees instead of the thighs.
   */
  seat?: { hipDrop: number; stoop: number; knees: boolean };
  /** Cloth, hair and tubes that hang and trail. */
  sway?: Sway[];
}

/** Seated legs (absolute, replacing rest) and an upper-body lean, written into a pose. */
function seatPose(o: Pose, d: Dims, seat: NonNullable<CharSpec['seat']>, anim: AnimName, w: number, scale: number): void {
  const hip = SEAT_TOP / scale + seat.hipDrop;
  // thigh angle that lets a vertical shin put the foot on the ground
  const a = Math.acos(Math.min(1, Math.max(0, (hip - d.shin - d.meta - d.footH) / d.thigh)));
  const legs: Array<[number, number, number, number]> = [[J.lLeg, J.lShin, J.lFoot, -1], [J.rLeg, J.rShin, J.rFoot, 1]];
  for (const [leg, shin, foot, s] of legs) {
    o[leg * 3] = a; o[leg * 3 + 1] = 0; o[leg * 3 + 2] = 0.09 * s;
    o[shin * 3] = -a; o[shin * 3 + 1] = 0; o[shin * 3 + 2] = -0.09 * s;
    o[foot * 3] = 0; o[foot * 3 + 1] = 0; o[foot * 3 + 2] = 0;
  }
  o[0] = 0; o[1] = 0; o[2] = 0;
  o[SEAT] = w;
  add(o, J.spine, -seat.stoop);
  add(o, J.head, seat.stoop * 0.8);
  if (anim === 'channel') return;
  // forearms rest on the knees (stooped) or hands on the thighs
  const armX = seat.knees ? 0.35 + seat.stoop : 0.3, foreX = seat.knees ? 1.15 : 0.85;
  add(o, J.lArm, armX, 0, 0.06); add(o, J.lFore, foreX);
  if (anim !== 'talk') { add(o, J.rArm, armX, 0, -0.06); add(o, J.rFore, foreX); }
}

const DEFAULT_LEN: Partial<Record<AnimName, number>> = { attack: 0.6, hit: 0.35, die: 1.2, wake: 1.0 };

export function makeCharModel(spec: CharSpec): Model {
  const { rig, style, rest } = spec;
  const lengths = { ...DEFAULT_LEN, ...style.lengths };
  const root = new THREE.Group();
  root.name = spec.name;
  const scaler = new THREE.Group();
  scaler.scale.setScalar(spec.scale ?? 1);
  scaler.add(rig.body);
  root.add(scaler);

  const cur = new Float32Array(POSE_LEN);
  const from = new Float32Array(POSE_LEN);
  const tgt = new Float32Array(POSE_LEN);
  const A = new Float32Array(POSE_LEN);
  const B = new Float32Array(POSE_LEN);
  const ctx: PoseCtx = { anim: 'idle', at: 0, p: 0, clock: spec.phase ?? 0, speed: 0 };

  const _wp = new THREE.Vector3();
  let lastX = 0, lastZ = 0, hadPos = false;
  let anim: AnimName = spec.restAnim?.() ?? 'idle';
  let at = 0, len = 0, fade = 1, fadeDur = 0.2;
  let clock = spec.phase ?? 0;
  let seated = false;

  function compute(out: Pose, a: AnimName, p: number): void {
    out.fill(0);
    ctx.anim = a; ctx.at = at; ctx.p = p; ctx.clock = clock;
    if (!spec.pose?.(out, ctx)) basePose(out, ctx, style);
    spec.post?.(out, ctx);
  }

  function target(): void {
    const p = len > 0 ? clamp01(at / len) : 0;
    if (anim === 'wake') {
      compute(A, 'sleep', p);
      compute(B, 'idle', p);
      const u = smooth(p);
      for (let i = 0; i < POSE_LEN; i++) tgt[i] = A[i] + (B[i] - A[i]) * u;
    } else {
      compute(tgt, anim, p);
    }
    for (let i = 0; i < POSE_LEN; i++) tgt[i] += rest[i];
    if (seated && spec.seat) seatPose(tgt, rig.dims, spec.seat, anim, 1, spec.scale ?? 1);
    ctx.anim = anim; ctx.p = p;
  }

  function apply(): void {
    const js = rig.joints;
    for (let i = 0; i < NJ; i++) js[i].rotation.set(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]);
    const d = rig.dims;
    let ground: number;
    if (style.hover !== undefined) {
      ground = style.hover;
    } else {
      const hx = cur[0];
      const ext = (leg: number) => {
        const a1 = hx + cur[leg * 3], a2 = a1 + cur[(leg + 1) * 3], a3 = a2 + cur[(leg + 2) * 3];
        return (d.thigh * Math.cos(a1) + d.shin * Math.cos(a2) + d.meta * Math.cos(a3)) * Math.cos(cur[leg * 3 + 2]) + d.footH;
      };
      ground = Math.max(ext(J.lLeg), ext(J.rLeg));
    }
    const seat = clamp01(cur[SEAT]);
    if (spec.seat) ground += (SEAT_TOP / (spec.scale ?? 1) + spec.seat.hipDrop - ground) * seat;
    const sit = clamp01(cur[SIT]);
    ground += (style.sitHeight - ground) * sit;
    rig.hips.position.y = ground + cur[HIPY];
    rig.body.rotation.set(cur[FALL], 0, cur[ROLL]);
    rig.body.position.set(cur[SIDE], cur[LIFT], cur[SLIDE]);
  }

  function glows(dt: number): void {
    const lvl = spec.glowLevel?.(clock, dt) ?? 1;
    const pulse = cur[PULSE];
    const dim = 1 - clamp01(cur[DIM]);
    const beat = 0.6 + 0.6 * Math.sin(clock * 7);
    for (const g of spec.glows) {
      g.mat.emissiveIntensity = g.base * lvl * dim * (g.crystal ? 1 + pulse * beat : 1);
    }
  }

  function play(a: AnimName): number {
    const oneShot = lengths[a] ?? 0;
    if (a === anim && oneShot === 0) return 0; // a loop that is already running
    // told to move or fight while seated: stand up on the way (a longer blend)
    const standUp = seated && !SEATED_ANIMS.has(a);
    if (standUp) seated = false;
    from.set(cur);
    anim = a; at = 0; len = oneShot; fade = 0;
    fadeDur = a === 'hit' ? 0.06 : a === 'attack' ? 0.1 : a === 'die' ? 0.12 : a === 'wake' ? 0.05 : 0.22;
    if (standUp) fadeDur = Math.max(fadeDur, 0.4);
    return len;
  }

  const ctl: CharCtl = { play, anim: () => anim };

  // settle into the first pose with no blend
  target();
  cur.set(tgt);
  from.set(tgt);
  apply();
  glows(0);
  spec.frame?.(cur, ctx, 0);

  mergeStatic(root);
  const pickables: THREE.Object3D[] = [];
  root.traverse((ob) => {
    const m = ob as THREE.Mesh;
    if (!m.isMesh) return;
    pickables.push(ob);
    // tell the world light layer to leave glowing parts alone (agreed with agent A)
    // people and creatures are never cut by the see-through circle round the player (user playtest, phase 2)
    const list = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[];
    for (const mt of list) {
      mt.userData.noOcc = true;
      if (mt.userData.glow || (mt.emissiveIntensity > 0 && mt.emissive && mt.emissive.getHex() !== 0 && !mt.emissiveMap)) {
        if (!Array.isArray(m.material)) m.userData.glow = true;
        mt.userData.glow = true;
      }
    }
  });

  return {
    root,
    height: spec.height * (spec.scale ?? 1),
    pickables,
    play,
    update(dt: number) {
      dt = Math.min(Math.max(dt, 0), 0.1);
      clock += dt; at += dt;
      if (dt > 0) {
        root.getWorldPosition(_wp);
        if (hadPos) {
          const d = Math.hypot(_wp.x - lastX, _wp.z - lastZ) / dt;
          ctx.speed += (Math.min(d, 8) - ctx.speed) * Math.min(1, dt * 8);
        }
        lastX = _wp.x; lastZ = _wp.z; hadPos = true;
      }
      if (len > 0 && at >= len && anim !== 'die') play(spec.restAnim?.() ?? 'idle');
      target();
      fade = fadeDur > 0 ? Math.min(1, fade + dt / fadeDur) : 1;
      const w = smooth(fade);
      for (let i = 0; i < POSE_LEN; i++) cur[i] = from[i] + (tgt[i] - from[i]) * w;
      apply();
      glows(dt);
      spec.frame?.(cur, ctx, dt);
      if (spec.sway) stepSway(spec.sway, dt, clock);
    },
    setState: spec.setState || spec.seat ? (s: string) => {
      if (spec.seat && (s === 'seated' || s === 'standing')) {
        const want = s === 'seated';
        if (want === seated) return;
        seated = want;
        if (want && !SEATED_ANIMS.has(anim)) { anim = 'idle'; at = 0; len = 0; }
        from.set(cur); fade = 0; fadeDur = 0.6;
        return;
      }
      spec.setState?.(s, ctl);
    } : undefined,
    dispose() {
      for (const g of spec.glows) g.mat.dispose();
    },
  };
}

// ---------------------------------------------------------------- draw call merging

/**
 * Merge the static meshes under each joint that share a material into one mesh.
 * Only direct mesh children of one parent merge, so pivots that move stay separate.
 * Mark a mesh `userData.keep = true` to leave it alone.
 */
export function mergeStatic(root: THREE.Object3D): void {
  const parents: THREE.Object3D[] = [];
  root.traverse((o) => { if (!(o as THREE.Mesh).isMesh) parents.push(o); });
  for (const par of parents) {
    const groups = new Map<string, THREE.Mesh[]>();
    for (const c of par.children) {
      const m = c as THREE.Mesh;
      if (!m.isMesh || m.children.length || m.userData.keep || Array.isArray(m.material)) continue;
      const k = `${(m.material as THREE.Material).uuid}|${m.castShadow ? 1 : 0}`;
      let g = groups.get(k);
      if (!g) groups.set(k, (g = []));
      g.push(m);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const gs: THREE.BufferGeometry[] = [];
      for (const m of list) {
        m.updateMatrix();
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
        if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
        if (!g.getAttribute('normal')) g.computeVertexNormals();
        g.morphAttributes = {};
        g.applyMatrix4(m.matrix);
        gs.push(g);
      }
      const merged = mergeGeometries(gs, false);
      for (const g of gs) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, list[0].material);
      mesh.castShadow = list[0].castShadow;
      mesh.receiveShadow = true;
      mesh.name = list.find((m) => m.name)?.name ?? '';
      for (const m of list) par.remove(m);
      par.add(mesh);
    }
  }
}
