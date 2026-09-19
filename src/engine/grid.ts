import type { Tile } from '../core/contracts';

// Walk grid. Static blocking comes from the level layout; dynamic blocking from entities.

export class Grid {
  readonly blocked: Uint8Array;      // static: 1 = can't walk
  readonly opaque: Uint8Array;       // static: 1 = blocks sight
  readonly occupied: Map<number, number> = new Map(); // tile index -> entity count
  /** World y of the top of solid scenery standing on a blocked tile, 0 if none. For the see-through circle. */
  readonly tops: Float32Array;

  constructor(readonly width: number, readonly height: number) {
    this.blocked = new Uint8Array(width * height);
    this.opaque = new Uint8Array(width * height);
    this.tops = new Float32Array(width * height);
  }

  raiseTop(x: number, y: number, top: number) { if (this.inBounds(x, y)) { const i = this.idx(x, y); if (top > this.tops[i]) this.tops[i] = top; } }
  topAt(x: number, y: number) { return this.inBounds(x, y) ? this.tops[this.idx(x, y)] : 0; }

  idx(x: number, y: number) { return y * this.width + x; }
  inBounds(x: number, y: number) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  block(x: number, y: number, opaque = true) {
    if (!this.inBounds(x, y)) return;
    this.blocked[this.idx(x, y)] = 1;
    if (opaque) this.opaque[this.idx(x, y)] = 1;
  }
  unblock(x: number, y: number) {
    if (!this.inBounds(x, y)) return;
    this.blocked[this.idx(x, y)] = 0;
    this.opaque[this.idx(x, y)] = 0;
  }

  isStaticFree(x: number, y: number) { return this.inBounds(x, y) && !this.blocked[this.idx(x, y)]; }

  isFree(x: number, y: number, ignoreEntities = false) {
    if (!this.isStaticFree(x, y)) return false;
    return ignoreEntities || !(this.occupied.get(this.idx(x, y)) ?? 0);
  }

  occupy(t: Tile, delta: 1 | -1) {
    const i = this.idx(t.x, t.y);
    const n = (this.occupied.get(i) ?? 0) + delta;
    if (n <= 0) this.occupied.delete(i); else this.occupied.set(i, n);
  }

  /** Bresenham on tile centres; the end tiles themselves never block. */
  lineOfSight(a: Tile, b: Tile) {
    let x0 = a.x, y0 = a.y;
    const dx = Math.abs(b.x - x0), dy = -Math.abs(b.y - y0);
    const sx = x0 < b.x ? 1 : -1, sy = y0 < b.y ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (x0 === b.x && y0 === b.y) return true;
      if (!(x0 === a.x && y0 === a.y) && this.inBounds(x0, y0) && this.opaque[this.idx(x0, y0)]) return false;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
}

export const chebyshev = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const DIRS = [
  [0, -1], [1, 0], [0, 1], [-1, 0], // orthogonal first
  [1, -1], [1, 1], [-1, 1], [-1, -1],
];

/** A* over 8 directions. Diagonals cost 1.41 for nicer paths; no corner cutting. */
export function findPath(
  grid: Grid, from: Tile, to: Tile,
  opts: { maxLength?: number; ignoreEntities?: boolean; adjacentOk?: boolean } = {},
): Tile[] | null {
  const { maxLength = 400, ignoreEntities = false, adjacentOk = false } = opts;
  if (!grid.inBounds(to.x, to.y)) return null;
  const W = grid.width;
  const goalFree = grid.isFree(to.x, to.y, ignoreEntities);
  const isGoal = (x: number, y: number) =>
    (x === to.x && y === to.y && goalFree) ||
    ((adjacentOk || !goalFree) && adjacentOk && Math.max(Math.abs(x - to.x), Math.abs(y - to.y)) === 1);
  if (!goalFree && !adjacentOk) return null;
  if (from.x === to.x && from.y === to.y) return [];

  const startI = grid.idx(from.x, from.y);
  const g = new Map<number, number>([[startI, 0]]);
  const came = new Map<number, number>();
  const open: Array<[number, number]> = [[0, startI]]; // [f, idx], binary heap
  const push = (f: number, i: number) => {
    open.push([f, i]);
    let c = open.length - 1;
    while (c > 0) { const p = (c - 1) >> 1; if (open[p][0] <= open[c][0]) break; [open[p], open[c]] = [open[c], open[p]]; c = p; }
  };
  const pop = () => {
    const top = open[0]; const last = open.pop()!;
    if (open.length) {
      open[0] = last; let c = 0;
      for (;;) {
        const l = 2 * c + 1, r = l + 1; let m = c;
        if (l < open.length && open[l][0] < open[m][0]) m = l;
        if (r < open.length && open[r][0] < open[m][0]) m = r;
        if (m === c) break; [open[m], open[c]] = [open[c], open[m]]; c = m;
      }
    }
    return top;
  };
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - to.x), dy = Math.abs(y - to.y);
    return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
  };
  const closed = new Set<number>();
  let expanded = 0;
  while (open.length) {
    const [, ci] = pop();
    if (closed.has(ci)) continue;
    closed.add(ci);
    const cx = ci % W, cy = (ci / W) | 0;
    if (isGoal(cx, cy)) {
      const path: Tile[] = [];
      let i = ci;
      while (i !== startI) { path.push({ x: i % W, y: (i / W) | 0 }); i = came.get(i)!; }
      path.reverse();
      return path.length <= maxLength ? path : null;
    }
    if (++expanded > 20000) break;
    const cg = g.get(ci)!;
    if (cg >= maxLength) continue;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!grid.inBounds(nx, ny)) continue;
      const isTarget = nx === to.x && ny === to.y;
      if (!grid.isFree(nx, ny, ignoreEntities) && !(isTarget && goalFree)) continue;
      if (dx && dy && (!grid.isStaticFree(cx + dx, cy) || !grid.isStaticFree(cx, cy + dy))) continue;
      const ni = grid.idx(nx, ny);
      if (closed.has(ni)) continue;
      const ng = cg + (dx && dy ? 1.41 : 1);
      if (ng < (g.get(ni) ?? Infinity)) {
        g.set(ni, ng); came.set(ni, ci);
        push(ng + h(nx, ny), ni);
      }
    }
  }
  return null;
}

/** Tiles reachable within `steps` moves (each move, straight or diagonal, costs 1). */
export function reachable(grid: Grid, from: Tile, steps: number): Tile[] {
  const out: Tile[] = [];
  const seen = new Map<number, number>([[grid.idx(from.x, from.y), 0]]);
  const q: Tile[] = [from];
  while (q.length) {
    const t = q.shift()!;
    const d = seen.get(grid.idx(t.x, t.y))!;
    if (d >= steps) continue;
    for (const [dx, dy] of DIRS) {
      const nx = t.x + dx, ny = t.y + dy;
      if (!grid.isFree(nx, ny)) continue;
      if (dx && dy && (!grid.isStaticFree(t.x + dx, t.y) || !grid.isStaticFree(t.x, t.y + dy))) continue;
      const ni = grid.idx(nx, ny);
      if (seen.has(ni)) continue;
      seen.set(ni, d + 1);
      const nt = { x: nx, y: ny };
      out.push(nt); q.push(nt);
    }
  }
  return out;
}
