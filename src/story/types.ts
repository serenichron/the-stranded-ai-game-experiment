// Dialogue data format. Story files are plain data plus small functions over a context.

import type { Spec, Stat, Race } from '../rules/character';
import type { Band } from '../rules/dice';
import type { GameState } from '../game/state';
import type { DialogueView } from '../ui/types';

export interface Ctx {
  s: GameState;
  race: Race;
  has(item: string): boolean;
  flag(k: string): boolean;
  set(k: string, v?: boolean | number | string): void;
  give(item: string, n?: number): void;
  take(item: string, n?: number): boolean;
  crystal(colour: 'amber' | 'crimson' | 'pale' | 'violet'): void;
  hasCrystal(colour: 'amber' | 'crimson' | 'pale' | 'violet'): boolean;
  quest(id: string, title: string, line?: string, done?: boolean): void;
  objective(text: string): void;
  toast(text: string, tone?: 'good' | 'bad' | 'neutral' | 'crystal' | 'quest'): void;
  /** Run a world-side action registered by the game, e.g. 'open-door'. */
  act(name: string, arg?: unknown): Promise<void>;
  /** Result of the last check in this conversation. */
  lastBand: Band | null;
}

export type Text = string | ((c: Ctx) => string);

export interface DCheck {
  stat: Stat;
  specs: Spec[]; // best one the character has
  bonus?: number;
  label: string;
  full: string;
  partial: string;
  miss: string;
  /** Shown before the roll: what a success gets you and what a miss costs. */
  win?: string;
  risk?: string;
}

export interface DChoice {
  text: Text;
  tag?: Text;
  /** Hidden unless true. */
  if?: (c: Ctx) => boolean;
  /** Shown but greyed with this reason when it returns a string. */
  lock?: (c: Ctx) => string | null;
  check?: DCheck;
  next?: string;
  do?: (c: Ctx) => void | Promise<void>;
  once?: boolean;
}

export interface DNode {
  speaker?: string; // key into SPEAKERS; '' or undefined = narration
  text: Text;
  /**
   * Shorter lines for a return visit, used in order and then cycled. The long `text` is for the
   * first time only (the user: coming back to a character repeated one long line every time).
   */
  again?: Text[];
  choices?: DChoice[];
  next?: string | ((c: Ctx) => string);
  do?: (c: Ctx) => void | Promise<void>;
  end?: boolean;
}

export type Dialogue = Record<string, DNode>;

export const SPEAKERS: Record<string, { name: string; portrait: DialogueView['portrait'] }> = {
  apprentice: { name: 'The apprentice', portrait: 'apprentice' },
  foreman: { name: 'Hadda, crew boss', portrait: 'foreman' },
  scav: { name: 'Pell', portrait: 'scavenger' },
  kid: { name: 'Osk', portrait: 'minaa' },
  cook: { name: 'Mother Tarn', portrait: 'minaa' },
  record: { name: 'The record', portrait: 'record' },
  hunter: { name: 'Sehari hunter', portrait: 'sehari' },
  you: { name: 'You', portrait: 'player' },
  sign: { name: 'Painted sign', portrait: 'narrator' },
};
