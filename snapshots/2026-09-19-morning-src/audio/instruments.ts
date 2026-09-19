// Small synth voices shared by music, ambience and sfx.
// Each one schedules its own envelope and stops its sources when done.

import { Voice, cents, perc, rand, swell } from './engine';

export type Inst = (v: Voice, dest: AudioNode, f: number, t: number, dur: number, lvl: number) => void;

/** Soft plucked string: triangle body, filter closes as it decays. */
export const pluck: Inst = (v, dest, f, t, dur, lvl) => {
  const g = v.gain(0, dest);
  const lp = v.filter('lowpass', f * 6, 0.8, g);
  lp.frequency.setValueAtTime(Math.min(f * 8, 9000), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.2, 200), t + dur * 0.6);
  const end = t + dur + 0.1;
  v.osc('triangle', f, t, end, lp);
  v.osc('triangle', cents(f, -4), t, end, lp);
  const og = v.gain(0.25, lp);
  v.osc('sine', f * 2.003, t, end, og);
  perc(g.gain, t, 0.006, lvl, dur);
};

/** Glassy FM bell. */
export const bell: Inst = (v, dest, f, t, dur, lvl) => {
  const g = v.gain(0, dest);
  const end = t + dur + 0.1;
  const car = v.osc('sine', f, t, end, g);
  const idx = v.gain(0, car.frequency);
  idx.gain.setValueAtTime(f * 0.9, t);
  idx.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.02), t + dur * 0.4);
  v.osc('sine', f * 2, t, end, idx);
  const pg = v.gain(0, g);
  perc(pg.gain, t, 0.003, 0.18, dur * 0.35);
  v.osc('sine', f * 2.756, t, end, pg);
  perc(g.gain, t, 0.004, lvl, dur);
};

/** Breathy flute-like line with gentle vibrato. */
export const flute: Inst = (v, dest, f, t, dur, lvl) => {
  const g = v.gain(0, dest);
  const lp = v.filter('lowpass', f * 3, 0.5, g);
  const end = t + dur + 0.2;
  const o1 = v.osc('triangle', f, t, end, lp);
  const sg = v.gain(0.5, lp);
  const o2 = v.osc('sine', f, t, end, sg);
  const vg = v.gain(0, o1.frequency);
  vg.connect(o2.frequency);
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.8, dur * 0.5));
  v.osc('sine', rand(4.6, 5.4), t, end, vg);
  const bg = v.gain(lvl * 0.25, g);
  const bp = v.filter('bandpass', f * 2, 2, bg);
  v.noise(v.engine.pink, t, end, bp);
  swell(g.gain, t, 0.25, lvl, Math.max(0, dur - 0.85), 0.6);
};

function padEnv(dur: number): { a: number; r: number; hold: number } {
  const a = Math.min(4, dur * 0.35);
  const r = Math.min(5, dur * 0.4);
  return { a, r, hold: Math.max(0, dur - a - r) };
}

/** Bowed pad: two detuned saws through a soft lowpass. */
export const bow: Inst = (v, dest, f, t, dur, lvl) => {
  const { a, r, hold } = padEnv(dur);
  const g = v.gain(0, dest);
  const lp = v.filter('lowpass', Math.min(f * 2.5, 2600), 0.6, g);
  const end = t + dur + 0.2;
  v.osc('sawtooth', cents(f, -7), t, end, lp);
  v.osc('sawtooth', cents(f, 6), t, end, lp);
  swell(g.gain, t, a, lvl, hold, r);
};

const VOWELS: readonly (readonly [number, number])[] = [
  [730, 1090], // ah
  [360, 820], // oo
  [540, 1700], // eh
];

/** Choir-like pad: detuned saws through vowel formants, slow vibrato. */
export const choir: Inst = (v, dest, f, t, dur, lvl) => {
  const { a, r, hold } = padEnv(dur);
  const g = v.gain(0, dest);
  const vw = VOWELS[Math.floor(Math.random() * VOWELS.length)] ?? [730, 1090];
  const sum = v.gain(1, g);
  const f1g = v.gain(3.2, sum);
  const f2g = v.gain(1.6, sum);
  const f1 = v.filter('bandpass', vw[0], 5, f1g);
  const f2 = v.filter('bandpass', vw[1], 6, f2g);
  const bodyG = v.gain(0.35, sum);
  const body = v.filter('lowpass', Math.min(f * 2, 1800), 0.5, bodyG);
  const end = t + dur + 0.2;
  const vib = v.gain(f * 0.004);
  for (const c of [-9, 0, 8]) {
    const o = v.osc('sawtooth', cents(f, c), t, end, f1);
    o.connect(f2);
    o.connect(body);
    vib.connect(o.frequency);
  }
  v.osc('sine', rand(4, 5), t, end, vib);
  swell(g.gain, t, a, lvl, hold, r);
};

/** Glass pad: detuned sines with a few quiet partials. */
export const glass: Inst = (v, dest, f, t, dur, lvl) => {
  const { a, r, hold } = padEnv(dur);
  const g = v.gain(0, dest);
  const end = t + dur + 0.2;
  v.osc('sine', cents(f, -5), t, end, g);
  v.osc('sine', cents(f, 5), t, end, g);
  const hg = v.gain(0.28, g);
  v.osc('sine', f * 2, t, end, hg);
  const hg3 = v.gain(0.1, g);
  v.osc('sine', f * 3.01, t, end, hg3);
  swell(g.gain, t, a, lvl, hold, r);
};

/** Struck metal: inharmonic sine partials, higher ones die faster. */
export function metal(v: Voice, dest: AudioNode, f: number, t: number, dur: number, lvl: number): void {
  const ratios = [1, 2.76, 5.4, 8.93];
  ratios.forEach((k, i) => {
    const g = v.gain(0, dest);
    v.osc('sine', f * k * rand(0.995, 1.005), t, t + dur + 0.05, g);
    perc(g.gain, t, 0.002, lvl / (1 + i * 0.9), dur / (1 + i * 0.8));
  });
}
