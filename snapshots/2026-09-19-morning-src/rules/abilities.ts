// Abilities. Data only. The game layer (src/game/combat.ts) carries out the effects.
// Each race brings two. Each role brings one. So every character has three.

import { Character, Race, Role, Spec, Stat } from './character';

export type Target = 'self' | 'enemy' | 'tile';

export type Effect =
  | { kind: 'damage'; amount: number }
  | { kind: 'push'; tiles: number }
  | { kind: 'stun'; turns: number }
  | { kind: 'heal'; which: 'worst' | 'lightest' }
  | { kind: 'guard'; amount: number }
  | { kind: 'hide' } // enemies not adjacent lose track of you
  | { kind: 'freeMove'; tiles: number }
  | { kind: 'defendBonus'; amount: number } // to your next defence
  | { kind: 'nextRoll'; amount: number } // to your next roll of any kind
  | { kind: 'chipCrystal' } // Sehari: the held crystal loses integrity
  | { kind: 'backlash' } // a light wound to you
  | { kind: 'cooldown'; turns: number }; // the ability is spent for N more turns

export interface Ability {
  id: string;
  name: string;
  desc: string;
  target: Target;
  range: number; // 0 for self
  roll: { stat: Stat; specs: Spec[] } | null; // best of the listed specs; null = no roll
  crystal?: 'amber' | 'crimson' | 'pale' | 'violet'; // Sehari need that colour in the pack
  machinesOnly?: boolean;
  full: Effect[];
  partial: Effect[];
  miss: Effect[];
  cooldown: number; // turns before reuse, after any use
  fx: string; // effect key for the world layer
  anim: string;
}

