import type { LevelData } from '../core/contracts';

// Art layout for a level. Plain data: the engine turns it into meshes AND the walk grid,
// so what you see and where you can walk never drift apart.
// Coordinates are in tiles. x east, y south. Rotations in degrees, 0 = facing north, clockwise.

export type Ground = 'sand' | 'path' | 'plaza' | 'scar' | 'oasis' | 'packed' | 'rock';

export type Feature =
  /** Paint ground type over a polyline with a width (paths) or a circle/rect. */
  | { t: 'ground'; kind: Ground; line?: [number, number][]; width?: number; circle?: [number, number, number]; rect?: [number, number, number, number] }
  /** Aza'los curving wall along a polyline of points. Blocks tiles along it. gap = indices of segments left open. */
  | { t: 'azalos-wall'; pts: [number, number][]; h: number; gaps?: number[] }
  /** Aza'los ring wall. from/to in degrees (0 = north, clockwise). Blocks. */
  | { t: 'azalos-ring'; c: [number, number]; r: number; h: number; from: number; to: number; gapsDeg?: [number, number][] }
  | { t: 'tower'; at: [number, number]; r: number; h: number }
  | { t: 'arch'; at: [number, number]; span: number; h: number; rot: number }
  | { t: 'fallen-spire'; at: [number, number]; len: number; rot: number }
  /** A raised round court. raise lifts the ground under it (metres); the rim steps down to the sand. */
  | { t: 'floor-disc'; at: [number, number]; r: number; raise?: number }
  /** A tall Aza'los stalagmite tower. block = radius of tiles it blocks (defaults to r * 1.6). */
  | { t: 'great-tower'; at: [number, number]; r: number; h: number; block?: number; broken?: boolean; doors?: number; char?: number }
  /** Wrecks (phase 2). Each lies along its rot; block tiles with 'block' features. */
  | { t: 'miner-hull'; at: [number, number]; len: number; rot: number }
  | { t: 'azalos-vessel'; at: [number, number]; len: number; rot: number }
  /** A drag trench gouged by a crash: sunk along a polyline, with raised berms. Does not block. */
  | { t: 'trench'; pts: [number, number][]; width: number; depth: number }
  /** Camp pieces (phase 2). rot: the way the piece's front faces, degrees clockwise from north. */
  | { t: 'canopy'; at: [number, number]; w: number; d: number; h: number; rot: number }
  | { t: 'jars'; at: [number, number] }
  | { t: 'blocks'; at: [number, number] }
  /** An iron pipe on trestles, h metres up, along ground points. */
  | { t: 'pipe'; pts: [number, number][]; h: number }
  /** A stilt hut against a tower; rot is the bearing towards the tower. Blocks its own footprint. */
  | { t: 'stilt-hut'; at: [number, number]; h: number; rot: number }
  /** A crack in a wall face, half mended in teal. rot: the way it faces, degrees clockwise from north. */
  | { t: 'wall-crack'; at: [number, number]; rot: number }
  | { t: 'miner-ruin'; at: [number, number]; w: number; d: number; h: number; rot: number }
  | { t: 'shack'; at: [number, number]; w: number; d: number; rot: number }
  | { t: 'scaffold'; at: [number, number]; w: number; h: number; rot: number }
  | { t: 'wreck'; at: [number, number]; len: number; rot: number; block: [number, number, number, number][] }
  | { t: 'rock'; at: [number, number]; size: number }
  /** A plain salvage crate, part of the scenery (not clickable). */
  | { t: 'crate'; at: [number, number]; rot: number }
  /** A ridge of rocks along a polyline; blocks a band `width` tiles wide. */
  | { t: 'ridge'; pts: [number, number][]; width: number; height: number }
  | { t: 'plant'; at: [number, number]; kind: 'spire-root' | 'field-moss' | 'glass-thistle' | 'glow-bloom' | 'twist-weed' | 'reed-cane' | 'sun-date' | 'dust-aloe' | 'digger-tuber'; block?: boolean }
  /** Scatter plants/debris randomly inside a rect, on free tiles only. */
  | { t: 'scatter'; rect: [number, number, number, number]; kind: 'field-moss' | 'glass-thistle' | 'glow-bloom' | 'twist-weed' | 'dust-aloe' | 'debris' | 'rock-small' | 'digger-tuber'; count: number }
  /** The Scar: a dead chasm. Blocks. */
  | { t: 'chasm'; rect: [number, number, number, number] }
  /** Keep this rect free of scatter and ground cover (it stays walkable). */
  | { t: 'clear'; rect: [number, number, number, number] }
  /** Invisible blocker. */
  | { t: 'block'; rect: [number, number, number, number] };

export interface LevelBundle {
  data: LevelData;
  features: Feature[];
  /** Tint and light of this place. */
  sky: { sunAzimuth: number; sunElevation: number };
}
