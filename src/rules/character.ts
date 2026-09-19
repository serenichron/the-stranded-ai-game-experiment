// Characters, straight from docs/mechanics.md.
// Stats -1..+3, seven points, a -1 buys one extra point. Six roles.
// Specialisations: 3 racial fixed + 2 player picks, all Trained.

export const STATS = ['body', 'edge', 'mind', 'will', 'presence', 'resonance'] as const;
export type Stat = (typeof STATS)[number];
export type Stats = Record<Stat, number>;

export const STAT_LABEL: Record<Stat, string> = {
  body: 'Body',
  edge: 'Edge',
  mind: 'Mind',
  will: 'Will',
  presence: 'Presence',
  resonance: 'Resonance',
};

export const STAT_HINT: Record<Stat, string> = {
  body: 'Strength, melee, taking hits.',
  edge: 'Speed, aim, stealth, reflexes.',
  mind: 'Knowledge, lore, technical work.',
  will: 'Focus, nerve, resisting effects.',
  presence: 'Persuasion, reading people.',
  resonance: 'Crystals, channelling, old tech.',
};

// The game offers the three playable races. Settled Mi'naa stands in for the Mi'naa.
export type Race = 'minaa' | 'sehari' | 'iskari';

export const RACE_LABEL: Record<Race, string> = {
  minaa: "Mi'naa",
  sehari: 'Sehari',
  iskari: 'Iskari',
};

export const ROLES = ['frontline', 'ranged', 'channeller', 'scout', 'healer', 'tech'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  frontline: 'Frontline',
  ranged: 'Ranged',
  channeller: 'Channeller',
  scout: 'Scout',
  healer: 'Healer',
  tech: 'Tech',
};

export const SPECS = [
  'archaeology',
  'lore',
  'linguistics',
  'translator',
  'cartography',
  'crystalLore',
  'azalosTech',
  'minaaTech',
  'telsharinTech',
  'mechanics',
  'melee',
  'ranged',
  'athletics',
  'hardiness',
  'stealth',
  'deception',
  'sleight',
  'tracking',
  'survival',
  'naturalism',
  'negotiation',
  'intimidation',
  'insight',
  'channellingDepth',
  'boneSinging',
  'medicine',
] as const;
export type Spec = (typeof SPECS)[number];

export const SPEC_LABEL: Record<Spec, string> = {
  archaeology: 'Archaeology',
  lore: 'Lore',
  linguistics: 'Linguistics',
  translator: 'Translator',
  cartography: 'Cartography',
  crystalLore: 'Crystal lore',
  azalosTech: "Aza'los tech",
  minaaTech: "Mi'naa tech",
  telsharinTech: "Tel'sharin tech",
  mechanics: 'Mechanics',
  melee: 'Melee combat',
  ranged: 'Ranged combat',
  athletics: 'Athletics',
  hardiness: 'Hardiness',
  stealth: 'Stealth',
  deception: 'Forgery and deception',
  sleight: 'Sleight of hand',
  tracking: 'Tracking',
  survival: 'Survival',
  naturalism: 'Naturalism',
  negotiation: 'Negotiation',
  intimidation: 'Intimidation',
  insight: 'Insight',
  channellingDepth: 'Channelling depth',
  boneSinging: 'Bone-singing',
  medicine: 'Medicine',
};

// Canon race locks: Translator is Iskari only. Channelling depth and Bone-singing are Sehari only.
export const RACE_LOCKED: Partial<Record<Spec, Race>> = {
  translator: 'iskari',
  channellingDepth: 'sehari',
  boneSinging: 'sehari',
};

// Provisional racial packages from canon.
export const RACE_PACKAGE: Record<Race, Spec[]> = {
  minaa: ['minaaTech', 'mechanics', 'negotiation'],
  sehari: ['tracking', 'survival', 'naturalism'],
  iskari: ['lore', 'insight', 'hardiness'],
};

