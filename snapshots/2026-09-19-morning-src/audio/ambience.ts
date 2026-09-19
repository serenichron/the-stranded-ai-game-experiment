// Ambience beds. Each is a Layer with a few persistent sources (wind, hum, resonance)
// and generators that drop in timed events (gusts, creaks, cloth, chimes).

import { Engine, Layer, cents, mtof, perc, pick, rand, randInt, swell } from './engine';
import { bell, metal } from './instruments';
import type { Ambience } from './types';

// Recorded beds (public/audio/, credits in public/audio/CREDITS.md). Loaded once, shared by every layer.
const samples = new Map<string, Promise<AudioBuffer | null>>();
function loadSample(e: Engine, url: string): Promise<AudioBuffer | null> {
  let p = samples.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => e.ctx.decodeAudioData(b))
      .catch(() => null);
    samples.set(url, p);
  }
  return p;
}

/** Loop a recording under a layer. Returns false (via the promise) if it could not load. */
function addSample(L: Layer, url: string, level: number): Promise<boolean> {
  return loadSample(L.e, url).then((buf) => {
    if (!buf || L.isStopped) return !!buf;
    const g = L.v.gain(0, L.out);
    L.v.noise(buf, L.e.now, undefined, g); // loops, starting at a random point
    g.gain.setTargetAtTime(level, L.e.now, 0.8);
    return true;
  });
}

interface WindOpts {
  level: number;
  freq: number;
  q: number;
  hiss: number;
  rumble: number;
  gust: [number, number]; // seconds between gusts
  amount: number; // gust strength
}

/**
 * Wind. The playtest said the synthesised wind sounded like waves, twice, so the bed is now a real
 * desert wind recording, scaled to the layer's wind level. The synth below is only the fallback.
 */
function addWind(L: Layer, opts: WindOpts): void {
  void addSample(L, '/audio/desert-wind.mp3', opts.level * 3.3) /* recording RMS is 0.031 */.then((ok) => {
    if (!ok && !L.isStopped) addSynthWind(L, opts);
  });
}

function addSynthWind(L: Layer, opts: WindOpts): void {
  // Retuned after playtest: the first wind sounded like surf (low band, big regular swells, rumble).
  // Desert wind is higher, thinner and steadier: band up an octave, swells small and irregular,
  // almost no rumble, and quieter overall.
  const o: WindOpts = {
    ...opts,
    level: opts.level * 0.55,
    freq: opts.freq * 2.2,
    q: Math.max(1.1, opts.q * 1.8),
    rumble: opts.rumble * 0.25,
    amount: opts.amount * 0.35,
    gust: [opts.gust[0] * 1.6, opts.gust[1] * 2],
  };
  const e = L.e;
  const v = L.v;
  const t0 = e.now;
  const bands = [-0.6, 0.6].map((side) => {
    const pan = v.pan(side, L.out);
    const g = v.gain(o.level, pan);
    const base = o.freq * rand(0.85, 1.15);
    const f = v.filter('bandpass', base, o.q, g);
    v.noise(e.pink, t0, undefined, f, rand(0.92, 1.08));
    return { g, f, base };
  });
  const hissG = v.gain(o.hiss, L.out);
  const hissF = v.filter('highpass', 3800, 0.6, hissG);
  v.noise(e.white, t0, undefined, hissF, rand(0.95, 1.05));
  if (o.rumble > 0) {
    const rg = v.gain(o.rumble, L.out);
    const rf = v.filter('lowpass', 120, 0.7, rg);
    v.noise(e.brown, t0, undefined, rf);
  }

  L.gen(rand(0.5, 2), (t) => {
    const s = rand(0.3, 1) * o.amount;
    const dur = rand(2.5, 6);
    for (const b of bands) {
      const off = rand(0, 0.7);
      b.f.frequency.setTargetAtTime(b.base * (1 + s * 1.2), t + off, dur * 0.25);
      b.f.frequency.setTargetAtTime(b.base * rand(0.8, 1.1), t + off + dur * 0.5, dur * 0.35);
      b.g.gain.setTargetAtTime(o.level * (1 + s * 0.7), t + off, dur * 0.4);
      b.g.gain.setTargetAtTime(o.level * rand(0.8, 1), t + off + dur * 0.6, dur * 0.5);
    }
    hissG.gain.setTargetAtTime(o.hiss * (1 + s * 3), t + 0.3, dur * 0.25);
    hissG.gain.setTargetAtTime(o.hiss * rand(0.5, 1), t + 0.3 + dur * 0.5, dur * 0.35);
    return rand(o.gust[0], o.gust[1]);
  });
}

/** Distant friction creak: a slow saw pulse train through a narrow resonance. */
function creak(L: Layer, t: number, level: number): void {
  const v = L.ev();
  const dur = rand(0.6, 1.6);
  const pan = v.pan(rand(-0.8, 0.8), v.out);
  const g = v.gain(0, pan);
  const bp = v.filter('bandpass', rand(700, 1600), 14, g);
  const r0 = rand(22, 45);
  const o = v.osc('sawtooth', r0, t, t + dur + 0.1, bp);
  o.frequency.setValueAtTime(r0, t);
  o.frequency.linearRampToValueAtTime(r0 * rand(0.6, 1.5), t + dur);
  swell(g.gain, t, dur * 0.4, level, dur * 0.2, dur * 0.4);
}

