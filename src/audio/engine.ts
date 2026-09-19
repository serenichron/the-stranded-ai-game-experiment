// Core WebAudio plumbing: buses, master chain, shared reverb, noise buffers,
// a Voice helper that cleans up after itself, and a Layer base for loops.

export type Channel = 'music' | 'ambience' | 'sfx';

/** A mix channel. Sources feed `dry`; reverb sends feed `wet`. Both carry the channel volume. */
export interface Bus {
  dry: GainNode;
  wet: GainNode;
}

export const rand = (a: number, b: number): number => a + Math.random() * (b - a);
export const randInt = (a: number, b: number): number => Math.floor(rand(a, b + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;
export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const cents = (f: number, c: number): number => f * Math.pow(2, c / 1200);

/** Linear attack, exponential decay to silence. */
export function perc(p: AudioParam, t: number, a: number, peak: number, d: number): void {
  const pk = Math.max(0.00011, peak);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(pk, t + a);
  p.exponentialRampToValueAtTime(0.0001, t + a + d);
  p.setValueAtTime(0, t + a + d + 0.005);
}

/** Linear attack, hold, exponential release. */
export function swell(p: AudioParam, t: number, a: number, peak: number, hold: number, r: number): void {
  const pk = Math.max(0.00011, peak);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(pk, t + a);
  p.setValueAtTime(pk, t + a + hold);
  p.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
  p.setValueAtTime(0, t + a + hold + r + 0.01);
}

function makeNoise(ctx: BaseAudioContext, kind: 'white' | 'pink' | 'brown', seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    let s: number;
    if (kind === 'white') {
      s = w;
    } else if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      s = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      s = last;
    }
    d[i] = s;
    const a = Math.abs(s);
    if (a > peak) peak = a;
  }
  const norm = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < len; i++) d[i] = (d[i] as number) * norm;
  // Short crossfade at the loop point so looping sources do not click.
  const fade = Math.min(512, Math.floor(len / 4));
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    const j = len - fade + i;
    d[j] = (d[j] as number) * (1 - k) + (d[i] as number) * k;
  }
  return buf;
}

/** Stereo impulse: pre-delay, then decaying noise that darkens over time. */
function makeImpulse(ctx: BaseAudioContext, seconds: number, power: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const pre = Math.floor(sr * 0.018);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < len; i++) {
      if (i < pre) {
        d[i] = 0;
        continue;
      }
      const t = (i - pre) / (len - pre);
      const x = Math.random() * 2 - 1;
      const k = 1 - 0.88 * t; // one-pole lowpass that closes as the tail goes on
      y += k * (x - y);
      d[i] = y * Math.pow(1 - t, power);
    }
  }
  return buf;
}

export class Engine {
  readonly ctx: AudioContext;
  readonly buses: Record<Channel, Bus>;
  readonly masterVol: GainNode;
  readonly muteGain: GainNode;
  readonly reverbIn: GainNode;
  readonly white: AudioBuffer;
  readonly pink: AudioBuffer;
  readonly brown: AudioBuffer;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    const sum = ctx.createGain();
    sum.gain.value = 0.85;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 14;
    comp.ratio.value = 3;
    comp.attack.value = 0.008;
    comp.release.value = 0.3;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.12;

    this.masterVol = ctx.createGain();
    this.muteGain = ctx.createGain();
    sum.connect(comp);
    comp.connect(limiter);
    limiter.connect(this.masterVol);
    this.masterVol.connect(this.muteGain);
    this.muteGain.connect(ctx.destination);

    this.white = makeNoise(ctx, 'white', 3);
    this.pink = makeNoise(ctx, 'pink', 4);
    this.brown = makeNoise(ctx, 'brown', 4);

    this.reverbIn = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 150;
    const conv = ctx.createConvolver();
    conv.normalize = true;
    conv.buffer = makeImpulse(ctx, 4.2, 2.4);
    const ret = ctx.createGain();
    ret.gain.value = 0.75;
    this.reverbIn.connect(hp);
    hp.connect(conv);
    conv.connect(ret);
    ret.connect(sum);

    const mk = (): Bus => {
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      dry.connect(sum);
      wet.connect(this.reverbIn);
      return { dry, wet };
    };
    this.buses = { music: mk(), ambience: mk(), sfx: mk() };
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  setParam(p: AudioParam, v: number, tc = 0.05): void {
    const t = this.ctx.currentTime;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.setTargetAtTime(v, t, tc);
  }

  setChannel(ch: Channel, v: number): void {
    const b = this.buses[ch];
    this.setParam(b.dry.gain, v);
    this.setParam(b.wet.gain, v);
  }
}

/**
 * Owns a small graph of nodes. When every source it started has ended,
 * it disconnects everything and calls onDone.
 */
