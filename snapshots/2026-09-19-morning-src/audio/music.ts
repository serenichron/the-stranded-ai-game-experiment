// Generative music beds. Nothing loops: a drone breathes, pads drift through
// a modal progression, and a sparse melody random-walks the mode in phrases
// that come to rest on a chord tone.

import { Engine, Layer, cents, mtof, perc, pick, rand, randInt } from './engine';
import { type Inst, bell, bow, choir, flute, glass, pluck } from './instruments';
import type { Music } from './types';

const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

interface MusicDef {
  root: number; // midi
  scale: number[];
  wet: number;
  drone?: { notes: number[]; level: number; cutoff: number; kind: 'bow' | 'glass' };
  pad?: {
    inst: Inst;
    level: number;
    octave: number;
    shape: number[]; // scale-degree offsets stacked on the chord root
    progression: number[]; // chord roots as scale degrees
    cycle: boolean; // walk the progression in order instead of at random
    gap: [number, number];
  };
  melody?: {
    inst: Inst;
    level: number;
    octave: number;
    unit: number; // seconds per rhythmic unit
    rhythm: number[];
    phrase: [number, number];
    rest: [number, number];
    range: [number, number]; // scale degrees
    dur: [number, number];
    firstIn: number;
  };
  pulse?: { bpm: number; level: number };
  cluster?: { level: number; gap: [number, number] };
}

const DEFS: Record<Exclude<Music, 'none'>, MusicDef> = {
  explore: {
    root: 50,
    scale: DORIAN,
    wet: 0.45,
    drone: { notes: [-12, -5], level: 0.05, cutoff: 420, kind: 'bow' },
    pad: { inst: bow, level: 0.03, octave: 0, shape: [0, 2, 4], progression: [0, 3, 6, 2, 4], cycle: false, gap: [11, 18] },
    melody: { inst: pluck, level: 0.09, octave: 12, unit: 0.62, rhythm: [1, 1, 2, 2, 3], phrase: [3, 6], rest: [4, 10], range: [0, 10], dur: [1.8, 3], firstIn: 3 },
  },
  tense: {
    root: 50,
    scale: PHRYGIAN,
    wet: 0.3,
    drone: { notes: [-12, -5], level: 0.06, cutoff: 320, kind: 'bow' },
    pad: { inst: bow, level: 0.025, octave: -12, shape: [0, 2, 4], progression: [0, 1, 5, 0, 6], cycle: false, gap: [7, 11] },
    melody: { inst: pluck, level: 0.08, octave: 0, unit: 0.45, rhythm: [1, 1, 1, 2], phrase: [2, 4], rest: [3, 7], range: [0, 8], dur: [1.2, 2], firstIn: 2 },
    pulse: { bpm: 66, level: 0.28 },
    cluster: { level: 0.018, gap: [9, 15] },
  },
  title: {
    root: 50,
    scale: DORIAN,
    wet: 0.6,
    drone: { notes: [-12, 0], level: 0.035, cutoff: 380, kind: 'bow' },
    pad: { inst: bow, level: 0.022, octave: 0, shape: [0, 4, 8], progression: [0, 3, 4, 6], cycle: false, gap: [14, 22] },
    melody: { inst: flute, level: 0.05, octave: 12, unit: 0.9, rhythm: [1, 2, 2, 3], phrase: [2, 5], rest: [8, 15], range: [0, 9], dur: [1.6, 3], firstIn: 6 },
  },
  ending: {
    root: 50,
    scale: AEOLIAN,
    wet: 0.6,
    drone: { notes: [-12], level: 0.025, cutoff: 300, kind: 'bow' },
    pad: { inst: bow, level: 0.024, octave: 0, shape: [0, 3, 4], progression: [5, 3, 6, 4], cycle: true, gap: [12, 18] },
    melody: { inst: bell, level: 0.04, octave: 12, unit: 1.1, rhythm: [1, 2, 3], phrase: [2, 4], rest: [10, 18], range: [1, 9], dur: [2.5, 4], firstIn: 8 },
  },
  memory: {
    root: 62,
    scale: LYDIAN,
    wet: 0.75,
    drone: { notes: [-24, -17], level: 0.03, cutoff: 900, kind: 'glass' },
    pad: { inst: choir, level: 0.02, octave: -12, shape: [0, 2, 4, 6], progression: [0, 1, 4, 5], cycle: false, gap: [9, 14] },
    melody: { inst: bell, level: 0.035, octave: 12, unit: 0.55, rhythm: [1, 1, 2, 3], phrase: [3, 7], rest: [3, 8], range: [0, 12], dur: [2, 3.5], firstIn: 2 },
  },
};

function degToSemi(scale: number[], d: number): number {
  const oct = Math.floor(d / 7);
  const i = ((d % 7) + 7) % 7;
  return (scale[i] ?? 0) + 12 * oct;
}

