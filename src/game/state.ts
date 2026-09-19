// Everything that changes during play, in one plain object so it saves as JSON.

import { Character, RACE_LABEL, ROLE_LABEL } from '../rules/character';
import { makeRng, Rng } from '../rules/dice';
import { WoundState, freshWounds } from '../rules/wounds';
import { guardFor } from '../rules/combat';
import type { Tile } from '../core/contracts';

export type CrystalColour = 'amber' | 'crimson' | 'pale' | 'violet';

export interface Crystal {
  colour: CrystalColour;
  integrity: number; // 3 whole, 0 shattered
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  usable: boolean; // can be used from the inventory or in combat
  quest?: boolean;
}

export const ITEMS: Record<string, ItemDef> = {
  aloe: {
    id: 'aloe',
    name: 'Dust-aloe leaf',
    desc: 'Thick leaf, bitter sap. Rub it into a wound. Heals your worst wound.',
    usable: true,
  },
  water: {
    id: 'water',
    name: 'Barrel-gourd water',
    desc: 'Cut from a swollen gourd. Drink it to steady yourself. Restores all guard.',
    usable: true,
  },
  chargeFruit: {
    id: 'chargeFruit',
    name: 'Charge-fruit',
    desc: 'It tingles on the tongue. +2 to your next Resonance roll.',
    usable: true,
  },
  scrap: {
    id: 'scrap',
    name: "Tel'sharin scrap",
    desc: 'Dark green metal with bone grown through it. Still warm. A Mi\'naa could fuse this.',
    usable: false,
  },
  feeder: {
    id: 'feeder',
    name: 'Salvage-feeder',
    desc: "A Tel'sharin feeding tube, fused into a Mi'naa tool. +1 to Shock cell rolls.",
    usable: false,
  },
  focus: {
    id: 'focus',
    name: 'Worn Keeper focus',
    desc: "A small curved Aza'los device, teal at the core. It wakes for Iskari hands.",
    usable: false,
  },
  rubbing: {
    id: 'rubbing',
    name: "The apprentice's rubbing",
    desc: 'Charcoal on cloth. A Keeper mark: three nested rings, one broken.',
    usable: false,
    quest: true,
  },
  archive: {
    id: 'archive',
    name: 'Keeper archive plate',
    desc: 'A thin plate of pale stone, cold to the touch. Azure threads move under the surface.',
    usable: false,
    quest: true,
  },
  tag: {
    id: 'tag',
    name: "Miner's tag",
    desc: 'Stamped dark metal on a rotten cord. The words are in the lost miner script. Only a number is clear: 7.',
    usable: false,
  },
  note: {
    id: 'note',
    name: 'Half-burnt note',
    desc: 'Found in the empty tent. Most of the words are gone.',
    usable: false,
    quest: true,
  },
};

export interface QuestLine {
  id: string;
  title: string;
  lines: string[];
  done: boolean;
}

export interface GameState {
  version: 1;
  seed: number;
  rngState: number;
  character: Character;
  wounds: WoundState;
  crystals: Crystal[];
  items: Record<string, number>;
  flags: Record<string, boolean | number | string>;
  quests: QuestLine[];
  objective: string;
  playerTile: Tile | null;
  // Per-entity state the world must restore on load: gone, asleep, open, etc.
  entityState: Record<string, string>;
  // Enemies' harm taken, so a fight can be resumed or survived.
  enemyHarm: Record<string, number>;
  playSeconds: number;
  collapses: number;
  rollsMade: number;
}

export function newGame(character: Character, seed = (Math.random() * 2 ** 31) | 0): GameState {
  const crystals: Crystal[] =
    character.race === 'sehari'
      ? [
          { colour: 'amber', integrity: 3 },
          { colour: 'crimson', integrity: 3 },
        ]
      : [];
  const items: Record<string, number> = { aloe: 1, water: 1 };
  if (character.race === 'iskari') items.focus = 1;
  return {
    version: 1,
    seed,
    rngState: seed,
    character,
    wounds: freshWounds(guardFor(character)),
    crystals,
    items,
    flags: {},
    quests: [],
    objective: 'Find the Keeper\'s apprentice in the camp.',
    playerTile: null,
    entityState: {},
    enemyHarm: {},
    playSeconds: 0,
    collapses: 0,
    rollsMade: 0,
  };
}

