// Sculpted people: Mi'naa, Sehari and Iskari, male and female bodies, the named NPCs and the
// defensive-line Iskari. Each body is one continuous skinned skin built by char-sdf.ts, with the
// head, hands and feet sculpted finer as rigid pieces on their bones. Clothing is part of the skin:
// body shapes inflated a little and cut by planes. Swinging cloth, hair locks, straps and gear
// are small rigid or swaying pieces on top.
//
// References (read them before changing proportions):
//   Mi'naa: source/reference-images/mi-naa-tinker-pair.png, images/generated/scene-minaa-water-holders.png
//   Sehari: images/generated/sehari-*.png, source/reference-images/sehari-upright-and-quadrupedal-pair.png
//   Iskari: images/generated/iskari-*.png, source/reference-images/iskari-menders-pair.png
//   Defender: images/generated/iskari-woken-defensive-azalos-v2.png, iskari-woken-defensive-unit-study.png
import * as THREE from 'three';
import { CRYSTAL_HEX, PALETTE, type Model, type ModelOpts } from './types';
import { ball, box, cone, cyl, glow, ico, lit, octa, put, ring, rng, seedOf, shade, pick, type Glow } from './char-kit';
import {
  J, add, kf, makeCharModel, makeRig, restPose, type CharSpec, type Dims, type Pose, type PoseCtx, type Rig, type Style,
} from './char-rig';
import { panel, swayPivot, tube, type Sway } from './char-parts';
import { sculpt, type Prim, type V3 } from './char-sdf';
import { smat, makeSmat } from './char-shade';
import { tex } from './char-tex';

export type Body = 'male' | 'female';
export type Race = 'minaa' | 'sehari' | 'iskari' | 'telsharin';
const S = [-1, 1] as const;

// ================================================================= builds

/** Body measurements in metres (half widths and radii). */
interface Build {
  dims: Dims;
  chestW: number; chestD: number; waistW: number; waistD: number; hipW: number; hipD: number;
  neckR: number; armR: number; elbowR: number; foreR: number; wristR: number;
  thighR: number; kneeR: number; calfR: number; ankleR: number;
  /** 0 lean .. 1 heavily muscled: pecs, biceps, calves. */
  muscle: number;
  bust: number;
  /** Hand size and finger length multipliers. */
  hand: number; finger: number;
  head: { w: number; h: number; d: number; jaw: number; brow: number; cheek: number; chin: number };
  height: number;
}

function build(race: Race, body: Body, look: string): Build {
  const b = build0(race, body, look);
  const k = race === 'telsharin' || look === 'defender' ? 1.08 : 1.15;
  b.head = { ...b.head, w: b.head.w * k, h: b.head.h * k, d: b.head.d * k };
  return b;
}

function build0(race: Race, body: Body, look: string): Build {
  const f = body === 'female';
  const heavy = look === 'hadda' || look === 'tarn' || look === 'digger';
  if (race === 'telsharin') {
    // telsharin-warden-pair-*.png: tall and lean, a narrow waist between chest armour and hip armour,
    // long arms, backward-bending legs on long feet. This is the dark core: armour plates sit on top.
    return {
      dims: { thigh: 0.5, shin: 0.5, meta: 0.3, footH: 0.04, hipW: 0.115, spineLen: 0.62, shoulderW: 0.215, upperArm: 0.4, foreArm: 0.4, neck: 0.14 },
      chestW: 0.19, chestD: 0.13, waistW: 0.085, waistD: 0.07, hipW: 0.13, hipD: 0.1,
      neckR: 0.036, armR: 0.042, elbowR: 0.038, foreR: 0.04, wristR: 0.028,
      thighR: 0.07, kneeR: 0.05, calfR: 0.045, ankleR: 0.032,
      muscle: 0.1, bust: 0, hand: 1.25, finger: 1.5,
      head: { w: 0.092, h: 0.12, d: 0.11, jaw: 1, brow: 0, cheek: 0, chin: 0 },
      height: 2.1,
    };
  }
  if (look === 'defender') {
    return {
      dims: { thigh: 0.64, shin: 0.56, meta: 0.19, footH: 0.04, hipW: 0.13, spineLen: 0.66, shoulderW: 0.29, upperArm: 0.41, foreArm: 0.37, neck: 0.1 },
      chestW: 0.25, chestD: 0.16, waistW: 0.19, waistD: 0.13, hipW: 0.2, hipD: 0.14,
      neckR: 0.085, armR: 0.1, elbowR: 0.075, foreR: 0.085, wristR: 0.055,
      thighR: 0.13, kneeR: 0.08, calfR: 0.09, ankleR: 0.05,
      muscle: 1, bust: 0, hand: 1.35, finger: 1.1,
      head: { w: 0.088, h: 0.115, d: 0.11, jaw: 1, brow: 1.3, cheek: 1, chin: 0.9 },
      height: 2.5,
    };
  }
  if (race === 'minaa') {
    const w = heavy ? 1.14 : 1;
    return f ? {
      dims: { thigh: 0.42, shin: 0.4, meta: 0, footH: 0.075, hipW: 0.095, spineLen: 0.47, shoulderW: 0.175, upperArm: 0.28, foreArm: 0.245, neck: 0.1 },
      chestW: 0.135 * w, chestD: 0.095 * w, waistW: 0.105 * w * w, waistD: 0.08 * w, hipW: 0.16 * w, hipD: 0.115 * w,
      neckR: 0.04, armR: 0.042 * w, elbowR: 0.03, foreR: 0.035 * w, wristR: 0.024,
      thighR: 0.085 * w, kneeR: 0.048, calfR: 0.052, ankleR: 0.03,
      muscle: 0.25, bust: heavy ? 0.07 : 0.058, hand: 0.9, finger: 1,
      head: { w: 0.075, h: 0.1, d: 0.094, jaw: 0.3, brow: 0.5, cheek: 1.1, chin: 0.8 },
      height: 1.66,
    } : {
      dims: { thigh: 0.45, shin: 0.43, meta: 0, footH: 0.08, hipW: 0.1, spineLen: 0.53, shoulderW: 0.205 * w, upperArm: 0.3, foreArm: 0.265, neck: 0.11 },
      chestW: 0.165 * w, chestD: 0.11 * w, waistW: 0.14 * w * w, waistD: 0.1 * w, hipW: 0.145 * w, hipD: 0.11 * w,
      neckR: 0.052, armR: 0.052 * w, elbowR: 0.038, foreR: 0.045 * w, wristR: 0.029,
      thighR: 0.085 * w, kneeR: 0.053, calfR: 0.058, ankleR: 0.034,
      muscle: heavy ? 0.5 : 0.75, bust: 0, hand: 1.05, finger: 1,
      head: { w: 0.08, h: 0.106, d: 0.1, jaw: 0.9, brow: 1, cheek: 0.8, chin: 1 },
      height: 1.78,
    };
  }
  if (race === 'sehari') {
    // lean, long-limbed; arms reach nearer the knee than a human's (canon)
    return f ? {
      dims: { thigh: 0.47, shin: 0.46, meta: 0, footH: 0.07, hipW: 0.09, spineLen: 0.47, shoulderW: 0.16, upperArm: 0.43, foreArm: 0.42, neck: 0.17 },
      chestW: 0.12, chestD: 0.085, waistW: 0.09, waistD: 0.07, hipW: 0.14, hipD: 0.1,
      neckR: 0.034, armR: 0.034, elbowR: 0.025, foreR: 0.028, wristR: 0.019,
      thighR: 0.07, kneeR: 0.042, calfR: 0.043, ankleR: 0.025,
      muscle: 0.3, bust: 0.045, hand: 1, finger: 1.45,
      head: { w: 0.068, h: 0.105, d: 0.095, jaw: 0.1, brow: 0.6, cheek: 1.4, chin: 1.2 },
      height: 1.8,
    } : {
      dims: { thigh: 0.49, shin: 0.48, meta: 0, footH: 0.07, hipW: 0.09, spineLen: 0.51, shoulderW: 0.185, upperArm: 0.45, foreArm: 0.44, neck: 0.18 },
      chestW: 0.14, chestD: 0.095, waistW: 0.105, waistD: 0.08, hipW: 0.125, hipD: 0.095,
      neckR: 0.042, armR: 0.04, elbowR: 0.029, foreR: 0.033, wristR: 0.022,
      thighR: 0.072, kneeR: 0.046, calfR: 0.048, ankleR: 0.028,
      muscle: 0.55, bust: 0, hand: 1.1, finger: 1.45,
      head: { w: 0.071, h: 0.11, d: 0.098, jaw: 0.4, brow: 0.9, cheek: 1.4, chin: 1.2 },
      height: 1.9,
    };
  }
  // Iskari serving line: tall, very lean, long neck, digitigrade legs (iskari-menders-pair.png)
  const old = look === 'apprentice';
  return f ? {
    dims: { thigh: 0.49, shin: 0.44, meta: 0.14, footH: 0.035, hipW: 0.095, spineLen: 0.52, shoulderW: 0.17, upperArm: 0.36, foreArm: 0.33, neck: 0.14 },
    chestW: 0.125, chestD: 0.085, waistW: 0.09, waistD: 0.07, hipW: 0.14, hipD: 0.1,
    neckR: 0.036, armR: 0.036, elbowR: 0.028, foreR: 0.03, wristR: 0.021,
    thighR: 0.07, kneeR: 0.042, calfR: 0.042, ankleR: 0.026,
    muscle: 0.2, bust: 0.04, hand: 1, finger: 1.15,
    head: { w: 0.07, h: 0.108, d: 0.1, jaw: 0.5, brow: 0.8, cheek: 1.2, chin: 1 },
    height: 1.96,
  } : {
    dims: { thigh: 0.51, shin: 0.46, meta: 0.15, footH: 0.035, hipW: 0.1, spineLen: 0.57, shoulderW: 0.21, upperArm: 0.38, foreArm: 0.35, neck: 0.14 },
    chestW: 0.16, chestD: 0.1, waistW: 0.115, waistD: 0.085, hipW: 0.13, hipD: 0.095,
    neckR: 0.046, armR: 0.044, elbowR: 0.033, foreR: 0.037, wristR: 0.025,
    thighR: 0.075, kneeR: 0.045, calfR: 0.046, ankleR: 0.028,
    muscle: old ? 0.25 : 0.55, bust: 0, hand: 1.1, finger: 1.15,
    head: { w: 0.076, h: 0.114, d: 0.104, jaw: 1, brow: 1.1, cheek: 1, chin: 1 },
    height: old ? 1.98 : 2.04,
  };
}

// ================================================================= material slots

export const M = {
  skin: 0, marked: 1, top: 2, bottom: 3, leather: 4, sash: 5, hair: 6, nail: 7, metal: 8, brass: 9, robe: 10, trim: 11, lip: 12,
} as const;
const NMAT = 13;

// ================================================================= the sculpt context

export interface Ctx {
  race: Race; body: Body; look: string; f: boolean; B: Build; rig: Rig; r: () => number;
  /** Bind-pose joint positions, body space. */
  j: Record<string, V3>;
  prims: Prim[];
  mats: THREE.Material[];
  glows: Glow[]; sway: Sway[];
  /** Clothing flags, part of the cache key. */
  key: string[];
}

const v3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const plus = (a: V3, x: number, y: number, z: number): V3 => [a[0] + x, a[1] + y, a[2] + z];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function cap(c: Ctx, a: V3, b: V3, r: number, r2: number, bone: number, mat: number, k: number, tag?: string): Prim {
  const p: Prim = { kind: 'cap', a, b, r, r2, bone, mat, k, tag };
  c.prims.push(p);
  return p;
}
function ell(c: Ctx, a: V3, s: V3, bone: number, mat: number, k: number, tag?: string, rot?: V3): Prim {
  const p: Prim = { kind: 'ell', a, s, bone, mat, k, tag, rot };
  c.prims.push(p);
  return p;
}
/** A plane cut that keeps the part of a shape before `at` along `dir`. */
const keepBefore = (at: V3, dir: V3) => { const n = norm(dir); return { n, o: dot3(at, n) }; };

/**
 * Clothing: copy every body shape whose tag is listed, inflated by `t`, in material `mat`, with cuts.
 * The copy wins the surface wherever it is outside the skin, so hems end in a small real step.
 */
