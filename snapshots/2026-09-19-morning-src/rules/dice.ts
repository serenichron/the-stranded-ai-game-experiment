// Dice. Seeded so a save can replay the same rolls and tests stay stable.

export interface Rng {
  next(): number; // 0 <= n < 1
  state(): number;
}

// mulberry32: tiny, fast, good enough for dice.
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state: () => s,
  };
}

export function d6(rng: Rng): number {
  return 1 + Math.floor(rng.next() * 6);
}

export function roll2d6(rng: Rng): [number, number] {
  return [d6(rng), d6(rng)];
}

export type Band = 'full' | 'partial' | 'miss';

// Canon: 10+ full success, 7 to 9 partial with a cost, 6 or less failure.
export function bandOf(total: number): Band {
  if (total >= 10) return 'full';
  if (total >= 7) return 'partial';
  return 'miss';
}

// Chance of each band for a given flat modifier. Used by the UI to show odds.
export function bandOdds(mod: number): Record<Band, number> {
  const out: Record<Band, number> = { full: 0, partial: 0, miss: 0 };
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) out[bandOf(a + b + mod)] += 1 / 36;
  return out;
}
