// Hand-drawn line glyphs. 24x24 viewBox, stroke uses currentColor.
import type { Race, Role } from '../rules/character';
import type { Severity } from '../rules/wounds';

const wrap = (body: string, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const RACE_GLYPH: Record<Race, string> = {
  // Mi'naa: a pick crossed with a fused cell.
  minaa: wrap(
    '<path d="M5 19 L15 9"/><path d="M11 5 C14 4 18 5 20 8 C17 7 14 7.5 12.5 9"/><rect x="13.5" y="13.5" width="6" height="6" rx="1" transform="rotate(45 16.5 16.5)"/><circle cx="16.5" cy="16.5" r="1"/>',
  ),
  // Sehari: a held crystal over a ground wave.
  sehari: wrap(
    '<path d="M12 3 L15 8 L12 14 L9 8 Z"/><path d="M12 3 L12 14"/><path d="M3 18 C6 16 8 20 12 18 C16 16 18 20 21 18"/><path d="M5 21.5 C8 20 10 22.5 12 21.5 C14 20.5 16 22.5 19 21.5" opacity=".6"/>',
  ),
  // Iskari: the stair and the eye, Aza'los hand.
  iskari: wrap(
    '<path d="M4 20 H8 V16 H12 V12 H16 V8 H20"/><path d="M6 8 C8 5 12 5 14 8 C12 11 8 11 6 8 Z"/><circle cx="10" cy="8" r="1.2"/>',
  ),
};

export const ROLE_GLYPH: Record<Role, string> = {
  frontline: wrap('<path d="M12 3 L19 6 V12 C19 16 16 19.5 12 21 C8 19.5 5 16 5 12 V6 Z"/><path d="M12 7 V17"/>'),
  ranged: wrap('<path d="M5 19 L19 5"/><path d="M14 5 H19 V10"/><path d="M5 19 L4 15 M5 19 L9 20"/><path d="M7 7 C10 4 15 4 17 7" opacity=".5"/>'),
  channeller: wrap('<path d="M12 2.5 L16 9 L12 16 L8 9 Z"/><path d="M8 9 H16"/><path d="M5 17 C7 21 17 21 19 17"/><path d="M3.5 13 L5.5 14 M20.5 13 L18.5 14"/>'),
  scout: wrap('<path d="M2.5 12 C6 6 18 6 21.5 12 C18 18 6 18 2.5 12 Z"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>'),
  healer: wrap('<path d="M12 21 C5 16 4 9 12 3 C20 9 19 16 12 21 Z"/><path d="M12 7 V20"/><path d="M12 11 L9 9 M12 14 L15 12"/>'),
  tech: wrap('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5 V5.5 M12 18.5 V21.5 M2.5 12 H5.5 M18.5 12 H21.5 M5.3 5.3 L7.4 7.4 M16.6 16.6 L18.7 18.7 M5.3 18.7 L7.4 16.6 M16.6 7.4 L18.7 5.3"/>'),
};

export const WOUND_GLYPH: Record<Severity, string> = {
  light: wrap('<path d="M7 17 L17 7"/>'),
  moderate: wrap('<path d="M6 15 L15 6 M9 18 L18 9"/>'),
  severe: wrap('<path d="M5 13 L13 5 M7.5 17 L17 7.5 M11 19 L19 11"/>'),
};

export const G = {
  quest: wrap('<path d="M12 3 L20 12 L12 21 L4 12 Z"/><path d="M12 8 L16 12 L12 16 L8 12 Z" fill="currentColor" opacity=".55"/>'),
  close: wrap('<path d="M6 6 L18 18 M18 6 L6 18"/>'),
  guard: wrap('<path d="M12 3 L19 6 V12 C19 16 16 19.5 12 21 C8 19.5 5 16 5 12 V6 Z"/>'),
  eye: wrap('<path d="M2.5 12 C6 6 18 6 21.5 12 C18 18 6 18 2.5 12 Z"/><circle cx="12" cy="12" r="3"/><path d="M4 20 L20 4" opacity=".8"/>'),
  sword: wrap('<path d="M5 19 L16 8 L19 5 L18.5 8.5 L16 8"/><path d="M4 16 L8 20 M6 18 L3.5 20.5"/>'),
  bow: wrap('<path d="M6 4 C15 6 18 9 20 18"/><path d="M6 4 L20 18" opacity=".6"/><path d="M4 20 L14 10 M14 10 L14 13 M14 10 L11 10"/>'),
  hourglass: wrap('<path d="M6 3 H18 M6 21 H18 M7 3 C7 9 17 9 17 12 C17 15 7 15 7 21 M17 3 C17 9 7 9 7 12 C7 15 17 15 17 21"/>'),
  flask: wrap('<path d="M10 3 H14 M10.5 3 V9 L5 19 C4.5 20 5 21 6 21 H18 C19 21 19.5 20 19 19 L13.5 9 V3"/><path d="M7.5 15 H16.5" opacity=".6"/>'),
  pouch: wrap('<path d="M8 6 C6 9 4 13 5 17 C6 20 18 20 19 17 C20 13 18 9 16 6"/><path d="M8 6 H16 M9 4 L12 6 L15 4"/>'),
  plate: wrap('<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M8 8 H16 M8 11 H14 M8 14 H15 M8 17 H12"/>'),
  crystal: wrap('<path d="M12 2.5 L17 9 L12 21.5 L7 9 Z"/><path d="M7 9 H17 M12 2.5 V21.5" opacity=".5"/>'),
  foot: wrap('<path d="M9 4 C11 4 12 6 12 9 C12 12 10 13 9 13 C7.5 13 6.5 11.5 6.5 9 C6.5 6 7.5 4 9 4 Z"/><path d="M15 11 C17 11 18 12.5 18 15 C18 18 16.5 20 15 20 C13.5 20 12.5 18.5 12.5 16 C12.5 13 13.5 11 15 11 Z"/>'),
  bolt: wrap('<path d="M13 2.5 L5 13.5 H11 L10 21.5 L19 10 H13 Z"/>'),
  stun: wrap('<circle cx="12" cy="12" r="7"/><path d="M12 5 C15 8 9 10 12 12 C15 14 9 16 12 19"/>'),
  skip: wrap('<path d="M5 5 L13 12 L5 19 Z"/><path d="M13 5 L21 12 L13 19"/>'),
};

export function itemGlyph(name: string, quest: boolean | undefined): string {
  const n = name.toLowerCase();
  if (quest || n.includes('plate') || n.includes('note') || n.includes('letter')) return G.plate;
  if (n.includes('crystal') || n.includes('shard')) return G.crystal;
  if (n.includes('sap') || n.includes('water') || n.includes('flask') || n.includes('gourd') || n.includes('aloe')) return G.flask;
  return G.pouch;
}

// Ability icons by ability id (src/rules/abilities.ts). Unknown ids fall back to initials.
export const ABILITY_GLYPH: Record<string, string> = {
  channelAmber: wrap('<path d="M12 3 L15.5 8.5 L12 14 L8.5 8.5 Z"/><path d="M12 14 V21 M8 18 L12 21 L16 18"/><path d="M4.5 6 L6.5 7 M19.5 6 L17.5 7 M4 11 H6 M18 11 H20"/>'),
  channelCrimson: wrap('<path d="M12 3 L15.5 8.5 L12 14 L8.5 8.5 Z"/><path d="M6 15 C6 19 9 21 12 21 C15 21 18 19 18 15"/><path d="M12 16.5 V19.5 M10.5 18 H13.5"/>'),
  allFours: G.foot,
  stillness: wrap('<path d="M7 21 V10 C7 6 9.5 3.5 12 3.5 C14.5 3.5 17 6 17 10 V21 Z"/><path d="M10 9 H14 M9.5 13 H14.5" opacity=".6"/><path d="M4 21 H20"/>'),
  keeperFocus: wrap('<path d="M4 20 L14 10"/><circle cx="16.5" cy="7.5" r="3.5"/><path d="M16.5 2 V4 M22 7.5 H20 M16.5 13 V11"/>'),
  shockCell: G.bolt,
  patchKit: wrap('<path d="M12 3 L19 6 V12 C19 16 16 19.5 12 21 C8 19.5 5 16 5 12 V6 Z"/><path d="M9 10 H15 M9 14 H15"/><circle cx="9" cy="10" r=".6" fill="currentColor"/><circle cx="15" cy="14" r=".6" fill="currentColor"/>'),
  holdTheLine: wrap('<path d="M12 3 L19 6 V12 C19 16 16 19.5 12 21 C8 19.5 5 16 5 12 V6 Z"/><path d="M3 21 H21"/><path d="M12 7 V16"/>'),
  aimedShot: wrap('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22"/>'),
  focusedChannel: wrap('<path d="M4 12 C7 8 10 16 13 12 C16 8 18 14 20 12"/><path d="M4 7 C7 4 10 9 13 7" opacity=".5"/><path d="M11 17 C14 14 17 19 20 17" opacity=".5"/>'),
  slipAway: wrap('<path d="M4 18 C8 18 9 6 14 6"/><path d="M11 3 L14 6 L11 9"/><path d="M15 15 H21 M17 19 H21" opacity=".6"/>'),
  mend: wrap('<path d="M5 19 L19 5"/><path d="M9 5 L19 15" opacity=".45"/><path d="M4 14 C6 13 7 12 8 10 M14 20 C13 18 12 17 10 16"/>'),
  overload: wrap('<circle cx="12" cy="12" r="3"/><path d="M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21"/><path d="M15 4 L13 9 L16 9 L13.5 14" stroke-width="1.3"/>'),
};

export const STRIP_GLYPH = {
  journal: wrap('<path d="M5 4 H17 C18 4 19 5 19 6 V20 H7 C6 20 5 19 5 18 Z"/><path d="M5 18 C5 17 6 16 7 16 H19"/><path d="M9 8 H15 M9 11 H14"/>'),
  inventory: G.pouch,
  character: wrap('<circle cx="12" cy="7.5" r="3.5"/><path d="M5 21 C5 15.5 8 13 12 13 C16 13 19 15.5 19 21"/>'),
  sneak: wrap('<path d="M2.5 12 C6 6 18 6 21.5 12 C18 18 6 18 2.5 12 Z"/><circle cx="12" cy="12" r="3"/>'),
  help: wrap('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5 C9.5 7.5 14.5 7.5 14.5 10 C14.5 12 12 12 12 14"/><circle cx="12" cy="17" r=".7" fill="currentColor"/>'),
  menu: wrap('<path d="M5 7 H19 M5 12 H19 M5 17 H19"/>'),
};