/** Distant metal tap, sometimes a short run of them (someone working salvage). */
function taps(L: Layer, t: number, level: number): void {
  const v = L.ev();
  const pan = v.pan(rand(-0.9, 0.9), v.out);
  const lp = v.filter('lowpass', 2500, 0.7, pan);
  const f = rand(700, 1300);
  const n = randInt(1, 4);
  const gap = rand(0.3, 0.5);
  for (let i = 0; i < n; i++) metal(v, lp, f * rand(0.98, 1.02), t + i * gap + rand(-0.03, 0.03), 0.5, level * rand(0.7, 1));
}

/** Cloth flapping in a gust: noise in a quick run of pulses. */
function flap(L: Layer, t: number, level: number): void {
  const v = L.ev();
  const n = randInt(4, 9);
  const dur = n * 0.09 + 0.2;
  const pan = v.pan(rand(-0.7, 0.7), v.out);
  const g = v.gain(0, pan);
  const bp = v.filter('bandpass', rand(600, 1200), 0.7, g);
  v.noise(L.e.pink, t, t + dur, bp);
  let tt = t;
  for (let i = 0; i < n; i++) {
    const pk = level * rand(0.5, 1);
    g.gain.setTargetAtTime(pk, tt, 0.008);
    g.gain.setTargetAtTime(pk * 0.08, tt + 0.025, 0.02);
    tt += rand(0.05, 0.09);
  }
  g.gain.setTargetAtTime(0, tt, 0.03);
}

function crackle(L: Layer, t: number, level: number): void {
  const v = L.ev();
  const n = randInt(1, 4);
  const g = v.gain(0, v.out);
  const hp = v.filter('highpass', rand(1800, 3000), 0.7, g);
  v.noise(L.e.white, t, t + 0.5, hp);
  g.gain.setValueAtTime(0, t);
  for (let i = 0; i < n; i++) {
    const tt = t + rand(0, 0.4);
    g.gain.setValueAtTime(level * rand(0.4, 1), tt);
    g.gain.setTargetAtTime(0, tt + 0.002, 0.004);
  }
}

/** Wind whistling across a gap: very narrow band of noise that glides. */
function whistle(L: Layer, t: number, level: number): void {
  const v = L.ev();
  const dur = rand(2, 4);
  const g = v.gain(0, v.pan(rand(-0.6, 0.6), v.out));
  const bp = v.filter('bandpass', 500, 28, g);
  const f0 = rand(450, 650);
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.linearRampToValueAtTime(f0 * rand(1.3, 1.7), t + dur * 0.5);
  bp.frequency.linearRampToValueAtTime(f0 * rand(0.9, 1.2), t + dur);
  v.noise(L.e.pink, t, t + dur + 0.1, bp);
  swell(g.gain, t, dur * 0.4, level, dur * 0.1, dur * 0.5);
}

function skitter(L: Layer, t: number, level: number): void {
  const v = L.ev();
  const g = v.gain(0, v.pan(rand(-0.8, 0.8), v.out));
  const hp = v.filter('highpass', 5000, 0.7, g);
  const dur = rand(0.8, 1.6);
  v.noise(L.e.white, t, t + dur + 0.1, hp);
  swell(g.gain, t, dur * 0.3, level, 0, dur * 0.7);
}

function groan(L: Layer, t: number, level: number): void {
  const v = L.ev();
  const dur = rand(2.5, 4);
  const g = v.gain(0, v.pan(rand(-0.5, 0.5), v.out));
  const lp = v.filter('lowpass', 180, 3, g);
  const f0 = rand(30, 45);
  const o = v.osc('sawtooth', f0, t, t + dur + 0.1, lp);
  o.frequency.setValueAtTime(f0, t);
  o.frequency.linearRampToValueAtTime(f0 * rand(0.8, 1.2), t + dur);
  swell(g.gain, t, dur * 0.4, level, dur * 0.2, dur * 0.4);
}

/** Buzzing amber light: a brief sputter of a filtered saw. */
function sputter(L: Layer, t: number, level: number): void {
  const v = L.ev();
  const g = v.gain(0, v.out);
  const bp = v.filter('bandpass', 2200, 6, g);
  v.osc('sawtooth', 110, t, t + 0.8, bp);
  let tt = t;
  g.gain.setValueAtTime(0, t);
  for (let i = 0; i < randInt(3, 8); i++) {
    g.gain.setValueAtTime(level * rand(0.3, 1), tt);
    g.gain.setValueAtTime(0, tt + rand(0.02, 0.06));
    tt += rand(0.05, 0.1);
  }
}