export const RACE_BLURB: Record<Race, string> = {
  minaa:
    'Descendants of the miners. They forget fast, so they keep memory in objects and implants. They fuse salvage into working tools.',
  sehari:
    'Native to this planet. They feel the energy under the sand and channel it through crystals held close. They never set a crystal into the body.',
  iskari:
    "Stone-skinned and built by the Aza'los. They do not age. They feel meaning in Aza'los symbols and can wake the old devices.",
};

export const ROLE_BLURB: Record<Role, string> = {
  frontline: 'Close combat. You hold the space and take the hits.',
  ranged: 'You hurt things before they can reach you.',
  channeller: 'You push the planet\'s energy through crystals or old devices.',
  scout: 'You move quietly, move fast, and see things first.',
  healer: 'You mend wounds and keep yourself standing.',
  tech: 'You repair, fuse and bypass machines.',
};

export type Level = 1 | 2; // 1 Trained (+1), 2 Mastered (+2)

export interface Character {
  name: string;
  race: Race;
  role: Role;
  stats: Stats;
  specs: Partial<Record<Spec, Level>>;
  /** Body shape. Iskari have no sex: their bodies were made to match specific Aza'los (canon). Old saves: male. */
  body?: Body;
}

export const STAT_POINTS = 7;

export function pointsSpent(stats: Stats): number {
  // A -1 refunds one point, so it counts as -1 spent.
  return STATS.reduce((sum, s) => sum + stats[s], 0);
}

export function validateStats(stats: Stats): string | null {
  for (const s of STATS) {
    if (stats[s] < -1 || stats[s] > 3) return `${STAT_LABEL[s]} must be between -1 and +3.`;
  }
  const spent = pointsSpent(stats);
  if (spent > STAT_POINTS) return `You have spent ${spent} of ${STAT_POINTS} points.`;
  if (spent < STAT_POINTS) return `You still have ${STAT_POINTS - spent} points to spend.`;
  return null;
}

export function canPick(race: Race, spec: Spec): boolean {
  const lock = RACE_LOCKED[spec];
  return !lock || lock === race;
}

export type Body = 'male' | 'female';

export function buildCharacter(name: string, race: Race, role: Role, stats: Stats, picks: Spec[], body: Body = 'male'): Character {
  const specs: Partial<Record<Spec, Level>> = {};
  for (const s of RACE_PACKAGE[race]) specs[s] = 1;
  for (const s of picks) if (canPick(race, s)) specs[s] = 1;
  return { name, race, role, stats: { ...stats }, specs, body };
}

export function specMod(c: Character, spec: Spec | undefined): number {
  if (!spec) return 0;
  return c.specs[spec] ?? 0;
}

// Sensible starting spreads so a player can skip the maths.
export const SUGGESTED: Record<Role, Stats> = {
  frontline: { body: 3, edge: 1, mind: 0, will: 2, presence: 0, resonance: 1 },
  ranged: { body: 1, edge: 3, mind: 1, will: 1, presence: 0, resonance: 1 },
  channeller: { body: 0, edge: 1, mind: 1, will: 2, presence: 0, resonance: 3 },
  scout: { body: 1, edge: 3, mind: 1, will: 0, presence: 1, resonance: 1 },
  healer: { body: 1, edge: 0, mind: 2, will: 2, presence: 1, resonance: 1 },
  tech: { body: 1, edge: 1, mind: 3, will: 1, presence: 0, resonance: 1 },
};

// Suggested player picks by role, filtered by race locks at use.
export const SUGGESTED_PICKS: Record<Role, Spec[]> = {
  frontline: ['melee', 'athletics'],
  ranged: ['ranged', 'stealth'],
  channeller: ['crystalLore', 'channellingDepth'],
  scout: ['stealth', 'athletics'],
  healer: ['medicine', 'crystalLore'],
  tech: ['azalosTech', 'telsharinTech'],
};
