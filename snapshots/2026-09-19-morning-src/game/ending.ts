// The end screen: what you did, in plain lines, then the coda.

import type { EndingSummary } from '../ui/types';
import { GameState, flag } from './state';
import { RACE_LABEL, ROLE_LABEL } from '../rules/character';

export function buildEnding(s: GameState): EndingSummary {
  const lines: string[] = [];
  const f = (k: string) => flag(s, k);

  if (f('telAsleep')) lines.push('You starved the ded-waka. It sleeps by the wreck, its red light dimmed to embers. It may wake again in a hundred years.');
  else if (f('telDead')) lines.push("You fought the ded-waka and it fell. Hadda's crew went back east the next day, for the scrap they paid for.");
  else if (f('crackClimbed')) lines.push('You climbed the crack and left the ded-waka feeding. It is still there, between the camp and the ridge.');
  else lines.push('You slipped past the ded-waka while it fed. It never knew you were there. Probably.');

  const scrap = s.flags.scrapTo;
  if (scrap === 'pell') lines.push('Pell took the plating west, to a band four days out. Hadda will never know where it went.');
  else if (scrap === 'camp') lines.push("The plating stayed in the gully for Hadda's crew. Pell walked west with empty hands.");
  else if (scrap === 'contested') lines.push(f('bandBeaten') ? 'Pell came for the plating with a band-shen, and you drove them off.' : 'Pell and a band-shen fought you for the plating.');
  if (f('pellReported') && scrap !== 'contested') lines.push('You told Hadda about the band marks. Pell was gone from the camp that night.');
  else if (f('pellTrust')) lines.push("You saw Pell's band marks and said nothing. Covered is covered.");

  if (f('dogsCalmed')) lines.push('The two feral dogs now follow the cook around the camp.');
  if (f('guardianFriendly')) lines.push("The repair drone let you pass. It knew what you were. You still do not know how.");
  else if (f('guardianDead')) lines.push(f('defenderDead') ? 'You brought down the repair drone. The stone guard it woke fell too. Nobody mends the cracks now.' : 'You brought down the repair drone. The stone guard it woke still keeps the court.');
  else if (f('innerOpen')) lines.push('You woke the outer rings and let the middle ring sleep. The inner door opened for you.');

  lines.push("You carried the Keeper's archive plate out of the ruin. It holds the last words of the apprentice's master: a stair under the broken city, between the Reach and the Spines.");

  const mins = Math.round(s.playSeconds / 60);
  const wounds = ['light', 'moderate', 'severe'].filter((k) => (s.wounds as any)[k]).length;
  return {
    title: "The Keeper's errand",
    lines,
    coda:
      s.character.race === 'iskari'
        ? 'The lamp in his tent is still burning. You sit on his crate, the way he did, and wait. Nobody comes. Somewhere north, a stair goes down.'
        : 'The lamp in his tent is still burning. You sit on his crate and hold the plate on your knees. Somewhere north, a stair goes down.',
    stats: [
      { label: 'Character', value: `${s.character.name}, ${RACE_LABEL[s.character.race]} ${ROLE_LABEL[s.character.role]}` },
      { label: 'Time', value: `${mins} minute${mins === 1 ? '' : 's'}` },
      { label: 'Dice rolled', value: String(s.rollsMade) },
      { label: 'Times you fell', value: String(s.collapses) },
      { label: 'Wounds at the end', value: String(wounds) },
    ],
  };
}