function layer(c: Ctx, tags: string[], t: number, mat: number, clip: Array<{ n: V3; o: number }> = [], k = 0.02, grow: Record<string, number> = {}): void {
  const add: Prim[] = [];
  for (const p of c.prims) {
    if (!p.tag || !tags.includes(p.tag) || p.sub) continue;
    const g = t + (grow[p.tag] ?? 0);
    const q: Prim = { ...p, mat, k: Math.max(p.k, k), clip: [...(p.clip ?? []), ...clip], tag: 'cloth:' + p.tag };
    if (q.kind === 'cap') { q.r = p.r! + g; q.r2 = (p.r2 ?? p.r!) + g; }
    else q.s = [p.s![0] + g, p.s![1] + g, p.s![2] + g];
    add.push(q);
  }
  c.prims.push(...add);
}

// ================================================================= body sculpt

function sculptBody(c: Ctx): void {
  const { B, j, f } = c;
  const d = B.dims;
  const y0 = 0, yS = d.spineLen;
  const m = B.muscle;
  const skin = M.skin;
  // pelvis and seat
  ell(c, [0, y0 - 0.02, 0.005], [B.hipW, 0.1, B.hipD], J.hips, skin, 0.05, 'pelvis');
  for (const s of S) ell(c, [s * B.hipW * 0.45, y0 - 0.07, B.hipD * 0.5], [B.hipW * 0.52, 0.085, B.hipD * 0.55], J.hips, skin, 0.04, 'pelvis');
  // belly, ribcage, upper chest
  ell(c, [0, y0 + 0.13, 0], [B.waistW, 0.12, B.waistD], J.spine, skin, 0.07, 'belly');
  ell(c, [0, y0 + d.spineLen * 0.6, 0.008], [B.chestW, d.spineLen * 0.33, B.chestD], J.spine, skin, 0.07, 'chest');
  ell(c, [0, yS - 0.06, 0.012], [B.chestW * 0.96, 0.085, B.chestD * 0.82], J.spine, skin, 0.06, 'chest');
  if (!f && m > 0.3) for (const s of S) ell(c, [s * B.chestW * 0.42, yS - 0.11, -B.chestD * 0.55], [B.chestW * 0.46, 0.055 + 0.01 * m, 0.035 + 0.012 * m], J.spine, skin, 0.035, 'chest');
  if (B.bust > 0) for (const s of S) ell(c, [s * B.chestW * 0.42, yS - 0.155, -B.chestD * 0.62], [B.bust, B.bust * 0.95, B.bust * 0.85], J.spine, skin, 0.04, 'chest', [0.2, s * 0.25, 0]);
  // shoulders: trapezius yoke and neck
  cap(c, [-d.shoulderW * 0.72, yS + 0.005, 0.015], [d.shoulderW * 0.72, yS + 0.005, 0.015], 0.04 + 0.01 * m, 0.04 + 0.01 * m, J.spine, skin, 0.06, 'yoke');
  cap(c, [0, yS - 0.04, 0.012], [0, yS + d.neck * 0.55, 0.004], B.neckR * 1.15, B.neckR, J.spine, skin, 0.05, 'neck');
  cap(c, [0, yS + d.neck * 0.35, 0.004], [0, yS + d.neck + 0.03, 0.012], B.neckR, B.neckR * 0.95, J.head, skin, 0.04, 'neck');
  // arms
  for (const s of S) {
    const [arm, fore] = s < 0 ? [J.lArm, J.lFore] : [J.rArm, J.rFore];
    const sh = j[s < 0 ? 'lArm' : 'rArm'], el = j[s < 0 ? 'lFore' : 'rFore'], wr = j[s < 0 ? 'lHand' : 'rHand'];
    const mk = s < 0 ? M.marked : skin; // Sehari: the root markings run down the left arm
    const armDir = norm(sub3(el, sh));
    ell(c, plus(sh, s * 0.012, -0.02, 0), [B.armR * 1.3, B.armR * 1.45, B.armR * 1.2], arm, mk, 0.045, 'uarm', [0, 0, s * 0.55]);
    cap(c, sh, el, B.armR, B.elbowR, arm, mk, 0.03, 'uarm');
    if (m > 0.2) ell(c, plus(v3(sh, el, 0.5), 0, 0, -0.014), [B.armR * (0.7 + 0.25 * m), 0.075, B.armR * (0.65 + 0.25 * m)], arm, mk, 0.03, 'uarm', [0, 0, s * 0.55]);
    cap(c, el, wr, B.foreR, B.wristR, fore, mk, 0.03, 'farm');
    ell(c, plus(v3(el, wr, 0.28), 0, 0, -0.005), [B.foreR * 1.05, 0.08, B.foreR * 0.95], fore, mk, 0.03, 'farm', [0, 0, s * 0.55]);
    void armDir;
  }
  // legs
  for (const s of S) {
    const [leg, shin] = s < 0 ? [J.lLeg, J.lShin] : [J.rLeg, J.rShin];
    const hp = j[s < 0 ? 'lLeg' : 'rLeg'], kn = j[s < 0 ? 'lShin' : 'rShin'], an = j[s < 0 ? 'lFoot' : 'rFoot'];
    const mk = s > 0 ? M.marked : skin; // and down the right leg
    cap(c, plus(hp, 0, 0.02, 0), kn, B.thighR, B.kneeR, leg, mk, 0.05, 'thigh');
    ell(c, plus(v3(hp, kn, 0.42), 0, 0, -0.018), [B.thighR * 0.88, d.thigh * 0.3, B.thighR * 0.8], leg, mk, 0.035, 'thigh');
    ell(c, plus(kn, 0, 0.01, -0.012), [B.kneeR * 0.95, 0.04, B.kneeR * 0.9], shin, mk, 0.025, 'shin');
    cap(c, kn, an, B.kneeR * 0.92, B.ankleR, shin, mk, 0.03, 'shin');
    ell(c, plus(v3(kn, an, 0.28), 0, 0, 0.018), [B.calfR * 0.9, d.shin * 0.2, B.calfR * 0.85], shin, mk, 0.03, 'shin');
  }
}

// ================================================================= clothing, per race and look

interface Pal { top: number; bottom: number; robe?: number; sash?: number; trim?: number }

function dressBody(c: Ctx): Pal {
  const { B, j, f, look, race, r } = c;
  const d = B.dims;
  const yS = d.spineLen;
  const ankle = (s: number) => j[s < 0 ? 'lFoot' : 'rFoot'];
  const knee = (s: number) => j[s < 0 ? 'lShin' : 'rShin'];
  const elbow = (s: number) => j[s < 0 ? 'lFore' : 'rFore'];
  const shoulder = (s: number) => j[s < 0 ? 'lArm' : 'rArm'];
  /** Trouser legs down to a fraction of the shin, for both legs. */
  const trousers = (t: number, shinFrac: number, baggy = 0) => {
    layer(c, ['pelvis', 'thigh'], t, M.bottom, [], 0.02, { thigh: baggy * 0.4 });
    for (const s of S) {
      const kn = knee(s), an = ankle(s);
      const cut = v3(kn, an, shinFrac);
      const q = c.prims.filter((p) => p.tag === 'shin' && (p.bone === (s < 0 ? J.lShin : J.rShin)));
      for (const p of q) {
        const cl: Prim = { ...p, mat: M.bottom, tag: 'cloth:shin', clip: [keepBefore(cut, sub3(an, kn))], k: Math.max(p.k, 0.02) };
        if (cl.kind === 'cap') { cl.r = p.r! + t + baggy; cl.r2 = (p.r2 ?? p.r!) + t + baggy; } else cl.s = [p.s![0] + t + baggy, p.s![1] + t, p.s![2] + t + baggy];
        c.prims.push(cl);
      }
    }
  };
  /** A top over the torso from `low` (height above the hips joint) up. */
  const top = (t: number, low: number, mat: number = M.top) => layer(c, ['belly', 'chest', 'yoke', 'pelvis'], t, mat, [{ n: [0, -1, 0], o: -low }]);
  const sleeves = (t: number, frac: number, mat: number = M.top) => {
    for (const s of S) {
      const sh = shoulder(s), el = elbow(s), wr = j[s < 0 ? 'lHand' : 'rHand'];
      const cut = frac <= 1 ? v3(sh, el, frac) : v3(el, wr, frac - 1);
      const dir = frac <= 1 ? sub3(el, sh) : sub3(wr, el);
      const tags = frac <= 1 ? ['uarm'] : ['uarm', 'farm'];
      const bones: number[] = s < 0 ? [J.lArm, J.lFore] : [J.rArm, J.rFore];
      for (const p of c.prims.filter((q) => q.tag && tags.includes(q.tag) && bones.includes(q.bone))) {
        const cl: Prim = { ...p, mat, tag: 'cloth:sleeve', clip: [keepBefore(cut, dir)], k: Math.max(p.k, 0.02) };
        if (cl.kind === 'cap') { cl.r = p.r! + t; cl.r2 = (p.r2 ?? p.r!) + t; } else cl.s = [p.s![0] + t, p.s![1] + t, p.s![2] + t];
        c.prims.push(cl);
      }
    }
  };
  /** A skirt, kilt or robe hanging from the waist, flaring to `rb` at `len` below the hips joint. */
  const skirt = (top: number, len: number, rt: number, rb: number, mat: number, depth = 0.85) => {
    c.prims.push({ kind: 'cap', a: [0, top, 0.005], b: [0, -len, 0.01], r: rt, r2: rb, s: [1, 1, depth], bone: J.hips, mat, k: 0.03, tag: 'skirt', clip: [{ n: [0, -1, 0], o: len }] });
  };
  /** A belt or sash band round the waist. */
  const band = (y: number, h: number, t: number, mat: number) => {
    c.prims.push({ kind: 'ell', a: [0, y, 0.005], s: [B.hipW * 1.02 + t, h, B.hipD * 1.02 + t], bone: J.hips, mat, k: 0.01, tag: 'band' });
  };

  if (race === 'telsharin') {
    // the armour, and the bone ribs where the left chest plate is torn away, are rigid (char-telsharin.ts)
    return { top: 0x8a9c86, bottom: 0x8a9c86 };
  }
  if (look === 'defender') {
    // carved stone plates over the chest and hips (iskari-woken-defensive-unit-study.png), a wide rust belt
    c.prims.push({ kind: 'ell', a: [0, yS * 0.62, -B.chestD * 0.35], s: [B.chestW * 0.95, yS * 0.3, B.chestD * 0.75], bone: J.spine, mat: M.nail, k: 0.012 });
    for (const s of S) c.prims.push({ kind: 'ell', a: [s * B.hipW * 0.7, -0.02, -0.02], s: [B.hipW * 0.5, 0.11, B.hipD * 0.9], bone: J.hips, mat: M.nail, k: 0.012 });
    band(0.06, 0.05, 0.02, M.sash);
    return { top: 0xd8ccb0, bottom: 0xd8ccb0, sash: 0x9b4a2c };
  }

  if (race === 'minaa') {
    const crowd = look === 'crowd', scav = look === 'scavenger' || look === 'pell';
    const MI = { ochre: 0xc8904a, rust: 0xa4502e, teal: 0x4f7f78, sand: 0xcdb38a, brown: 0x7a5a3e };
    if (look === 'player' && !f) {
      // mi-naa-tinker-pair.png, the man: bare chest, patched rust trousers cut ragged below the knee, sandals
      c.key.push('tinkerM');
      trousers(0.018, 0.35, 0.01);
      band(0.05, 0.035, 0.022, M.leather);
      return { top: MI.ochre, bottom: MI.rust };
    }
    if (look === 'player' && f) {
      // the woman: a short loose top, bare midriff, wide teal trousers to mid-shin, a rope belt
      c.key.push('tinkerF2');
      top(0.018, yS * 0.74);
      c.prims.push({ kind: 'cap', a: [0.01, yS + 0.03, 0.01], b: [-0.01, yS * 0.66, 0.01], r: B.neckR * 1.4, r2: B.chestW * 1.55, s: [1, 1, 0.78], bone: J.spine, mat: M.top, k: 0.02, tag: 'poncho', clip: [{ n: [0, -1, 0], o: -(yS * 0.66) }, { n: [-0.35, -1, 0], o: -(yS * 0.66) }] });
      trousers(0.02, 0.62, 0.02);
      band(0.02, 0.025, 0.028, M.leather);
      return { top: 0xe0b058, bottom: MI.teal };
    }
    if (look === 'hadda') {
      // the crew boss: a knee-length teal work coat with rolled sleeves over dark trousers, boots
      trousers(0.015, 0.8);
      top(0.024, -0.1, M.robe);
      sleeves(0.026, 0.8, M.robe);
      skirt(0.12, 0.52, B.hipW * 1.2, B.hipW * 1.5, M.robe, 0.9);
      band(0.06, 0.035, 0.045, M.leather);
      return { top: 0x4f7a74, bottom: 0x4e4a40, robe: 0x4f7a74 };
    }
    if (look === 'tarn') {
      // the cook: a pale blouse, a long rust skirt to the ankle, an apron (rigid flap)
      top(0.02, -0.02);
      sleeves(0.022, 0.55);
      skirt(0.08, 0.84, B.hipW * 1.15, B.hipW * 1.75, M.robe, 0.95);
      band(0.07, 0.03, 0.03, M.leather);
      return { top: 0xd8c8a4, bottom: 0xa4502e, robe: 0xa4502e };
    }
    if (look === 'digger') {
      // bare-chested, cut-off trousers, a headband
      trousers(0.018, 0.12, 0.01);
      band(0.05, 0.035, 0.022, M.leather);
      return { top: 0xa88a5a, bottom: 0x7a6448 };
    }
    if (scav) {
      // long sleeves and trousers: band marks stay covered (canon)
      top(0.022, -0.1);
      sleeves(0.022, 1.9);
      trousers(0.02, 0.85);
      band(0.06, 0.035, 0.04, M.leather);
      return { top: look === 'pell' ? 0x8f7050 : 0x7a5a40, bottom: 0x5e4632 };
    }
    // crowd: a tunic or a bare chest, trousers of some length
    const bare = !f && r() < 0.35;
    const topHex = shade(pick(r, [MI.ochre, MI.sand, 0xb88c5a, MI.brown, 0xa06a48]), 0, 0, (r() - 0.5) * 0.1);
    const botHex = shade(pick(r, [MI.teal, MI.rust, 0x7a5a3e, 0x5d6f63]), 0, 0, (r() - 0.5) * 0.08);
    const len = pick(r, [0.2, 0.55, 0.85]);
    c.key.push(`crowd${bare ? 'b' : 't'}${len}`);
    if (!bare) { top(0.02, -0.08); sleeves(0.02, f ? 0.45 : 0.3); }
    trousers(0.018, len, 0.01);
    band(0.05, 0.035, 0.025, M.leather);
    void crowd;
    return { top: topHex, bottom: botHex };
  }

  if (race === 'sehari') {
    // women: an undyed bone wrap over the torso. Men: bare-chested under a wrap over one shoulder
    // (sehari-male-herd-protector.png). Both: baggy trousers gathered at the ankle, a teal sash.
    if (f) top(0.02, -0.05);
    else c.key.push('bareM');
    trousers(0.02, 0.84, 0.03);
    band(0.07, 0.05, 0.03, M.sash);
    return { top: 0xd9ccb2, bottom: 0xd4c6aa, sash: 0x4f8a86 };
  }

  // Iskari
  if (look === 'apprentice') {
    // a long faded robe with sleeves to the elbow, a rust sash and collar
    top(0.022, -0.1, M.robe);
    sleeves(0.028, 0.95, M.robe);
    skirt(0.14, 0.92, B.hipW * 1.25, B.hipW * 1.9, M.robe, 0.9);
    band(0.1, 0.04, 0.05, M.sash);
    return { top: 0xd8ccb0, bottom: 0xd8ccb0, robe: 0xd8ccb0, sash: 0x9b4a2c };
  }
  if (f) {
    // iskari-menders-pair.png, narrow: a short wrap top over the chest, bare waist, a short wrap skirt
    layer(c, ['chest'], 0.016, M.top, [{ n: [0, -1, 0], o: -(yS * 0.55) }, { n: [0, 1, 0], o: yS - 0.075 }]);
    skirt(0.06, 0.36, B.hipW * 1.12, B.hipW * 1.5, M.top, 0.9);
    band(0.05, 0.035, 0.03, M.sash);
    return { top: 0xe0d6c0, bottom: 0xe0d6c0, sash: 0x6a6080, trim: 0x3f7a74 };
  }
  // broad: an open dusty-violet vest (two halves, the stone chest bare between), a cream kilt, a teal sash
  for (const s of S) layer(c, ['chest', 'yoke', 'belly'], 0.018, M.robe, [{ n: [s * -1, 0, 0], o: -0.055 }, { n: [0, -1, 0], o: -0.1 }]);
  layer(c, ['uarm'], 0.02, M.robe, [{ n: [0, -1, 0], o: -(yS - 0.07) }]);
  skirt(0.07, 0.34, B.hipW * 1.1, B.hipW * 1.35, M.top, 0.85);
  band(0.07, 0.06, 0.035, M.sash);
  return { top: 0xe0d6c0, bottom: 0xe0d6c0, robe: 0x6a6080, sash: 0x4f8a86 };
}

