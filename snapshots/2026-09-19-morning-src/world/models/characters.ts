// Procedural people: Mi'naa, Sehari and Iskari, male and female bodies, the player's role kit,
// and the named NPCs. Creatures and machines live in char-creatures.ts.
// 1 unit = 1 metre, forward is -Z. Every body part is a lathe or a panel, textured in char-tex.ts.
//
// Reading at a glance, from the concept art:
//   Mi'naa  warm skin, patched ochre and rust cloth, goggles, dark metal and brass, one augmented arm.
//   Sehari  cool grey-lavender skin with clay cracks and dark root markings, long arms and claws,
//           dreadlocks, pointed ears, undyed bone cloth with a rust motif border, a teal sash.
//   Iskari  pale weathered stone in plates, a crest on the skull, a teal soul crystal in the chest,
//           digitigrade legs on two-toed hooves, a cream wrap and a rust or teal sash.
// Sex reads from shoulder to hip ratio, waist, chest, jaw, neck and hair. Iskari are shaped the same
// way, because their bodies were made to match specific Aza'los (canon), without being a sex.
import * as THREE from 'three';
import type { EntityKind } from '../../core/contracts';
import { CRYSTAL_HEX, type Model, type ModelOpts } from './types';
import { ball, box, cone, cyl, glow, ico, lit, mat, octa, pick, put, ring, rng, seedOf, shade, type Glow, type V3 } from './char-kit';
import { J, add, kf, makeCharModel, makeRig, restPose, type CharSpec, type Dims, type Pose, type PoseCtx, type Rig, type Style } from './char-rig';
import { column, headGeo, panel, skirt, swayPivot, tmat, tube, type HeadShape, type Sway } from './char-parts';
import { tex } from './char-tex';
import { buildDog, buildDrone, buildTelsharin } from './char-creatures';
import { buildSculpted, buildDefender as buildSculptedDefender, buildTelsharinSculpted } from './char-people';

export type Body = 'male' | 'female';
type Race = 'minaa' | 'sehari' | 'iskari';

export function buildCharacter(kind: EntityKind, opts: ModelOpts = {}): Model {
  switch (kind) {
    // for the player, `look` carries the role: the body always dresses as the player, the role adds its kit
    case 'player-minaa': return buildSculpted('minaa', opts.body ?? 'male', 'player', opts, kind, opts.look);
    case 'player-sehari': return buildSculpted('sehari', opts.body ?? 'male', 'player', opts, kind, opts.look);
    case 'player-iskari': return buildSculpted('iskari', opts.body ?? 'male', 'player', opts, kind, opts.look);
    case 'npc-minaa': return buildSculpted('minaa', opts.body ?? crowdBody(opts, kind), opts.look ?? 'crowd', opts, kind);
    case 'npc-scavenger': return buildSculpted('minaa', opts.body ?? 'male', opts.look ?? 'scavenger', opts, kind);
    case 'npc-sehari': return buildSculpted('sehari', opts.body ?? 'female', opts.look ?? 'hunter', opts, kind);
    case 'npc-apprentice': return buildSculpted('iskari', opts.body ?? 'male', opts.look ?? 'apprentice', opts, kind);
    case 'telsharin': return buildTelsharinSculpted(opts);
    case 'guardian':
    case 'drone': return buildDrone(opts);
    case 'defender': return buildSculptedDefender(opts);
    case 'dog': return buildDog(opts);
    default:
      console.warn(`[characters] no character model for '${kind}', using a Mi'naa`);
      return buildSculpted('minaa', 'male', 'crowd', opts, kind);
  }
}

function crowdBody(opts: ModelOpts, kind: string): Body {
  return rng(seedOf(opts.seed, opts.name, kind + 'sex'))() < 0.5 ? 'male' : 'female';
}

const S = [-1, 1] as const; // left, right
/** Head centre above the head joint, as a fraction of head half-height. */
const HY = 0.66;

// ================================================================= anatomy

interface Anat {
  dims: Dims;
  height: number;
  /** Torso lathe on the spine joint: [y, radius], y from the hips joint up. */
  torso: Array<[number, number]>;
  torsoScale: [number, number];
  pelvis: Array<[number, number]>;
  pelvisScale: [number, number];
  neck: number;
  arm: Array<[number, number]>;
  fore: Array<[number, number]>;
  thigh: Array<[number, number]>;
  shin: Array<[number, number]>;
  hand: [number, number, number];
  bust: number;
  deltoid: number;
  head: HeadShape;
}

function anatomy(race: Race, body: Body, look: string): Anat {
  // limbs read too thin at game zoom: every limb is thickened here, in one place
  const a = anatomyBase(race, body, look);
  const thick = (p: Array<[number, number]>, k: number) => p.map(([t, r]) => [t, r * k] as [number, number]);
  a.arm = thick(a.arm, 1.25); a.fore = thick(a.fore, 1.25); a.thigh = thick(a.thigh, 1.2); a.shin = thick(a.shin, 1.22);
  a.neck *= race === "minaa" ? 1.1 : 1.3;
  // slightly big heads read better from the game camera
  a.head = { ...a.head, w: a.head.w * 1.08, h: a.head.h * 1.08, d: a.head.d * 1.08 };
  // Sex has to read in the silhouette (round 1 critic): wider hips and a narrow waist, or wider shoulders.
  if (body === 'female') {
    a.pelvisScale = [a.pelvisScale[0] * 1.12, a.pelvisScale[1]];
    a.torso = a.torso.map(([y, r], i) => [y, i === 1 || i === 2 ? r * 0.88 : r] as [number, number]);
  } else {
    a.torsoScale = [a.torsoScale[0] * 1.12, a.torsoScale[1]];
    a.dims = { ...a.dims, shoulderW: a.dims.shoulderW * 1.1 };
  }
  // Sehari arms are longer than human (canon): the hands hang near the knee
  if (race === 'sehari') a.dims = { ...a.dims, upperArm: a.dims.upperArm + 0.05, foreArm: a.dims.foreArm + 0.05 };
  return a;
}

function anatomyBase(race: Race, body: Body, look: string): Anat {
  const f = body === 'female';
  if (race === 'minaa') {
    const heavy = look === 'hadda' || look === 'tarn' || look === 'digger';
    const w = heavy ? 1.12 : 1;
    const d: Dims = f
      ? { thigh: 0.41, shin: 0.4, meta: 0, footH: 0.07, hipW: 0.1, spineLen: 0.47, shoulderW: 0.165 * w, upperArm: 0.27, foreArm: 0.24, neck: 0.11 }
      : { thigh: 0.44, shin: 0.43, meta: 0, footH: 0.07, hipW: 0.095, spineLen: 0.52, shoulderW: 0.2 * w, upperArm: 0.29, foreArm: 0.26, neck: 0.12 };
    return {
      dims: d, height: f ? 1.66 : 1.78,
      torso: f
        ? [[0, 0.12 * w], [0.1, 0.108 * w], [0.2, 0.118 * w], [0.3, 0.13 * w], [0.4, 0.13 * w], [0.47, 0.085]]
        : [[0, 0.125 * w], [0.12, 0.13 * w], [0.24, 0.145 * w], [0.36, 0.16 * w], [0.46, 0.16 * w], [0.52, 0.095]],
      torsoScale: f ? [1.18, 0.74] : [1.28, 0.7],
      pelvis: f ? [[-0.13, 0.11 * w], [-0.06, 0.158 * w], [0.02, 0.15 * w], [0.08, 0.12 * w]] : [[-0.12, 0.1 * w], [-0.05, 0.135 * w], [0.03, 0.135 * w], [0.08, 0.125 * w]],
      pelvisScale: f ? [1.12, 0.82] : [1.05, 0.78],
      neck: f ? 0.036 : 0.047,
      arm: f ? [[0, 0.046], [0.25, 0.046], [0.7, 0.036], [1, 0.03]] : [[0, 0.058], [0.3, 0.058], [0.7, 0.045], [1, 0.037]],
      fore: f ? [[0, 0.032], [0.25, 0.036], [1, 0.024]] : [[0, 0.038], [0.25, 0.045], [1, 0.029]],
      thigh: f ? [[0, 0.085], [0.3, 0.078], [1, 0.047]] : [[0, 0.08], [0.3, 0.078], [1, 0.05]],
      shin: f ? [[0, 0.047], [0.3, 0.05], [1, 0.03]] : [[0, 0.05], [0.3, 0.056], [1, 0.034]],
      hand: f ? [0.033, 0.055, 0.02] : [0.04, 0.065, 0.024],
      bust: f ? 0.055 * (heavy ? 1.2 : 1) : 0, deltoid: f ? 0.045 : 0.062 * w,
      head: f
        ? { w: 0.086, h: 0.112, d: 0.104, jaw: 0.25, chin: 0.06, brow: 0.05, cheek: 0.16, back: 1.05, crown: 0, socket: 0.05 }
        : { w: 0.092, h: 0.118, d: 0.108, jaw: 0.8, chin: 0.1, brow: 0.12, cheek: 0.1, back: 1.05, crown: 0, socket: 0.06 },
    };
  }
  if (race === 'sehari') {
    const d: Dims = f
      ? { thigh: 0.46, shin: 0.45, meta: 0, footH: 0.06, hipW: 0.09, spineLen: 0.46, shoulderW: 0.145, upperArm: 0.35, foreArm: 0.34, neck: 0.12 }
      : { thigh: 0.48, shin: 0.47, meta: 0, footH: 0.06, hipW: 0.085, spineLen: 0.5, shoulderW: 0.17, upperArm: 0.37, foreArm: 0.36, neck: 0.13 };
    return {
      dims: d, height: f ? 1.8 : 1.9,
      torso: f
        ? [[0, 0.11], [0.1, 0.095], [0.2, 0.105], [0.3, 0.118], [0.4, 0.115], [0.46, 0.07]]
        : [[0, 0.112], [0.12, 0.11], [0.24, 0.128], [0.36, 0.14], [0.45, 0.138], [0.5, 0.08]],
      torsoScale: f ? [1.15, 0.72] : [1.22, 0.68],
      pelvis: f ? [[-0.12, 0.1], [-0.05, 0.14], [0.03, 0.128], [0.08, 0.105]] : [[-0.11, 0.09], [-0.05, 0.118], [0.03, 0.115], [0.08, 0.108]],
      pelvisScale: f ? [1.1, 0.8] : [1.05, 0.78],
      neck: f ? 0.03 : 0.036,
      arm: f ? [[0, 0.04], [0.3, 0.038], [0.75, 0.03], [1, 0.026]] : [[0, 0.046], [0.3, 0.046], [0.75, 0.035], [1, 0.03]],
      fore: f ? [[0, 0.028], [0.25, 0.032], [1, 0.02]] : [[0, 0.032], [0.25, 0.037], [1, 0.023]],
      thigh: f ? [[0, 0.075], [0.3, 0.07], [1, 0.04]] : [[0, 0.072], [0.3, 0.07], [1, 0.043]],
      shin: f ? [[0, 0.042], [0.25, 0.046], [1, 0.026]] : [[0, 0.044], [0.25, 0.05], [1, 0.028]],
      hand: f ? [0.03, 0.08, 0.016] : [0.034, 0.09, 0.018],
      bust: f ? 0.045 : 0, deltoid: f ? 0.036 : 0.048,
      head: f
        ? { w: 0.074, h: 0.125, d: 0.1, jaw: 0.1, chin: 0.14, brow: 0.06, cheek: 0.22, back: 1.15, crown: 0.12, socket: 0.1 }
        : { w: 0.078, h: 0.13, d: 0.102, jaw: 0.35, chin: 0.16, brow: 0.1, cheek: 0.2, back: 1.15, crown: 0.12, socket: 0.1 },
    };
  }
  if (look === 'defender') {
    // defensive line (canon): larger, broader, denser. Same skin, eyes and head shape as the serving line.
    return {
      dims: { thigh: 0.58, shin: 0.5, meta: 0.17, footH: 0.05, hipW: 0.14, spineLen: 0.66, shoulderW: 0.29, upperArm: 0.43, foreArm: 0.39, neck: 0.11 },
      height: 2.5,
      torso: [[0, 0.16], [0.14, 0.165], [0.3, 0.2], [0.46, 0.235], [0.58, 0.225], [0.66, 0.12]],
      torsoScale: [1.3, 0.72],
      pelvis: [[-0.13, 0.13], [-0.06, 0.17], [0.03, 0.17], [0.09, 0.16]],
      pelvisScale: [1.1, 0.8],
      neck: 0.06,
      arm: [[0, 0.085], [0.3, 0.09], [0.7, 0.068], [1, 0.055]],
      fore: [[0, 0.06], [0.3, 0.07], [1, 0.045]],
      thigh: [[0, 0.12], [0.35, 0.12], [1, 0.07]],
      shin: [[0, 0.07], [0.3, 0.075], [1, 0.045]],
      hand: [0.05, 0.1, 0.03],
      bust: 0, deltoid: 0.095,
      head: { w: 0.088, h: 0.115, d: 0.114, jaw: 1, chin: 0.1, brow: 0.2, cheek: 0.16, back: 1.3, crown: 0.08, socket: 0.08, seg: 12 },
    };
  }
  // Iskari: tall and lean, long neck, digitigrade legs on hooves. The apprentice is old and a little shorter.
  const old = look === 'apprentice';
  const d: Dims = f
    ? { thigh: 0.48, shin: 0.43, meta: 0.13, footH: 0.04, hipW: 0.1, spineLen: 0.52, shoulderW: 0.165, upperArm: 0.35, foreArm: 0.32, neck: 0.14 }
    : { thigh: 0.5, shin: 0.45, meta: 0.14, footH: 0.04, hipW: 0.1, spineLen: 0.56, shoulderW: 0.205, upperArm: 0.37, foreArm: 0.34, neck: 0.13 };
  return {
    dims: d, height: (f ? 1.96 : 2.04) - (old ? 0.06 : 0),
    torso: f
      ? [[0, 0.11], [0.1, 0.092], [0.22, 0.108], [0.34, 0.125], [0.44, 0.122], [0.52, 0.07]]
      : [[0, 0.112], [0.12, 0.11], [0.26, 0.135], [0.38, 0.158], [0.48, 0.155], [0.56, 0.085]],
    torsoScale: f ? [1.15, 0.72] : [1.3, 0.68],
    pelvis: f ? [[-0.12, 0.1], [-0.05, 0.142], [0.03, 0.13], [0.08, 0.105]] : [[-0.11, 0.09], [-0.05, 0.122], [0.03, 0.12], [0.08, 0.11]],
    pelvisScale: f ? [1.1, 0.8] : [1.05, 0.76],
    neck: f ? 0.034 : 0.044,
    arm: f ? [[0, 0.042], [0.3, 0.04], [0.7, 0.032], [1, 0.028]] : [[0, 0.055], [0.3, 0.054], [0.7, 0.04], [1, 0.034]],
    fore: f ? [[0, 0.03], [0.25, 0.034], [1, 0.022]] : [[0, 0.036], [0.25, 0.043], [1, 0.027]],
    thigh: f ? [[0, 0.078], [0.3, 0.07], [1, 0.042]] : [[0, 0.08], [0.3, 0.078], [1, 0.047]],
    shin: f ? [[0, 0.042], [0.3, 0.04], [1, 0.026]] : [[0, 0.048], [0.3, 0.046], [1, 0.03]],
    hand: f ? [0.03, 0.075, 0.018] : [0.036, 0.085, 0.021],
    bust: f ? 0.04 : 0, deltoid: f ? 0.04 : 0.058,
    head: f
      ? { w: 0.078, h: 0.11, d: 0.112, jaw: 0.45, chin: 0.08, brow: 0.1, cheek: 0.18, back: 1.4, crown: 0.22, socket: 0.07, seg: 12 }
      : { w: 0.085, h: 0.115, d: 0.112, jaw: 0.9, chin: 0.1, brow: 0.16, cheek: 0.16, back: 1.35, crown: 0.1, socket: 0.07, seg: 12 },
  };
}

