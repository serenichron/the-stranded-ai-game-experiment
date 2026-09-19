// The creation line-up: all six player bodies stand in the world behind the creation panel, lit by the
// real light. The chosen one steps forward and turns to talk; the rest stand at ease.

import type { EntityKind, Facing, IWorld, Tile } from '../core/contracts';
import type { CreationPreviewState } from '../ui/types';

const ORDER: Array<{ race: 'minaa' | 'sehari' | 'iskari'; body: 'male' | 'female' }> = [
  { race: 'minaa', body: 'male' }, { race: 'minaa', body: 'female' },
  { race: 'sehari', body: 'male' }, { race: 'sehari', body: 'female' },
  { race: 'iskari', body: 'male' }, { race: 'iskari', body: 'female' },
];
const DIRS: Array<[number, number]> = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
/** Default role kit per race when no role is picked yet, so each body shows something in its hands. */
const DEFAULT_LOOK = { minaa: 'tech', sehari: 'channeller', iskari: 'frontline' } as const;

export class Lineup {
  private ids: string[] = [];
  private tiles: Tile[] = [];
  private facing: Facing = 4;
  private chosen = -1;
  private role: string | null = null;
  private hl: number | null = null;
  private placed = false;

  constructor(private w: IWorld, private near: Tile) {}

  /** Find a straight row of free tiles that runs across the screen, and a facing towards the camera. */
  private place(): void {
    const w = this.w;
    const c = w.toScreen(this.near), cx = w.toScreen({ x: this.near.x + 1, y: this.near.y }), cy = w.toScreen({ x: this.near.x, y: this.near.y + 1 });
    let axis: [number, number] = [1, 0];
    if (c && cx && cy) {
      // of the four grid directions and the two diagonals, the one that runs most level across the screen
      let bestScore = -1e9;
      for (const d of [[1, 0], [0, 1], [1, 1], [1, -1]] as Array<[number, number]>) {
        const q = w.toScreen({ x: this.near.x + d[0], y: this.near.y + d[1] });
        if (!q) continue;
        const dx = q.x - c.x, dy = q.y - c.y;
        const score = Math.abs(dx) / (Math.abs(dy) + 1);
        if (score > bestScore) { bestScore = score; axis = dx >= 0 ? d : [-d[0], -d[1]]; }
      }
      void cx; void cy;
      // face whichever way points most down the screen
      let best = -1e9;
      DIRS.forEach(([dx, dy], i) => {
        const p = w.toScreen({ x: this.near.x + dx * 3, y: this.near.y + dy * 3 });
        if (p && p.y - c.y > best) { best = p.y - c.y; this.facing = i as Facing; }
      });
    }
    // search outwards from `near` for six free tiles in a row, one tile apart plus a gap between races
    for (let r = 0; r < 14 && !this.tiles.length; r++) {
      for (let oy = -r; oy <= r && !this.tiles.length; oy++) {
        for (let ox = -r; ox <= r && !this.tiles.length; ox++) {
          // three pairs, one per race, across the screen; each woman one step nearer the camera than the man
          const row: Tile[] = [];
          const fwd: [number, number] = [axis[1], -axis[0]]; // away from the camera, perpendicular to the row
          for (let i = 0; i < 6; i++) {
            const col = i, back = 0; // one row: every body in full view
            row.push({ x: this.near.x + ox + axis[0] * col + fwd[0] * back, y: this.near.y + oy + axis[1] * col + fwd[1] * back });
          }
          if (row.every((t) => w.isWalkable(t, true))) this.tiles = row;
        }
      }
    }
    if (!this.tiles.length) this.tiles = ORDER.map((_, i) => ({ x: this.near.x + axis[0] * i, y: this.near.y + axis[1] * i }));
  }

  private kind(i: number): EntityKind {
    return `player-${ORDER[i].race}` as EntityKind;
  }

  private spawnOne(i: number, look: string): void {
    const id = `cc-${ORDER[i].race}-${ORDER[i].body}`;
    this.w.spawn(this.kind(i), this.tiles[i], { id, facing: this.facing, faction: 'neutral', body: ORDER[i].body, look, tags: ['lineup'] });
    this.ids[i] = id;
  }