// ================================================================= head, hands, feet (rigid, finer)

function sculptHead(c: Ctx): { geoKey: string; prims: Prim[]; eyes: V3[]; eyeR: number } {
  const { race, f, look, B } = c;
  const H = B.head;
  const hy = H.h * 0.72; // head centre above the head joint
  const P: Prim[] = [];
  const add = (p: Prim) => { P.push(p); return p; };
  const e = (a: V3, s: V3, mat: number, k: number, rot?: V3, sub = false) => add({ kind: 'ell', a, s, bone: -1, mat, k, rot, sub });
  const cp = (a: V3, b: V3, r: number, r2: number, mat: number, k: number, sub = false) => add({ kind: 'cap', a, b, r, r2, bone: -1, mat, k, sub });
  const w = H.w, h = H.h, d = H.d;
  if (race === 'telsharin') {
    // only the dark socket under the helmet; the faceted dome is a rigid hull (char-telsharin.ts)
    e([0, hy - h * 0.55, 0.0], [w * 0.62, h * 0.5, d * 0.62], M.skin, 0.03);
    return { geoKey: 'head:telsharin2', prims: P, eyes: [], eyeR: 0 };
  }
  const iskari = race === 'iskari', sehari = race === 'sehari';
  // skull and cranium: Iskari and Sehari skulls sweep further back
  e([0, hy, 0.01], [w, h, d], M.skin, 0.02);
  e([0, hy + h * 0.1, d * (iskari || sehari ? 0.35 : 0.2)], [w * 0.93, h * 0.9, d * (iskari || sehari ? 1.0 : 0.9)], M.skin, 0.05);
  // jaw and chin
  e([0, hy - h * 0.52, -d * 0.2], [w * (0.62 + 0.18 * H.jaw), h * 0.42, d * 0.72], M.skin, 0.04);
  e([0, hy - h * 0.82, -d * 0.66], [0.02 + 0.006 * H.jaw, 0.018 * H.chin, 0.02], M.skin, 0.025);
  // cheekbones and brow
  for (const s of S) e([s * w * 0.58, hy - h * 0.12, -d * 0.6], [0.022 * H.cheek, 0.016, 0.022], M.skin, 0.025);
  cp([-w * 0.55, hy + h * 0.2, -d * 0.84], [w * 0.55, hy + h * 0.2, -d * 0.84], 0.009 + 0.006 * H.brow, 0.009 + 0.006 * H.brow, M.skin, 0.03);
  // eye sockets
  const eyes: V3[] = [];
  const eyeR = sehari ? 0.014 : iskari ? 0.011 : 0.011;
  for (const s of S) {
    const ex = s * w * 0.38, ey = hy + h * 0.04, ez = -d * 0.86;
    e([ex, ey, ez - 0.004], [0.019, 0.014, 0.016], M.skin, 0.012, undefined, true);
    eyes.push([ex, ey, ez + 0.003]);
  }
  // nose and mouth
  if (!iskari) {
    cp([0, hy + h * 0.08, -d * 0.97], [0, hy - h * 0.28, -d * 1.1], 0.008, sehari ? 0.011 : 0.014, M.skin, 0.02);
    e([0, hy - h * 0.46, -d * 0.93], [0.021, 0.006, 0.01], M.lip, 0.012);
    e([0, hy - h * 0.53, -d * 0.9], [0.018, 0.007, 0.011], M.lip, 0.012);
  } else {
    // Iskari: a flat, straight carved nose and a thin mouth line
    add({ kind: 'box', a: [0, hy - h * 0.1, -d * 1.0], s: [0.008, 0.035, 0.012], r: 0.004, bone: -1, mat: M.skin, k: 0.02 });
    cp([-0.017, hy - h * 0.48, -d * 0.93], [0.017, hy - h * 0.48, -d * 0.93], 0.003, 0.003, M.skin, 0.006, true);
  }
  // ears
  if (sehari) {
    // long, pointed, swept up and back (concept art)
    for (const s of S) add({ kind: 'cap', a: [s * w * 0.9, hy + h * 0.02, 0.012], b: [s * (w + 0.085), hy + h * 0.5, 0.06], r: 0.017, r2: 0.003, s: [1, 1, 0.45], bone: -1, mat: M.skin, k: 0.015 });
  } else if (!iskari) {
    for (const s of S) e([s * w * 0.98, hy - h * 0.02, 0.008], [0.009, 0.026, 0.017], M.skin, 0.01);
  }
  // Iskari: a crest ridge over the crown, and carved plate lines on the cheek
  if (iskari) {
    const hi = f ? 1.3 : 1;
    cp([0, hy + h * 0.62, -d * 0.55], [0, hy + h * (0.86 + 0.08 * hi), d * 0.35], 0.011, 0.007, M.skin, 0.035);
    for (const s of S) cp([s * w * 0.72, hy + h * 0.15, -d * 0.62], [s * w * 0.8, hy - h * 0.35, -d * 0.4], 0.0025, 0.0025, M.skin, 0.004, true);
  }
  // hair
  const hair = (a: V3, s: V3, hairline: number, back = 0) => add({
    kind: 'ell', a, s, bone: -1, mat: M.hair, k: 0.012,
    // keep the hair above a hairline that dips from the forehead down to the nape
    clip: [{ n: norm([0, -1, -0.9 + back]), o: dot3([0, hy + h * hairline, -d], norm([0, -1, -0.9 + back])) }],
  });
  if (race === 'minaa') {
    if (look === 'tarn') {
      e([0, hy + h * 0.35, 0.01], [w * 1.14, h * 0.78, d * 1.12], M.robe, 0.015); // headwrap
      e([0, hy + h * 0.25, d * 1.0], [0.035, 0.035, 0.03], M.robe, 0.015);
    } else if (look === 'pell' || look === 'scavenger') {
      // a deep hood, the face open at the front
      e([0, hy + h * 0.12, 0.02], [w * 1.34, h * 1.18, d * 1.3], M.top, 0.01);
      e([0, hy - h * 0.05, -d * 0.95], [w * 0.8, h * 0.85, d * 0.55], M.top, 0.02, undefined, true);
    } else if (f) {
      hair([0, hy + h * 0.14, 0.012], [w * 1.08, h * 0.98, d * 1.08], 0.5);
      e([0, hy + h * 0.35, d * 1.05], [0.04, 0.036, 0.034], M.hair, 0.02); // bun
    } else {
      hair([0, hy + h * 0.12, 0.014], [w * 1.07, h * 0.96, d * 1.08], 0.55);
    }
  } else if (sehari) {
    hair([0, hy + h * 0.1, 0.012], [w * 1.04, h * 0.97, d * 1.06], 0.8, 0.35);
    if (f) e([0, hy + h * 0.95, d * 0.4], [0.05, 0.045, 0.05], M.hair, 0.03); // topknot
  }
  const key = `head:${race}:${c.body}:${look}`;
  return { geoKey: key, prims: P, eyes, eyeR };
}