// ================================================================= materials by race

interface Kit {
  skin: THREE.Material;
  /** Skin with markings: one arm and one leg for Sehari. */
  marked: THREE.Material;
  eye: THREE.Material;
  hair: THREE.Material;
  claw: THREE.Material;
}

function raceKit(race: Race, r: () => number, look: string, glows: Glow[]): Kit {
  if (race === 'minaa') {
    const tone = look === 'player' ? 0 : (r() - 0.5) * 0.12;
    const skinHex = shade(look === 'tarn' ? 0xb88462 : look === 'hadda' ? 0xa87450 : 0xc08a64, 0, 0, tone);
    const skin = tmat('skin', skinHex, { rough: 0.75 });
    const hairHex = look === 'tarn' ? 0x8a8078 : pick(r, [0x2b211b, 0x3a2a1e, 0x1f1a17, 0x4a3524]);
    return { skin, marked: skin, eye: tmat('', 0x1c1612, { rough: 0.3 }), hair: tmat('hair', hairHex, { rough: 0.95 }), claw: tmat('', 0x6a5448) };
  }
  if (race === 'sehari') {
    const skinHex = shade(0xbdb1c4, 0, 0, look === 'player' ? 0 : (r() - 0.5) * 0.06);
    return {
      skin: tmat('sehari', skinHex, { rough: 0.85, rep: [1, 1.5] }),
      marked: tmat('sehariRoots', skinHex, { rough: 0.85 }),
      // pale-gold luminous eyes (canon)
      eye: glow(glows, 0xf0b840, 0.55, true, 0xc89030, false),
      hair: tmat('hair', 0x231d22, { rough: 0.95, rep: [3, 1] }),
      claw: tmat('', 0x2a2226, { rough: 0.5 }),
    };
  }
  if (look === 'defender') {
    // its own stone material: the teal seams are an emissive map the game wakes up, per instance
    const stone = new THREE.MeshStandardMaterial({
      color: 0xddd2bf, map: tex('defender'), roughness: 0.88, metalness: 0.02, flatShading: true,
      emissive: 0x5fe0d0, emissiveMap: tex('defenderGlow'), emissiveIntensity: 1.0,
    });
    glows.push({ mat: stone, base: 1.0, crystal: false });
    return {
      skin: stone, marked: stone,
      eye: glow(glows, 0xe8f4f6, 1.3, false, 0x9aa4a6, false),
      hair: stone, claw: tmat('defender', 0xbfb09a, { rough: 0.9, flat: true }),
    };
  }
  const old = look === 'apprentice';
  const stone = tmat('iskari', old ? 0xbdb6aa : 0xcdc3b0, { rough: 0.92, flat: false, rep: [1, 1] });
  return {
    skin: stone, marked: stone,
    eye: glow(glows, 0xe8f4f6, 1.1, false, 0x9aa4a6, false),
    hair: stone, claw: tmat('iskari', old ? 0xa8a296 : 0xcfc5b2, { rough: 0.9, flat: true }),
  };
}

// ================================================================= the person

/** Styles per race. Sex adjusts sway and stride in `styleFor`. */
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
const ISKARI: Style = {
  walkHz: 1.25, stride: 0.55, runHz: 1.6, runStride: 0.72, armSwing: 0.22, life: 0.12,
  sleep: 'sit', sitHeight: 0.1,
  fallX: -Math.PI / 2, fallZ: 0, lieLift: 0.13, lieSlide: 0.45, lieSide: 0,
};

function styleFor(race: Race, body: Body, look: string): Style {
  const base = race === 'minaa' ? HUMAN : race === 'sehari' ? SEHARI : ISKARI;
  const f = body === 'female';
  const st: Style = { ...base, hipSway: f ? 0.09 : 0.03, shoulderSway: f ? 0.03 : 0.07 };
  if (race === 'sehari' && (look === 'hunter' || look === 'player')) st.idleCrouch = look === 'hunter' ? 0.6 : 0.25;
  if (look === 'tarn') { st.walkHz = 1.2; st.stride = 0.38; st.life = 0.8; }
  if (look === 'hadda') { st.stride = 0.56; st.armSwing = 0.5; }
  return st;
}

