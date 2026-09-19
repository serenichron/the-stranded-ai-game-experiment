// Wounds, not hit points. Canon: three slots, light / moderate / severe.
// Canon gives moderate -1 and severe -2 to every roll. The game drops that on the designer's
// call after playtesting: it made each fight harder the longer it went. A fourth wound still collapses you.
// Set WOUND_PENALTIES to true to restore the tabletop rule.
export const WOUND_PENALTIES = false;
// Game addition: Guard. Guard pips soak a hit before a wound lands. Guard refills after a fight.

export type Severity = 'light' | 'moderate' | 'severe';
export const SEVERITIES: Severity[] = ['light', 'moderate', 'severe'];

export interface WoundState {
  light: boolean;
  moderate: boolean;
  severe: boolean;
  guard: number;
  guardMax: number;
}

export function freshWounds(guardMax: number): WoundState {
  return { light: false, moderate: false, severe: false, guard: guardMax, guardMax };
}

export function woundPenalty(w: WoundState): number {
  if (!WOUND_PENALTIES) return 0;
  if (w.severe) return -2;
  if (w.moderate) return -1;
  return 0;
}

export type HarmResult =
  | { kind: 'guard'; guardLeft: number }
  | { kind: 'wound'; severity: Severity }
  | { kind: 'collapse' };

// A hit of a given severity fills that slot. If it is full, it rolls up to the next.
// If severe is full too, the character collapses.
export function takeWound(w: WoundState, sev: Severity): HarmResult {
  const start = SEVERITIES.indexOf(sev);
  for (let i = start; i < SEVERITIES.length; i++) {
    const s = SEVERITIES[i];
    if (!w[s]) {
      w[s] = true;
      return { kind: 'wound', severity: s };
    }
  }
  return { kind: 'collapse' };
}

// Guard soaks first. `pierce` skips guard (a clean full-success hit from a strong enemy).
export function takeHarm(w: WoundState, sev: Severity, pierce = false): HarmResult {
  if (!pierce && w.guard > 0) {
    w.guard -= 1;
    return { kind: 'guard', guardLeft: w.guard };
  }
  return takeWound(w, sev);
}

// Heal the last wound taken first. Wounds fill light, then moderate, then severe,
// so the last one is always the worst one.
export function healOne(w: WoundState): Severity | null {
  const order = [...SEVERITIES].reverse();
  for (const s of order) {
    if (w[s]) {
      w[s] = false;
      return s;
    }
  }
  return null;
}

export function woundCount(w: WoundState): number {
  return SEVERITIES.filter((s) => w[s]).length;
}

export function refillGuard(w: WoundState) {
  w.guard = w.guardMax;
}

export const WOUND_TEXT: Record<Severity, string> = {
  light: 'Light wound. It stings.',
  moderate: 'Moderate wound. It hurts, and it counts towards a fall.',
  severe: 'Severe wound. One more and you go down.',
};