export const ABILITIES: Record<string, Ability> = {
  // ---- Sehari: direct channelling through held crystals.
  channelAmber: {
    id: 'channelAmber',
    name: 'Channel amber',
    desc: 'Push raw force through an amber crystal held in your palm. Range 5.',
    target: 'enemy',
    range: 5,
    roll: { stat: 'resonance', specs: ['channellingDepth', 'crystalLore'] },
    crystal: 'amber',
    full: [{ kind: 'damage', amount: 2 }, { kind: 'push', tiles: 2 }],
    partial: [{ kind: 'damage', amount: 1 }, { kind: 'chipCrystal' }],
    miss: [{ kind: 'backlash' }, { kind: 'chipCrystal' }],
    cooldown: 0,
    fx: 'channel-amber',
    anim: 'channel',
  },
  channelCrimson: {
    id: 'channelCrimson',
    name: 'Channel crimson',
    desc: 'Draw the body back together through a crimson crystal. Heals your worst wound.',
    target: 'self',
    range: 0,
    roll: { stat: 'resonance', specs: ['channellingDepth', 'crystalLore'] },
    crystal: 'crimson',
    full: [{ kind: 'heal', which: 'worst' }],
    partial: [{ kind: 'heal', which: 'worst' }, { kind: 'chipCrystal' }],
    miss: [{ kind: 'chipCrystal' }],
    cooldown: 2,
    fx: 'channel-crimson',
    anim: 'channel',
  },
  allFours: {
    id: 'allFours',
    name: 'Run on all fours',
    desc: 'Drop to four limbs and cover ground fast. Three extra tiles of movement.',
    target: 'self',
    range: 0,
    roll: null,
    full: [{ kind: 'freeMove', tiles: 3 }],
    partial: [],
    miss: [],
    cooldown: 3,
    fx: 'dust',
    anim: 'walk',
  },

  // ---- Iskari: still stone, and old Aza'los devices.
  stillness: {
    id: 'stillness',
    name: 'Go still',
    desc: 'Stop, the way only stone can. Gain guard. On a clean roll, distant enemies lose you.',
    target: 'self',
    range: 0,
    roll: { stat: 'will', specs: ['hardiness'] },
    full: [{ kind: 'guard', amount: 2 }, { kind: 'hide' }],
    partial: [{ kind: 'guard', amount: 1 }],
    miss: [],
    cooldown: 3,
    fx: 'stone',
    anim: 'sleep',
  },
  keeperFocus: {
    id: 'keeperFocus',
    name: 'Wake the focus',
    desc: "Wake an old Aza'los focus. A teal lance strikes one target. Range 6.",
    target: 'enemy',
    range: 6,
    roll: { stat: 'resonance', specs: ['azalosTech', 'lore'] },
    full: [{ kind: 'damage', amount: 2 }, { kind: 'stun', turns: 1 }],
    partial: [{ kind: 'damage', amount: 1 }, { kind: 'cooldown', turns: 1 }],
    miss: [{ kind: 'cooldown', turns: 2 }],
    cooldown: 1,
    fx: 'teal-lance',
    anim: 'channel',
  },

  // ---- Mi'naa: fused salvage.
  shockCell: {
    id: 'shockCell',
    name: 'Shock cell',
    desc: 'A fused amber cell on a wire. It jolts one target and locks it up. Range 4.',
    target: 'enemy',
    range: 4,
    roll: { stat: 'mind', specs: ['minaaTech'] },
    full: [{ kind: 'damage', amount: 1 }, { kind: 'stun', turns: 2 }],
    partial: [{ kind: 'damage', amount: 1 }, { kind: 'stun', turns: 1 }, { kind: 'cooldown', turns: 1 }],
    miss: [{ kind: 'cooldown', turns: 2 }],
    cooldown: 1,
    fx: 'shock',
    anim: 'attack',
  },
  patchKit: {
    id: 'patchKit',
    name: 'Patch plating',
    desc: 'Strap salvaged plating over the weak spots. Gain guard.',
    target: 'self',
    range: 0,
    roll: { stat: 'mind', specs: ['mechanics'] },
    full: [{ kind: 'guard', amount: 2 }],
    partial: [{ kind: 'guard', amount: 1 }],
    miss: [],
    cooldown: 2,
    fx: 'sparks',
    anim: 'channel',
  },

  // ---- Roles.
  holdTheLine: {
    id: 'holdTheLine',
    name: 'Hold the line',
    desc: 'Plant your feet. +1 guard and +1 to your next defence.',
    target: 'self',
    range: 0,
    roll: null,
    full: [{ kind: 'guard', amount: 1 }, { kind: 'defendBonus', amount: 1 }],
    partial: [],
    miss: [],
    cooldown: 2,
    fx: 'dust',
    anim: 'idle',
  },
  aimedShot: {
    id: 'aimedShot',
    name: 'Aimed shot',
    desc: 'Take your time. +1 to hit, and a clean hit does 3 harm. Range 7.',
    target: 'enemy',
    range: 7,
    roll: { stat: 'edge', specs: ['ranged'] },
    full: [{ kind: 'damage', amount: 3 }],
    partial: [{ kind: 'damage', amount: 1 }],
    miss: [],
    cooldown: 1,
    fx: 'shot',
    anim: 'attack',
  },
  focusedChannel: {
    id: 'focusedChannel',
    name: 'Steady breath',
    desc: 'Settle yourself. +2 to your next roll of any kind.',
    target: 'self',
    range: 0,
    roll: null,
    full: [{ kind: 'nextRoll', amount: 2 }],
    partial: [],
    miss: [],
    cooldown: 2,
    fx: 'glow',
    anim: 'channel',
  },
  slipAway: {
    id: 'slipAway',
    name: 'Slip away',
    desc: 'Break contact. On a clean roll, enemies at a distance lose you.',
    target: 'self',
    range: 0,
    roll: { stat: 'edge', specs: ['stealth'] },
    full: [{ kind: 'hide' }, { kind: 'freeMove', tiles: 2 }],
    partial: [{ kind: 'freeMove', tiles: 3 }],
    miss: [],
    cooldown: 2,
    fx: 'dust',
    anim: 'walk',
  },
  mend: {
    id: 'mend',
    name: 'Mend',
    desc: 'Clean and bind your worst wound. Steady hands, no aloe needed.',
    target: 'self',
    range: 0,
    roll: { stat: 'mind', specs: ['medicine'] },
    full: [{ kind: 'heal', which: 'worst' }],
    partial: [{ kind: 'heal', which: 'worst' }],
    miss: [],
    cooldown: 2,
    fx: 'heal',
    anim: 'channel',
  },
  overload: {
    id: 'overload',
    name: 'Overload',
    desc: 'Reach into a machine and jam it. Machines only. Adjacent.',
    target: 'enemy',
    range: 1,
    machinesOnly: true,
    roll: { stat: 'mind', specs: ['telsharinTech', 'azalosTech', 'mechanics'] },
    full: [{ kind: 'stun', turns: 2 }, { kind: 'damage', amount: 1 }],
    partial: [{ kind: 'stun', turns: 1 }],
    miss: [{ kind: 'backlash' }],
    cooldown: 2,
    fx: 'sparks',
    anim: 'attack',
  },
};

export const RACE_ABILITIES: Record<Race, string[]> = {
  sehari: ['channelAmber', 'channelCrimson', 'allFours'],
  iskari: ['keeperFocus', 'stillness'],
  minaa: ['shockCell', 'patchKit'],
};

export const ROLE_ABILITY: Record<Role, string> = {
  frontline: 'holdTheLine',
  ranged: 'aimedShot',
  channeller: 'focusedChannel',
  scout: 'slipAway',
  healer: 'mend',
  tech: 'overload',
};

export function abilitiesFor(c: Character): Ability[] {
  const ids = [...RACE_ABILITIES[c.race], ROLE_ABILITY[c.role]];
  return [...new Set(ids)].map((id) => ABILITIES[id]);
}

// Best spec the character has from a list. Returns undefined when they have none.
export function bestSpec(c: Character, specs: Spec[]): Spec | undefined {
  let best: Spec | undefined;
  let val = 0;
  for (const s of specs) {
    const v = c.specs[s] ?? 0;
    if (v > val) {
      val = v;
      best = s;
    }
  }
  return best;
}