function buildPerson(race: Race, body: Body, look: string, opts: ModelOpts, kind: string, extend?: (spec: CharSpec, d: Dress) => void, role?: string): Model {
  const r = rng(seedOf(opts.seed, opts.name, kind + look + body));
  const A = anatomy(race, body, look);
  const rig = makeRig(A.dims);
  const glows: Glow[] = [];
  const sway: Sway[] = [];
  const K = raceKit(race, r, look, glows);
  const f = body === 'female';
  const key = `${race}-${body}-${look === 'apprentice' ? 'old' : 'std'}`;
  const heavy = look === 'hadda' || look === 'tarn' || look === 'digger';
  const wkey = heavy ? key + '-heavy' : key;

  // ---- bare body. Clothing layers go over it and hide most of it.
  const bodyMat = K.skin;
  put(rig.spine, column(`torso-${wkey}`, A.torso), bodyMat, undefined, undefined, [A.torsoScale[0], 1, A.torsoScale[1]]);
  put(rig.hips, column(`pelvis-${wkey}`, A.pelvis), bodyMat, undefined, undefined, [A.pelvisScale[0], 1, A.pelvisScale[1]]);
  const topY = A.torso[A.torso.length - 1][0];
  put(rig.spine, column(`neck-${key}`, [[topY - 0.06, A.neck * 1.7], [topY, A.neck * 1.35], [topY + A.dims.neck * 0.8, A.neck * 1.1]]), bodyMat);

  // head
  const hd = rig.head;
  const H = A.head;
  const headMat = race === 'iskari' ? (look === 'defender' ? K.skin : tmat('iskari', look === 'apprentice' ? 0xbdb6aa : 0xcdc3b0, { rough: 0.9, flat: true })) : K.skin;
  put(hd, headGeo(`${race}-${body}-${look === 'apprentice' ? 'old' : ''}`, H), headMat, [0, H.h * HY, -0.008]);
  // nose
  if (race !== 'iskari') put(hd, cone(0.016, 0.045, 4), K.skin, [0, H.h * (HY - 0.1), -H.d * 1.02], [-1.25, 0, 0], [1, 1, 0.7]);
  else put(hd, box(0.022, 0.05, 0.02), headMat, [0, H.h * (HY - 0.1), -H.d * 1.0], [0.15, 0, 0]);
  // eyes
  const eyeY = H.h * (HY + 0.02), eyeZ = -H.d * 0.96, eyeX = H.w * 0.38;
  for (const s of S) {
    if (race === 'sehari') lit(put(hd, ball(0.015, 6, 4), K.eye, [s * eyeX, eyeY, eyeZ], [0, 0, -s * 0.25], [1.4, 0.8, 0.6]));
    else if (race === 'iskari') lit(put(hd, ball(0.012, 6, 4), K.eye, [s * eyeX, eyeY, eyeZ], undefined, [1.5, 0.7, 0.6]));
    else {
      put(hd, ball(0.011, 5, 4), K.eye, [s * eyeX, eyeY, eyeZ + 0.004]);
      // brows: the face reads from the game camera by its dark marks
      put(hd, box(0.034, 0.009, 0.012), K.hair, [s * eyeX, eyeY + 0.024, eyeZ - 0.004], [0.2, 0, s * (body === 'female' ? -0.12 : 0.05)]);
    }
  }

  // mouth: a thin dark line
  if (race !== 'iskari') put(hd, box(0.034, 0.006, 0.01), tmat('', race === 'sehari' ? 0x6a5a6e : 0x7a4a36, { rough: 0.8 }), [0, H.h * (HY - 0.36), -H.d * 0.92]);

  // arms and hands
  for (const s of S) {
    const arm = s < 0 ? rig.lArm : rig.rArm;
    const fore = s < 0 ? rig.lFore : rig.rFore;
    const hand = s < 0 ? rig.lHand : rig.rHand;
    const skinA = race === 'sehari' && s < 0 ? K.marked : K.skin;
    // the upper arm starts inside the shoulder, round-capped, so there is no ball joint to see
    put(arm, tube(`arm-${wkey}`, A.dims.upperArm + 0.04, [[0, A.deltoid * 0.95], [0.18, A.deltoid], ...A.arm.slice(1).map(([t, r]) => [0.1 + t * 0.9, r] as [number, number])]), skinA, [0, 0.04, 0]);
    put(fore, tube(`fore-${key}`, A.dims.foreArm, A.fore), skinA);
    put(fore, ball(A.fore[0][1] * 1.02, 7, 5), skinA); // elbow
    put(hand, ball(1, 6, 5), K.skin, [0, -A.hand[1] * 0.45, 0], undefined, [A.hand[0], A.hand[1], A.hand[2]]);
    if (race === 'sehari') {
      // long fingers ending in dark claw-nails
      for (const k of [-1, 0, 1]) put(hand, cone(0.008, 0.035, 4), K.claw, [k * 0.014, -A.hand[1] - 0.012, -0.004], [Math.PI, 0, 0]);
    }
    const leg = s < 0 ? rig.lLeg : rig.rLeg;
    const shin = s < 0 ? rig.lShin : rig.rShin;
    const foot = s < 0 ? rig.lFoot : rig.rFoot;
    const skinL = race === 'sehari' && s > 0 ? K.marked : K.skin;
    put(leg, tube(`thigh-${key}`, A.dims.thigh, A.thigh), skinL);
    put(shin, tube(`shin-${key}`, A.dims.shin, A.shin), skinL);
    put(shin, ball(A.shin[0][1] * 1.08, 7, 5), skinL, [0, 0.005, 0]); // knee
    if (race === 'iskari') {
      // metatarsal segment and a two-toed hoof (concept art)
      put(foot, tube(`meta-${key}`, A.dims.meta, [[0, A.shin[A.shin.length - 1][1]], [1, 0.026]]), K.skin);
      for (const k of S) put(foot, ball(0.034, 6, 4), K.claw, [k * 0.022, -A.dims.meta - 0.01, -0.035], undefined, [0.65, 0.5, 1.4]);
    } else if (race === 'sehari') {
      put(foot, ball(1, 7, 5), K.skin, [0, -0.03, -0.075], undefined, [0.045, 0.03, 0.12]);
      for (const k of [-1, 0, 1]) put(foot, cone(0.009, 0.04, 4), K.claw, [k * 0.018, -0.045, -0.19], [-Math.PI / 2 - 0.3, 0, 0]);
    } else {
      put(foot, ball(1, 7, 5), K.skin, [0, -0.035, -0.05], undefined, [0.045, 0.035, 0.11]);
    }
  }

  // ---- race and look dressing
  const ctx: Dress = { rig, A, K, r, glows, sway, race, body, look, f, key, wkey };
  if (race === 'minaa') dressMinaa(ctx);
  else if (race === 'sehari') dressSehari(ctx);
  else dressIskari(ctx);
  if (kind.startsWith('player-') && role) roleKit(ctx, role);

  const rest: Partial<Record<keyof typeof J, V3>> = {
    lArm: [0, 0, -0.07], rArm: [0, 0, 0.07], lFore: [0.14, 0, 0], rFore: [0.14, 0, 0],
  };
  if (race === 'iskari') {
    // digitigrade stance: the knee sits forward, the long foot angles back to the hoof
    Object.assign(rest, {
      lLeg: [0.12, 0, -0.02], lShin: [-0.5, 0, 0], lFoot: [0.38, 0, 0],
      rLeg: [0.12, 0, 0.02], rShin: [-0.5, 0, 0], rFoot: [0.38, 0, 0],
    });
    if (look === 'apprentice') Object.assign(rest, { spine: [-0.12, 0, 0], head: [0.08, 0, 0] });
  }
  if (look === 'tarn') Object.assign(rest, { spine: [-0.1, 0, 0], head: [0.06, 0, 0] });

  const post = lookPost(look, race);
  const spec: CharSpec = {
    name: kind, rig, style: styleFor(race, body, look), glows, sway,
    height: A.height,
    seat: race === 'iskari'
      ? { hipDrop: 0.09, stoop: look === 'apprentice' ? 0.3 : 0.05, knees: look === 'apprentice' }
      : race === 'sehari' ? { hipDrop: 0.09, stoop: 0.2, knees: true } : { hipDrop: 0.1, stoop: 0.12, knees: false },
    phase: r() * 20,
    rest: restPose(rest),
    post,
  };
  extend?.(spec, ctx);
  return makeCharModel(spec);
}

/** Idle character: how each named person stands when nothing is happening. */
function lookPost(look: string, race: Race): ((o: Pose, c: PoseCtx) => void) | undefined {
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
    // arms folded, watching: a man who does not want to be asked anything
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
      // leaning on the shovel
      add(o, J.rArm, 0.45, 0, 0.1); add(o, J.rFore, 0.8);
      add(o, J.spine, -0.08, -0.15);
    };
  }
  return undefined;
}

// ================================================================= dressing

interface Dress {
  rig: Rig; A: Anat; K: Kit; r: () => number; glows: Glow[]; sway: Sway[];
  race: Race; body: Body; look: string; f: boolean; key: string; wkey: string;
}

/** A torso-shaped shell slightly bigger than the body: shirts, tunics, vests. */
function shell(d: Dress, m: THREE.Material, from: number, to: number, grow = 1.08, keyExtra = ''): void {
  const prof = d.A.torso.filter(([y]) => y >= from - 0.001 && y <= to + 0.001).map(([y, r]) => [y, r * grow] as [number, number]);
  if (prof.length < 2) return;
  put(d.rig.spine, column(`shell-${d.wkey}-${from}-${to}-${grow}${keyExtra}`, prof, 12, false, false), m, undefined, undefined, [d.A.torsoScale[0], 1, d.A.torsoScale[1] * 1.05]);
  // a fuller chest reads through the cloth as one soft volume, not two balls
  const chestY = d.A.torso[d.A.torso.length - 2][0] - 0.07;
  if (d.A.bust > 0 && from <= chestY && to >= chestY) {
    const rz = d.A.torso[d.A.torso.length - 2][1] * d.A.torsoScale[1] * grow;
    put(d.rig.spine, ball(1, 12, 8), m, [0, chestY, -rz * 0.55], undefined, [d.A.torso[3][1] * d.A.torsoScale[0] * 0.78, d.A.bust * 1.25, d.A.bust * 1.05]);
  }
}
/** A sleeve over the upper arm. */
function sleeve(d: Dress, m: THREE.Material, s: number, frac = 0.5, grow = 1.3): void {
  const arm = s < 0 ? d.rig.lArm : d.rig.rArm;
  const prof = d.A.arm.map(([t, r]) => [t * frac, r * grow] as [number, number]);
  put(arm, tube(`sleeve-${d.wkey}-${frac}-${grow}`, d.A.dims.upperArm, prof), m);
}
/** A trouser leg over the thigh and shin. */
function trouser(d: Dress, m: THREE.Material, s: number, shinFrac: number, grow = 1.25, baggy = 1): void {
  const leg = s < 0 ? d.rig.lLeg : d.rig.rLeg;
  const shin = s < 0 ? d.rig.lShin : d.rig.rShin;
  put(leg, tube(`tleg-${d.key}-${grow}`, d.A.dims.thigh, d.A.thigh.map(([t, r]) => [t, r * grow] as [number, number])), m);
  if (shinFrac > 0) {
    const r0 = d.A.thigh[d.A.thigh.length - 1][1] * grow;
    put(shin, tube(`tshin-${d.key}-${shinFrac}-${grow}-${baggy}`, d.A.dims.shin * shinFrac, d.A.shin.map(([t, r], i) => [t, i === 0 ? r0 : Math.max(r * grow, r0 * 0.9) * (1 + (baggy - 1) * 1.6 * t)] as [number, number])), m);
  }
}
/** A band round a limb or the waist. */
function band(parent: THREE.Object3D, m: THREE.Material, y: number, r: number, h = 0.03, sx = 1, sz = 1): void {
  put(parent, cyl(r, r, h, 10), m, [0, y, 0], undefined, [sx, 1, sz]);
}
/** A hanging cloth strip that sways. */
function flap(d: Dress, parent: THREE.Object3D, m: THREE.Material, p: V3, w: number, h: number, o: { yaw?: number; hang?: number; front?: boolean; back?: boolean; curve?: number; taper?: number; drag?: number; restX?: number } = {}): THREE.Object3D {
  const outer = new THREE.Object3D();
  outer.position.set(p[0], p[1], p[2]);
  outer.rotation.y = o.yaw ?? 0;
  parent.add(outer);
  const pv = swayPivot(outer, [0, 0, 0], [o.restX ?? 0, 0]);
  const mesh = put(pv, panel(`${w}-${h}-${o.curve ?? 0}-${o.taper ?? 1}`, w, h, o.curve ?? 0, o.taper ?? 1), m);
  mesh.userData.keep = true;
  const rig = d.rig;
  const s: Sway = { pivot: pv, hang: o.hang ?? 0.85, rest: [o.restX ?? 0, 0], drag: o.drag ?? 0.12, stiff: 60, damp: 7, flutter: 0.12 };
  if (o.front) s.minX = () => Math.max(rig.lLeg.rotation.x, rig.rLeg.rotation.x) * 0.85 + rig.hips.rotation.x * 0;
  if (o.back) s.maxX = () => Math.min(rig.lLeg.rotation.x, rig.rLeg.rotation.x) * 0.85;
  d.sway.push(s);
  return pv;
}
/** A lock of hair or a dreadlock: a short chain that sways. */
function lock(d: Dress, parent: THREE.Object3D, m: THREE.Material, p: V3, len: number, r0: number, rest: [number, number], hang = 0.6): void {
  const pv = swayPivot(parent, p, rest);
  const mesh = put(pv, tube(`lock-${len}-${r0}`, len, [[0, r0], [0.7, r0 * 0.85], [1, r0 * 0.55]], 5), m);
  mesh.userData.keep = true;
  d.sway.push({ pivot: pv, hang, rest, drag: 0.1, stiff: 45, damp: 5, flutter: 0.2 });
}