function sculptHand(c: Ctx, s: number): Prim[] {
  const { race, B } = c;
  const P: Prim[] = [];
  const k = B.hand, fl = B.finger;
  if (race === 'telsharin') {
    // a long mechanical hand: plated palm, three jointed fingers and a thumb, bone claw tips (warden art)
    P.push({ kind: 'box', a: [0, -0.05, 0], s: [0.017, 0.05, 0.036], r: 0.01, bone: -1, mat: M.marked, k: 0.01 });
    [-0.024, 0, 0.024].forEach((z, i) => {
      const L = [0.1, 0.115, 0.1][i];
      const a: V3 = [0, -0.1, z], m1: V3 = [s * 0.012, -0.1 - L * 0.5, z * 1.1], m2: V3 = [s * 0.03, -0.1 - L * 0.9, z * 1.15];
      P.push({ kind: 'cap', a, b: m1, r: 0.0105, r2: 0.009, bone: -1, mat: M.marked, k: 0.004 });
      P.push({ kind: 'cap', a: m1, b: m2, r: 0.009, r2: 0.0075, bone: -1, mat: M.marked, k: 0.004 });
      P.push({ kind: 'ell', a: m1, s: [0.012, 0.011, 0.012], bone: -1, mat: M.skin, k: 0.004 });
      P.push({ kind: 'cap', a: m2, b: [s * 0.045, -0.1 - L * 1.12, z * 1.2], r: 0.007, r2: 0.0015, bone: -1, mat: M.nail, k: 0.004 });
    });
    P.push({ kind: 'cap', a: [s * 0.006, -0.03, -0.034], b: [s * 0.02, -0.1, -0.06], r: 0.011, r2: 0.008, bone: -1, mat: M.marked, k: 0.008 });
    P.push({ kind: 'cap', a: [s * 0.02, -0.1, -0.06], b: [s * 0.03, -0.13, -0.066], r: 0.007, r2: 0.0015, bone: -1, mat: M.nail, k: 0.004 });
    return P;
  }
  const skinMat = race === 'sehari' && s < 0 ? M.marked : M.skin;
  // palm: thin along x, wide along z. Left hand's palm faces +x, the right's -x.
  P.push({ kind: 'box', a: [0, -0.045 * k, 0], s: [0.013 * k, 0.04 * k, 0.036 * k], r: 0.011 * k, bone: -1, mat: skinMat, k: 0.01 });
  const zs = [-0.026, -0.009, 0.008, 0.024];
  const lens = [0.07, 0.08, 0.075, 0.06];
  zs.forEach((z, i) => {
    const L = lens[i] * k * fl;
    const a: V3 = [0, -0.08 * k, z * k];
    const mid: V3 = [s * 0.006, -0.08 * k - L * 0.55, z * k * 1.05];
    const tip: V3 = [s * 0.018, -0.08 * k - L, z * k * 1.08];
    P.push({ kind: 'cap', a, b: mid, r: 0.0085 * k, r2: 0.0075 * k, bone: -1, mat: skinMat, k: 0.006 });
    P.push({ kind: 'cap', a: mid, b: tip, r: 0.0075 * k, r2: 0.006 * k, bone: -1, mat: skinMat, k: 0.005 });
    if (race === 'sehari') P.push({ kind: 'cap', a: tip, b: [s * 0.028, -0.08 * k - L - 0.016, z * k * 1.1], r: 0.005, r2: 0.0008, bone: -1, mat: M.nail, k: 0.003 });
  });
  // thumb, towards the front
  P.push({ kind: 'cap', a: [s * 0.004, -0.025 * k, -0.03 * k], b: [s * 0.012, -0.07 * k * fl, -0.05 * k], r: 0.01 * k, r2: 0.0075 * k, bone: -1, mat: skinMat, k: 0.012 });
  if (race === 'sehari') P.push({ kind: 'cap', a: [s * 0.012, -0.07 * k * fl, -0.05 * k], b: [s * 0.02, -0.085 * k * fl, -0.058 * k], r: 0.005, r2: 0.0008, bone: -1, mat: M.nail, k: 0.003 });
  return P;
}

function sculptFoot(c: Ctx, s: number): Prim[] {
  const { race, B, look } = c;
  const P: Prim[] = [];
  const fh = B.dims.footH;
  const skinMat = race === 'sehari' && s > 0 ? M.marked : M.skin;
  if (race === 'telsharin') {
    // a long plated metatarsal, three forward toes and a back spur, each ending in bone (warden art)
    const L = B.dims.meta;
    P.push({ kind: 'cap', a: [0, 0, 0], b: [0, -L, 0], r: 0.04, r2: 0.032, bone: -1, mat: M.marked, k: 0.02 });
    P.push({ kind: 'ell', a: [0, -L, -0.01], s: [0.042, 0.03, 0.05], bone: -1, mat: M.skin, k: 0.015 });
    for (const yaw of [-0.5, 0, 0.5]) {
      const mid: V3 = [Math.sin(yaw) * 0.1, -L - 0.022, -Math.cos(yaw) * 0.1];
      const tip: V3 = [Math.sin(yaw) * 0.19, -L - 0.03, -Math.cos(yaw) * 0.19];
      P.push({ kind: 'cap', a: [0, -L, -0.01], b: mid, r: 0.018, r2: 0.014, bone: -1, mat: M.marked, k: 0.01 });
      P.push({ kind: 'cap', a: mid, b: tip, r: 0.014, r2: 0.004, bone: -1, mat: M.nail, k: 0.006 });
    }
    P.push({ kind: 'cap', a: [0, -L, 0], b: [0, -L - 0.028, 0.1], r: 0.015, r2: 0.004, bone: -1, mat: M.nail, k: 0.01 });
    return P;
  }
  if (race === 'iskari') {
    // the long metatarsal and a two-toed hoof (concept art)
    const L = B.dims.meta, big = look === 'defender' ? 1.5 : 1;
    P.push({ kind: 'cap', a: [0, 0, 0], b: [0, -L, -0.01], r: B.ankleR * 1.05, r2: 0.022 * big, bone: -1, mat: M.skin, k: 0.02 });
    for (const t of S) P.push({ kind: 'ell', a: [t * 0.022 * big, -L - 0.014, -0.035 * big], s: [0.021 * big, 0.019, 0.045 * big], bone: -1, mat: M.nail, k: 0.014 });
    return P;
  }
  const long = race === 'sehari' ? 1.2 : 1;
  P.push({ kind: 'ell', a: [0, -fh * 0.55, 0.018], s: [0.032, fh * 0.55, 0.04], bone: -1, mat: skinMat, k: 0.02 }); // heel
  P.push({ kind: 'ell', a: [0, -fh * 0.72, -0.055 * long], s: [0.038, fh * 0.42, 0.085 * long], bone: -1, mat: skinMat, k: 0.03 });
  P.push({ kind: 'cap', a: [0, 0.01, 0], b: [0, -fh * 0.5, -0.02], r: B.ankleR, r2: B.ankleR * 1.05, bone: -1, mat: skinMat, k: 0.02 });
  if (race === 'sehari') {
    for (const z of [-0.022, -0.007, 0.008]) P.push({ kind: 'cap', a: [z, -fh * 0.85, -0.13 * long], b: [z * 1.2, -fh, -0.16 * long], r: 0.004, r2: 0.0008, bone: -1, mat: M.nail, k: 0.003 });
  } else {
    // sandals or boots
    const boots = look === 'hadda' || look === 'digger' || look === 'pell' || look === 'scavenger';
    P.push({ kind: 'box', a: [0, -fh + 0.008, -0.035], s: [0.042, 0.009, 0.125], r: 0.006, bone: -1, mat: M.leather, k: 0.004 });
    if (boots) P.push({ kind: 'ell', a: [0, -fh * 0.45, -0.03], s: [0.043, fh * 0.75, 0.11], bone: -1, mat: M.leather, k: 0.01 });
    else P.push({ kind: 'cap', a: [-0.035, -fh * 0.55, -0.07], b: [0.035, -fh * 0.55, -0.07], r: 0.006, r2: 0.006, bone: -1, mat: M.leather, k: 0.004 });
  }
  // clip the sole flat at the ground
  for (const p of P) p.clip = [...(p.clip ?? []), { n: [0, -1, 0], o: fh }];
  return P;
}

// ================================================================= materials

function materials(c: Ctx, pal: Pal): THREE.Material[] {
  const { race, look, r } = c;
  const mats: THREE.Material[] = [];
  let skin: THREE.Material, marked: THREE.Material, hair: THREE.Material, nail: THREE.Material, lip: THREE.Material;
  if (race === 'minaa') {
    const tone = look === 'player' ? 0 : (r() - 0.5) * 0.12;
    const hex = shade(look === 'tarn' ? 0xa4704e : look === 'hadda' ? 0x8e5c3c : 0x9c6644, 0, 0, tone);
    skin = smat('skin', hex, { rough: 0.72, scale: 6 });
    marked = skin;
    hair = smat('hair', look === 'tarn' ? 0x8a8078 : pick(r, [0x2e231c, 0x3a2a1e, 0x241c17, 0x4a3524]), { rough: 0.95, scale: 12 });
    nail = smat('', 0x6a5448);
    lip = smat('skin', shade(hex, 0, 0, -0.08), { rough: 0.6, scale: 6 });
  } else if (race === 'sehari') {
    // cool grey-lavender, cracked like dried clay; dark root markings on one arm and leg (canon)
    const hex = shade(0xa89eb8, 0, 0, look === 'player' ? 0 : (r() - 0.5) * 0.05);
    skin = smat('sehari', hex, { rough: 0.85, scale: 5 });
    marked = smat('sehariRoots', hex, { rough: 0.85, scale: 3 });
    hair = smat('hair', 0x221c22, { rough: 0.95, scale: 10 });
    nail = smat('', 0x2a2226, { rough: 0.5 });
    lip = smat('sehari', shade(hex, 0, 0, -0.1), { rough: 0.8, scale: 5 });
  } else if (race === 'telsharin') {
    // the dark core under the armour, plated fingers and feet, pitted bone (canon, locked;
    // telsharin-warden-pair-variant-a/b/c.png). The armour plates themselves are in char-telsharin.ts.
    skin = smat('maker', 0x474c44, { rough: 0.7, metal: 0.1, flat: true, scale: 4 });
    marked = smat('warden', 0x7c8a80, { rough: 0.55, metal: 0.15, flat: true, scale: 5 });
    nail = smat('bone', 0xd2c4a2, { rough: 0.9, flat: true, scale: 4 });
    hair = lip = skin;
  } else if (look === 'defender') {
    // pale bone stone, rust stains, teal light in the seams: a per-instance material the model drives
    const st = makeSmat('defender', 0xece2d0, { rough: 0.88, flat: true, scale: 1.7, emissive: 0x5fe0d0, emissiveMap: 'defenderGlow', ei: 1.9 });
    c.glows.push({ mat: st, base: 1.9, crystal: false });
    skin = marked = hair = lip = st;
    nail = smat('defender', 0xd0c4ae, { rough: 0.9, flat: true, scale: 1.1 });
  } else {
    const old = look === 'apprentice';
    skin = smat('iskari', old ? 0xa39c90 : 0xd3cab8, { rough: 0.97, scale: 3 });
    marked = hair = lip = skin;
    nail = smat('iskari', old ? 0xa8a296 : 0xbdb2a0, { rough: 0.9, scale: 3 });
  }
  mats[M.skin] = skin; mats[M.marked] = marked; mats[M.hair] = hair; mats[M.nail] = nail; mats[M.lip] = lip;
  const clothKey = race === 'minaa' ? 'patched' : 'cloth';
  mats[M.top] = smat(clothKey, pal.top, { rough: 0.95, scale: 3 });
  mats[M.bottom] = smat(clothKey, pal.bottom, { rough: 0.95, scale: 3 });
  mats[M.robe] = smat(clothKey, pal.robe ?? pal.top, { rough: 0.95, scale: 3 });
  mats[M.leather] = smat('leather', 0x5a3d28, { rough: 0.7, scale: 5 });
  mats[M.sash] = smat('cloth', pal.sash ?? 0x4f8a86, { rough: 0.95, scale: 4 });
  mats[M.trim] = smat('cloth', pal.trim ?? 0x3f7a74, { rough: 0.95, scale: 4 });
  mats[M.metal] = smat('metal', 0x4a423a, { rough: 0.5, metal: 0.2, scale: 4 });
  mats[M.brass] = smat('metal', 0xa27a45, { rough: 0.45, metal: 0.25, scale: 4 });
  if (race === 'sehari') {
    // undyed fibre with the rust motif band near the hem
    mats[M.top] = smat('cloth', 0xd9ccb2, { rough: 0.95, scale: 3 });
  }
  for (let i = 0; i < NMAT; i++) if (!mats[i]) mats[i] = skin;
  return mats;
}