export class Voice {
  readonly out: GainNode;
  private readonly e: Engine;
  private readonly nodes: AudioNode[] = [];
  private readonly srcs: AudioScheduledSourceNode[] = [];
  private ended = 0;
  private done = false;
  private readonly onDone: (() => void) | undefined;

  constructor(e: Engine, dest: AudioNode, level = 1, onDone?: () => void) {
    this.e = e;
    this.onDone = onDone;
    this.out = e.ctx.createGain();
    this.out.gain.value = level;
    this.out.connect(dest);
  }

  get ctx(): AudioContext {
    return this.e.ctx;
  }

  get engine(): Engine {
    return this.e;
  }

  gain(value: number, dest?: AudioNode | AudioParam): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    if (dest) connect(g, dest);
    this.nodes.push(g);
    return g;
  }

  filter(type: BiquadFilterType, freq: number, q: number, dest: AudioNode): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = Math.min(freq, this.ctx.sampleRate * 0.45);
    f.Q.value = q;
    f.connect(dest);
    this.nodes.push(f);
    return f;
  }

  pan(value: number, dest: AudioNode): AudioNode {
    if (typeof this.ctx.createStereoPanner === 'function') {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, value));
      p.connect(dest);
      this.nodes.push(p);
      return p;
    }
    return this.gain(1, dest);
  }

  osc(type: OscillatorType, freq: number, t0: number, t1: number | undefined, dest: AudioNode | AudioParam): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    connect(o, dest);
    this.reg(o);
    o.start(t0);
    if (t1 !== undefined) o.stop(Math.max(t1, t0 + 0.01));
    return o;
  }

  noise(buf: AudioBuffer, t0: number, t1: number | undefined, dest: AudioNode, rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = rate;
    s.connect(dest);
    this.reg(s);
    s.start(t0, Math.random() * buf.duration * 0.9);
    if (t1 !== undefined) s.stop(Math.max(t1, t0 + 0.01));
    return s;
  }

  stopAll(t: number): void {
    if (this.srcs.length === 0) {
      this.cleanup();
      return;
    }
    for (const s of this.srcs) {
      try {
        s.stop(t);
      } catch {
        /* already stopped */
      }
    }
  }

  private reg(s: AudioScheduledSourceNode): void {
    this.srcs.push(s);
    this.nodes.push(s);
    s.onended = () => {
      this.ended++;
      if (this.ended >= this.srcs.length) this.cleanup();
    };
  }

  private cleanup(): void {
    if (this.done) return;
    this.done = true;
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    try {
      this.out.disconnect();
    } catch {
      /* ignore */
    }
    this.onDone?.();
  }
}

function connect(src: AudioNode, dest: AudioNode | AudioParam): void {
  if (dest instanceof AudioParam) src.connect(dest);
  else src.connect(dest);
}

interface Gen {
  next: number;
  fire: (t: number) => number; // schedules an event at t, returns seconds until the next one
}

/**
 * A looping bed (ambience or music). Persistent nodes live on `v`.
 * Timed events come from generators ticked ahead on the audio clock.
 */
export class Layer {
  readonly out: GainNode;
  readonly v: Voice;
  readonly e: Engine;
  private readonly send: GainNode;
  private readonly gens: Gen[] = [];
  private stopped = false;

  /** True once the layer has started fading out. Late-loading samples check this. */
  get isStopped(): boolean {
    return this.stopped;
  }

  constructor(e: Engine, bus: Bus, wet: number) {
    this.e = e;
    const ctx = e.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(bus.dry);
    this.send = ctx.createGain();
    this.send.gain.value = wet;
    this.out.connect(this.send);
    this.send.connect(bus.wet);
    this.v = new Voice(e, this.out);
  }

  /** A short-lived voice for one event, routed into this layer. */
  ev(level = 1): Voice {
    return new Voice(this.e, this.out, level);
  }

  gen(firstIn: number, fire: (t: number) => number): void {
    this.gens.push({ next: this.e.now + firstIn, fire });
  }

  tick(now: number, until: number): void {
    if (this.stopped) return;
    for (const g of this.gens) {
      if (g.next < now) g.next = now + rand(0.05, 0.25); // skip events missed while throttled
      let guard = 0;
      while (g.next < until && guard++ < 16) {
        const gap = g.fire(g.next);
        g.next += Math.max(0.05, gap);
      }
    }
  }

  fadeIn(sec: number): void {
    const t = this.e.now;
    const g = this.out.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(1, t + Math.max(0.05, sec));
  }

  fadeOut(sec: number): void {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.e.now;
    const s = Math.max(0.05, sec);
    const g = this.out.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + s);
    this.v.stopAll(t + s + 0.05);
    setTimeout(() => {
      try {
        this.out.disconnect();
        this.send.disconnect();
      } catch {
        /* ignore */
      }
    }, (s + 0.4) * 1000);
  }
}
