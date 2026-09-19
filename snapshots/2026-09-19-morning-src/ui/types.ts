// The UI contract inside agent 2's half. The game (src/game/) calls this. src/ui/ implements it.
// DOM overlay only. No three.js here.

import type { Character, Race, Role, Spec, Stat } from '../rules/character';
import type { CheckResult } from '../rules/check';
import type { Band } from '../rules/dice';
import type { Severity } from '../rules/wounds';

export type Tone = 'good' | 'bad' | 'neutral' | 'crystal' | 'quest';

export interface HudAbility {
  id: string;
  name: string;
  desc: string;
  key: string; // hotkey label, "1".."5"
  cooldown: number; // turns left, 0 = ready
  disabled?: string; // reason it cannot be used right now, shown in tooltip
  rollLabel?: string; // e.g. "Resonance + Channelling depth (+4)"
}

export interface HudCrystal {
  colour: 'amber' | 'crimson' | 'pale' | 'violet';
  integrity: number; // 0..3. 0 = shattered (not shown)
}

export interface HudState {
  name: string;
  race: Race;
  role: Role;
  raceLabel: string;
  roleLabel: string;
  wounds: Record<Severity, boolean>;
  guard: number;
  guardMax: number;
  penalty: number; // 0, -1, -2
  crystals: HudCrystal[];
  abilities: HudAbility[];
  sneaking: boolean;
  objective: string; // current main objective, one line
  mode: 'explore' | 'combat' | 'dialogue' | 'cutscene';
}

export interface CombatBarState {
  round: number;
  whoseTurn: 'player' | 'enemy';
  moveLeft: number;
  moveMax: number;
  actionLeft: boolean;
  attackLabel: string; // "Strike (Body + Melee +3)" or "Shoot (Edge + Ranged +4)"
  attackRange: number;
  selected: string | null; // 'attack' | ability id | null
  abilities: HudAbility[];
  items: { id: string; name: string; count: number; desc: string }[]; // usable consumables
  enemies: { id: string; name: string; harm: number; harmMax: number; stunned: number; hidden?: boolean }[];
  log: string[]; // last few lines, newest last
}

export type CombatAction =
  | { type: 'select'; what: string | null } // 'attack', an ability id, or null
  | { type: 'item'; id: string }
  | { type: 'end' };

export interface DialogueChoiceView {
  text: string;
  tag?: string; // e.g. "[Iskari]", "[Mind + Lore, +2]"
  odds?: Record<Band, number>; // if the choice rolls, the chance of each band
  disabled?: string; // shown greyed with this reason
  /** For a check: what you stand to gain and lose, shown before you roll. */
  stakes?: string;
  seen?: boolean; // already picked once, shown dimmer
}

export interface DialogueView {
  speaker: string; // display name, "" for narration
  portrait?: 'apprentice' | 'minaa' | 'scavenger' | 'sehari' | 'iskari' | 'player' | 'narrator' | 'foreman' | 'record';
  text: string; // may contain *emphasis*
  choices: DialogueChoiceView[]; // empty = show "Continue"
}

export interface InventoryItemView {
  id: string;
  name: string;
  count: number;
  desc: string;
  usable: boolean;
  quest?: boolean;
}

export interface JournalEntryView {
  id: string;
  title: string;
  lines: string[]; // oldest first
  done: boolean;
}

export interface CreationPreviewState { step: number; race: Race | null; body: 'male' | 'female'; role: Role | null; done?: boolean }
export type CreationPreview = (s: CreationPreviewState) => void;

export interface CreationChoice {
  name: string;
  race: Race;
  role: Role;
  stats: Record<Stat, number>;
  picks: Spec[]; // exactly 2
  body: 'male' | 'female';
}

export interface EndingSummary {
  title: string;
  lines: string[]; // what happened, one per line
  coda: string; // the final line
  stats: { label: string; value: string }[];
}

export interface MenuHandlers {
  onSave(): Promise<string>; // returns a status line
  onLoad(): Promise<string>;
  onQuitToTitle(): void;
  storageNote: string; // e.g. "Saves go to ./saves/ in the game folder."
  /** Graphics quality row. Optional: hidden when absent. */
  quality?: { get(): 'high' | 'medium' | 'low'; set(q: 'high' | 'medium' | 'low'): void };
  /** Spoken narration on or off. Optional: hidden when absent. */
  narration?: { get(): boolean; set(on: boolean): void };
}

export interface UI {
  mount(root: HTMLElement): void;

  // Screens. Each resolves when the player finishes it.
  title(opts: { canContinue: boolean }): Promise<'new' | 'continue'>;
  /** `preview` is told the choice so far, so the world can show the bodies behind the panel. */
  createCharacter(preview?: CreationPreview): Promise<CreationChoice>;
  ending(summary: EndingSummary): Promise<void>;
  /** Full-screen text beat with a slow fade, click or Space to advance. */
  narrate(lines: string[], opts?: { title?: string }): Promise<void>;

  // HUD
  showHud(visible: boolean): void;
  updateHud(s: HudState): void;
  toast(text: string, tone?: Tone): void;
  /** Speech bubble at screen coordinates. Hides after ms. */
  bark(at: { x: number; y: number } | null, speaker: string, text: string, ms?: number): void;
  /** Hover label near the cursor. null hides it. */
  hoverLabel(text: string | null, sub?: string): void;

  // Dice. Animates two dice, lists the terms, shows the band. Resolves after the player has seen it.
  roll(r: CheckResult): Promise<void>;

  // Dialogue. Resolves with the chosen index (0 when there are no choices and the player continues).
  dialogue(view: DialogueView): Promise<number>;
  closeDialogue(): void;

  // Combat
  combatBar(state: CombatBarState | null): void; // null hides it
  onCombatAction(fn: (a: CombatAction) => void): void;
  /** HUD clicks the UI cannot handle itself: the sneak toggle, and explore-mode ability buttons. */
  onHudAction(fn: (a: 'sneak' | { ability: string }) => void): void;
  /** Big banner: "Your turn", "The Tel'sharin moves", "Combat over". */
  banner(text: string, sub?: string): Promise<void>;

  // Panels (toggle with J, I, C, Esc; the game forwards keys)
  setJournal(entries: JournalEntryView[]): void;
  setInventory(items: InventoryItemView[], onUse: (id: string) => void): void;
  setCharacter(c: Character, extra: { lines: string[] }): void;
  togglePanel(p: 'journal' | 'inventory' | 'character' | 'menu' | 'help'): void;
  closePanels(): boolean; // true if something was open
  setMenu(h: MenuHandlers): void;

  /** Screen fade for scene changes and collapse. */
  fade(to: 'black' | 'clear', ms?: number): Promise<void>;
}