  /** Debug: where the line-up stands. */
  get where() { return { tiles: this.tiles, ids: this.ids }; }

  private ready = false;
  private pending: CreationPreviewState | null = null;

  /** Aim the camera at the spot first, so the row can be laid level across the screen. */
  private async init(): Promise<void> {
    await this.w.focus(this.near, { zoom: 1.15, duration: 0.01 });
    await new Promise((r) => setTimeout(r, 1500));
    this.place();
    ORDER.forEach((o, i) => this.spawnOne(i, DEFAULT_LOOK[o.race]));
    this.ready = true;
    if (this.pending) this.show(this.pending);
    await this.frame();
  }

  show(s: CreationPreviewState): void {
    if (s.done) { this.pending = null; if (this.ready) this.clear(); else this.cleared = true; return; }
    if (!this.placed) { this.placed = true; void this.init(); }
    if (!this.ready) { this.pending = s; return; }
    if (this.cleared) return;
    const want = s.race ? ORDER.findIndex((o) => o.race === s.race && o.body === s.body) : -1;
    // a role picked: the chosen body shows that role's kit
    if (want >= 0 && s.role && s.role !== this.role) {
      this.role = s.role;
      this.spawnOne(want, s.role);
    }
    if (want !== this.chosen) {
      if (this.chosen >= 0) {
        const old = this.chosen;
        if (this.role) this.spawnOne(old, DEFAULT_LOOK[ORDER[old].race]);
        void this.w.playAnim(this.ids[old], 'idle');
      }
      this.chosen = want;
      this.role = s.role;
      if (want >= 0 && s.role) this.spawnOne(want, s.role);
      if (this.hl !== null) this.w.clearHighlight(this.hl);
      this.hl = null;
      if (want >= 0) {
        this.hl = this.w.highlight([this.ids[want]], 'selected');
        void this.w.playAnim(this.ids[want], 'talk');
      }
    }
  }

  /** Put the line-up in the right half of the screen, clear of the docked panel. */
  private async frame(): Promise<void> {
    const w = this.w;
    const mid = this.tiles[2], mid2 = this.tiles[3]; // the Sehari pair stands in the middle
    const centre = { x: Math.round((mid.x + mid2.x) / 2), y: Math.round((mid.y + mid2.y) / 2) };
    const zoom = 1.15;
    // the camera eases towards its goal: wait until the centre stops moving on screen
    const settle = async () => {
      let last = w.toScreen(centre);
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const now = w.toScreen(centre);
        if (now && last && Math.hypot(now.x - last.x, now.y - last.y) < 0.5) return;
        last = now;
      }
    };
    // the line-up's middle should land at 70% across and 60% down, clear of the docked panel
    const want = { x: innerWidth * 0.77, y: innerHeight * 0.55 };
    let aim = { x: centre.x, y: centre.y };
    for (let i = 0; i < 3; i++) {
      await w.focus(aim, { zoom, duration: 0.01 });
      await settle();
      const p = w.toScreen(centre), px = w.toScreen({ x: centre.x + 1, y: centre.y }), py = w.toScreen({ x: centre.x, y: centre.y + 1 });
      if (!p || !px || !py) { aim = { x: centre.x, y: centre.y }; continue; }
      // moving the camera's aim by one tile moves the centre on screen by minus these vectors
      const a = px.x - p.x, b = py.x - p.x, c = px.y - p.y, d = py.y - p.y;
      const det = a * d - b * c;
      if (Math.abs(det) < 1e-6) return;
      const ex = p.x - want.x, ey = p.y - want.y;
      let mx = (d * ex - b * ey) / det, my = (-c * ex + a * ey) / det;
      const len = Math.hypot(mx, my);
      if (len > 6) { mx *= 6 / len; my *= 6 / len; }
      aim = { x: aim.x + mx, y: aim.y + my };
      if (Math.hypot(ex, ey) < 12) break;
    }
  }

  private cleared = false;

  clear(): void {
    this.cleared = true;
    if (this.hl !== null) this.w.clearHighlight(this.hl);
    for (const id of this.ids) if (id && this.w.get(id)) void this.w.despawn(id, 'instant');
    this.ids = [];
  }
}
