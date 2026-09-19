export type Ambience = 'none' | 'camp' | 'desert' | 'wreck' | 'spire' | 'memory';
export type Music = 'none' | 'explore' | 'tense' | 'memory' | 'title' | 'ending';
export type Sfx =
  | 'click' | 'hover' | 'open' | 'close' | 'page'          // UI
  | 'dice-roll' | 'dice-land' | 'full' | 'partial' | 'miss' // 2d6 checks: rattle, clack, then a result sting
  | 'step' | 'step-sand'                                    // footsteps
  | 'swing' | 'hit' | 'guard' | 'wound' | 'collapse'        // combat on the player
  | 'enemy-hit' | 'enemy-die'
  | 'channel-amber' | 'channel-crimson' | 'teal-lance' | 'shock' | 'shatter' | 'sparks'
  | 'telsharin-growl' | 'telsharin-feed' | 'telsharin-sleep' | 'guardian-hum' | 'dog-bark'
  | 'door-open' | 'pickup' | 'metal-drag' | 'quest' | 'alert' | 'suspicious' | 'memory-echo' | 'drink';

export type VolumeChannel = 'master' | 'music' | 'ambience' | 'sfx';

export interface SfxOptions {
  volume?: number;
  pitch?: number;
}

export interface AudioApi {
  init(): void;
  setAmbience(a: Ambience, fadeSec?: number): void;
  setMusic(m: Music, fadeSec?: number): void;
  sfx(name: Sfx, opts?: SfxOptions): void;
  setVolume(channel: VolumeChannel, v: number): void;
  getVolume(channel: VolumeChannel): number;
  mute(m: boolean): void;
  readonly muted: boolean;
}