// ---------------------------------------------------------------- Mi'naa

const MI = {
  ochre: 0xc8904a, rust: 0xa4502e, teal: 0x557f7a, sand: 0xcdb38a, brown: 0x7a5a3e,
  leather: 0x5a3d28, brass: 0xa27a45, metal: 0x4a423a, cream: 0xe0d2b4,
};

function dressMinaa(d: Dress): void {
  const { rig, r, f, look } = d;
  const leather = tmat('leather', MI.leather, { rough: 0.7 });
  const brass = tmat('metal', MI.brass, { rough: 0.45, metal: 0.6 });
  const metal = tmat('metal', MI.metal, { rough: 0.5, metal: 0.55 });
  const glass = tmat('', 0x3a4a48, { rough: 0.2, metal: 0.3 });
  const crowd = look === 'crowd';
  const scav = look === 'scavenger' || look === 'pell';

  // palette per look
  let topHex = MI.ochre, botHex = f ? MI.teal : MI.rust, scarfHex: number | null = look === 'player' ? null : 0xc4532a;
  if (look === 'hadda') { topHex = 0x4f7a74; botHex = 0x5e5446; scarfHex = null; }
  else if (look === 'tarn') { topHex = 0xd8c8a4; botHex = 0xa4502e; scarfHex = null; }
  else if (look === 'digger') { topHex = 0xa88a5a; botHex = 0x7a6448; scarfHex = null; }
  else if (scav) { topHex = 0x8f7050; botHex = 0x5e4632; scarfHex = 0x6e5a44; }
  else if (crowd) {
    topHex = shade(pick(r, [MI.ochre, MI.sand, 0xb88c5a, MI.brown, 0xa06a48]), 0, 0, (r() - 0.5) * 0.1);
    botHex = shade(pick(r, [MI.teal, MI.rust, 0x7a5a3e, 0x5d6f63]), 0, 0, (r() - 0.5) * 0.08);
    scarfHex = r() < 0.4 ? pick(r, [0xa89170, 0x8a5a3a, 0x6e7a70]) : null;
  }
  const top = tmat('patched', topHex, { rough: 0.95 });
  const bot = tmat('patched', botHex, { rough: 0.95, rep: [1, 1] });
  const topD = tmat('patched', topHex, { rough: 0.95, double: true });

  // ---- torso. Each body gets one clothing signature that reads from the game camera (round 1 critic):
  //   man: bare chest under an open vest, a bandolier across it (scene-minaa-water-holders.png)
  //   woman: a short top that stops above the waist, a wide sash low on the hips
  const topY = d.A.torso[d.A.torso.length - 1][0];
  const bare = look === 'digger' || (look === 'player' && !f) || (crowd && !f && r() < 0.35);
  const cropped = f && (look === 'player' || (crowd && r() < 0.5));
  const z = d.A.torso[3][1] * d.A.torsoScale[1];
  if (bare) {
    // mi-naa-tinker-pair.png: a torn ochre sash over one shoulder, a bandolier crossing it with crystal cartridges
    const sashM = tmat('patched', look === 'player' ? MI.ochre : 0xa88a5a, { rough: 0.9, double: true });
    put(rig.spine, box(0.09, 0.66, z * 2.3), sashM, [0, d.A.torso[3][0] - 0.02, 0], [0, 0, -0.6]);
    flap(d, rig.hips, sashM, [0.1, 0.06, -0.1], 0.1, 0.34, { hang: 0.85, drag: 0.15, yaw: 0.3 });
    put(rig.spine, box(0.04, 0.64, z * 2.26), leather, [0, d.A.torso[3][0], 0], [0, 0, 0.62]);
    const cart = [CRYSTAL_HEX.verdant, CRYSTAL_HEX.azure, CRYSTAL_HEX.violet, CRYSTAL_HEX.amber];
    for (let i = 0; i < 4; i++) {
      const t = (i - 1.5) * 0.07;
      lit(put(rig.spine, box(0.022, 0.05, 0.022), mat(0x2a2a2a, 0.4, 0.2, true, cart[i], look === 'player' ? 0.9 : 0), [-0.58 * t, d.A.torso[3][0] + 0.8 * t + 0.03, -z * 1.07], [0, 0, 0.62]));
    }
  } else if (cropped) {
    // the tinker woman's top: a short loose poncho, slipping off one shoulder, the waist bare below it
    const pon = tmat('patched', look === 'player' ? MI.ochre : topHex, { rough: 0.95, double: true });
    const r0 = d.A.torso[d.A.torso.length - 2][1];
    put(rig.spine, skirt(`poncho-${d.wkey}`, d.A.neck * 1.6, r0 * 1.55, 0.3, 0.55, 14), pon, [0, topY + 0.04, 0], [0, 0, 0.12], [d.A.torsoScale[0] * 0.95, 1, d.A.torsoScale[1] * 1.15]);
    shell(d, top, d.A.torso[3][0], topY, 1.06, 'crop');
  } else {
    shell(d, top, 0, topY, f ? 1.12 : 1.08);
    if (f) for (const s of S) sleeve(d, top, s, 0.42, 1.45);
  }
  // tunic skirt below the belt, hanging over the hips (not on bare or cropped bodies)
  if (!bare && !cropped && look !== 'hadda') put(rig.hips, skirt(`mt-${d.wkey}`, d.A.pelvis[2][1] * 1.12, d.A.pelvis[1][1] * 1.3, f ? 0.2 : 0.16, 0.7), topD, [0, 0.07, 0], undefined, [d.A.pelvisScale[0], 1, d.A.pelvisScale[1] * 1.05]);
  if (cropped) {
    // a wide faded-teal sash slung low on the hips, the ends hanging at one side
    const sash = tmat('cloth', 0x557f7a, { rough: 0.95, double: true });
    band(rig.hips, sash, 0.02, d.A.pelvis[2][1] * 1.2, 0.09, d.A.pelvisScale[0], d.A.pelvisScale[1] * 1.12);
    flap(d, rig.hips, sash, [-0.12, 0.0, -0.08], 0.07, 0.34, { hang: 0.9, drag: 0.2, yaw: -0.4 });
  }
  // the trousers cover the pelvis, so no skin shows between the legs when the tunic is short
  put(rig.hips, column(`mpelvis-${d.wkey}`, d.A.pelvis.map(([y, rr]) => [y, rr * 1.06] as [number, number])), bot, undefined, undefined, [d.A.pelvisScale[0], 1, d.A.pelvisScale[1]]);
  band(rig.hips, leather, 0.06, d.A.pelvis[2][1] * 1.15, 0.035, d.A.pelvisScale[0], d.A.pelvisScale[1] * 1.08);
  put(rig.hips, box(0.07, 0.09, 0.05), leather, [0.15, 0.0, -0.05], [0, 0.4, 0]);
  put(rig.hips, box(0.06, 0.08, 0.05), leather, [-0.15, 0.0, 0.03], [0, -0.3, 0]);

  // ---- legs: trousers to the shin with wraps, or shorts on some
  const shorts = look === 'digger' || (crowd && r() < 0.3);
  for (const s of S) {
    trouser(d, bot, s, shorts ? 0.15 : look === 'player' ? (f ? 0.62 : 0.5) : 0.85, 1.28, look === 'player' ? 1.14 : 1);
    const shin = s < 0 ? rig.lShin : rig.rShin;
    const foot = s < 0 ? rig.lFoot : rig.rFoot;
    // wrapped shins and sandals: leather straps
    band(shin, leather, -d.A.dims.shin * 0.82, 0.042, 0.05);
    if (!shorts) band(shin, tmat('cloth', MI.cream), -d.A.dims.shin * 0.6, 0.06, 0.08);
    put(foot, box(0.085, 0.022, 0.2), leather, [0, -0.06, -0.045]);
    if (look === 'hadda' || look === 'digger' || scav) put(foot, ball(1, 6, 4), leather, [0, -0.035, -0.05], undefined, [0.052, 0.045, 0.115]); // boots
  }

  // ---- head: hair, goggles, headwear
  const hd = rig.head;
  const H = d.A.head;
  const hy = H.h * HY;
  const hairM = d.K.hair;
  if (look === 'tarn') {
    // headwrap over grey hair, knot at the back
    const wrap = tmat('cloth', 0xc8904a, { rough: 0.95 });
    put(hd, ball(1, 10, 7), wrap, [0, hy + H.h * 0.3, 0.012], undefined, [H.w * 1.15, H.h * 0.82, H.d * 1.15]);
    put(hd, ball(0.035, 6, 5), wrap, [0, hy + 0.02, H.d * 1.15]);
    put(hd, ball(1, 7, 5), hairM, [0, hy - H.h * 0.1, H.d * 0.45], undefined, [H.w * 1.04, H.h * 0.7, H.d * 0.75]);
  } else if (look === 'hadda') {
    // cropped hair under a rolled headscarf, goggles on the brow
    put(hd, ball(1, 9, 6), hairM, [0, hy + H.h * 0.12, 0.012], undefined, [H.w * 1.08, H.h * 0.95, H.d * 1.08]);
    band(hd, tmat('cloth', 0xc8904a), hy + 0.035, H.w * 1.1, 0.035, 1, H.d / H.w);
  } else if (scav) {
    // deep hood and a face scarf
    const hood = tmat('patched', look === 'pell' ? 0x6e4e36 : 0x7a4a33, { rough: 0.95, double: true });
    put(hd, ball(1, 10, 7), hood, [0, hy + 0.01, 0.02], undefined, [H.w * 1.35, H.h * 1.12, H.d * 1.3]);
    put(hd, skirt('scarf', H.w * 1.0, H.w * 1.35, 0.14, 0.6, 10), tmat('cloth', 0x8a7458, { double: true }), [0, hy - 0.03, -0.005], undefined, [1, 1, H.d / H.w]);
    flap(d, rig.spine, hood, [0, d.A.torso[d.A.torso.length - 1][0] + 0.04, 0.09], 0.3, 0.5, { hang: 0.7, curve: 0.18, restX: -0.2 });
  } else if (f) {
    // hair pulled back into a bun, loose strands at the front
    put(hd, ball(1, 9, 6), hairM, [0, hy + H.h * 0.12, 0.014], undefined, [H.w * 1.09, H.h * 0.96, H.d * 1.1]);
    put(hd, ball(0.045, 7, 5), hairM, [0, hy + 0.05, H.d * 1.08]);
    lock(d, hd, hairM, [-H.w * 0.8, hy + 0.02, -H.d * 0.5], 0.09, 0.012, [0, 0], 0.5);
    lock(d, hd, hairM, [0, hy + 0.04, H.d * 1.1], 0.14, 0.02, [-0.4, 0], 0.7);
  } else {
    // short messy hair
    put(hd, ball(1, 9, 6), hairM, [0, hy + H.h * 0.12, 0.016], undefined, [H.w * 1.09, H.h * 0.95, H.d * 1.1]);
    for (let i = 0; i < 4; i++) put(hd, cone(0.025, 0.06, 4), hairM, [(i - 1.5) * 0.03, hy + H.h * 0.9, -0.02 + (i % 2) * 0.03], [-0.6 + r() * 0.3, 0, (r() - 0.5) * 0.8]);
  }
  const goggles = (look === 'player' && f) || look === 'hadda' || (crowd && r() < 0.6);
  if (look === 'player' && !f) {
    // the tinker man wears his goggles round his neck
    for (const s of S) put(rig.spine, cyl(0.03, 0.03, 0.034, 8), brass, [s * 0.042, d.A.torso[d.A.torso.length - 1][0] + 0.01, -d.A.neck * 2.2], [1.3, 0, 0]);
    put(rig.spine, ring(d.A.neck * 2.0, 0.012, 4, 12), leather, [0, d.A.torso[d.A.torso.length - 1][0] + 0.02, 0], [Math.PI / 2 + 0.2, 0, 0]);
  }
  if (goggles) {
    band(hd, leather, hy + H.h * 0.42, H.w * 1.14, 0.018, 1, H.d / H.w * 1.02);
    for (const s of S) {
      put(hd, cyl(0.026, 0.026, 0.03, 8), brass, [s * 0.035, hy + H.h * 0.46, -H.d * 1.0], [1.1, 0, 0]);
      put(hd, cyl(0.02, 0.02, 0.032, 8), glass, [s * 0.035, hy + H.h * 0.46, -H.d * 1.0], [1.1, 0, 0]);
    }
  }

  // ---- scarf: the player's warm accent, loose at the neck with a tail that swings
  if (scarfHex !== null && !scav) {
    const scarf = tmat('cloth', scarfHex, { rough: 0.95, double: true });
    const ny = d.A.torso[d.A.torso.length - 1][0] + 0.02;
    put(rig.spine, ring(d.A.neck * 1.8, 0.03, 6, 12), scarf, [0, ny, 0], [Math.PI / 2 + 0.15, 0, 0], [1, 1.05, 1]);
    flap(d, rig.spine, scarf, [0.05, ny - 0.02, -0.07], 0.07, 0.3, { hang: 0.8, drag: 0.18 });
  }

  // ---- augmentation: Mi'naa are the most augmented race (canon). Everyone carries something.
  if (look === 'player') {
    if (!f) {
      // the tinker man's left arm is iron from the elbow down, a brass collar at the joint
      const iron = tmat('metal', 0x3e3a36, { rough: 0.45, metal: 0.65 });
      put(rig.lFore, tube('ironfore', d.A.dims.foreArm, [[0, 0.056], [0.3, 0.058], [0.85, 0.046], [1, 0.042]], 8), iron);
      band(rig.lFore, brass, -0.015, 0.062, 0.04);
      band(rig.lFore, brass, -d.A.dims.foreArm * 0.55, 0.058, 0.02);
      put(rig.lHand, ball(1, 6, 5), iron, [0, -0.04, 0], undefined, [0.05, 0.075, 0.03]);
      for (const k of [-1, 0, 1]) put(rig.lHand, box(0.012, 0.05, 0.012), iron, [k * 0.018, -0.1, -0.005]);
      put(rig.lArm, tube('ironcap', d.A.dims.upperArm * 0.35, [[0, 0.075], [1, 0.06]], 8), iron, [0, -d.A.dims.upperArm * 0.62, 0]);
    }
    // the tinker woman's left forearm is bronze with two teal crystal cells; his wrist has one
    const fore = rig.lFore;
    if (f) {
      put(fore, tube('brace', d.A.dims.foreArm * 0.85, [[0, 0.05], [0.3, 0.052], [1, 0.04]], 8), tmat('metal', 0x8a6238, { rough: 0.45, metal: 0.6 }));
      for (let i = 0; i < 3; i++) band(fore, brass, -0.05 - i * 0.07, 0.054 - i * 0.003, 0.02);
    }
    for (let i = 0; i < (f ? 2 : 1); i++) lit(put(fore, octa(0.024), glow(d.glows, 0x5fd0c0, 1.2, true, 0x1f6f6a), [0, -d.A.dims.foreArm * (0.3 + i * 0.3), -0.055], undefined, [1, 1.6, 1], 'crystal'));
    if (f) {
      // a teal crystal on a cord at her throat (memory object)
      put(rig.spine, ring(d.A.neck * 2.3, 0.004, 3, 12), leather, [0, d.A.torso[d.A.torso.length - 1][0] - 0.03, -0.01], [Math.PI / 2 - 0.45, 0, 0]);
      lit(put(rig.spine, octa(0.016), glow(d.glows, 0x5fd0c0, 1.0, true, 0x1f6f6a), [0, d.A.torso[4][0] - 0.02, -d.A.torso[4][1] * d.A.torsoScale[1] - 0.035], undefined, [0.8, 1.6, 0.8]));
    }
    // memory objects: a string of tokens at the belt
    for (let i = 0; i < 3; i++) put(rig.hips, cyl(0.014, 0.014, 0.006, 6), brass, [-0.12 + i * 0.02, -0.07 - i * 0.03, -0.13], [Math.PI / 2, 0, 0]);
  } else if (look === 'hadda') {
    // iron hand: two fingers replaced, a bolted knuckle plate
    put(rig.rHand, box(0.06, 0.05, 0.035), metal, [0, -0.03, 0]);
    put(rig.rFore, tube('hbrace', d.A.dims.foreArm * 0.5, [[0, 0.05], [1, 0.045]], 8), metal, [0, -d.A.dims.foreArm * 0.45, 0]);
    // heavy work coat to the knee, sleeves rolled
    const coat = tmat('patched', 0x4f7a74, { rough: 0.95, double: true });
    put(rig.hips, skirt('haddacoat', d.A.pelvis[2][1] * 1.2, d.A.pelvis[2][1] * 1.55, 0.5, 0.8), coat, [0, 0.07, 0], undefined, [d.A.pelvisScale[0], 1, d.A.pelvisScale[1] * 1.1]);
    shell(d, coat, d.A.torso[1][0], d.A.torso[d.A.torso.length - 1][0], 1.16, 'coat');
    for (const s of S) sleeve(d, coat, s, 0.8, 1.5);
    // pry bar across the back
    put(rig.spine, cyl(0.016, 0.016, 0.95, 6), metal, [0, 0.3, 0.14], [0, 0, 0.9]);
  } else if (look === 'tarn') {
    // long skirt and apron, a ladle at the belt
    const sk = tmat('patched', 0x8a4a30, { rough: 0.95, double: true });
    put(rig.hips, skirt('tarnskirt', d.A.pelvis[2][1] * 1.15, d.A.pelvis[2][1] * 1.7, 0.72, 0.9, 16), sk, [0, 0.06, 0], undefined, [d.A.pelvisScale[0], 1, d.A.pelvisScale[1] * 1.1]);
    flap(d, rig.hips, tmat('cloth', 0xd8c8a4, { rough: 0.95, double: true }), [0, 0.03, -d.A.pelvis[2][1] * d.A.pelvisScale[1] * 1.25], 0.24, 0.55, { front: true, curve: 0.2 });
    put(rig.hips, cyl(0.01, 0.01, 0.3, 5), tmat('', 0x8a6a48), [0.17, -0.08, -0.02], [0.2, 0, 0.15]);
    put(rig.hips, ball(0.035, 6, 4), tmat('', 0x8a6a48), [0.19, -0.22, -0.04], undefined, [1, 0.5, 1]);
    // a copper bead necklace: her memory string
    put(rig.spine, ring(0.07, 0.008, 4, 12), brass, [0, d.A.torso[4][0] - 0.02, -0.02], [Math.PI / 2 - 0.4, 0, 0]);
  } else if (look === 'digger') {
    // shovel over the shoulder, headband, one iron knee
    put(rig.rArm, cyl(0.016, 0.016, 1.1, 5), tmat('', 0x7a5a3a), [0.02, -0.25, -0.05], [0.3, 0, 0]);
    put(rig.rArm, box(0.16, 0.2, 0.02), metal, [0.02, -0.78, -0.2], [0.3, 0, 0]);
    band(rig.head, tmat('cloth', 0xa4502e), d.A.head.h * HY + 0.05, d.A.head.w * 1.12, 0.03, 1, d.A.head.d / d.A.head.w);
    put(rig.lShin, ball(0.06, 6, 5), metal, [0, -0.02, -0.03], undefined, [1, 1.2, 0.8]);
  } else if (scav) {
    // long sleeves and gloves: band marks stay covered (canon). Satchel, long gun, blade.
    for (const s of S) {
      sleeve(d, top, s, 1, 1.35);
      put(s < 0 ? rig.lFore : rig.rFore, tube('scavsleeve', d.A.dims.foreArm, [[0, 0.05], [1, 0.035]]), top);
      put(s < 0 ? rig.lHand : rig.rHand, ball(1, 6, 4), leather, [0, -0.03, 0], undefined, [0.045, 0.06, 0.028]);
    }
    put(rig.hips, box(0.17, 0.15, 0.08), leather, [-0.2, 0, 0.02]);
    put(rig.spine, box(0.04, 0.62, 0.02), leather, [0, 0.3, 0.12], [0, 0, -0.6]);
    put(rig.spine, cyl(0.02, 0.018, 0.95, 6), metal, [0.12, 0.45, 0.16], [0, 0, -0.55]);
    put(rig.hips, box(0.03, 0.3, 0.05), metal, [0.19, -0.13, 0.03], [0, 0, 0.15]);
  } else if (crowd) {
    // one visible augment each: an iron forearm, a brass ear piece, or a lens
    const k = r();
    if (k < 0.33) put(rig.lFore, tube('cbrace', d.A.dims.foreArm * 0.7, [[0, 0.048], [1, 0.04]], 8), metal);
    else if (k < 0.66) put(rig.head, cyl(0.02, 0.02, 0.03, 6), brass, [-d.A.head.w * 1.02, d.A.head.h * HY, 0], [0, 0, Math.PI / 2]);
    else put(rig.head, cyl(0.018, 0.018, 0.03, 8), brass, [d.A.head.w * 0.38, d.A.head.h * (HY + 0.03), -d.A.head.d * 1.0], [1.3, 0, 0]);
    if (r() < 0.5) put(rig.spine, box(0.04, 0.6, 0.02), leather, [0, 0.28, -0.09], [0, 0, 0.6]);
  }
}

