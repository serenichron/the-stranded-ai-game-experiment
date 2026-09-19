// The seam between agent 1 (engine, world, level) and agent 2 (rules, game, story, ui, audio).
// Change rules: announce the diff in your comms log BEFORE saving. See comms/PROTOCOL.md.
//
// Direction of travel:
//   world -> game : events on the Bus (clicks, hovers, arrivals, zone entry).
//   game -> world : calls on IWorld (move, animate, effects, highlight, camera).
// The world never decides what happens. The game never touches three.js.

// ---------------------------------------------------------------- grid

/** Grid tile. x grows east, y grows south, in the level's own frame (not screen). */
export interface Tile { x: number; y: number }

export type Facing = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 0 = north, clockwise in 45 degree steps

export type EntityId = string;

// ---------------------------------------------------------------- kinds

/** What the world knows how to draw. Add kinds by announcing them in the log. */
export type EntityKind =
  // the player, one per race
  | 'player-minaa'
  | 'player-sehari'
  | 'player-iskari'
  // people
  | 'npc-apprentice'      // Iskari, serving line, the Keeper's apprentice
  | 'npc-minaa'           // settled Mi'naa, generic camp folk
  | 'npc-scavenger'       // scavenger Mi'naa, looks identical to settled
  | 'npc-sehari'
  // machines
  | 'telsharin'           // amber, bone-coral, starving
  | 'guardian'            // Aza'los guardian, teal, precise. Alias for 'drone' until the level switches.
  | 'drone'               // Aza'los repair drone, teal, precise. States: 'tending' | 'hostile' | 'dead'
  | 'defender'            // defensive-line Iskari. States: 'dormant' | 'waking' | 'awake' | 'dead'
  | 'dog'                 // feral dog, the introduced line the miners brought
  // props the game cares about (clickable)
  | 'prop-metal-pile'     // Tel'sharin food. Remove all nearby piles to starve it.
  | 'prop-crystal'        // loose crystal. opts.colour picks the domain.
  | 'prop-symbol-door'    // Aza'los door. visual states: 'sealed' | 'open'
  | 'prop-archive'        // the Keeper archive fragment. states: 'dormant' | 'lit' | 'taken'
  | 'prop-chest'          // salvage crate. states: 'closed' | 'open'
  | 'prop-spring'
  | 'prop-barrel-gourd'
  | 'prop-lamp'           // states: 'lit' | 'out'
  | 'prop-tent'
  | 'prop-sign'
  | 'prop-lever'          // Aza'los crystal socket / switch. states: 'off' | 'on'
  | 'prop-niche';         // wall alcove for the dormant defender. States: 'dark' | 'lit' | 'empty'

export type CrystalColour = 'crimson' | 'amber' | 'verdant' | 'azure' | 'violet' | 'pale' | 'void';

export type Faction = 'player' | 'neutral' | 'hostile';

export type AnimName = 'idle' | 'walk' | 'run' | 'attack' | 'hit' | 'die' | 'channel' | 'sleep' | 'wake' | 'talk' | 'crouch';

export type FxKind =
  | 'hit'           // impact sparks at a tile or entity
  | 'channel'       // crystal channelling swirl; opts.colour
  | 'shatter'       // crystal shards; opts.colour
  | 'dust'          // footstep / impact dust puff
  | 'crystal-glow'  // a pulse of light; opts.colour
  | 'memory-echo'   // azure ghost-light, used on the archive reveal
  | 'wound'         // red flash on an entity
  | 'miss'          // whiff of air
  | 'sleep';        // amber light dimming (Tel'sharin going into hibernation)

export type HighlightStyle = 'move' | 'target' | 'danger' | 'interact' | 'path' | 'selected';

// ---------------------------------------------------------------- level data (agent 1 writes, agent 2 reads)

export interface LevelEntity {
  id: EntityId;
  kind: EntityKind;
  tile: Tile;
  facing?: Facing;
  faction: Faction;
  /** Display name the UI can show on hover. */
  name?: string;
  /** Free tags the game may use, e.g. 'metal', 'feeds:tel1', 'hidden'. */
  tags?: string[];
  /** Script id the game runs when the player interacts. Agent 2 registers handlers by this id. */
  script?: string;
  /** Kind-specific options, e.g. { colour: 'pale' } for crystals. */
  opts?: Record<string, unknown>;
}

export interface LevelZone {
  id: string;
  /** Inclusive tile rectangle. */
  rect: { x: number; y: number; w: number; h: number };
  /** Script id run when the player enters. */
  script?: string;
  /** Human label, for the journal or debug. */
  label?: string;
}

export interface LevelData {
  id: string;
  name: string;
  width: number;
  height: number;
  playerSpawn: Tile;
  playerFacing?: Facing;
  entities: LevelEntity[];
  zones: LevelZone[];
}

// ---------------------------------------------------------------- events (world -> game)

export interface WorldEvents {
  'world:ready': { level: LevelData };
  'tile:click': { tile: Tile; button: 0 | 2; shift: boolean };
  'tile:hover': { tile: Tile | null };
  'entity:click': { id: EntityId; button: 0 | 2 };
  'entity:hover': { id: EntityId | null };
  'entity:arrived': { id: EntityId; tile: Tile };
  'zone:enter': { zoneId: string; id: EntityId };
  'zone:leave': { zoneId: string; id: EntityId };
  /** Raw keys the world did not consume (world uses Q, E, wheel, middle-drag for the camera). */
  'key:down': { key: string; code: string };
}

// ---------------------------------------------------------------- the world API (game -> world)