// The RNG lives outside the JSON; its seed state is copied back into the save.
export function rngFor(s: GameState): Rng {
  const rng = makeRng(s.rngState);
  return {
    next() {
      const v = rng.next();
      s.rngState = rng.state();
      return v;
    },
    state: () => rng.state(),
  };
}

export function hasItem(s: GameState, id: string, n = 1) {
  return (s.items[id] ?? 0) >= n;
}

export function addItem(s: GameState, id: string, n = 1) {
  s.items[id] = (s.items[id] ?? 0) + n;
}

export function takeItem(s: GameState, id: string, n = 1): boolean {
  if (!hasItem(s, id, n)) return false;
  s.items[id] -= n;
  if (s.items[id] <= 0) delete s.items[id];
  return true;
}

export function crystal(s: GameState, colour: CrystalColour): Crystal | undefined {
  return s.crystals.find((c) => c.colour === colour && c.integrity > 0);
}

export function addCrystal(s: GameState, colour: CrystalColour) {
  const c = s.crystals.find((x) => x.colour === colour);
  if (c) c.integrity = Math.min(3, c.integrity + (c.integrity === 0 ? 3 : 1));
  else s.crystals.push({ colour, integrity: 3 });
}

export function flag(s: GameState, k: string): boolean {
  return !!s.flags[k];
}

export function setFlag(s: GameState, k: string, v: boolean | number | string = true) {
  s.flags[k] = v;
}

export function quest(s: GameState, id: string, title: string, line?: string, done = false) {
  let q = s.quests.find((x) => x.id === id);
  if (!q) s.quests.push((q = { id, title, lines: [], done: false }));
  if (line && !q.lines.includes(line)) q.lines.push(line);
  if (done) q.done = true;
  return q;
}

export function describe(s: GameState) {
  const c = s.character;
  return `${c.name}, ${RACE_LABEL[c.race]} ${ROLE_LABEL[c.role]}`;
}

// ---------------------------------------------------------------- saving

const SLOT = 'slot1';
const LS_KEY = 'stranded-keepers-errand-' + SLOT;

export async function saveGame(s: GameState): Promise<'disk' | 'browser'> {
  const body = JSON.stringify(s);
  try {
    const r = await fetch('/__saves/' + SLOT, { method: 'PUT', body, keepalive: body.length < 60000 });
    if (r.ok) return 'disk';
  } catch {
    /* fall through */
  }
  try {
    localStorage.setItem(LS_KEY, body);
  } catch {
    /* private mode: nothing we can do */
  }
  return 'browser';
}

export async function loadGame(): Promise<GameState | null> {
  try {
    const r = await fetch('/__saves/' + SLOT);
    if (r.ok) {
      const v = JSON.parse(await r.text()) as GameState | null;
      if (v) return v;
    }
  } catch {
    /* fall through */
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as GameState;
  } catch {
    /* ignore */
  }
  return null;
}

export async function hasSave(): Promise<boolean> {
  const s = await loadGame();
  return s !== null && !s.flags.__completed;
}

// A per-tab marker: set while a game is running, so a page reload resumes it instead of showing the title.
const LIVE_KEY = 'stranded-live-game';
export function markLive(on: boolean) {
  try {
    if (on) sessionStorage.setItem(LIVE_KEY, '1');
    else sessionStorage.removeItem(LIVE_KEY);
  } catch {
    /* ignore */
  }
}
export function wasLive(): boolean {
  try {
    return sessionStorage.getItem(LIVE_KEY) === '1';
  } catch {
    return false;
  }
}
