// One roll: 2d6 + stat + specialisation + collaboration + situational, minus wounds.

import { Band, Rng, bandOf, roll2d6 } from './dice';
import { Character, Spec, Stat, STAT_LABEL, SPEC_LABEL, specMod } from './character';
import { WoundState, woundPenalty } from './wounds';

export interface CheckSpec {
  stat: Stat;
  spec?: Spec;
  bonus?: number; // situational, e.g. a crystal, an item, a good position
  bonusLabel?: string;
  label: string; // what the player is trying, e.g. "Read the symbol door"
  /** What each band means for this roll, e.g. a defence miss is 'Hit'. Shown instead of the generic band words. */
  bandText?: Partial<Record<Band, string>>;
}

export interface Term {
  label: string;
  value: number;
}

export interface CheckResult {
  dice: [number, number];
  terms: Term[]; // every modifier, for the dice panel
  mod: number;
  total: number;
  band: Band;
  label: string;
  bandText?: Partial<Record<Band, string>>;
}

export function modifiersFor(c: Character, w: WoundState | null, s: CheckSpec): Term[] {
  const terms: Term[] = [{ label: STAT_LABEL[s.stat], value: c.stats[s.stat] }];
  const sm = specMod(c, s.spec);
  if (s.spec && sm) terms.push({ label: SPEC_LABEL[s.spec], value: sm });
  if (s.bonus) terms.push({ label: s.bonusLabel ?? 'Situation', value: s.bonus });
  const wp = w ? woundPenalty(w) : 0;
  if (wp) terms.push({ label: 'Wounds', value: wp });
  return terms;
}

export function check(rng: Rng, c: Character, w: WoundState | null, s: CheckSpec): CheckResult {
  const terms = modifiersFor(c, w, s);
  const mod = terms.reduce((a, t) => a + t.value, 0);
  const dice = roll2d6(rng);
  const total = dice[0] + dice[1] + mod;
  return { dice, terms, mod, total, band: bandOf(total), label: s.label, bandText: s.bandText };
}