// ---------------------------------------------------------------- Sehari

function dressSehari(d: Dress): void {
  const { rig, r, f, look } = d;
  const cloth = tmat('sehariCloth', 0xffffff, { rough: 0.95 });
  const clothD = tmat('sehariCloth', 0xffffff, { rough: 0.95, double: true });
  const trou = tmat('cloth', 0xd9ccb2, { rough: 0.95 });
  const sash = tmat('cloth', 0x4f8a86, { rough: 0.95, double: true });
  const fibre = tmat('cloth', 0x9d8a66, { rough: 0.95 });
  const hairM = d.K.hair;
  const H = d.A.head;
  const hd = rig.head;
  const hy = H.h * HY;

  // ---- wrap top: bone cloth over the torso, crossing at the chest, bare arms
  shell(d, cloth, 0, d.A.torso[d.A.torso.length - 1][0], f ? 1.1 : 1.07);
  // hip skirt panels over baggy trousers: front and back fall between the legs
  // the front panel carries one big rust root motif (sehari-upright-and-quadrupedal-pair.png)
  const motif = tmat('sehariMotif', 0xffffff, { rough: 0.95, double: true });
  flap(d, rig.hips, motif, [0.03, 0.05, -d.A.pelvis[2][1] * d.A.pelvisScale[1] * 1.15], 0.24, f ? 0.56 : 0.46, { front: true, curve: 0.16, taper: 1.15, yaw: 0.15 });
  flap(d, rig.hips, clothD, [0, 0.05, d.A.pelvis[2][1] * d.A.pelvisScale[1] * 1.15], 0.2, 0.38, { back: true, curve: 0.16, taper: 0.85, yaw: Math.PI });
  put(rig.hips, column(`spelvis-${d.wkey}`, d.A.pelvis.map(([y, rr]) => [y, rr * 1.06] as [number, number])), trou, undefined, undefined, [d.A.pelvisScale[0], 1, d.A.pelvisScale[1]]);
  for (const s of S) {
    trouser(d, trou, s, 0.8, 1.35, 1.25);
    // fibre wraps at the ankle
    band(s < 0 ? rig.lShin : rig.rShin, fibre, -d.A.dims.shin * 0.8, 0.04, 0.07);
  }
  // teal sash at the waist, tied, ends hanging
  band(rig.hips, sash, 0.08, d.A.pelvis[2][1] * 1.16, 0.06, d.A.pelvisScale[0], d.A.pelvisScale[1] * 1.1);
  flap(d, rig.hips, sash, [0.07, 0.06, -d.A.pelvis[2][1] * 0.95], 0.05, 0.36, { hang: 0.9, drag: 0.2, yaw: 0.25 });
  flap(d, rig.hips, sash, [0.1, 0.06, -d.A.pelvis[2][1] * 0.9], 0.045, 0.28, { hang: 0.9, drag: 0.2, yaw: 0.4 });

  // ---- head: long pointed ears swept back, dreadlocks
  for (const s of S) put(hd, cone(0.03, 0.17, 4), d.K.skin, [s * H.w * 1.0, hy + 0.02, 0.015], [-0.45, 0, -s * 1.25], [1, 1, 0.4]);
  // a thick cap of hair from the hairline back over the crown
  put(hd, ball(1, 10, 7), hairM, [0, hy + H.h * 0.28, H.d * 0.18], [-0.35, 0, 0], [H.w * 1.12, H.h * 0.95, H.d * 1.12]);
  if (f) {
    // dreads gathered in a big knot high on the crown, bound with fibre, a tail arcing out behind:
    // the silhouette that tells her from him at the game's distance
    put(hd, ball(0.065, 8, 6), hairM, [0, hy + H.h * 1.02, H.d * 0.35], undefined, [1, 0.85, 1]);
    band(hd, fibre, hy + H.h * 0.93, 0.045, 0.03);
    for (let i = 0; i < 8; i++) lock(d, hd, hairM, [(i - 3.5) * 0.014, hy + H.h * 1.0, H.d * 0.62], 0.3 + r() * 0.12, 0.021, [-1.1 + i * 0.04, (i - 3.5) * 0.1], 0.35);
  } else {
    // long loose dreads to the chest, falling from the crown round the back and sides, bound with fibre
    for (let i = 0; i < 13; i++) {
      const a = -1.8 + (i / 12) * 3.6;
      lock(d, hd, hairM, [Math.sin(a) * H.w * 0.9, hy + H.h * 0.45, Math.cos(a) * H.d * 0.75], 0.36 + r() * 0.14, 0.023, [-0.25 * Math.cos(a), -0.4 * Math.sin(a)], 0.75);
    }
  }
  // river stone pendant on a cord (bone-singers keep close to stone)
  put(rig.spine, ring(d.A.neck * 1.9, 0.004, 3, 12), fibre, [0, d.A.torso[d.A.torso.length - 1][0] - 0.02, -0.01], [Math.PI / 2 - 0.5, 0, 0]);
  put(rig.spine, ball(0.02, 6, 4), tmat('', 0x5a6a60, { rough: 0.4 }), [0, d.A.torso[3][0] + 0.02, -d.A.torso[3][1] * d.A.torsoScale[1] - 0.03], undefined, [1, 1.3, 0.6]);

  // crystal pouch at the hip: carried close, never set into the body (canon)
  put(rig.hips, cyl(0.04, 0.03, 0.08, 6), fibre, [0.16, -0.08, -0.03]);
  lit(put(rig.hips, octa(0.024), glow(d.glows, CRYSTAL_HEX.amber, 1.1, true, 0x6a4418), [0.16, -0.02, -0.03], undefined, [1, 1.8, 1], 'crystal'));

  if (look === 'hunter' || (f && look !== 'player')) {
    // open grey-green vest: the tracker's look
    const vest = tmat('cloth', 0x5d6b5b, { rough: 0.95, double: true });
    for (const s of S) flap(d, rig.spine, vest, [s * 0.075, d.A.torso[4][0], -d.A.torso[3][1] * d.A.torsoScale[1] * 1.05], 0.08, 0.42, { hang: 0.4, curve: 0.1 });
    put(rig.spine, panel('svb', 0.26, 0.44, 0.18), vest, [0, d.A.torso[4][0], d.A.torso[3][1] * d.A.torsoScale[1] + 0.01]);
    // bow on the back
    bow(rig.spine, [0.02, 0.28, 0.12]);
  }
  if (look === 'player') {
    // warm rust wrap over one shoulder: the player's accent, read at a glance
    const wrap = tmat('cloth', 0xb24f2c, { rough: 0.95, double: true });
    put(rig.spine, box(0.07, 0.56, d.A.torso[3][1] * d.A.torsoScale[1] * 2.3), wrap, [0.02, 0.24, 0], [0, 0, f ? 0.55 : -0.55]);
    put(rig.spine, ball(0.07, 6, 4), wrap, [(f ? 1 : -1) * d.A.dims.shoulderW * 0.8, d.A.torso[d.A.torso.length - 1][0] - 0.03, 0], undefined, [1.3, 0.7, 1.3]);
    flap(d, rig.spine, wrap, [(f ? 1 : -1) * 0.1, d.A.torso[d.A.torso.length - 1][0] - 0.05, 0.08], 0.14, 0.34, { hang: 0.7, restX: -0.1 });
  }
}

