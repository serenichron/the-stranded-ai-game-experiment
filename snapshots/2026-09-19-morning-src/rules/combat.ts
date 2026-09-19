// Combat maths. Turn based, player-facing rolls only (the tabletop is GM-led, so enemies never roll).
// When you attack, one roll settles the exchange: 10+ clean hit, 7-9 you both hit, 6- it hits you.
// An enemy you did not trade with this round strikes on its own turn, and you roll to defend.

import { Rng } from './dice';
import { Character, Stat } from './character';
import { CheckResult, CheckSpec, check } from './check';
import { Severity, WoundState, HarmResult, takeHarm } from './wounds';

export type EnemyKind = 'telsharin' | 'guardian' | 'drone' | 'defender' | 'dog' | 'scavenger';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  harm: number; // boxes of harm before it drops
  hits: Severity; // what its full strike does
  threat: number; // penalty to your defence roll
  pierce: boolean; // a failed defence skips your guard
  reach: number; // tiles it can strike from (1 = adjacent)
  speed: number; // tiles per turn
  sight: number; // tiles it can see out of combat
  machine: boolean; // Tech can overload it
  /** Never loses you: no escape, no hiding, no sight check. */
  relentless?: boolean;
  blurb: string;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  telsharin: {
    kind: 'telsharin',
    name: "Tel'sharin",
    harm: 6,
    hits: 'moderate',
    threat: 1,
    pierce: true,
    reach: 2, // the feeding tube lunges
    speed: 3,
    sight: 7,
    machine: true,
    blurb: 'Bone fused with dark green metal. Red light leaks from its seams. It is starving.',
  },
  // Phase 2: the guardian became a small repair drone (user request). 'guardian' stays as an alias for old saves.
  guardian: {
    kind: 'guardian',
    name: 'Repair drone',
    harm: 2,
    hits: 'light',
    threat: 0,
    pierce: false,
    reach: 4, // its mending beam, turned on you
    speed: 3,
    sight: 6,
    machine: true,
    blurb: 'A small teal machine the size of a lamb. It mends cracks in the stone with a thin beam.',
  },
  drone: {
    kind: 'drone',
    name: 'Repair drone',
    harm: 2,
    hits: 'light',
    threat: 0,
    pierce: false,
    reach: 4,
    speed: 3,
    sight: 6,
    machine: true,
    blurb: 'A small teal machine the size of a lamb. It mends cracks in the stone with a thin beam.',
  },
  // The defensive-line Iskari. No sight check, no escape: it comes for you wherever you are.
  defender: {
    kind: 'defender',
    name: 'Woken Iskari',
    harm: 5,
    hits: 'moderate',
    threat: 1,
    pierce: true,
    reach: 2, // the crescent staff
    speed: 4,
    sight: 99,
    machine: false,
    relentless: true,
    blurb: 'An Iskari twice your weight, woken at its post. Teal light runs in the cracks of its stone.',
  },
  dog: {
    kind: 'dog',
    name: 'Feral dog',
    harm: 1, // a mook: no wound track, one hit drops it (docs/build-order.md)
    hits: 'light',
    threat: 0,
    pierce: false,
    reach: 1,
    speed: 5,
    sight: 6,
    machine: false,
    blurb: 'Lean, sun-dark, ribs showing. The miners brought its line here long ago.',
  },
  scavenger: {
    kind: 'scavenger',
    name: 'Scavenger',
    harm: 1, // a mook
    hits: 'light',
    threat: 0,
    pierce: false,
    reach: 4, // sling
    speed: 4,
    sight: 6,
    machine: false,
    blurb: "A Mi'naa in patched wraps. Marks hidden under the sleeves.",
  },
};

export type AttackMode = 'melee' | 'ranged';

// One roll per exchange, so the band says what happened on both sides.
const ATTACK_TEXT = { full: 'Clean hit', partial: 'You trade blows', miss: 'You miss, it hits back' };

export function attackSpec(c: Character, mode: AttackMode, bonus = 0, label?: string): CheckSpec {
  return mode === 'melee'
    ? { stat: 'body', spec: 'melee', bonus, bonusLabel: 'Aim', label: label ?? 'Strike', bandText: ATTACK_TEXT }
    : { stat: 'edge', spec: 'ranged', bonus, bonusLabel: 'Aim', label: label ?? 'Shoot', bandText: ATTACK_TEXT };
}

export interface AttackOutcome {
  roll: CheckResult;
  harm: number; // boxes dealt
  exposed: boolean; // you left an opening: -1 on your next defence
}

// 10+: 2 harm. 7-9: 1 harm and you are exposed. 6-: miss and you are exposed.
export function resolveAttack(rng: Rng, c: Character, w: WoundState, spec: CheckSpec, fullHarm = 2): AttackOutcome {
  const roll = check(rng, c, w, spec);
  if (roll.band === 'full') return { roll, harm: fullHarm, exposed: false };
  if (roll.band === 'partial') return { roll, harm: 1, exposed: true };
  return { roll, harm: 0, exposed: true };
}

// Defence uses your better of Body and Edge, plus Hardiness if you have it.
export function defendSpec(c: Character, e: EnemyDef, exposed: boolean, extra = 0): CheckSpec {
  const stat: Stat = c.stats.body >= c.stats.edge ? 'body' : 'edge';
  const bonus = -e.threat - (exposed ? 1 : 0) + extra;
  return {
    stat,
    spec: 'hardiness',
    bonus,
    bonusLabel: exposed ? 'Threat, exposed' : 'Threat',
    label: `The ${e.name} attacks. Dodge it`,
    // The user read 'Miss' on a defence roll as the enemy missing. Name the outcome instead.
    bandText: { full: 'Avoided', partial: 'Glancing blow', miss: 'It hits you' },
  };
}

export interface DefendOutcome {
  roll: CheckResult;
  harm: HarmResult | null; // null = no harm
}

// 10+: you avoid it. 7-9: it lands, one step lighter, and guard can soak it.
// 6-: it lands in full. A piercing enemy skips your guard.
export function resolveDefence(rng: Rng, c: Character, w: WoundState, e: EnemyDef, spec: CheckSpec): DefendOutcome {
  const roll = check(rng, c, w, spec);
  if (roll.band === 'full') return { roll, harm: null };
  if (roll.band === 'partial') {
    const lighter: Severity = e.hits === 'severe' ? 'moderate' : 'light';
    return { roll, harm: takeHarm(w, lighter, false) };
  }
  return { roll, harm: takeHarm(w, e.hits, e.pierce) };
}

export function moveRange(c: Character): number {
  return 4 + Math.max(0, c.stats.edge >= 2 ? 1 : 0);
}

export function guardFor(c: Character): number {
  const base = 1 + (c.stats.body >= 2 ? 1 : 0);
  return base + (c.role === 'frontline' ? 1 : 0) + (c.race === 'iskari' ? 1 : 0);
}