/** A cluster of sustained sine partials; a generator swells one at a time. */
function addResonance(L: Layer, notes: number[], level: number, every: [number, number]): void {
  const v = L.v;
  const t0 = L.e.now;
  const parts = notes.map((m) => {
    const g = v.gain(level * 0.2, v.pan(rand(-0.7, 0.7), L.out));
    const f = mtof(m);
    v.osc('sine', cents(f, -4), t0, undefined, g);
    v.osc('sine', cents(f, 4), t0, undefined, g);
    return g;
  });
  L.gen(rand(0.5, 2), (t) => {
    const g = pick(parts);
    const up = rand(1.5, 4);
    g.gain.setTargetAtTime(level * rand(0.5, 1), t, up * 0.4);
    g.gain.setTargetAtTime(level * rand(0.05, 0.25), t + up, rand(1.5, 3));
    return rand(every[0], every[1]);
  });
}

function addHum(L: Layer, level: number): void {
  const v = L.v;
  const t0 = L.e.now;
  const g = v.gain(level, L.out);
  const trem = v.gain(level * 0.3, g.gain);
  v.osc('sine', 0.23, t0, undefined, trem);
  const lp = v.filter('lowpass', 500, 0.7, g);
  v.osc('sine', 55, t0, undefined, lp);
  const g2 = v.gain(0.6, lp);
  v.osc('sine', 110.4, t0, undefined, g2);
  const g3 = v.gain(0.25, lp);
  v.osc('triangle', 164.8, t0, undefined, g3);
}

function build(e: Engine, a: Exclude<Ambience, 'none'>): Layer {
  const bus = e.buses.ambience;
  switch (a) {
    case 'camp': {
      const L = new Layer(e, bus, 0.18);
      addWind(L, { level: 0.22, freq: 480, q: 0.7, hiss: 0.012, rumble: 0.1, gust: [5, 11], amount: 0.8 });
      L.gen(rand(3, 8), (t) => (flap(L, t, 0.09), rand(4, 12)));
      L.gen(rand(6, 14), (t) => (creak(L, t, 0.03), rand(9, 20)));
      L.gen(rand(4, 10), (t) => (taps(L, t, 0.025), rand(7, 18)));
      void addSample(L, '/audio/campfire.mp3', 0.9) /* recording RMS is 0.005, sharp crackles */;
      return L;
    }
    case 'desert': {
      const L = new Layer(e, bus, 0.12);
      addWind(L, { level: 0.3, freq: 380, q: 0.6, hiss: 0.03, rumble: 0.16, gust: [4, 9], amount: 1.1 });
      L.gen(rand(6, 15), (t) => (whistle(L, t, 0.05), rand(12, 26)));
      L.gen(rand(2, 6), (t) => (skitter(L, t, 0.025), rand(4, 10)));
      return L;
    }
    case 'wreck': {
      const L = new Layer(e, bus, 0.3);
      addWind(L, { level: 0.12, freq: 420, q: 0.7, hiss: 0.008, rumble: 0.08, gust: [6, 13], amount: 0.6 });
      addHum(L, 0.07);
      L.gen(rand(2, 6), (t) => (creak(L, t, 0.045), rand(5, 13)));
      L.gen(rand(8, 16), (t) => (groan(L, t, 0.09), rand(14, 28)));
      L.gen(rand(3, 9), (t) => (sputter(L, t, 0.012), rand(6, 16)));
      L.gen(rand(5, 12), (t) => {
        const v = L.ev();
        metal(v, v.pan(rand(-0.8, 0.8), v.out), rand(500, 900), t, 0.8, 0.015);
        return rand(8, 20);
      });
      return L;
    }
    case 'spire': {
      const L = new Layer(e, bus, 0.65);
      addWind(L, { level: 0.08, freq: 600, q: 0.8, hiss: 0.006, rumble: 0.04, gust: [7, 14], amount: 0.5 });
      addResonance(L, [74, 81, 88, 90, 93], 0.03, [1.5, 4]);
      const low = L.v.gain(0.04, L.out);
      L.v.osc('sine', mtof(38), e.now, undefined, low);
      L.gen(rand(4, 9), (t) => {
        const v = L.ev();
        bell(v, v.pan(rand(-0.8, 0.8), v.out), mtof(pick([74, 76, 78, 81, 83, 86])), t, rand(2, 3.5), 0.025);
        return rand(6, 15);
      });
      return L;
    }
    case 'memory': {
      const L = new Layer(e, bus, 0.8);
      const v = L.v;
      const g = v.gain(0.05, L.out);
      const hp = v.filter('bandpass', 2400, 0.6, g);
      v.noise(e.pink, e.now, undefined, hp);
      addResonance(L, [86, 90, 93, 97], 0.04, [1, 3]);
      L.gen(rand(1, 4), (t) => {
        const ev = L.ev();
        const pan = ev.pan(rand(-0.9, 0.9), ev.out);
        const f = mtof(pick([86, 88, 90, 93, 95, 98]));
        const gg = ev.gain(0, pan);
        ev.osc('sine', f, t, t + 1.6, gg);
        perc(gg.gain, t, 0.01, 0.03, 1.4);
        return rand(2, 6);
      });
      return L;
    }
  }
}

export function buildAmbience(e: Engine, a: Ambience): Layer | null {
  if (a === 'none') return null;
  return build(e, a);
}