function bow(parent: THREE.Object3D, p: V3): void {
  const wood = tmat('', 0x5a4030, { rough: 0.8 });
  const g = new THREE.Object3D();
  g.position.set(p[0], p[1], p[2]);
  g.rotation.z = 0.35;
  parent.add(g);
  put(g, ring(0.5, 0.013, 4, 12, 1.9), wood, [0.35, 0, 0], [0, 0, Math.PI - 0.95]);
  put(g, cyl(0.003, 0.003, 0.8, 3), tmat('', 0xd8ccb2), [0.02, 0, 0]);
}

// ---------------------------------------------------------------- Iskari

function dressIskari(d: Dress): void {
  if (d.look === 'defender') { dressDefender(d); return; }
  const { rig, f, look, glows } = d;
  const old = look === 'apprentice';
  const H = d.A.head;
  const hd = rig.head;
  const hy = H.h * HY;
  const crestMat = tmat('iskari', old ? 0xaaa398 : 0xc2b8a4, { rough: 0.9, flat: true });

  // ---- crest: male-shaped a low ridge, female-shaped a tall swept fan (concept art)
  const n = f ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const hgt = f ? 0.05 + t * 0.05 : 0.03 + t * 0.02;
    put(hd, box(0.02 + t * 0.008, hgt, 0.06), crestMat, [0, hy + H.h * (0.98 - t * 0.3) + hgt * 0.25, -H.d * 0.35 + t * H.d * 1.15], [-0.5 - t * 0.6, 0, 0]);
  }
  // cheek plate lines and a jaw plate: carved planes on the face
  for (const s of S) put(hd, box(0.006, 0.05, 0.03), crestMat, [s * H.w * 0.82, hy - 0.02, -H.d * 0.35], [0.2, 0, s * 0.1]);

  // ---- soul crystal in the chest: teal-blue, shown, never explained
  const soul = glow(glows, 0x5fd8e8, 1.6, true, 0x1c6a76, true);
  const cy = d.A.torso[3][0] + 0.03, cz = -d.A.torso[3][1] * d.A.torsoScale[1] * (f ? 1.02 : 1.0);
  lit(put(rig.spine, octa(0.048), soul, [0, cy, cz - 0.01], [0, 0, 0], [0.8, 1.5, 0.55], 'crystal'));
  put(rig.spine, ring(0.05, 0.01, 4, 8), crestMat, [0, cy, cz + 0.004], undefined, [0.85, 1.4, 1]);

  // ---- clothing: cream wrap over one shoulder, a sash, a short kilt or long tabard
  const cream = tmat('cloth', old ? 0xb89a68 : 0xe6dcc4, { rough: 0.95, double: true });
  const creamS = tmat('cloth', old ? 0xb89a68 : 0xe6dcc4, { rough: 0.95 });
  const sashHex = old ? 0x9b4a2c : f ? 0x4f8a86 : 0x9b4a2c;
  const sash = tmat('cloth', sashHex, { rough: 0.95, double: true });
  const border = tmat('cloth', f ? 0x9b4a2c : 0x4f8a86, { rough: 0.95, double: true });

  if (old) {
    // the apprentice: a long faded robe, rust sash and collar, a satchel of records
    put(rig.hips, skirt('approbe', d.A.pelvis[2][1] * 1.2, d.A.pelvis[2][1] * 1.9, 0.9, 0.9, 16), cream, [0, 0.1, 0], undefined, [d.A.pelvisScale[0], 1, d.A.pelvisScale[1] * 1.1]);
    shell(d, creamS, 0, d.A.torso[d.A.torso.length - 1][0], 1.12);
    for (const s of S) sleeve(d, creamS, s, 0.9, 1.22);
    put(rig.spine, ring(d.A.neck * 2.2, 0.03, 6, 12), sash, [0, d.A.torso[d.A.torso.length - 1][0] - 0.01, 0], [Math.PI / 2 + 0.1, 0, 0]);
    const leather = tmat('leather', 0x6b4a30, { rough: 0.8 });
    put(rig.spine, box(0.04, 0.66, 0.02), leather, [0, 0.25, -0.11], [0, 0, -0.6]);
    put(rig.hips, box(0.2, 0.17, 0.08), leather, [-0.26, -0.04, 0.02]);
    const parch = tmat('cloth', 0xd9c9a4);
    put(rig.hips, cyl(0.02, 0.02, 0.16, 5), parch, [-0.29, 0.08, 0.02], [0, 0, 0.3]);
    put(rig.hips, cyl(0.018, 0.018, 0.14, 5), parch, [-0.23, 0.07, 0.03], [0.2, 0, -0.2]);
  } else {
    // iskari-menders-pair.png. Each body gets its own signature, readable from the game camera:
    //   narrow: a short wrap top over one shoulder, bare waist, a short wrap skirt with a teal glyph hem, a teal headband
    //   broad: an open dusty-violet vest on a bare stone chest, a cream kilt with a long teal cloth hanging in front
    const side = f ? -1 : 1;
    const pz = d.A.pelvis[2][1] * d.A.pelvisScale[1] * 1.2;
    const topY = d.A.torso[d.A.torso.length - 1][0];
    const leather = tmat('leather', 0x6b4a30, { rough: 0.8 });
    if (f) {
      shell(d, creamS, d.A.torso[3][0] - 0.02, topY, 1.08, 'wraptop');
      put(rig.spine, box(0.05, 0.3, d.A.torso[4][1] * d.A.torsoScale[1] * 2.2), creamS, [side * 0.05, d.A.torso[4][0] + 0.05, 0], [0, 0, side * 0.45]);
      band(rig.spine, tmat('cloth', 0x4f8a86), d.A.torso[3][0] - 0.02, d.A.torso[3][1] * 1.1, 0.025, d.A.torsoScale[0], d.A.torsoScale[1] * 1.1);
      put(rig.hips, skirt(`iwrap-${d.wkey}`, d.A.pelvis[2][1] * 1.15, d.A.pelvis[1][1] * 1.45, 0.34, 0.8, 16), cream, [0, 0.07, 0], [0, 0, 0.05], [d.A.pelvisScale[0], 1, d.A.pelvisScale[1] * 1.08]);
      put(rig.hips, skirt(`ihem-${d.wkey}`, d.A.pelvis[1][1] * 1.43, d.A.pelvis[1][1] * 1.48, 0.05, 1, 16), tmat('cloth', 0x3f7a74, { double: true }), [0, 0.07 - 0.3, 0], [0, 0, 0.05], [d.A.pelvisScale[0], 1, d.A.pelvisScale[1] * 1.08]);
      band(rig.hips, sash, 0.07, d.A.pelvis[2][1] * 1.18, 0.05, d.A.pelvisScale[0], d.A.pelvisScale[1] * 1.12);
      // teal headband, its ends trailing behind
      const hb = tmat('cloth', 0x4f8a86, { rough: 0.95, double: true });
      band(rig.head, hb, d.A.head.h * (HY + 0.28), d.A.head.w * 1.08, 0.035, 1, d.A.head.d / d.A.head.w * 1.05);
      flap(d, rig.head, hb, [0.02, d.A.head.h * (HY + 0.25), d.A.head.d * 1.05], 0.03, 0.18, { hang: 0.7, drag: 0.2 });
    } else {
      const vest = tmat('cloth', 0x6a6080, { rough: 0.95, double: true });
      const z = d.A.torso[3][1] * d.A.torsoScale[1];
      for (const s of S) put(rig.spine, panel(`ivest-${d.wkey}`, 0.09, 0.44, 0.13, 1.1), vest, [s * d.A.torso[3][1] * 1.05, topY - 0.01, -z * 1.02], [0, Math.PI + s * 0.4, 0]);
      put(rig.spine, panel(`ivestb-${d.wkey}`, d.A.torso[3][1] * d.A.torsoScale[0] * 2.0, 0.46, 0.26), vest, [0, topY - 0.01, z * 0.95]);
      for (const s of S) put(rig.spine, ball(0.07, 8, 6), vest, [s * d.A.dims.shoulderW * 0.92, topY - 0.02, 0], undefined, [1.1, 0.5, 1.2]);
      put(rig.hips, skirt(`ikilt-${d.wkey}`, d.A.pelvis[2][1] * 1.12, d.A.pelvis[1][1] * 1.3, 0.3, 0.8, 14), cream, [0, 0.07, 0], undefined, [d.A.pelvisScale[0], 1, d.A.pelvisScale[1] * 1.05]);
      band(rig.hips, tmat('cloth', 0x4f8a86), 0.07, d.A.pelvis[2][1] * 1.2, 0.07, d.A.pelvisScale[0], d.A.pelvisScale[1] * 1.14);
      flap(d, rig.hips, tmat('cloth', 0x4f8a86, { rough: 0.95, double: true }), [0, 0.04, -pz * 1.06], 0.16, 0.46, { front: true, curve: 0.14, taper: 0.9 });
    }
    // a satchel on a strap across the body (both menders carry one)
    put(rig.spine, box(0.03, 0.66, d.A.torso[3][1] * d.A.torsoScale[1] * 2.28), leather, [0, d.A.torso[3][0], 0], [0, 0, side * 0.62]);
    put(rig.hips, box(0.13, 0.12, 0.06), leather, [side * 0.2, -0.04, 0.02]);
  }
}