// ================================================================= styles and idle character

const HUMAN: Style = {
  walkHz: 1.45, stride: 0.52, runHz: 1.75, runStride: 0.75, armSwing: 0.45, life: 1,
  sleep: 'sit', sitHeight: 0.1,
  fallX: Math.PI / 2, fallZ: 0, lieLift: 0.12, lieSlide: -0.45, lieSide: 0,
};
const SEHARI: Style = {
  walkHz: 1.35, stride: 0.5, runHz: 1.9, runStride: 0.55, armSwing: 0.4, life: 1,
  quadRun: true, sleep: 'sit', sitHeight: 0.1,
  fallX: Math.PI / 2, fallZ: 0, lieLift: 0.1, lieSlide: -0.45, lieSide: 0,
};
const TELSHARIN: Style = {
  walkHz: 1.05, stride: 0.5, runHz: 1.4, runStride: 0.7, armSwing: 0.2, life: 0.7,
  sleep: 'crouch', sitHeight: 0.5,
  fallX: 0, fallZ: 1.45, lieLift: 0.3, lieSlide: 0, lieSide: 0.5,
  lengths: { attack: 0.75 },
};
const ISKARI: Style = {
  walkHz: 1.25, stride: 0.55, runHz: 1.6, runStride: 0.72, armSwing: 0.22, life: 0.12,
  sleep: 'sit', sitHeight: 0.1,
  fallX: -Math.PI / 2, fallZ: 0, lieLift: 0.13, lieSlide: 0.45, lieSide: 0,
};

function styleFor(race: Race, body: Body, look: string): Style {
  if (race === 'telsharin') return { ...TELSHARIN };
  const base = race === 'minaa' ? HUMAN : race === 'sehari' ? SEHARI : ISKARI;
  const f = body === 'female';
  const st: Style = { ...base, hipSway: f ? 0.09 : 0.03, shoulderSway: f ? 0.03 : 0.07 };
  // Sehari stand with a predator's forward weight (concept art), the hunter most of all
  if (race === 'sehari') st.idleCrouch = look === 'hunter' ? 0.7 : 0.42;
  if (look === 'tarn') { st.walkHz = 1.2; st.stride = 0.38; st.life = 0.8; }
  if (look === 'hadda') { st.stride = 0.56; st.armSwing = 0.5; }
  return st;
}

function lookPost(look: string): ((o: Pose, c: PoseCtx) => void) | undefined {
  if (look === 'hadda') {
    // hands on her hips, weight on one leg: the crew boss waiting for bad news
    return (o, c) => {
      if (c.anim !== 'idle') return;
      add(o, J.lArm, -0.15, 0, -0.5); add(o, J.lFore, 0.35, 0, 1.75);
      add(o, J.rArm, -0.15, 0, 0.5); add(o, J.rFore, 0.35, 0, -1.75);
      add(o, J.hips, 0, 0.1, 0.05); add(o, J.lLeg, 0, 0, -0.08); add(o, J.rShin, -0.12);
    };
  }
  if (look === 'tarn') {
    // one hand at the small of her back, the other stirring
    return (o, c) => {
      if (c.anim !== 'idle') return;
      add(o, J.lArm, -0.1, 0, -0.45); add(o, J.lFore, 0.3, 0, 1.6);
      add(o, J.rArm, 0.55 + 0.12 * Math.sin(c.clock * 2.2), 0.2, 0.1 * Math.cos(c.clock * 2.2)); add(o, J.rFore, 0.9);
    };
  }
  if (look === 'pell') {
    // arms folded, watching: someone who does not want to be asked anything
    return (o, c) => {
      if (c.anim !== 'idle') return;
      add(o, J.lArm, 0.3, 0, 0.08); add(o, J.lFore, 1.45, 0, 1.05);
      add(o, J.rArm, 0.32, 0, -0.08); add(o, J.rFore, 1.35, 0, -1.1);
      add(o, J.head, 0.1);
    };
  }
  if (look === 'digger') {
    return (o, c) => {
      if (c.anim !== 'idle') return;
      add(o, J.rArm, 0.45, 0, 0.1); add(o, J.rFore, 0.8);
      add(o, J.spine, -0.08, -0.15);
    };
  }
  return undefined;
}

// ================================================================= small gear helpers

function flap(c: Ctx, parent: THREE.Object3D, m: THREE.Material, p: V3, w: number, h: number, o: { yaw?: number; hang?: number; front?: boolean; back?: boolean; curve?: number; taper?: number; drag?: number; restX?: number } = {}): void {
  const outer = new THREE.Object3D();
  outer.position.set(p[0], p[1], p[2]);
  outer.rotation.y = o.yaw ?? 0;
  parent.add(outer);
  const pv = swayPivot(outer, [0, 0, 0], [o.restX ?? 0, 0]);
  const mesh = put(pv, panel(`${w}-${h}-${o.curve ?? 0}-${o.taper ?? 1}`, w, h, o.curve ?? 0, o.taper ?? 1), m);
  mesh.userData.keep = true;
  const rig = c.rig;
  const s: Sway = { pivot: pv, hang: o.hang ?? 0.85, rest: [o.restX ?? 0, 0], drag: o.drag ?? 0.12, stiff: 60, damp: 7, flutter: 0.12 };
  if (o.front) s.minX = () => Math.max(rig.lLeg.rotation.x, rig.rLeg.rotation.x) * 0.85;
  if (o.back) s.maxX = () => Math.min(rig.lLeg.rotation.x, rig.rLeg.rotation.x) * 0.85;
  c.sway.push(s);
}

function lock(c: Ctx, parent: THREE.Object3D, m: THREE.Material, p: V3, len: number, r0: number, rest: [number, number], hang = 0.6): void {
  const pv = swayPivot(parent, p, rest);
  const mesh = put(pv, tube(`lock-${len}-${r0}`, len, [[0, r0], [0.3, r0 * 1.05], [0.75, r0 * 0.9], [1, r0 * 0.55]], 6), m);
  mesh.userData.keep = true;
  c.sway.push({ pivot: pv, hang, rest, drag: 0.1, stiff: 45, damp: 5, flutter: 0.2 });
}

/** A strap across the chest from one shoulder to the opposite hip. */
function strap(c: Ctx, side: number, m: THREE.Material, w = 0.04, over = 0.012): void {
  const { B } = c;
  const d = B.dims;
  const z = B.chestD + over;
  const g = new THREE.Object3D();
  c.rig.spine.add(g);
  // front and back halves, each a thin box laid on the body at a slant
  for (const zz of [-z, z * 0.92]) {
    put(g, box(w, d.spineLen * 1.08, 0.012), m, [0, d.spineLen * 0.5, zz], [zz < 0 ? 0.08 : -0.08, 0, side * 0.58]);
  }
}

// ================================================================= the person

export function buildSculpted(race: Race, body: Body, look: string, opts: ModelOpts, kind: string, role?: string, extend?: (spec: CharSpec, c: Ctx) => void): Model {
  const r = rng(seedOf(opts.seed, opts.name, kind + look + body));
  const B = build(race, body, look);
  const rig = makeRig(B.dims);
  const c: Ctx = { race, body, look, f: body === 'female', B, rig, r, j: {}, prims: [], mats: [], glows: [], sway: [], key: [] };

  // ---- bind pose: arms out, legs apart, so no two limbs touch while the skin is built
  rig.lArm.rotation.z = -0.5; rig.rArm.rotation.z = 0.5;
  rig.lLeg.rotation.z = -0.07; rig.rLeg.rotation.z = 0.07;
  rig.body.updateMatrixWorld(true);
  const wp = (o: THREE.Object3D): V3 => { const v = new THREE.Vector3(); o.getWorldPosition(v); return [v.x, v.y, v.z]; };
  for (const n of ['hips', 'spine', 'head', 'lArm', 'lFore', 'lHand', 'rArm', 'rFore', 'rHand', 'lLeg', 'lShin', 'lFoot', 'rLeg', 'rShin', 'rFoot'] as const) c.j[n] = wp(rig[n]);

  sculptBody(c);
  const pal = dressBody(c);
  c.mats = materials(c, pal);

  const bodyKey = `body:${race}:${body}:${look}:${c.key.join(',')}`;
  const cell = look === 'defender' ? 0.019 : 0.0145;
  // Robes and skirts are their own layer over the body. In one blended skin they swallowed the legs:
  // the apprentice sat on his crate with no legs (user, morning after phase 2).
  const outer = c.prims.filter((p) => p.tag === 'skirt');
  const inner = c.prims.filter((p) => p.tag !== 'skirt');
  const skeleton = new THREE.Skeleton(rig.joints as THREE.Bone[]);
  const addSkin = (key: string, prims: Prim[]) => {
    const m = new THREE.SkinnedMesh(sculpt(key, prims, cell, true), c.mats);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.userData.keep = true;
    rig.body.add(m);
    m.updateMatrixWorld(true);
    m.bind(skeleton);
  };
  addSkin(bodyKey, inner);
  if (outer.length) {
    // the lower robe follows the legs, blended by height, so a stride pulls the cloth instead of stabbing through it
    const g = sculpt(bodyKey + ':outer', outer, cell, true);
    if (!g.userData.legWeights) {
      g.userData.legWeights = true;
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      const si = g.getAttribute('skinIndex') as THREE.BufferAttribute;
      const sw = g.getAttribute('skinWeight') as THREE.BufferAttribute;
      // down to the knee the cloth follows the thighs (a lap when seated); below it, the shins (it hangs from the knee)
      const th = B.dims.thigh;
      for (let v = 0; v < pos.count; v++) {
        const x = pos.getX(v), y = pos.getY(v);
        const side = Math.min(1, Math.max(0, 0.5 + x / (B.hipW * 1.6))); // 0 left leg .. 1 right leg
        const up = Math.min(1, Math.max(0, -y / th)) * 0.9;          // hips -> thigh
        const low = Math.min(1, Math.max(0, (-y - th) / (th * 0.4))); // thigh -> shin, past the knee
        if (low <= 0) {
          si.setXYZW(v, J.hips, J.lLeg, J.rLeg, J.hips);
          sw.setXYZW(v, 1 - up, up * (1 - side), up * side, 0);
        } else {
          si.setXYZW(v, J.lLeg, J.rLeg, J.lShin, J.rShin);
          sw.setXYZW(v, (1 - low) * (1 - side), (1 - low) * side, low * (1 - side), low * side);
        }
      }
      si.needsUpdate = true; sw.needsUpdate = true;
    }
    addSkin(bodyKey + ':outer', outer);
  }
  // back to the rest orientation: everything below is placed relative to hanging limbs
  rig.lArm.rotation.z = 0; rig.rArm.rotation.z = 0; rig.lLeg.rotation.z = 0; rig.rLeg.rotation.z = 0;

  // ---- head, hands, feet
  const head = sculptHead(c);
  const rigid = (parent: THREE.Object3D, key: string, prims: Prim[], cell: number) => {
    const m = new THREE.Mesh(sculpt(key, prims, cell, false), c.mats);
    m.castShadow = true; m.receiveShadow = true; m.userData.keep = true;
    parent.add(m);
    return m;
  };
  rigid(rig.head, head.geoKey, head.prims, 0.0062);
  for (const s of S) {
    // hands and feet are shared by everyone of the same race and build: key them by what shapes them
    const boots = look === 'hadda' || look === 'digger' || look === 'pell' || look === 'scavenger';
    const bk = look === 'defender' || race === 'telsharin' ? look : c.body;
    rigid(s < 0 ? rig.lHand : rig.rHand, `hand:${race}:${bk}:${s}`, sculptHand(c, s), 0.0045);
    rigid(s < 0 ? rig.lFoot : rig.rFoot, `foot:${race}:${bk}:${boots ? 'boot' : 'bare'}:${s}`, sculptFoot(c, s), 0.0075);
  }
  // eyes: dark and human for the Mi'naa, pale-gold glowing for the Sehari, pale for the Iskari
  const eyeMat = race === 'sehari' ? glow(c.glows, 0xf0b840, 0.6, true, 0xd09a38, false)
    : race === 'iskari' ? glow(c.glows, 0xdfeef2, look === 'defender' ? 1.2 : 0.5, false, 0xc8d4d8, false)
    : smat('', 0x1c1612, { rough: 0.25 });
  const pupil = smat('', 0x140f0c, { rough: 0.2 });
  for (const e of head.eyes) {
    if (race === 'minaa') {
      put(rig.head, ball(head.eyeR, 10, 8), smat('', 0xe8e0d4, { rough: 0.3 }), e, undefined, [1.15, 0.72, 0.6]);
      put(rig.head, ball(head.eyeR * 0.55, 8, 6), smat('', 0x3a2618, { rough: 0.2 }), [e[0], e[1], e[2] - head.eyeR * 0.42], undefined, [1, 1, 0.5]);
      continue;
    }
    lit(put(rig.head, ball(head.eyeR, 10, 8), eyeMat, e, undefined, [1.35, 0.75, 0.55]));
    // Sehari: vertical pupils in pale-gold eyes (canon)
    if (race === 'sehari') put(rig.head, ball(head.eyeR, 8, 6), pupil, [e[0], e[1], e[2] - head.eyeR * 0.36], undefined, [0.18, 0.62, 0.3]);
  }

  // ---- gear
  gear(c, pal);
  if (kind.startsWith('player-') && role) roleKit(c, role);

  // ---- rest pose
  const rest: Partial<Record<keyof typeof J, [number, number, number]>> = {
    lArm: [0, 0, -0.07], rArm: [0, 0, 0.07], lFore: [0.14, 0, 0], rFore: [0.14, 0, 0],
  };
  if (race === 'iskari') {
    // digitigrade: the knee forward, the long foot angled back up to the heel (concept art)
    Object.assign(rest, {
      lLeg: [0.14, 0, -0.03], lShin: [-0.55, 0, 0], lFoot: [0.42, 0, 0],
      rLeg: [0.14, 0, 0.03], rShin: [-0.55, 0, 0], rFoot: [0.42, 0, 0],
    });
    if (look === 'apprentice') Object.assign(rest, { spine: [-0.12, 0, 0], head: [0.08, 0, 0] });
  }
  if (look === 'tarn') Object.assign(rest, { spine: [-0.1, 0, 0], head: [0.06, 0, 0] });
  if (race === 'telsharin') {
    // digitigrade legs and a starving stoop: head low and forward, arms hanging long
    Object.assign(rest, {
      lLeg: [0.75, 0, -0.1], lShin: [-1.55, 0, 0], lFoot: [0.95, 0, 0],
      rLeg: [0.62, 0, 0.1], rShin: [-1.4, 0, 0], rFoot: [0.9, 0, 0],
      spine: [-0.45, 0.1, -0.05], head: [0.5, 0, -0.1],
      lArm: [0.15, 0, -0.12], lFore: [0.25, 0, 0], rArm: [0.2, 0, 0.1], rFore: [0.3, 0, 0],
    });
  }

  const spec: CharSpec = {
    name: kind, rig, style: styleFor(race, body, look), glows: c.glows, sway: c.sway,
    height: B.height,
    seat: race === 'iskari'
      ? { hipDrop: 0.09, stoop: look === 'apprentice' ? 0.3 : 0.05, knees: look === 'apprentice' }
      : race === 'sehari' ? { hipDrop: 0.09, stoop: 0.2, knees: true } : { hipDrop: 0.1, stoop: 0.12, knees: false },
    phase: r() * 20,
    rest: restPose(rest),
    post: lookPost(look) ?? (race === 'sehari' ? sehariStance : undefined),
  };
  extend?.(spec, c);
  return makeCharModel(spec);
}

