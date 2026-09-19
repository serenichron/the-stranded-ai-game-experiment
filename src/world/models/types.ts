import type * as THREE from 'three';
import type { AnimName, CrystalColour } from '../../core/contracts';

// Every drawable thing the world spawns is a Model.
// Units: 1 world unit = 1 tile = about 1 metre. Y is up. The model's origin sits on the ground
// at the centre of its tile. "Forward" is -Z (the world rotates the root to face).
export interface Model {
  root: THREE.Object3D;
  /** Called every frame. t = seconds since start, dt = frame seconds. */
  update(dt: number, t: number): void;
  /** Start an animation. Returns its length in seconds for one-shots, 0 for loops. */
  play(anim: AnimName): number;
  /** Visual state for props and machines (door 'open', telsharin 'asleep', lamp 'out'). */
  setState?(state: string): void;
  /** Meshes that should be clickable. Defaults to everything under root. */
  pickables?: THREE.Object3D[];
  /** Height of the head/top, for float text and bubbles. */
  height: number;
  dispose?(): void;
}

export interface ModelOpts {
  colour?: CrystalColour; seed?: number; name?: string;
  /** Body shape for people. Iskari bodies are shaped after the Aza'los they were made for. */
  body?: 'male' | 'female';
  /** NPC preset, e.g. 'hadda', 'tarn', 'pell', 'digger', 'hunter', 'apprentice'. */
  look?: string;
}

/** The seven crystal domains, as light colours. Palette leans warm; teal is Aza'los. */
export const CRYSTAL_HEX: Record<CrystalColour, number> = {
  crimson: 0xd8413a,
  amber: 0xffa034,
  verdant: 0x5fd07a,
  azure: 0x3fa9ff,
  violet: 0xa36bff,
  pale: 0xe8f0ff,
  void: 0x2a2440,
};

/** House palette from docs/visual-reference.md: faded ochre, rust-red, teal, bone. */
export const PALETTE = {
  ochre: 0xc79a55,
  sand: 0xd7b27a,
  sandDark: 0xa9824f,
  rust: 0x9b4a2c,
  rustDark: 0x6b3020,
  teal: 0x3fbfb0,
  tealDeep: 0x1f6f6a,
  bone: 0xe6dcc6,
  stone: 0xcfc4ae,     // Aza'los pale stone
  minerMetal: 0x4a423a, // dark grey-brown miner metal
  makerMetal: 0x3d4a3c, // oxidised grey-green Maker metal
  makerAmber: 0xff5e14, // deeper amber-orange: at 0xff8a2a the bloom washed it to yellow (user playtest)
  telsharinRed: 0xff1a0c, // the ded-waka glows red in the game (designer call, user playtest); canon says amber-orange
  cloth: 0x8a6a4a,
  skinMinaa: 0xb98a66,
  skinSehari: 0x8f7a63,
  stoneIskari: 0x9c9a92,
};