export type WorldMode = 'explore' | 'combat' | 'dialogue' | 'cutscene';

export interface EntityInfo {
  id: EntityId;
  kind: EntityKind;
  tile: Tile;
  facing: Facing;
  faction: Faction;
  name?: string;
  tags: string[];
  visible: boolean;
}

export interface IWorld {
  readonly level: LevelData;

  // entities
  spawn(kind: EntityKind, tile: Tile, opts?: { id?: EntityId; facing?: Facing; faction?: Faction; name?: string; tags?: string[]; colour?: CrystalColour; body?: 'male' | 'female'; look?: string }): EntityId;
  despawn(id: EntityId, how?: 'instant' | 'fade' | 'sink'): Promise<void>;
  get(id: EntityId): EntityInfo | null;
  all(): EntityInfo[];
  at(tile: Tile): EntityInfo[];
  setVisible(id: EntityId, visible: boolean): void;
  /** Prop or creature visual state, e.g. door 'open', telsharin 'asleep', archive 'lit'. */
  setState(id: EntityId, state: string): void;

  // movement. Speed in tiles per second. Resolves on arrival, or rejects with 'blocked' if the path is cut.
  moveAlong(id: EntityId, path: Tile[], speed?: number): Promise<void>;
  /** Snap without animation. */
  place(id: EntityId, tile: Tile, facing?: Facing): void;
  face(id: EntityId, target: Tile | EntityId): void;
  stop(id: EntityId): void;

  // animation. Loops for idle/walk/run/channel/sleep/crouch. One-shots resolve when done.
  playAnim(id: EntityId, anim: AnimName): Promise<void>;

  // grid queries
  isWalkable(tile: Tile, ignoreEntities?: boolean): boolean;
  findPath(from: Tile, to: Tile, opts?: { maxLength?: number; ignoreEntities?: boolean; adjacentOk?: boolean }): Tile[] | null;
  /** Tiles reachable within `steps` moves. For the combat move range. */
  reachable(from: Tile, steps: number): Tile[];
  lineOfSight(a: Tile, b: Tile): boolean;
  distance(a: Tile, b: Tile): number; // Chebyshev, diagonals cost 1

  // effects
  fx(kind: FxKind, at: Tile | EntityId, opts?: { colour?: CrystalColour; intensity?: number; duration?: number }): void;
  /** A projectile or beam between two points. Resolves on impact. */
  bolt(from: EntityId, to: Tile | EntityId, opts?: { colour?: CrystalColour; kind?: 'beam' | 'shard' | 'slug' }): Promise<void>;
  /** A teal pulse along the ruin's floor seams, from the drone to the niche. Resolves when it reaches `to`. */
  seamPulse(from: Tile | EntityId, to: Tile | EntityId, opts?: { colour?: CrystalColour; duration?: number }): Promise<void>;
  /** Floating text above an entity, for "Light wound", "7 - partial" and the like. */
  floatText(id: EntityId, text: string, tone?: 'good' | 'bad' | 'neutral' | 'crystal'): void;

  // highlights. Returns a handle; pass it to clearHighlight.
  highlight(targets: Array<Tile | EntityId>, style: HighlightStyle): number;
  clearHighlight(handle?: number): void; // no handle = clear all
  /** Vision cone for stealth, drawn on the ground. range in tiles, angle in degrees. */
  showSightCone(id: EntityId, range: number, angle: number, alert?: boolean): void;
  hideSightCone(id: EntityId): void;

  // camera
  follow(id: EntityId | null): void;
  focus(target: Tile | EntityId, opts?: { zoom?: number; duration?: number }): Promise<void>;
  shake(intensity?: number, duration?: number): void;
  /** Screen pixels for DOM anchoring (speech bubbles, labels). null if off-screen. */
  toScreen(target: Tile | EntityId): { x: number; y: number } | null;

  // mode. Changes cursor, hover rules, and whether wheel/rotate work.
  setMode(mode: WorldMode): void;
  /** Mood lighting. 'normal' | 'tense' (combat) | 'memory' (azure wash for the reveal) | 'dim' (inside the spire). */
  setMood(mood: 'normal' | 'tense' | 'memory' | 'dim', duration?: number): void;
  /** Stop the world clock (menus). */
  setPaused(paused: boolean): void;
  /** Graphics quality. 'high' is the default. 'low' is for weak laptops and tablets. */
  setQuality(q: 'high' | 'medium' | 'low'): void;
  getQuality(): 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------- event bus

type Handler<T> = (payload: T) => void;

export class Bus<E extends object> {
  private handlers = new Map<keyof E, Set<Handler<any>>>();
  on<K extends keyof E>(type: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }
  once<K extends keyof E>(type: K, fn: Handler<E[K]>): () => void {
    const off = this.on(type, (p) => { off(); fn(p); });
    return off;
  }
  emit<K extends keyof E>(type: K, payload: E[K]): void {
    this.handlers.get(type)?.forEach((fn) => {
      try { fn(payload); } catch (err) { console.error(`[bus] ${String(type)} handler failed`, err); }
    });
  }
}

// ---------------------------------------------------------------- boot

/**
 * main.ts (agent 1) builds the world, then calls the game's entry (agent 2):
 *   import { startGame } from '../game';   // agent 2 exports this
 *   startGame({ world, bus, root })
 * `root` is the DOM element the UI overlay should mount into (sits above the canvas).
 * The game owns the title screen, so the world renders the level behind it from the start.
 */
export interface GameBoot {
  world: IWorld;
  bus: Bus<WorldEvents>;
  root: HTMLElement;
}