// ---------------------------------------------------------------- the player's role kit

/** What each role carries on the back or belt, so the role reads at a glance too. */
function roleKit(d: Dress, role: string): void {
  const { rig, race } = d;
  const wood = tmat('', 0x8a6a48, { rough: 0.8 });
  const metal = tmat('metal', MI.metal, { rough: 0.5, metal: 0.55 });
  const stone = tmat('iskari', 0xd8ceba, { rough: 0.9, flat: true });
  const back = new THREE.Object3D();
  back.position.set(0, 0.28, d.A.torso[3][1] * d.A.torsoScale[1] + 0.06);
  rig.spine.add(back);
  switch (role) {
    case 'frontline': {
      // a round shield on the back and a spear
      const sm = race === 'iskari' ? stone : race === 'sehari' ? tmat('leather', 0x8a6a4a) : metal;
      put(back, cyl(0.22, 0.22, 0.03, 12), sm, [0, 0.02, 0.02], [Math.PI / 2, 0, 0]);
      put(back, cyl(0.04, 0.04, 0.04, 8), race === 'minaa' ? tmat('metal', MI.brass, { metal: 0.6 }) : sm, [0, 0.02, 0.04], [Math.PI / 2, 0, 0]);
      put(back, cyl(0.013, 0.013, 1.5, 5), wood, [0.05, 0.1, -0.02], [0, 0, 0.3]);
      put(back, cone(0.028, 0.14, 4), race === 'sehari' ? tmat('', 0x5a8a78, { rough: 0.4 }) : metal, [-0.17, 0.8, -0.02], [0, 0, 0.3]);
      break;
    }
    case 'ranged': {
      if (race === 'sehari') { bow(rig.spine, [0.02, 0.3, back.position.z]); break; }
      if (race === 'iskari') {
        // forearm pulse projector (concept art), amber core
        put(rig.rFore, tube('proj', d.A.dims.foreArm * 0.8, [[0, 0.055], [0.5, 0.06], [1, 0.05]], 8), stone);
        lit(put(rig.rFore, ball(0.03, 6, 4), glow(d.glows, CRYSTAL_HEX.amber, 1.2, true, 0x6a4418), [0, -d.A.dims.foreArm * 0.5, -0.05], undefined, [1, 1.5, 1], 'crystal'));
        break;
      }
      put(back, cyl(0.022, 0.02, 1.0, 6), metal, [0.05, 0.1, 0], [0, 0, -0.5]);
      put(back, box(0.06, 0.18, 0.05), wood, [0.25, -0.28, 0], [0, 0, -0.5]);
      break;
    }
    case 'channeller': {
      // a forked staff with a crystal in the cradle
      const g = new THREE.Object3D();
      g.position.set(0, -0.1, 0);
      g.rotation.z = 0.3;
      back.add(g);
      put(g, cyl(0.018, 0.022, 1.4, 5), tmat('', 0xb49c78), [0, 0.1, 0]);
      for (const s of S) put(g, cone(0.018, 0.2, 4), tmat('', 0xb49c78), [s * 0.04, 0.85, 0], [0, 0, -s * 0.35]);
      lit(put(g, octa(0.045), glow(d.glows, CRYSTAL_HEX.verdant, 1.5, true, 0x2c5a34), [0, 0.85, 0], undefined, [0.8, 1.5, 0.8], 'crystal'));
      break;
    }
    case 'scout': {
      // a hooded half-cape and a long knife at the hip
      const cape = tmat('cloth', race === 'minaa' ? 0x6e5a44 : 0x6e6a5a, { rough: 0.95, double: true });
      flap(d, rig.spine, cape, [0, d.A.torso[d.A.torso.length - 1][0] + 0.02, back.position.z - 0.03], 0.36, 0.52, { hang: 0.75, curve: 0.2, restX: -0.15 });
      put(rig.hips, box(0.025, 0.3, 0.04), metal, [0.17, -0.15, 0.02], [0.1, 0, 0.12]);
      break;
    }
    case 'healer': {
      // a satchel with a crimson crystal clasp and a rolled bandage
      const bag = tmat('leather', 0x7a5236, { rough: 0.8 });
      put(rig.hips, box(0.2, 0.16, 0.08), bag, [-0.2, -0.02, 0.02]);
      lit(put(rig.hips, octa(0.02), glow(d.glows, CRYSTAL_HEX.crimson, 1.2, true, 0x5a1a14), [-0.2, 0.0, -0.03], undefined, [1, 1.4, 1], 'crystal'));
      put(rig.spine, box(0.035, 0.6, 0.02), bag, [0, 0.28, 0], [0, 0, 0.62], [1, 1, d.A.torso[3][1] * d.A.torsoScale[1] * 48]);
      put(back, cyl(0.05, 0.05, 0.22, 8), tmat('cloth', 0xe6dcc4), [0, 0.2, 0], [0, 0, Math.PI / 2]);
      break;
    }
    case 'tech': {
      // a tool roll and a bundle of salvage on the back
      put(back, cyl(0.06, 0.06, 0.28, 8), tmat('leather', 0x6a4a30), [0, 0.18, 0], [0, 0, Math.PI / 2]);
      put(back, box(0.14, 0.16, 0.08), metal, [0, -0.02, 0.02]);
      put(back, cyl(0.03, 0.03, 0.14, 8), tmat('metal', MI.brass, { metal: 0.6 }), [0.1, -0.02, 0.03], [Math.PI / 2, 0, 0]);
      break;
    }
  }
}


// ================================================================= the defensive-line Iskari

// Reference: iskari-woken-defensive-azalos-v2.png, iskari-woken-defensive-unit-study.png,
// iskari-defensive-line-personal-force-cannon.png. Broad, dense, rust-stained pale stone with teal
// in the seams, a big soul crystal, a crescent shield on the left arm and a crescent-headed staff.
// Dormant, it stands frozen mid-stride under a crust of sand and stone. Waking, the crust cracks
// and falls, the seams light, and it steps out.