function buildMusic(e: Engine, def: MusicDef): Layer {
  const L = new Layer(e, e.buses.music, def.wet);
  const t0 = e.now;
  const deg = (d: number): number => degToSemi(def.scale, d);

  // Drone: persistent, its filter and level drift slowly.
  if (def.drone) {
    const dr = def.drone;
    const dg = L.v.gain(dr.level, L.out);
    const lp = L.v.filter('lowpass', dr.cutoff, 0.8, dg);
    for (const n of dr.notes) {
      const f = mtof(def.root + n);
      if (dr.kind === 'bow') {
        L.v.osc('sawtooth', cents(f, -6), t0, undefined, lp);
        L.v.osc('sawtooth', cents(f, 5), t0, undefined, lp);
      } else {
        L.v.osc('sine', cents(f, -3), t0, undefined, lp);
        L.v.osc('triangle', cents(f * 2, 4), t0, undefined, lp);
      }
    }
    L.gen(rand(2, 5), (t) => {
      lp.frequency.setTargetAtTime(dr.cutoff * rand(0.7, 1.6), t, rand(2, 4));
      dg.gain.setTargetAtTime(dr.level * rand(0.65, 1.1), t, rand(3, 5));
      return rand(5, 11);
    });
  }

  // Pads: chords from the mode.
  let chord = [0, 2, 4];
  let progIdx = 0;
  if (def.pad) {
    const pd = def.pad;
    let last = -99;
    L.gen(0.15, (t) => {
      let root: number;
      if (pd.cycle) {
        root = pd.progression[progIdx % pd.progression.length] ?? 0;
        progIdx++;
      } else {
        do root = pick(pd.progression);
        while (root === last && pd.progression.length > 1);
      }
      last = root;
      chord = pd.shape.map((k) => root + k);
      const gap = rand(pd.gap[0], pd.gap[1]);
      const dur = gap + 4;
      const v = L.ev();
      const per = pd.level / Math.sqrt(chord.length);
      chord.forEach((d) => {
        pd.inst(v, v.out, mtof(def.root + pd.octave + deg(d)), t + rand(0, 0.4), dur, per);
      });
      return gap;
    });
  }

  // Melody: random walk in phrases with rests.
  if (def.melody) {
    const md = def.melody;
    let d = randInt(md.range[0], Math.min(md.range[1], md.range[0] + 5));
    let left = 0;
    const steps = [-2, -1, -1, 1, 1, 2, 0, 4, -3];
    L.gen(md.firstIn, (t) => {
      if (left <= 0) {
        left = randInt(md.phrase[0], md.phrase[1]);
      }
      d += pick(steps);
      if (d < md.range[0]) d = md.range[0] + 1;
      if (d > md.range[1]) d = md.range[1] - 1;
      left--;
      if (left === 0) {
        // Land on the nearest tone of the current chord (in any octave).
        let best = d;
        let bestDist = 99;
        for (const c of chord) {
          for (let o = -14; o <= 14; o += 7) {
            const cand = c + o;
            const dist = Math.abs(cand - d);
            if (cand >= md.range[0] && cand <= md.range[1] && dist < bestDist) {
              best = cand;
              bestDist = dist;
            }
          }
        }
        d = best;
      }
      const v = L.ev();
      const f = mtof(def.root + md.octave + deg(d));
      const dur = left === 0 ? md.dur[1] * 1.3 : rand(md.dur[0], md.dur[1]);
      md.inst(v, v.pan(rand(-0.3, 0.3), v.out), f, t, dur, md.level * rand(0.75, 1));
      if (left === 0) return rand(md.rest[0], md.rest[1]);
      return md.unit * pick(md.rhythm) * rand(0.95, 1.08);
    });
  }

  // Pulse: a low heartbeat for combat, with a faint metallic tick between.
  if (def.pulse) {
    const pu = def.pulse;
    const beat = 60 / pu.bpm;
    let n = 0;
    L.gen(0.5, (t) => {
      const v = L.ev();
      const thump = (tt: number, lvl: number): void => {
        const g = v.gain(0, v.out);
        const lp = v.filter('lowpass', 180, 0.7, g);
        const o = v.osc('sine', 62, tt, tt + 0.4, lp);
        o.frequency.setValueAtTime(62, tt);
        o.frequency.exponentialRampToValueAtTime(38, tt + 0.25);
        perc(g.gain, tt, 0.006, lvl, 0.3);
      };
      thump(t, pu.level);
      thump(t + beat * 0.3, pu.level * 0.6);
      if (n % 2 === 1 && Math.random() < 0.6) {
        const g = v.gain(0, v.pan(rand(-0.6, 0.6), v.out));
        const hp = v.filter('bandpass', rand(3000, 4500), 4, g);
        v.noise(e.white, t + beat * 0.65, t + beat * 0.65 + 0.06, hp);
        perc(g.gain, t + beat * 0.65, 0.002, pu.level * 0.12, 0.04);
      }
      n++;
      return beat * (n % 8 === 0 ? 2 : 1);
    });
  }

  // Cluster: a quiet swelling minor second, high, with tremolo.
  if (def.cluster) {
    const cl = def.cluster;
    L.gen(rand(3, 6), (t) => {
      const v = L.ev();
      const pair = pick([[63, 62], [68, 69], [75, 74], [70, 69]]);
      const dur = rand(5, 8);
      const trem = v.gain(0.7, v.out);
      const depth = v.gain(0.3, trem.gain);
      v.osc('sine', rand(5, 7), t, t + dur + 0.3, depth);
      for (const m of pair) bow(v, trem, mtof(def.root - 12 + m), t, dur, cl.level);
      return rand(cl.gap[0], cl.gap[1]);
    });
  }

  // Memory: an occasional glass shimmer high above the choir.
  if (def.scale === LYDIAN) {
    L.gen(rand(4, 8), (t) => {
      const v = L.ev();
      glass(v, v.pan(rand(-0.8, 0.8), v.out), mtof(def.root + 24 + deg(pick([0, 2, 4, 6]))), t, rand(5, 8), 0.012);
      return rand(7, 13);
    });
  }

  return L;
}

export function buildMusicLayer(e: Engine, m: Music): Layer | null {
  if (m === 'none') return null;
  return buildMusic(e, DEFS[m]);
}
