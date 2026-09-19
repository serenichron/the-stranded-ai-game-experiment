// One-shot sound effects. Each builds a tiny graph in a Voice that
// disconnects itself when its last source ends.

import { Engine, Voice, mtof, perc, rand, randInt, swell } from './engine';
import { bell, metal, pluck } from './instruments';
import type { Sfx } from './types';

const MAX_VOICES = 24;
let active = 0;
const lastPlayed = new Map<Sfx, number>();

interface C {
  e: Engine;
  v: Voice;
  t: number;
  p: number; // pitch multiplier
  out: AudioNode; // dry destination
  send: GainNode; // reverb send level
}

interface ToneOpts {
  a?: number;
  f2?: number;
  dest?: AudioNode;
}

/** Enveloped oscillator, optional exponential glide to f2. */
function tone(c: C, type: OscillatorType, f: number, t: number, dur: number, peak: number, o: ToneOpts = {}): OscillatorNode {
  const a = o.a ?? 0.005;
  const g = c.v.gain(0, o.dest ?? c.out);
  const osc = c.v.osc(type, f * c.p, t, t + a + dur + 0.05, g);
  if (o.f2 !== undefined) {
    osc.frequency.setValueAtTime(f * c.p, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2 * c.p), t + a + dur);
  }
  perc(g.gain, t, a, peak, dur);
  return osc;
}

interface BurstOpts {
  a?: number;
  f2?: number;
  buf?: 'white' | 'pink' | 'brown';
  dest?: AudioNode;
}

/** Enveloped filtered noise, optional filter sweep to f2. */
function burst(c: C, t: number, dur: number, peak: number, type: BiquadFilterType, f: number, q: number, o: BurstOpts = {}): BiquadFilterNode {
  const a = o.a ?? 0.003;
  const g = c.v.gain(0, o.dest ?? c.out);
  const filt = c.v.filter(type, f * c.p, q, g);
  if (o.f2 !== undefined) {
    filt.frequency.setValueAtTime(f * c.p, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2 * c.p), t + a + dur);
  }
  c.v.noise(c.e[o.buf ?? 'white'], t, t + a + dur + 0.05, filt);
  perc(g.gain, t, a, peak, dur);
  return filt;
}

function thud(c: C, t: number, f: number, dur: number, peak: number): void {
  tone(c, 'sine', f, t, dur, peak, { f2: f * 0.4, a: 0.003 });
  burst(c, t, dur * 0.35, peak * 0.6, 'lowpass', 500, 0.7, { buf: 'pink' });
}

function clack(c: C, t: number, peak: number, lo: number, hi: number): void {
  const f = rand(lo, hi);
  burst(c, t, rand(0.012, 0.022), peak, 'bandpass', f, 3);
  tone(c, 'sine', f * rand(0.45, 0.65), t, 0.03, peak * 0.35, { a: 0.001 });
}

function note(c: C, m: number): number {
  return mtof(m);
}