function dressDefender(d: Dress): void {
  const { rig, glows, A, sway } = d;
  const H = A.head;
  const hd = rig.head;
  const hy = H.h * HY;
  const stone = d.K.skin;
  const dark = tmat('defender', 0xb09c84, { rough: 0.9, flat: true });
  const cream = tmat('cloth', 0xd8ccb0, { rough: 0.95, double: true });
  const tealCloth = tmat('cloth', 0x3f7a74, { rough: 0.95, double: true });

  // a low ridge on the skull, cracked plates on the brow
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    put(hd, box(0.028, 0.035, 0.07), dark, [0, hy + H.h * (0.97 - t * 0.3), -H.d * 0.3 + t * H.d * 1.1], [-0.5 - t * 0.6, 0, 0]);
  }
  for (const s of S) put(hd, box(0.008, 0.06, 0.04), dark, [s * H.w * 0.85, hy - 0.02, -H.d * 0.3], [0.2, 0, s * 0.12]);

  // the soul crystal: large, teal-blue, set in a stone collar of petal plates
  const soul = glow(glows, 0x5fd8e8, 2.2, true, 0x1c6a76, true);
  const cy = A.torso[3][0] + 0.02, cz = -A.torso[3][1] * A.torsoScale[1] - 0.005;
  lit(put(rig.spine, octa(0.06), soul, [0, cy, cz], undefined, [0.8, 1.5, 0.5], 'crystal'));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    put(rig.spine, ball(0.05, 6, 4), dark, [Math.cos(a) * 0.075, cy + Math.sin(a) * 0.1, cz + 0.02], [0, 0, a], [0.4, 1.3, 0.35]);
  }
  // pauldrons: heavy curved plates on both shoulders
  for (const s of S) {
    put(rig.spine, ball(0.13, 10, 7), stone, [s * A.dims.shoulderW * 1.02, A.torso[A.torso.length - 1][0] - 0.02, 0], [0, 0, -s * 0.5], [1.15, 0.6, 1.05]);
  }
  // loincloth: cream front and back, a teal strip, a rust tie
  const pz = A.pelvis[2][1] * A.pelvisScale[1] * 1.15;
  flap(d, rig.hips, cream, [0, 0.06, -pz], 0.3, 0.62, { front: true, curve: 0.2, taper: 0.7 });
  flap(d, rig.hips, cream, [0, 0.06, pz], 0.32, 0.55, { back: true, curve: 0.2, taper: 0.8, yaw: Math.PI });
  flap(d, rig.hips, tealCloth, [0.05, 0.05, -pz * 1.04], 0.06, 0.58, { front: true, hang: 0.9 });
  band(rig.hips, tmat('cloth', 0x9b4a2c), 0.08, A.pelvis[2][1] * 1.16, 0.06, A.pelvisScale[0], A.pelvisScale[1] * 1.12);

  // crescent shield on the left forearm (concept art): curved stone, teal glass inlay
  const sh = new THREE.Object3D();
  sh.position.set(-0.09, -A.dims.foreArm * 0.5, -0.02);
  sh.rotation.set(0, -0.3, 0);
  rig.lFore.add(sh);
  put(sh, ring(0.38, 0.06, 6, 18, Math.PI * 0.95), stone, [0, 0, 0], [0, Math.PI / 2, -Math.PI * 0.47], [1, 1, 0.5]);
  put(sh, ring(0.3, 0.035, 5, 16, Math.PI * 0.9), glow(glows, 0x5fe0d0, 0.9, false, 0x2a6a66, false), [0.01, 0, 0], [0, Math.PI / 2, -Math.PI * 0.45], [1, 1, 0.35]);

  // crescent-headed staff in the right hand
  const staff = new THREE.Object3D();
  staff.position.set(0, -0.06, 0);
  staff.rotation.set(Math.PI / 2 - 0.2, 0, 0);
  rig.rHand.add(staff);
  put(staff, cyl(0.025, 0.028, 1.9, 6), dark, [0, 0.35, 0]);
  put(staff, ring(0.16, 0.03, 5, 14, Math.PI * 1.3), stone, [0, 1.36, 0], [0, 0, Math.PI * 0.85]);
  lit(put(staff, octa(0.05), glow(glows, 0x5fd8e8, 1.6, true, 0x1c6a76, false), [0, 1.36, 0], undefined, [0.7, 1.4, 0.7], 'crystal'));
  void sway;
}

/** The defender. States: 'dormant' (frozen mid-stride under a crust), 'waking', 'awake', 'dead'. */
function buildDefender(opts: ModelOpts): Model {
  return buildPerson('iskari', 'male', 'defender', opts, 'defender', (spec, d) => {
    const { rig } = d;
    const r = rng(seedOf(opts.seed, 'defender', 'crust'));

    // the crust: a per-instance material, so it can fade as it falls
    const crustMat = new THREE.MeshStandardMaterial({ color: 0xc9ab84, map: tex('iskari'), roughness: 1, flatShading: true, transparent: true, opacity: 1 });
    const shards: Array<{ m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; delay: number; home: THREE.Object3D }> = [];
    const parts: Array<[THREE.Object3D, number, number, number]> = [
      [rig.spine, 22, 0.66, 0.24], [rig.hips, 8, 0.18, 0.2], [rig.head, 6, 0.28, 0.12],
      [rig.lArm, 6, -0.4, 0.1], [rig.rArm, 6, -0.4, 0.1], [rig.lFore, 5, -0.36, 0.08], [rig.rFore, 5, -0.36, 0.08],
      [rig.lLeg, 7, -0.55, 0.13], [rig.rLeg, 7, -0.55, 0.13], [rig.lShin, 5, -0.48, 0.09], [rig.rShin, 5, -0.48, 0.09],
    ];
    for (const [joint, n, span, rad] of parts) {
      for (let i = 0; i < n; i++) {
        const t = r();
        const a = r() * Math.PI * 2;
        const y = span > 0 ? t * span : t * span;
        const m = put(joint, ico(0.05 + r() * 0.06, 0), crustMat, [Math.cos(a) * rad * (0.85 + r() * 0.3), y, Math.sin(a) * rad * (0.85 + r() * 0.3)], [r() * 3, r() * 3, r() * 3], [1, 0.6 + r() * 0.6, 1]);
        m.userData.keep = true;
        shards.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), delay: r() * 0.9, home: joint });
      }
    }

    type St = 'dormant' | 'waking' | 'awake' | 'dead';
    let state: St = 'dormant';
    let wakeT = 0; // 0 frozen .. 1 fully awake
    let level = 0;
    let fallen = false;

    const frozen = (o: Pose, k: number) => {
      // mid-stride at its post: left foot forward, staff held low, shield up
      add(o, J.lLeg, 0.5, 0, -0.04); add(o, J.lShin, -0.35); add(o, J.lFoot, 0.2);
      add(o, J.rLeg, -0.35, 0, 0.05); add(o, J.rShin, -0.25); add(o, J.rFoot, 0.55);
      add(o, J.spine, -0.12, 0.2); add(o, J.head, 0.05, -0.2);
      add(o, J.lArm, 0.55, 0, -0.25); add(o, J.lFore, 1.1);
      add(o, J.rArm, 0.15, 0, 0.2); add(o, J.rFore, 0.4);
      void k;
    };
    const stance = (o: Pose, k: number) => {
      // ready stance: wide, low, shield forward, staff back and angled
      const br = Math.sin(k * 1.4) * 0.02;
      add(o, J.lLeg, 0.35, 0, -0.18); add(o, J.lShin, -0.55); add(o, J.lFoot, 0.25);
      add(o, J.rLeg, -0.1, 0, 0.18); add(o, J.rShin, -0.6); add(o, J.rFoot, 0.5);
      add(o, J.spine, -0.2 + br, 0.35); add(o, J.head, 0.12, -0.3);
      add(o, J.lArm, 0.8, 0, -0.35); add(o, J.lFore, 1.2);
      add(o, J.rArm, 0.1, 0, 0.3); add(o, J.rFore, 0.55);
    };

    const basePost = spec.post;
    spec.style = { ...spec.style, life: 0.3, walkHz: 1.05, stride: 0.62, armSwing: 0.15, hipSway: 0.02, shoulderSway: 0.1, lengths: { attack: 0.8, hit: 0.4, die: 1.6, wake: 2.4 } };
    spec.height = 2.5;
    spec.restAnim = () => (state === 'dormant' ? 'sleep' : 'idle');
    spec.post = (o, c) => {
      basePost?.(o, c);
      if (state === 'dormant' || (c.anim === 'sleep')) {
        // hold dead still: cancel the generic sleep pose and freeze mid-stride
        o.fill(0);
        frozen(o, c.clock);
        return;
      }
      if (c.anim === 'wake' || state === 'waking') {
        const u = smoothT(wakeT);
        const A2 = new Float32Array(o.length), B2 = new Float32Array(o.length);
        frozen(A2, c.clock); stance(B2, c.clock);
        o.fill(0);
        // a shudder before it moves: stone grinding loose
        const shake = wakeT < 0.4 ? 0.03 * Math.sin(c.clock * 60) * (wakeT / 0.4) : 0;
        for (let i = 0; i < o.length; i++) o[i] = A2[i] + (B2[i] - A2[i]) * u;
        add(o, J.spine, shake, shake * 0.5);
        add(o, J.head, -0.25 * Math.sin(Math.min(1, wakeT * 1.5) * Math.PI)); // the head comes up last
        return;
      }
      if (c.anim === 'idle' || c.anim === 'talk') stance(o, c.clock);
      if (c.anim === 'walk' || c.anim === 'run') {
        add(o, J.lArm, 0.6, 0, -0.3); add(o, J.lFore, 1.0); // shield stays up while it walks
        add(o, J.spine, -0.1);
      }
      if (c.anim === 'attack') {
        const T = [0, 0.35, 0.5, 0.65, 1];
        const kk = (v: number[]) => kf(c.p, T, v);
        add(o, J.rArm, kk([0, 2.6, 0.2, 0.3, 0]), 0, kk([0, 0.3, -0.2, -0.2, 0]));
        add(o, J.rFore, kk([0, 0.6, 0.1, 0.1, 0]));
        add(o, J.spine, kk([0, 0.1, -0.35, -0.3, 0]), kk([0, -0.4, 0.45, 0.4, 0]));
        add(o, J.lArm, 0.7, 0, -0.3); add(o, J.lFore, 1.1);
      }
    };
    const baseFrame = spec.frame;
    spec.frame = (cur, c, dt) => {
      baseFrame?.(cur, c, dt);
      if (state === 'waking') wakeT = Math.min(1, wakeT + dt / 2.4);
      if (state === 'waking' && wakeT >= 1) state = 'awake';
      // shards: fall once waking has begun
      if ((state === 'waking' || state === 'awake' || state === 'dead') && !fallen) {
        const root = rig.body.parent?.parent?.parent; // body -> scaler -> model root -> scene
        let alive = 0;
        for (const s of shards) {
          if (s.delay > 0) { s.delay -= dt; alive++; continue; }
          if (s.m.parent === s.home) {
            // detach into the scene, keeping its place, and throw it out and down
            const host = root ?? rig.body;
            host.attach(s.m);
            s.v.set((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6);
            s.w.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
          }
          s.v.y -= 9 * 0.9 * dt;
          s.m.position.addScaledVector(s.v, dt);
          if (s.m.position.y < (root ? 0.03 : -9)) { s.m.position.y = root ? 0.03 : s.m.position.y; s.v.multiplyScalar(0.3); s.v.y = 0; s.w.multiplyScalar(0.5); }
          s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt; s.m.rotation.z += s.w.z * dt;
          alive++;
        }
        if (wakeT > 0.75) crustMat.opacity = Math.max(0, 1 - (wakeT - 0.75) * 4);
        if (crustMat.opacity <= 0 || alive === 0) {
          fallen = true;
          for (const s of shards) s.m.parent?.remove(s.m);
          crustMat.dispose();
        }
      }
    };
    spec.glowLevel = (k, dt) => {
      let want = 0;
      if (state === 'waking') want = wakeT < 0.3 ? 0.4 * Math.abs(Math.sin(k * 25)) : wakeT;
      else if (state === 'awake') want = 1 + 0.08 * Math.sin(k * 2);
      level += (want - level) * Math.min(1, dt * 4);
      return level;
    };
    spec.setState = (s, ctl) => {
      if (s === 'dormant' || s === 'asleep') {
        state = 'dormant'; wakeT = 0;
        if (ctl.anim() !== 'die') ctl.play('sleep');
      } else if (s === 'waking') {
        if (state === 'dormant') { state = 'waking'; wakeT = 0; ctl.play('idle'); }
      } else if (s === 'awake' || s === 'hostile' || s === 'active') {
        if (state === 'dormant') { state = 'waking'; wakeT = 0.99; }
        else state = state === 'waking' ? 'waking' : 'awake';
        if (ctl.anim() === 'sleep') ctl.play('idle');
      } else if (s === 'dead') {
        state = 'dead';
      }
    };
  });
}

const smoothT = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