// ================================================================= gear per race and look

function gear(c: Ctx, pal: Pal): void {
  const { rig, race, look, f, B, r } = c;
  if (race === 'telsharin') return;
  const d = B.dims;
  const yS = d.spineLen;
  const leather = smat('leather', 0x5a3d28, { rough: 0.7, scale: 5 });
  const brass = smat('metal', 0xa27a45, { rough: 0.45, metal: 0.25, scale: 4 });
  const metal = smat('metal', 0x46403a, { rough: 0.5, metal: 0.2, scale: 4 });
  const hd = rig.head;
  const H = B.head, hy = H.h * 0.72;

  if (race === 'minaa') {
    const scav = look === 'pell' || look === 'scavenger';
    if (look === 'player' && !f) {
      // the tinker man: a torn ochre sash over one shoulder, a bandolier of crystal cartridges across it,
      // goggles round his neck, an iron forearm (mi-naa-tinker-pair.png)
      strap(c, -1, smat('patched', 0xc8904a, { rough: 0.9, scale: 3 }), 0.09, 0.008);
      strap(c, 1, leather, 0.04, 0.016);
      const cart = [CRYSTAL_HEX.verdant, CRYSTAL_HEX.azure, CRYSTAL_HEX.violet, CRYSTAL_HEX.amber];
      for (let i = 0; i < 4; i++) {
        const t = (i - 1.5) * 0.06;
        lit(put(rig.spine, box(0.02, 0.045, 0.02), glow(c.glows, cart[i], 0.9, true, 0x2a2a2a), [-0.55 * t + 0.01, yS * 0.55 + 0.8 * t, -B.chestD - 0.028], [0, 0, 0.58]));
      }
      flap(c, rig.hips, smat('patched', 0xc8904a, { rough: 0.9, scale: 3, double: true }), [0.1, 0.02, -B.hipD - 0.02], 0.1, 0.36, { hang: 0.85, drag: 0.15, yaw: 0.3 });
      goggles(c, brass, leather);
      const iron = smat('metal', 0x3e3a36, { rough: 0.45, metal: 0.3, scale: 4 });
      put(rig.lFore, tube('ironfore2', d.foreArm, [[0, B.foreR + 0.012], [0.3, B.foreR + 0.014], [0.85, B.wristR + 0.012], [1, B.wristR + 0.01]], 10), iron);
      for (const y of [-0.01, -d.foreArm * 0.55]) put(rig.lFore, cyl(B.foreR + 0.016, B.foreR + 0.016, 0.02, 12), brass, [0, y, 0]);
      lit(put(rig.lFore, octa(0.02), glow(c.glows, 0x5fd0c0, 1.1, true, 0x1f6f6a), [0, -d.foreArm * 0.35, -B.foreR - 0.012], undefined, [1, 1.5, 1], 'crystal'));
    } else if (look === 'player' && f) {
      // the tinker woman: goggles on her brow, a bronze arm with two teal cells, a crystal at her throat
      const bronze = smat('metal', 0x8a6238, { rough: 0.45, metal: 0.25, scale: 4 });
      put(rig.lFore, tube('bronzefore', d.foreArm * 0.85, [[0, B.foreR + 0.012], [0.3, B.foreR + 0.014], [1, B.wristR + 0.012]], 10), bronze);
      for (let i = 0; i < 2; i++) lit(put(rig.lFore, octa(0.02), glow(c.glows, 0x5fd0c0, 1.1, true, 0x1f6f6a), [0, -d.foreArm * (0.3 + i * 0.3), -B.foreR - 0.012], undefined, [1, 1.5, 1], 'crystal'));
      goggles(c, brass, leather);
      lit(put(rig.spine, octa(0.014), glow(c.glows, 0x5fd0c0, 0.9, true, 0x1f6f6a), [0, yS - 0.06, -B.chestD - 0.03], undefined, [0.8, 1.6, 0.8]));
      put(rig.hips, box(0.06, 0.08, 0.035), leather, [0.14, -0.04, -B.hipD * 0.6], [0, 0.4, 0]);
    } else if (look === 'hadda') {
      // an iron hand, goggles, a pry bar across her back
      put(rig.rHand, box(0.05, 0.055, 0.04), metal, [0, -0.035, 0]);
      goggles(c, brass, leather);
      put(rig.spine, cyl(0.016, 0.016, 0.95, 6), metal, [0, yS * 0.55, B.chestD + 0.05], [0, 0, 0.9]);
    } else if (look === 'tarn') {
      flap(c, rig.hips, smat('cloth', 0xe0d4b6, { rough: 0.95, double: true, scale: 3 }), [0, 0.04, -B.hipD - 0.03], 0.24, 0.6, { front: true, curve: 0.22 });
      put(rig.hips, cyl(0.01, 0.01, 0.3, 5), smat('', 0x8a6a48), [0.17, -0.08, -0.02], [0.2, 0, 0.15]);
      put(rig.spine, ring(0.065, 0.007, 4, 14), brass, [0, yS - 0.04, -0.02], [Math.PI / 2 - 0.4, 0, 0]);
    } else if (look === 'digger') {
      put(rig.rArm, cyl(0.016, 0.016, 1.1, 5), smat('', 0x7a5a3a), [0.02, -0.25, -0.05], [0.3, 0, 0]);
      put(rig.rArm, box(0.16, 0.2, 0.02), metal, [0.02, -0.78, -0.2], [0.3, 0, 0]);
      put(hd, ring(H.w * 1.05, 0.012, 5, 18), smat('cloth', 0xa4502e), [0, hy + H.h * 0.35, 0], [Math.PI / 2, 0, 0], [1, H.d / H.w, 1]);
      put(rig.lShin, ball(0.06, 8, 6), metal, [0, -0.02, -0.03], undefined, [1, 1.2, 0.8]);
      strap(c, 1, leather, 0.04, 0.012);
    } else if (scav) {
      // a face scarf, a long gun, a satchel
      put(hd, ring(H.w * 0.92, 0.024, 6, 16), smat('cloth', 0x8a7458), [0, hy - H.h * 0.55, -0.01], [Math.PI / 2 + 0.2, 0, 0], [1, H.d / H.w, 1]);
      strap(c, -1, leather, 0.04, 0.02);
      put(rig.hips, box(0.17, 0.15, 0.08), leather, [-0.2, 0, 0.02]);
      put(rig.spine, cyl(0.02, 0.018, 0.95, 6), metal, [0.1, yS * 0.7, B.chestD + 0.05], [0, 0, -0.55]);
      flap(c, rig.spine, smat('patched', look === 'pell' ? 0x6e4e36 : 0x7a4a33, { rough: 0.95, double: true, scale: 3 }), [0, yS + 0.04, B.chestD * 0.9], 0.3, 0.5, { hang: 0.7, curve: 0.18, restX: -0.2 });
    } else {
      // crowd: one visible augment each (canon: the most augmented race)
      const k = r();
      if (k < 0.33) put(rig.lFore, tube('cbrace2', d.foreArm * 0.7, [[0, B.foreR + 0.012], [1, B.wristR + 0.01]], 8), metal);
      else if (k < 0.66) goggles(c, brass, leather);
      else put(hd, cyl(0.018, 0.018, 0.03, 8), brass, [H.w * 0.4, hy + H.h * 0.06, -H.d * 1.0], [1.3, 0, 0]);
      if (r() < 0.5) strap(c, 1, leather, 0.04, 0.02);
    }
    return;
  }

  if (race === 'sehari') {
    const fibre = smat('cloth', 0x9d8a66, { rough: 0.95, scale: 5 });
    const hairM = c.mats[M.hair];
    // dreadlocks: loose to the chest for him; for her gathered into a topknot, a tail arcing out behind
    if (f) {
      for (let i = 0; i < 9; i++) lock(c, hd, hairM, [(i - 4) * 0.012, hy + H.h * 0.95, H.d * 0.55], 0.4 + r() * 0.1, 0.019, [-0.35 + i * 0.02, (i - 4) * 0.05], 0.75);
      put(hd, cyl(0.03, 0.03, 0.028, 10), fibre, [0, hy + H.h * 0.9, H.d * 0.42], [0.5, 0, 0]);
    } else {
      // clumped dreads with fibre bindings, some falling in front of the shoulders (sehari-male-herd-protector.png)
      const fibreB = smat('cloth', 0xb89a62, { rough: 0.95, scale: 5 });
      for (let i = 0; i < 17; i++) {
        const a = -2.3 + (i / 16) * 4.6;
        const len = 0.34 + r() * 0.16;
        const p: [number, number, number] = [Math.sin(a) * H.w * 0.98, hy + H.h * 0.45, Math.cos(a) * H.d * 0.72 + 0.01];
        lock(c, hd, hairM, p, len, 0.022 + r() * 0.006, [-0.25 * Math.cos(a) - (Math.abs(a) > 1.6 ? 0.25 : 0), -0.3 * Math.sin(a)], 0.75);
        if (i % 3 === 0) put(hd, cyl(0.027, 0.027, 0.02, 8), fibreB, [p[0] * 1.02, p[1] - 0.07, p[2] * 1.02]);
      }
    }
    // river stone on a cord, crystal pouch at the hip (held close, never set in the body: canon)
    put(rig.spine, ring(B.neckR * 1.9, 0.004, 3, 14), fibre, [0, yS - 0.01, -0.005], [Math.PI / 2 - 0.5, 0, 0]);
    put(rig.spine, ball(0.019, 8, 6), smat('', 0x5a6a60, { rough: 0.4 }), [0, yS * 0.62, -B.chestD - 0.035], undefined, [1, 1.3, 0.6]);
    put(rig.hips, cyl(0.04, 0.03, 0.08, 8), fibre, [0.15, -0.07, -0.04]);
    lit(put(rig.hips, octa(0.024), glow(c.glows, CRYSTAL_HEX.amber, 1.0, true, 0x6a4418), [0.15, -0.01, -0.04], undefined, [1, 1.8, 1], 'crystal'));
    // the front panel with its rust root motif, the sash ends
    flap(c, rig.hips, smat('sehariMotif', 0xffffff, { rough: 0.95, double: true, scale: 1 }), [0.03, 0.03, -B.hipD - 0.035], 0.24, f ? 0.56 : 0.48, { front: true, curve: 0.18, taper: 1.15, yaw: 0.15 });
    const sash = smat('cloth', pal.sash ?? 0x4f8a86, { rough: 0.95, double: true, scale: 4 });
    flap(c, rig.hips, sash, [0.1, 0.05, -B.hipD * 0.9], 0.055, 0.4, { hang: 0.9, drag: 0.2, yaw: 0.35 });
    for (const s of S) put(s < 0 ? rig.lShin : rig.rShin, cyl(B.ankleR + 0.035, B.ankleR + 0.03, 0.05, 10), fibre, [0, -d.shin * 0.86, 0]);
    if (look === 'hunter') {
      const vest = smat('cloth', 0x5d6b5b, { rough: 0.95, double: true, scale: 3 });
      for (const s of S) flap(c, rig.spine, vest, [s * 0.075, yS - 0.02, -B.chestD - 0.03], 0.08, 0.44, { hang: 0.4, curve: 0.1 });
      bow(rig.spine, [0.02, yS * 0.55, B.chestD + 0.05]);
    }
    if (!f) strap(c, 1, smat('cloth', 0xd9ccb2, { rough: 0.95, scale: 3 }), 0.11, 0.01);
    else strap(c, -1, smat('cloth', 0x9d8a66, { rough: 0.95, scale: 3 }), 0.1, 0.03); // a darker fibre wrap, so her top reads as cloth

    return;
  }

  if (look === 'defender') {
    // the crescent shield on the left forearm, a crescent staff in the right hand, the big soul crystal
    const stone = c.mats[M.skin];
    const soul = glow(c.glows, 0x5fd8e8, 2.0, true, 0x1c6a76, true);
    lit(put(rig.spine, octa(0.065), soul, [0, yS * 0.62, -B.chestD - 0.02], undefined, [0.8, 1.5, 0.5], 'crystal'));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      put(rig.spine, ball(0.05, 8, 6), c.mats[M.nail], [Math.cos(a) * 0.08, yS * 0.62 + Math.sin(a) * 0.1, -B.chestD + 0.01], [0, 0, a], [0.4, 1.3, 0.35]);
    }
    for (const s of S) put(rig.spine, ball(0.14, 12, 9), stone, [s * d.shoulderW * 1.02, yS - 0.01, 0], [0, 0, -s * 0.5], [1.15, 0.6, 1.05]);
    const sh = new THREE.Object3D();
    sh.position.set(-0.1, -d.foreArm * 0.5, -0.02);
    sh.rotation.set(0, -0.3, 0);
    rig.lFore.add(sh);
    put(sh, ring(0.38, 0.06, 8, 22, Math.PI * 0.95), stone, [0, 0, 0], [0, Math.PI / 2, -Math.PI * 0.47], [1, 1, 0.5]);
    put(sh, ring(0.3, 0.035, 6, 20, Math.PI * 0.9), glow(c.glows, 0x5fe0d0, 0.9, false, 0x2a6a66, false), [0.01, 0, 0], [0, Math.PI / 2, -Math.PI * 0.45], [1, 1, 0.35]);
    const staff = new THREE.Object3D();
    staff.position.set(0, -0.08, 0);
    staff.rotation.set(Math.PI / 2 - 0.2, 0, 0);
    rig.rHand.add(staff);
    put(staff, cyl(0.025, 0.028, 1.9, 8), c.mats[M.nail], [0, 0.35, 0]);
    put(staff, ring(0.16, 0.03, 6, 16, Math.PI * 1.3), stone, [0, 1.36, 0], [0, 0, Math.PI * 0.85]);
    lit(put(staff, octa(0.05), glow(c.glows, 0x5fd8e8, 1.6, true, 0x1c6a76, false), [0, 1.36, 0], undefined, [0.7, 1.4, 0.7], 'crystal'));
    const cream = smat('cloth', 0xd8ccb0, { rough: 0.95, double: true, scale: 3 });
    flap(c, rig.hips, cream, [0, 0.04, -B.hipD - 0.03], 0.3, 0.62, { front: true, curve: 0.2, taper: 0.7 });
    flap(c, rig.hips, cream, [0, 0.04, B.hipD + 0.03], 0.32, 0.55, { back: true, curve: 0.2, taper: 0.8, yaw: Math.PI });
    flap(c, rig.hips, smat('cloth', 0x3f7a74, { rough: 0.95, double: true, scale: 3 }), [0.05, 0.03, -B.hipD - 0.045], 0.06, 0.58, { front: true, hang: 0.9 });
    return;
  }

  // Iskari serving line: the soul crystal, shown and never explained
  const soul = glow(c.glows, 0x5fd8e8, 1.4, true, 0x1c6a76, true);
  lit(put(rig.spine, octa(0.042), soul, [0, yS * 0.62, -B.chestD - 0.012], undefined, [0.8, 1.5, 0.55], 'crystal'));
  put(rig.spine, ring(0.045, 0.009, 5, 10), c.mats[M.nail], [0, yS * 0.62, -B.chestD - 0.004], undefined, [0.85, 1.4, 1]);
  if (look === 'apprentice') {
    const leather2 = smat('leather', 0x6b4a30, { rough: 0.8, scale: 5 });
    strap(c, -1, leather2, 0.04, 0.03);
    put(rig.hips, box(0.2, 0.17, 0.08), leather2, [-0.26, -0.04, 0.02]);
    const parch = smat('cloth', 0xd9c9a4, { scale: 4 });
    put(rig.hips, cyl(0.02, 0.02, 0.16, 6), parch, [-0.29, 0.08, 0.02], [0, 0, 0.3]);
    put(rig.hips, cyl(0.018, 0.018, 0.14, 6), parch, [-0.23, 0.07, 0.03], [0.2, 0, -0.2]);
    put(rig.spine, ring(B.neckR * 2.2, 0.026, 6, 14), c.mats[M.sash], [0, yS + 0.005, 0], [Math.PI / 2 + 0.1, 0, 0]);
    return;
  }
  const leather2 = smat('leather', 0x6b4a30, { rough: 0.8, scale: 5 });
  if (f) {
    // teal headband, a satchel on a strap
    const hb = smat('cloth', 0x4f8a86, { rough: 0.95, double: true, scale: 4 });
    put(hd, ring(H.w * 1.02, 0.014, 6, 20), hb, [0, hy + H.h * 0.42, 0.005], [Math.PI / 2 + 0.1, 0, 0], [1, H.d / H.w * 1.05, 1.6]);
    flap(c, hd, hb, [0.02, hy + H.h * 0.4, H.d * 1.02], 0.03, 0.2, { hang: 0.7, drag: 0.2 });
    // the wrap top goes over one shoulder
    strap(c, -1, smat('cloth', 0xe0d6c0, { rough: 0.95, scale: 3 }), 0.06, 0.012);
  } else {
    // an open dusty-violet vest over the stone chest, a long teal cloth hanging in front
    flap(c, rig.hips, smat('cloth', 0x4f8a86, { rough: 0.95, double: true, scale: 4 }), [0, 0.03, -B.hipD - 0.04], 0.16, 0.46, { front: true, curve: 0.14, taper: 0.9 });
  }
  strap(c, f ? -1 : 1, leather2, 0.03, 0.03);
  put(rig.hips, box(0.12, 0.11, 0.055), leather2, [f ? -0.19 : 0.19, -0.05, 0.02]);
}