const DEFS: Record<Sfx, (c: C) => void> = {
  // ---------- UI ----------
  click: (c) => {
    tone(c, 'sine', 1100, c.t, 0.045, 0.26, { f2: 720, a: 0.002 });
    burst(c, c.t, 0.01, 0.06, 'highpass', 3000, 0.7);
  },
  hover: (c) => {
    tone(c, 'sine', 1600, c.t, 0.035, 0.045, { f2: 1750, a: 0.003 });
  },
  open: (c) => {
    c.send.gain.value = 0.25;
    burst(c, c.t, 0.16, 0.05, 'bandpass', 600, 1.2, { a: 0.08, f2: 2400, buf: 'pink' });
    tone(c, 'triangle', note(c, 72), c.t + 0.02, 0.25, 0.1, { a: 0.01 });
    tone(c, 'triangle', note(c, 79), c.t + 0.08, 0.35, 0.08, { a: 0.01 });
  },
  close: (c) => {
    c.send.gain.value = 0.2;
    burst(c, c.t, 0.14, 0.05, 'bandpass', 2400, 1.2, { a: 0.02, f2: 600, buf: 'pink' });
    tone(c, 'triangle', note(c, 77), c.t, 0.18, 0.08, { a: 0.008 });
    tone(c, 'triangle', note(c, 70), c.t + 0.06, 0.28, 0.08, { a: 0.008 });
  },
  page: (c) => {
    burst(c, c.t, 0.13, 0.1, 'bandpass', 3000, 0.8, { a: 0.03, f2: 1700 });
    burst(c, c.t + 0.07, 0.05, 0.04, 'highpass', 5000, 0.7);
  },

  // ---------- Dice ----------
  'dice-roll': (c) => {
    burst(c, c.t, 0.45, 0.08, 'lowpass', 300, 0.8, { a: 0.05, buf: 'brown' });
    const n = randInt(7, 11);
    for (let i = 0; i < n; i++) {
      const tt = c.t + Math.pow(Math.random(), 0.8) * 0.55;
      clack(c, tt, rand(0.06, 0.15), 1800, 3800);
    }
  },
  'dice-land': (c) => {
    burst(c, c.t, 0.05, 0.2, 'lowpass', 450, 0.7, { buf: 'pink' });
    const t2 = c.t + rand(0.07, 0.11);
    const t3 = t2 + rand(0.08, 0.13);
    clack(c, c.t, 0.3, 1000, 2000);
    clack(c, t2, 0.2, 1100, 2200);
    clack(c, t3, 0.1, 1200, 2400);
  },
  full: (c) => {
    c.send.gain.value = 0.35;
    const lp = c.v.filter('lowpass', 2600, 0.5, c.out);
    [62, 66, 69, 74].forEach((m, i) => {
      tone(c, 'triangle', note(c, m), c.t + i * 0.07, 1.4 - i * 0.1, 0.1, { a: 0.02, dest: lp });
    });
    tone(c, 'sine', note(c, 50), c.t, 1.6, 0.12, { a: 0.03 });
    bell(c.v, c.out, note(c, 81) * c.p, c.t + 0.3, 1.2, 0.035);
  },
  partial: (c) => {
    c.send.gain.value = 0.3;
    const lp = c.v.filter('lowpass', 1800, 0.5, c.out);
    tone(c, 'triangle', note(c, 62), c.t, 0.8, 0.12, { a: 0.015, dest: lp });
    const o = tone(c, 'triangle', note(c, 67), c.t + 0.18, 1.0, 0.11, { a: 0.015, dest: lp });
    o.frequency.setValueAtTime(note(c, 67) * c.p, c.t + 0.4);
    o.frequency.linearRampToValueAtTime(note(c, 66.6) * c.p, c.t + 1.2);
  },
  miss: (c) => {
    c.send.gain.value = 0.15;
    tone(c, 'sine', 110, c.t, 0.4, 0.38, { f2: 45, a: 0.004 });
    burst(c, c.t, 0.2, 0.25, 'lowpass', 250, 0.7, { buf: 'brown' });
    const lp = c.v.filter('lowpass', 400, 0.7, c.out);
    tone(c, 'triangle', note(c, 38), c.t + 0.02, 0.8, 0.14, { a: 0.02, dest: lp });
  },

  // ---------- Footsteps ----------
  step: (c) => {
    burst(c, c.t, 0.06, 0.16, 'lowpass', rand(500, 800), 0.8, { buf: 'pink', a: 0.004 });
    tone(c, 'sine', rand(70, 95), c.t, 0.05, 0.1, { f2: 50, a: 0.002 });
  },
  'step-sand': (c) => {
    burst(c, c.t, 0.085, 0.09, 'bandpass', rand(1500, 2600), 0.9, { a: 0.01 });
    burst(c, c.t + 0.02, 0.06, 0.04, 'highpass', 3500, 0.7);
    burst(c, c.t, 0.05, 0.07, 'lowpass', 400, 0.7, { buf: 'pink' });
  },

  // ---------- Combat on the player ----------
  swing: (c) => {
    burst(c, c.t, 0.14, 0.3, 'bandpass', 350, 1.2, { a: 0.09, f2: 1800, buf: 'pink' });
  },
  hit: (c) => {
    tone(c, 'sine', 140, c.t, 0.25, 0.45, { f2: 48, a: 0.002 });
    burst(c, c.t, 0.09, 0.3, 'lowpass', 1400, 0.7, { buf: 'pink' });
    burst(c, c.t, 0.03, 0.1, 'bandpass', 2500, 1);
  },
  guard: (c) => {
    c.send.gain.value = 0.2;
    metal(c.v, c.out, rand(380, 440) * c.p, c.t, 0.5, 0.16);
    burst(c, c.t, 0.02, 0.18, 'highpass', 2000, 0.7);
    tone(c, 'sine', 180, c.t, 0.1, 0.18, { f2: 120 });
  },
  wound: (c) => {
    c.send.gain.value = 0.2;
    tone(c, 'sine', 120, c.t, 0.3, 0.38, { f2: 50, a: 0.003 });
    const lp = c.v.filter('lowpass', 900, 0.7, c.out);
    tone(c, 'sawtooth', 311, c.t + 0.03, 0.6, 0.06, { a: 0.02, f2: 280, dest: lp });
    tone(c, 'sawtooth', 330, c.t + 0.03, 0.6, 0.06, { a: 0.02, f2: 297, dest: lp });
  },
  collapse: (c) => {
    c.send.gain.value = 0.2;
    thud(c, c.t, 110, 0.3, 0.4);
    thud(c, c.t + 0.22, 90, 0.45, 0.5);
    burst(c, c.t + 0.22, 0.9, 0.09, 'bandpass', 900, 0.8, { a: 0.1, f2: 300, buf: 'pink' });
  },

  // ---------- Enemy ----------
  'enemy-hit': (c) => {
    c.send.gain.value = 0.15;
    metal(c.v, c.out, rand(220, 300) * c.p, c.t, 0.35, 0.14);
    burst(c, c.t, 0.05, 0.25, 'bandpass', 1800, 1.5);
    burst(c, c.t + 0.025, 0.04, 0.18, 'bandpass', 900, 1.5);
    tone(c, 'sine', 160, c.t, 0.15, 0.28, { f2: 70 });
  },
  'enemy-die': (c) => {
    c.send.gain.value = 0.3;
    const t = c.t;
    const trem = c.v.gain(0.5, c.out);
    const depth = c.v.gain(0.5, trem.gain);
    const lfo = c.v.osc('square', 14, t, t + 1.8, depth);
    lfo.frequency.setValueAtTime(14, t);
    lfo.frequency.exponentialRampToValueAtTime(2.5, t + 1.6);
    const lp = c.v.filter('lowpass', 1200, 2, trem);
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(150, t + 1.6);
    tone(c, 'sawtooth', 180, t, 1.6, 0.14, { f2: 30, a: 0.02, dest: lp });
    metal(c.v, c.out, 260 * c.p, t + 0.3, 0.4, 0.1);
    thud(c, t + 0.5, 80, 0.4, 0.4);
    metal(c.v, c.out, 190 * c.p, t + 0.58, 0.5, 0.08);
    for (let i = 0; i < 4; i++) burst(c, t + rand(0.1, 0.9), rand(0.005, 0.02), rand(0.05, 0.12), 'highpass', rand(3000, 6000), 0.7);
  },

  // ---------- Channelling and crystals ----------
  'channel-amber': (c) => {
    c.send.gain.value = 0.45;
    const t = c.t;
    const g = c.v.gain(0, c.out);
    const bp = c.v.filter('bandpass', 300, 2, g);
    bp.frequency.setValueAtTime(300 * c.p, t);
    bp.frequency.exponentialRampToValueAtTime(1400 * c.p, t + 0.6);
    c.v.osc('sawtooth', 110 * c.p, t, t + 1.3, bp);
    c.v.osc('sawtooth', 110.8 * c.p, t, t + 1.3, bp);
    swell(g.gain, t, 0.5, 0.12, 0.1, 0.5);
    [57, 64, 69].forEach((m) => tone(c, 'sine', note(c, m), t + 0.45, 1.4, 0.07, { a: 0.05 }));
  },
  'channel-crimson': (c) => {
    c.send.gain.value = 0.35;
    const t = c.t;
    const trem = c.v.gain(0.6, c.out);
    const depth = c.v.gain(0.4, trem.gain);
    c.v.osc('sine', 11, t, t + 1.5, depth);
    const lp = c.v.filter('lowpass', 700, 4, trem);
    tone(c, 'square', 98, t, 1.0, 0.1, { f2: 73, a: 0.3, dest: lp });
    tone(c, 'sawtooth', 103.8, t, 1.0, 0.05, { f2: 77, a: 0.3, dest: lp });
    burst(c, t, 1.0, 0.14, 'lowpass', 200, 0.7, { a: 0.3, buf: 'brown' });
  },
  'teal-lance': (c) => {
    c.send.gain.value = 0.5;
    const t = c.t;
    tone(c, 'sine', 600, t, 0.12, 0.16, { f2: 3200, a: 0.004 });
    tone(c, 'sine', 1320, t + 0.05, 0.6, 0.08, { a: 0.004 });
    tone(c, 'sine', 1980, t + 0.05, 0.5, 0.05, { a: 0.004 });
    burst(c, t, 0.2, 0.07, 'highpass', 4000, 0.7);
    bell(c.v, c.out, 2640 * c.p, t + 0.1, 0.5, 0.03);
  },
  shock: (c) => {
    const t = c.t;
    const g = c.v.gain(0, c.out);
    const hp = c.v.filter('highpass', 900, 0.7, g);
    const o = c.v.osc('square', 300, t, t + 0.45, hp);
    for (let k = 0; k < 20; k++) o.frequency.setValueAtTime(rand(80, 900) * c.p, t + k * 0.018);
    perc(g.gain, t, 0.005, 0.08, 0.35);
    for (let i = 0; i < 6; i++) burst(c, t + rand(0, 0.35), 0.01, rand(0.1, 0.2), 'highpass', 3000, 0.7);
  },
  shatter: (c) => {
    c.send.gain.value = 0.4;
    const t = c.t;
    burst(c, t, 0.35, 0.22, 'highpass', 2500, 0.7, { a: 0.002 });
    tone(c, 'sine', 400, t, 0.08, 0.14, { f2: 200 });
    for (let i = 0; i < 10; i++) {
      tone(c, 'sine', rand(2200, 6000), t + Math.pow(Math.random(), 2) * 0.25, rand(0.1, 0.4), rand(0.03, 0.07), { a: 0.001 });
    }
  },
  sparks: (c) => {
    c.send.gain.value = 0.2;
    for (let i = 0; i < 8; i++) burst(c, c.t + rand(0, 0.6), rand(0.005, 0.02), rand(0.08, 0.18), 'highpass', rand(3000, 7000), 0.7);
    for (let i = 0; i < 3; i++) tone(c, 'sine', rand(3000, 5000), c.t + rand(0, 0.5), 0.06, 0.025, { a: 0.001 });
  },

  // ---------- Tel'sharin and creatures ----------
  'telsharin-growl': (c) => {
    c.send.gain.value = 0.2;
    const t = c.t;
    const g = c.v.gain(0, c.out);
    const lp = c.v.filter('lowpass', 250, 6, g);
    lp.frequency.setValueAtTime(250, t);
    lp.frequency.linearRampToValueAtTime(700, t + 0.4);
    lp.frequency.exponentialRampToValueAtTime(300, t + 1.2);
    const o = c.v.osc('sawtooth', 55 * c.p, t, t + 1.4, lp);
    o.frequency.setValueAtTime(55 * c.p, t);
    o.frequency.linearRampToValueAtTime(48 * c.p, t + 1.2);
    const vib = c.v.gain(3, o.frequency);
    c.v.osc('sine', 7, t, t + 1.4, vib);
    swell(g.gain, t, 0.25, 0.24, 0.4, 0.6);
    burst(c, t, 0.9, 0.1, 'bandpass', 350, 2, { a: 0.2, buf: 'pink' });
    tone(c, 'sine', 880, t + 0.1, 0.9, 0.015, { f2: 830, a: 0.2 });
  },
  'telsharin-feed': (c) => {
    c.send.gain.value = 0.2;
    const t = c.t;
    let tt = t;
    for (let i = 0; i < 6; i++) {
      burst(c, tt, 0.08, 0.16, 'bandpass', rand(500, 900), 2, { buf: 'pink' });
      tone(c, 'sine', 90, tt, 0.07, 0.13, { f2: 60 });
      tt += rand(0.15, 0.21);
    }
    const g = c.v.gain(0, c.out);
    const o = c.v.osc('sine', 82 * c.p, t, t + 1.8, g);
    o.frequency.setValueAtTime(82 * c.p, t);
    o.frequency.linearRampToValueAtTime(110 * c.p, t + 1.4);
    swell(g.gain, t, 0.4, 0.08, 0.6, 0.6);
    tone(c, 'sine', 1200, t, 1.2, 0.012, { f2: 1500, a: 0.3 });
  },
  'telsharin-sleep': (c) => {
    c.send.gain.value = 0.3;
    const t = c.t;
    const lp = c.v.filter('lowpass', 600, 0.7, c.out);
    tone(c, 'sine', 110, t, 2.2, 0.12, { f2: 55, a: 0.05, dest: lp });
    tone(c, 'sine', 165, t, 2.0, 0.06, { f2: 82, a: 0.05, dest: lp });
    let gap = 0.12;
    let tt = t;
    for (let i = 0; i < 7; i++) {
      burst(c, tt, 0.01, 0.1 * (1 - i / 8), 'highpass', 2500, 0.7);
      tt += gap;
      gap *= 1.35;
    }
    burst(c, t + 0.4, 1.2, 0.07, 'lowpass', 600, 0.7, { a: 0.3, f2: 200, buf: 'pink' });
  },
  'guardian-hum': (c) => {
    c.send.gain.value = 0.5;
    const t = c.t;
    const g = c.v.gain(0, c.out);
    const trem = c.v.gain(0.8, g);
    const depth = c.v.gain(0.2, trem.gain);
    c.v.osc('sine', 0.8, t, t + 3.5, depth);
    const lp = c.v.filter('lowpass', 900, 0.7, trem);
    for (const f of [73.4, 110, 146.8, 147.4, 220.5]) c.v.osc('sine', f * c.p, t, t + 3.5, lp);
    swell(g.gain, t, 1.0, 0.07, 0.8, 1.5);
  },
  'dog-bark': (c) => {
    c.send.gain.value = 0.3;
    const lp = c.v.filter('lowpass', 3000, 0.7, c.out);
    const bark = (tt: number): void => {
      const f0 = rand(380, 460) * c.p;
      const g = c.v.gain(0, lp);
      const b1 = c.v.filter('bandpass', 1000, 3, g);
      const b2 = c.v.filter('bandpass', 2200, 4, g);
      const o = c.v.osc('sawtooth', f0 * 1.3, tt, tt + 0.2, b1);
      o.connect(b2);
      o.frequency.setValueAtTime(f0 * 1.3, tt);
      o.frequency.exponentialRampToValueAtTime(f0, tt + 0.12);
      perc(g.gain, tt, 0.01, 0.5, 0.13);
      burst(c, tt, 0.08, 0.08, 'bandpass', 1500, 1, { dest: lp });
    };
    bark(c.t);
    bark(c.t + rand(0.22, 0.3));
  },

  // ---------- World ----------
  'door-open': (c) => {
    c.send.gain.value = 0.3;
    const t = c.t;
    burst(c, t, 1.2, 0.3, 'lowpass', 180, 0.7, { a: 0.2, buf: 'brown' });
    const g = c.v.gain(0, c.out);
    const bp = c.v.filter('bandpass', 1100, 12, g);
    const o = c.v.osc('sawtooth', 45, t, t + 1.3, bp);
    o.frequency.setValueAtTime(45, t);
    o.frequency.linearRampToValueAtTime(60, t + 1.1);
    swell(g.gain, t, 0.3, 0.05, 0.4, 0.4);
    thud(c, t + 1.2, 90, 0.3, 0.32);
  },
  pickup: (c) => {
    c.send.gain.value = 0.3;
    pluck(c.v, c.out, note(c, 76) * c.p, c.t, 0.35, 0.1);
    pluck(c.v, c.out, note(c, 83) * c.p, c.t + 0.07, 0.45, 0.09);
    burst(c, c.t, 0.04, 0.03, 'highpass', 6000, 0.7);
  },
  'metal-drag': (c) => {
    c.send.gain.value = 0.15;
    const t = c.t;
    const bp = burst(c, t, 1.1, 0.12, 'bandpass', 1400, 6, { a: 0.1 });
    for (let k = 0; k < 28; k++) bp.frequency.setValueAtTime(rand(900, 2200) * c.p, t + k * 0.04);
    burst(c, t, 1.1, 0.14, 'lowpass', 300, 0.7, { a: 0.1, buf: 'brown' });
    const g = c.v.gain(0, c.out);
    const cr = c.v.filter('bandpass', 1600, 15, g);
    c.v.osc('sawtooth', 38, t, t + 1.3, cr);
    swell(g.gain, t, 0.15, 0.04, 0.6, 0.35);
  },
  quest: (c) => {
    c.send.gain.value = 0.45;
    bell(c.v, c.out, note(c, 62) * c.p, c.t, 1.4, 0.08);
    bell(c.v, c.out, note(c, 69) * c.p, c.t + 0.14, 1.4, 0.07);
    bell(c.v, c.out, note(c, 76) * c.p, c.t + 0.28, 1.8, 0.06);
    tone(c, 'sine', note(c, 50), c.t, 1.8, 0.08, { a: 0.2 });
  },
  alert: (c) => {
    c.send.gain.value = 0.2;
    const lp = c.v.filter('lowpass', 1200, 0.7, c.out);
    tone(c, 'sine', 70, c.t, 0.2, 0.32, { f2: 45 });
    tone(c, 'triangle', note(c, 57), c.t, 0.25, 0.15, { a: 0.005, dest: lp });
    tone(c, 'triangle', note(c, 58), c.t + 0.14, 0.25, 0.15, { a: 0.005, dest: lp });
    tone(c, 'triangle', note(c, 57), c.t + 0.35, 0.2, 0.08, { a: 0.005, dest: lp });
    tone(c, 'triangle', note(c, 58), c.t + 0.49, 0.3, 0.08, { a: 0.005, dest: lp });
  },
  suspicious: (c) => {
    c.send.gain.value = 0.3;
    const lp = c.v.filter('lowpass', 1500, 0.7, c.out);
    tone(c, 'triangle', note(c, 62), c.t, 0.3, 0.1, { a: 0.02, dest: lp });
    const o = tone(c, 'triangle', note(c, 66), c.t + 0.22, 0.6, 0.1, { a: 0.03, dest: lp, f2: note(c, 68) });
    const vib = c.v.gain(4, o.frequency);
    c.v.osc('sine', 5.5, c.t + 0.22, c.t + 0.9, vib);
  },
  'memory-echo': (c) => {
    c.send.gain.value = 0.8;
    const t = c.t;
    for (const m of [50, 57, 64, 66, 73]) {
      const g = c.v.gain(0, c.out);
      const f = note(c, m) * c.p;
      c.v.osc('sine', f * Math.pow(2, -8 / 1200), t, t + 4.4, g);
      c.v.osc('sine', f * Math.pow(2, 8 / 1200), t, t + 4.4, g);
      swell(g.gain, t, 1.6, 0.045, 0.6, 2.0);
    }
    [86, 90, 93].forEach((m, i) => bell(c.v, c.out, note(c, m) * c.p, t + 1.4 + i * 0.22, 1.6, 0.03));
    burst(c, t, 1.5, 0.05, 'bandpass', 2500, 0.7, { a: 1.2, buf: 'pink' });
  },
  drink: (c) => {
    const lp = c.v.filter('lowpass', 1500, 0.7, c.out);
    for (const dt of [0, 0.28, 0.55]) {
      const tt = c.t + dt + rand(-0.02, 0.02);
      tone(c, 'sine', 280, tt, 0.08, 0.16, { f2: 620, dest: lp });
      tone(c, 'sine', 900, tt + 0.04, 0.03, 0.04, { f2: 1400 });
      burst(c, tt, 0.06, 0.05, 'lowpass', 800, 0.7, { buf: 'pink' });
    }
  },
};

// Sounds that can fire in rapid bursts get a small retrigger guard.
const MIN_GAP: Partial<Record<Sfx, number>> = { hover: 0.04, step: 0.06, 'step-sand': 0.06, click: 0.03 };

export function playSfx(e: Engine, name: Sfx, volume: number, pitch: number): void {
  const def = DEFS[name];
  if (!def) return;
  if (active >= MAX_VOICES) return;
  const now = e.now;
  const last = lastPlayed.get(name);
  const gap = MIN_GAP[name] ?? 0.015;
  if (last !== undefined && now - last < gap && now >= last) return;
  lastPlayed.set(name, now);

  active++;
  const bus = e.buses.sfx;
  const v = new Voice(e, bus.dry, volume, () => {
    active = Math.max(0, active - 1);
  });
  const send = v.gain(0.12, bus.wet);
  v.out.connect(send);
  const c: C = { e, v, t: now + 0.005, p: pitch, out: v.out, send };
  try {
    def(c);
  } catch {
    v.stopAll(now);
  }
}
