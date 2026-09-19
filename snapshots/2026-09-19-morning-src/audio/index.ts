// The Stranded: runtime-synthesised audio. No files, no samples.
//
//   audio.init()                  from a user gesture (click / key). Safe to call again.
//   audio.setAmbience('camp')     crossfades ambience beds
//   audio.setMusic('explore')     crossfades generative music
//   audio.sfx('dice-roll')        one-shot effects
//
// Every call is a no-op before init() or when WebAudio is missing.
// setAmbience / setMusic called before init() are remembered and start on init().

import { Engine, Layer } from './engine';
import { buildAmbience } from './ambience';
import { buildMusicLayer } from './music';
import { playSfx } from './sfx';
import type { Ambience, AudioApi, Music, Sfx, SfxOptions, VolumeChannel } from './types';

export type { Ambience, AudioApi, Music, Sfx, SfxOptions, VolumeChannel } from './types';

const LOOKAHEAD = 1.5; // seconds of events scheduled ahead of the audio clock
const TICK_MS = 200;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

class AudioSystem implements AudioApi {
  private e: Engine | null = null;
  private failed = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly vols: Record<VolumeChannel, number> = { master: 0.8, music: 0.5, ambience: 0.6, sfx: 0.8 };
  private isMuted = false;

  private ambName: Ambience = 'none';
  private ambLayer: Layer | null = null;
  private musName: Music = 'none';
  private musLayer: Layer | null = null;

  get muted(): boolean {
    return this.isMuted;
  }

  init(): void {
    try {
      if (this.e) {
        if (this.e.ctx.state === 'suspended') void this.e.ctx.resume().catch(() => undefined);
        return;
      }
      if (this.failed || typeof window === 'undefined') return;
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) {
        this.failed = true;
        return;
      }
      const ctx = new Ctor({ latencyHint: 'interactive' });
      const e = new Engine(ctx);
      this.e = e;
      e.masterVol.gain.value = this.vols.master;
      e.buses.music.dry.gain.value = this.vols.music;
      e.buses.music.wet.gain.value = this.vols.music;
      e.buses.ambience.dry.gain.value = this.vols.ambience;
      e.buses.ambience.wet.gain.value = this.vols.ambience;
      e.buses.sfx.dry.gain.value = this.vols.sfx;
      e.buses.sfx.wet.gain.value = this.vols.sfx;
      e.muteGain.gain.value = this.isMuted ? 0 : 1;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

      this.timer = setInterval(() => this.tick(), TICK_MS);

      // Start anything requested before init.
      const amb = this.ambName;
      const mus = this.musName;
      this.ambName = 'none';
      this.musName = 'none';
      this.setAmbience(amb, 2);
      this.setMusic(mus, 3);
    } catch {
      this.failed = true;
      this.e = null;
    }
  }

  private tick(): void {
    const e = this.e;
    if (!e) return;
    try {
      const now = e.now;
      this.ambLayer?.tick(now, now + LOOKAHEAD);
      this.musLayer?.tick(now, now + LOOKAHEAD);
    } catch {
      /* never let a scheduling error escape */
    }
  }

  setAmbience(a: Ambience, fadeSec = 2.5): void {
    try {
      if (!this.e) {
        this.ambName = a;
        return;
      }
      if (a === this.ambName) return;
      this.ambName = a;
      this.ambLayer?.fadeOut(fadeSec);
      this.ambLayer = buildAmbience(this.e, a);
      if (this.ambLayer) {
        this.ambLayer.fadeIn(fadeSec);
        this.tick();
      }
    } catch {
      this.ambLayer = null;
    }
  }

  setMusic(m: Music, fadeSec = 3): void {
    try {
      if (!this.e) {
        this.musName = m;
        return;
      }
      if (m === this.musName) return;
      this.musName = m;
      this.musLayer?.fadeOut(fadeSec);
      this.musLayer = buildMusicLayer(this.e, m);
      if (this.musLayer) {
        this.musLayer.fadeIn(fadeSec);
        this.tick();
      }
    } catch {
      this.musLayer = null;
    }
  }

  sfx(name: Sfx, opts?: SfxOptions): void {
    const e = this.e;
    if (!e || this.isMuted) return;
    try {
      if (e.ctx.state === 'suspended') void e.ctx.resume().catch(() => undefined);
      const vol = opts?.volume ?? 1;
      const pitch = opts?.pitch ?? 1;
      const v = Number.isFinite(vol) ? Math.max(0, Math.min(2, vol)) : 1;
      const p = Number.isFinite(pitch) ? Math.max(0.25, Math.min(4, pitch)) : 1;
      if (v <= 0) return;
      playSfx(e, name, v, p);
    } catch {
      /* ignore */
    }
  }

  setVolume(channel: VolumeChannel, v: number): void {
    const val = clamp01(v);
    this.vols[channel] = val;
    const e = this.e;
    if (!e) return;
    try {
      if (channel === 'master') e.setParam(e.masterVol.gain, val);
      else e.setChannel(channel, val);
    } catch {
      /* ignore */
    }
  }

  getVolume(channel: VolumeChannel): number {
    return this.vols[channel] ?? 0;
  }

  mute(m: boolean): void {
    this.isMuted = !!m;
    const e = this.e;
    if (!e) return;
    try {
      e.setParam(e.muteGain.gain, this.isMuted ? 0 : 1, 0.03);
    } catch {
      /* ignore */
    }
  }
}

export const audio: AudioApi = new AudioSystem();