function goggles(c: Ctx, brass: THREE.Material, leather: THREE.Material): void {
  const H = c.B.head, hy = H.h * 0.72;
  const hd = c.rig.head;
  put(hd, ring(H.w * 1.08, 0.008, 5, 22), leather, [0, hy + H.h * 0.45, 0.004], [Math.PI / 2 + 0.12, 0, 0], [1, H.d / H.w * 1.04, 1]);
  for (const s of S) {
    put(hd, cyl(0.03, 0.03, 0.03, 12), brass, [s * 0.036, hy + H.h * 0.58, -H.d * 0.92], [0.8, 0, 0]);
    put(hd, cyl(0.022, 0.022, 0.032, 12), smat('', 0x6a8a88, { rough: 0.15, metal: 0.3 }), [s * 0.036, hy + H.h * 0.58, -H.d * 0.92], [0.8, 0, 0]);
  }
}

function bow(parent: THREE.Object3D, p: V3): void {
  const wood = smat('', 0x5a4030, { rough: 0.8 });
  const g = new THREE.Object3D();
  g.position.set(p[0], p[1], p[2]);
  g.rotation.z = 0.35;
  parent.add(g);
  put(g, ring(0.5, 0.013, 5, 16, 1.9), wood, [0.35, 0, 0], [0, 0, Math.PI - 0.95]);
  put(g, cyl(0.003, 0.003, 0.8, 3), smat('', 0xd8ccb2), [0.02, 0, 0]);
}

/** What each role carries, so the role reads at a glance too. */
function roleKit(c: Ctx, role: string): void {
  const { rig, race, B } = c;
  const yS = B.dims.spineLen;
  const wood = smat('', 0x8a6a48, { rough: 0.8 });
  const metal = smat('metal', 0x4a423a, { rough: 0.5, metal: 0.2, scale: 4 });
  const stone = smat('iskari', 0xcfc5b2, { rough: 0.9, scale: 3 });
  const back = new THREE.Object3D();
  back.position.set(0, yS * 0.55, B.chestD + 0.06);
  rig.spine.add(back);
  switch (role) {
    case 'frontline': {
      const sm = race === 'iskari' ? stone : race === 'sehari' ? smat('leather', 0x8a6a4a, { scale: 4 }) : metal;
      put(back, cyl(0.22, 0.22, 0.03, 16), sm, [0, 0.02, 0.02], [Math.PI / 2, 0, 0]);
      put(back, cyl(0.04, 0.04, 0.04, 10), smat('metal', 0xa27a45, { metal: 0.25, scale: 4 }), [0, 0.02, 0.04], [Math.PI / 2, 0, 0]);
      put(back, cyl(0.013, 0.013, 1.5, 6), wood, [0.05, 0.1, -0.02], [0, 0, 0.3]);
      put(back, cone(0.028, 0.14, 5), race === 'sehari' ? smat('', 0x5a8a78, { rough: 0.4 }) : metal, [-0.17, 0.8, -0.02], [0, 0, 0.3]);
      break;
    }
    case 'ranged': {
      if (race === 'sehari') { bow(rig.spine, [0.02, yS * 0.55, back.position.z]); break; }
      if (race === 'iskari') {
        put(rig.rFore, tube('proj2', B.dims.foreArm * 0.8, [[0, B.foreR + 0.02], [0.5, B.foreR + 0.025], [1, B.wristR + 0.02]], 10), stone);
        lit(put(rig.rFore, ball(0.028, 8, 6), glow(c.glows, CRYSTAL_HEX.amber, 1.1, true, 0x6a4418), [0, -B.dims.foreArm * 0.5, -B.foreR - 0.02], undefined, [1, 1.5, 1], 'crystal'));
        break;
      }
      put(back, cyl(0.022, 0.02, 1.0, 6), metal, [0.05, 0.1, 0], [0, 0, -0.5]);
      put(back, box(0.06, 0.18, 0.05), wood, [0.25, -0.28, 0], [0, 0, -0.5]);
      break;
    }
    case 'channeller': {
      const g = new THREE.Object3D();
      g.position.set(0, -0.1, 0);
      g.rotation.z = 0.3;
      back.add(g);
      put(g, cyl(0.018, 0.022, 1.4, 6), smat('', 0xb49c78), [0, 0.1, 0]);
      for (const s of S) put(g, cone(0.018, 0.2, 5), smat('', 0xb49c78), [s * 0.04, 0.85, 0], [0, 0, -s * 0.35]);
      lit(put(g, octa(0.045), glow(c.glows, CRYSTAL_HEX.verdant, 1.4, true, 0x2c5a34), [0, 0.85, 0], undefined, [0.8, 1.5, 0.8], 'crystal'));
      break;
    }
    case 'scout': {
      flap(c, rig.spine, smat('cloth', race === 'minaa' ? 0x8a6a4a : 0xcfc2a4, { rough: 0.95, double: true, scale: 3 }), [0, yS + 0.02, back.position.z - 0.03], 0.36, 0.52, { hang: 0.75, curve: 0.2, restX: -0.15 });
      put(rig.hips, box(0.025, 0.3, 0.04), metal, [0.17, -0.15, 0.02], [0.1, 0, 0.12]);
      break;
    }
    case 'healer': {
      const bag = smat('leather', 0x7a5236, { rough: 0.8, scale: 5 });
      put(rig.hips, box(0.2, 0.16, 0.08), bag, [-0.2, -0.02, 0.02]);
      lit(put(rig.hips, octa(0.02), glow(c.glows, CRYSTAL_HEX.crimson, 1.1, true, 0x5a1a14), [-0.2, 0.0, -0.03], undefined, [1, 1.4, 1], 'crystal'));
      strap(c, 1, bag, 0.035, 0.03);
      put(back, cyl(0.05, 0.05, 0.22, 10), smat('cloth', 0xe6dcc4, { scale: 4 }), [0, 0.2, 0], [0, 0, Math.PI / 2]);
      break;
    }
    case 'tech': {
      put(back, cyl(0.06, 0.06, 0.28, 10), smat('leather', 0x6a4a30, { scale: 5 }), [0, 0.18, 0], [0, 0, Math.PI / 2]);
      put(back, box(0.14, 0.16, 0.08), metal, [0, -0.02, 0.02]);
      put(back, cyl(0.03, 0.03, 0.14, 10), smat('metal', 0xa27a45, { metal: 0.25, scale: 4 }), [0.1, -0.02, 0.03], [Math.PI / 2, 0, 0]);
      break;
    }
  }
}

// ================================================================= the defensive-line Iskari

/** States: 'dormant' (frozen mid-stride under a crust), 'waking', 'awake', 'dead'. */
export function buildDefender(opts: ModelOpts): Model {
  return buildSculpted('iskari', 'male', 'defender', opts, 'defender', undefined, (spec, c) => {
    const { rig } = c;
    const r = rng(seedOf(opts.seed, 'defender', 'crust'));
    // the crust: sand-stone chunks on every limb, a per-instance material so it can fade as it falls
    const crustMat = new THREE.MeshStandardMaterial({ color: 0xc9ab84, map: tex('iskari'), roughness: 1, flatShading: true, transparent: true, opacity: 1 });
    crustMat.userData.noOcc = true;
    const shards: Array<{ m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; delay: number; home: THREE.Object3D }> = [];
    const parts: Array<[THREE.Object3D, number, number, number]> = [
      [rig.spine, 22, 0.66, 0.26], [rig.hips, 8, 0.18, 0.22], [rig.head, 6, 0.26, 0.12],
      [rig.lArm, 6, -0.4, 0.11], [rig.rArm, 6, -0.4, 0.11], [rig.lFore, 5, -0.36, 0.09], [rig.rFore, 5, -0.36, 0.09],
      [rig.lLeg, 7, -0.55, 0.14], [rig.rLeg, 7, -0.55, 0.14], [rig.lShin, 5, -0.48, 0.1], [rig.rShin, 5, -0.48, 0.1],
    ];
    for (const [joint, n, span, rad] of parts) {
      for (let i = 0; i < n; i++) {
        const t = r(), a = r() * Math.PI * 2;
        const m = put(joint, ico(0.05 + r() * 0.06, 0), crustMat, [Math.cos(a) * rad * (0.85 + r() * 0.3), t * span, Math.sin(a) * rad * (0.85 + r() * 0.3)], [r() * 3, r() * 3, r() * 3], [1, 0.6 + r() * 0.6, 1]);
        m.userData.keep = true;
        shards.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), delay: r() * 0.9, home: joint });
      }
    }
    type St = 'dormant' | 'waking' | 'awake' | 'dead';
    let state: St = 'dormant';
    let wakeT = 0, level = 0, fallen = false;
    const frozen = (o: Pose) => {
      // mid-stride at its post: left foot forward, staff held low, shield up
      add(o, J.lLeg, 0.5, 0, -0.04); add(o, J.lShin, -0.35); add(o, J.lFoot, 0.2);
      add(o, J.rLeg, -0.35, 0, 0.05); add(o, J.rShin, -0.25); add(o, J.rFoot, 0.55);
      add(o, J.spine, -0.12, 0.2); add(o, J.head, 0.05, -0.2);
      add(o, J.lArm, 0.55, 0, -0.25); add(o, J.lFore, 1.1);
      add(o, J.rArm, 0.15, 0, 0.2); add(o, J.rFore, 0.4);
    };
    const stance = (o: Pose, k: number) => {
      // ready stance: wide, low, shield forward, staff back
      const br = Math.sin(k * 1.4) * 0.02;
      add(o, J.lLeg, 0.35, 0, -0.18); add(o, J.lShin, -0.55); add(o, J.lFoot, 0.25);
      add(o, J.rLeg, -0.1, 0, 0.18); add(o, J.rShin, -0.6); add(o, J.rFoot, 0.5);
      add(o, J.spine, -0.07 + br, 0.3); add(o, J.head, 0.04, -0.3);
      add(o, J.lArm, 0.8, 0, -0.35); add(o, J.lFore, 1.2);
      add(o, J.rArm, 0.1, 0, 0.3); add(o, J.rFore, 0.55);
    };
    spec.style = { ...spec.style, life: 0.3, walkHz: 1.05, stride: 0.62, armSwing: 0.15, hipSway: 0.02, shoulderSway: 0.1, lengths: { attack: 0.8, hit: 0.4, die: 1.6, wake: 2.4 } };
    spec.height = 2.5;
    spec.restAnim = () => (state === 'dormant' ? 'sleep' : 'idle');
    spec.post = (o, cx) => {
      if (state === 'dormant' || cx.anim === 'sleep') { o.fill(0); frozen(o); return; }
      if (state === 'waking') {
        const u = wakeT * wakeT * (3 - 2 * wakeT);
        const A2 = new Float32Array(o.length), B2 = new Float32Array(o.length);
        frozen(A2); stance(B2, cx.clock);
        o.fill(0);
        const shake = wakeT < 0.4 ? 0.03 * Math.sin(cx.clock * 60) * (wakeT / 0.4) : 0;
        for (let i = 0; i < o.length; i++) o[i] = A2[i] + (B2[i] - A2[i]) * u;
        add(o, J.spine, shake, shake * 0.5);
        add(o, J.head, -0.25 * Math.sin(Math.min(1, wakeT * 1.5) * Math.PI)); // the head comes up last
        return;
      }
      if (cx.anim === 'idle' || cx.anim === 'talk') stance(o, cx.clock);
      if (cx.anim === 'walk' || cx.anim === 'run') { add(o, J.lArm, 0.6, 0, -0.3); add(o, J.lFore, 1.0); add(o, J.spine, -0.1); }
      if (cx.anim === 'attack') {
        const T = [0, 0.35, 0.5, 0.65, 1];
        const kk = (v: number[]) => kf(cx.p, T, v);
        add(o, J.rArm, kk([0, 2.6, 0.2, 0.3, 0]), 0, kk([0, 0.3, -0.2, -0.2, 0]));
        add(o, J.rFore, kk([0, 0.6, 0.1, 0.1, 0]));
        add(o, J.spine, kk([0, 0.1, -0.35, -0.3, 0]), kk([0, -0.4, 0.45, 0.4, 0]));
        add(o, J.lArm, 0.7, 0, -0.3); add(o, J.lFore, 1.1);
      }
    };
    spec.frame = (_cur, cx, dt) => {
      if (state === 'waking') { wakeT = Math.min(1, wakeT + dt / 2.4); if (wakeT >= 1) state = 'awake'; }
      if ((state === 'waking' || state === 'awake' || state === 'dead') && !fallen) {
        const root = rig.body.parent?.parent?.parent;
        let alive = 0;
        for (const s of shards) {
          if (s.delay > 0) { s.delay -= dt; alive++; continue; }
          if (s.m.parent === s.home) {
            (root ?? rig.body).attach(s.m);
            s.v.set((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6);
            s.w.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
          }
          s.v.y -= 9 * 0.9 * dt;
          s.m.position.addScaledVector(s.v, dt);
          if (root && s.m.position.y < 0.03) { s.m.position.y = 0.03; s.v.multiplyScalar(0.3); s.v.y = 0; s.w.multiplyScalar(0.5); }
          s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt; s.m.rotation.z += s.w.z * dt;
          alive++;
        }
        if (wakeT > 0.75) crustMat.opacity = Math.max(0, 1 - (wakeT - 0.75) * 4);
        if (crustMat.opacity <= 0 || alive === 0) { fallen = true; for (const s of shards) s.m.parent?.remove(s.m); crustMat.dispose(); }
      }
      void cx;
    };
    spec.glowLevel = (k, dt) => {
      let want = 0;
      if (state === 'waking') want = wakeT < 0.3 ? 0.4 * Math.abs(Math.sin(k * 25)) : wakeT;
      else if (state === 'awake') want = 1 + 0.08 * Math.sin(k * 2);
      level += (want - level) * Math.min(1, dt * 4);
      return level;
    };
    spec.setState = (s, ctl) => {
      if (s === 'dormant' || s === 'asleep') { state = 'dormant'; wakeT = 0; if (ctl.anim() !== 'die') ctl.play('sleep'); }
      else if (s === 'waking') { if (state === 'dormant') { state = 'waking'; wakeT = 0; ctl.play('idle'); } }
      else if (s === 'awake' || s === 'hostile' || s === 'active') {
        if (state === 'dormant') { state = 'waking'; wakeT = 0.99; }
        else if (state !== 'waking') state = 'awake';
        if (ctl.anim() === 'sleep') ctl.play('idle');
      } else if (s === 'dead') state = 'dead';
    };
  });
}

/** Sehari stand with a predator's forward weight: head low and forward, long arms hanging ahead of the hips. */
function sehariStance(o: Pose, c: PoseCtx): void {
  if (c.anim !== 'idle' && c.anim !== 'talk') return;
  add(o, J.spine, -0.16); add(o, J.head, 0.14);
  add(o, J.lArm, 0.22, 0, -0.04); add(o, J.rArm, 0.18, 0, 0.04);
  add(o, J.lFore, 0.25); add(o, J.rFore, 0.3);
}
