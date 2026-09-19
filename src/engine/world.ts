import * as THREE from 'three';
import type {
  AnimName, Bus, CrystalColour, EntityId, EntityInfo, EntityKind, Facing, Faction, FxKind,
  HighlightStyle, IWorld, LevelData, Tile, WorldEvents, WorldMode,
} from '../core/contracts';
import type { LevelBundle } from '../level/layout';
import type { Model } from '../world/models/types';
import { buildCharacter } from '../world/models/characters';
import { buildProp } from '../world/models/props';
import { Renderer } from './render';
import { IsoCamera } from './camera';
import { Terrain, buildFarGround, buildScarCracks } from './terrain';
import { buildBackdrop } from '../world/models/scn-backdrop';
import { buildGroundCover } from './groundcover';
import { Grid, chebyshev, findPath, reachable } from './grid';
import { Effects, type FxColour } from './fx';
import { buildLevelArt } from './levelbuild';
import { mergeStatic } from './merge';
import { occUniforms, patchTree } from './occlusion';
import { atmos } from './atmos';
import { seamNetFor, seamPath, type SeamNet } from '../world/models/scn-azalos';

interface Entity {
  id: EntityId;
  kind: EntityKind;
  model: Model;
  tile: Tile;
  facing: Facing;
  faction: Faction;
  name?: string;
  tags: string[];
  visible: boolean;
  pos: THREE.Vector3;      // world position of the feet
  yaw: number;             // radians, clockwise from north
  yawGoal: number;
  path: Tile[];
  speed: number;
  move?: { resolve: () => void; reject: (e: Error) => void };
  occupying: Tile | null;
  zones: Set<string>;
  anim: AnimName;
  state?: string;
  fading?: { t: number; dur: number; how: 'fade' | 'sink'; resolve: () => void };
  isPlayer: boolean;
  isProp: boolean;
  animTimer?: number;
  stride: number;          // metres walked since the last footstep puff
}

const facingToYaw = (f: Facing) => (f * Math.PI) / 4;
const yawToFacing = (y: number) => ((((Math.round(y / (Math.PI / 4)) % 8) + 8) % 8) as Facing);
const LOOPS: AnimName[] = ['idle', 'walk', 'run', 'channel', 'sleep', 'talk', 'crouch'];

export class World implements IWorld {
  readonly level: LevelData;
  readonly ready: Promise<void>;
  readonly r: Renderer;
  readonly cam: IsoCamera;
  readonly terrain: Terrain;
  readonly grid: Grid;
  readonly fxl: Effects;
  /** Debug and test handles: the shared air and occlusion uniforms. */
  readonly atmos = atmos;
  readonly occ = occUniforms;
  /** The raised ruin court whose floor channels carry the seam pulse. */
  private seamFloor: { x: number; z: number; y: number; r: number; net: SeamNet } | null = null;
  private ents = new Map<EntityId, Entity>();
  private mode: WorldMode = 'explore';
  private paused = false;
  private clock = new THREE.Timer();
  private t = 0;
  private hoverTile: Tile | null = null;
  private hoverEnt: EntityId | null = null;
  private pointer = new THREE.Vector2();
  private pointerIn = false;
  private raycaster = new THREE.Raycaster();
  private followId: EntityId | null = null;
  private nextAutoId = 1;
  private spawnSerial = 0;
  // adaptive resolution: slow frames lower the render scale, spare time raises it
  private frameAvg = 16;
  private scale = 1;
  private scaleCooldown = 0;
  private quality: 'high' | 'medium' | 'low' = 'high';
  private scaleMax = 1;

  constructor(private host: HTMLElement, private bus: Bus<WorldEvents>, bundle: LevelBundle) {
    this.level = bundle.data;
    const W = this.level.width, H = this.level.height;
    this.cam = new IsoCamera(host.clientWidth / Math.max(1, host.clientHeight));
    this.cam.bounds = { minX: 6, minZ: 3, maxX: W - 6, maxZ: H - 11 };
    this.r = new Renderer(host, this.cam.camera, bundle.sky.sunAzimuth, bundle.sky.sunElevation);
    this.terrain = new Terrain(W, H, bundle.features);
    this.r.scene.add(this.terrain.mesh);
    patchTree(this.terrain.mesh);
    // the land and skyline past the map, out to the horizon
    const far = buildFarGround(this.terrain);
    const backdrop = buildBackdrop(W, H, (x, z) => this.terrain.heightAt(x, z));
    this.r.scene.add(far, backdrop);
    patchTree(far); patchTree(backdrop);
    const cracks = buildScarCracks(this.terrain);
    if (cracks) { this.r.scene.add(cracks); patchTree(cracks); }
    this.grid = new Grid(W, H);

    const art = mergeStatic(buildLevelArt(bundle, this.terrain, this.grid));
    this.r.scene.add(art);
    patchTree(art);
    const cover = buildGroundCover(this.terrain, this.grid, 1, bundle.features.flatMap((f) => (f.t === 'clear' ? [f.rect] : [])));
    this.r.scene.add(cover);
    patchTree(cover);

    for (const f of bundle.features) if (f.t === 'floor-disc' && f.raise) this.seamFloor = { x: f.at[0], z: f.at[1], y: this.terrain.heightAt(f.at[0], f.at[1]), r: f.r, net: seamNetFor(f.r) };
    this.fxl = new Effects(host, (x, z) => this.terrain.heightAt(x, z), (p) => this.project(p));
    this.r.scene.add(this.fxl.group);
    for (const f of bundle.features) if (f.t === 'chasm') this.fxl.addHaze(-20, W + 20, f.rect[1] - 1, f.rect[1] + f.rect[3], -7, 0.2);

    for (const e of this.level.entities) {
      this.spawn(e.kind, e.tile, { id: e.id, facing: e.facing, faction: e.faction, name: e.name, tags: e.tags, colour: e.opts?.colour as CrystalColour | undefined, seed: e.opts?.seed as number | undefined, body: e.opts?.body as 'male' | 'female' | undefined, look: e.opts?.look as string | undefined });
      if (typeof e.opts?.state === 'string') this.setState(e.id, e.opts.state);
    }

    const sp = this.level.playerSpawn;
    this.cam.snapTo(this.tileToWorld(sp));
    this.bindInput();
    const q = new URLSearchParams(location.search).get('quality');
    if (q === 'low' || q === 'medium' || q === 'high') this.setQuality(q);
    // If the GPU drops us (driver reset, overload), let the browser restore the context instead of dying.
    const cv = this.r.renderer.domElement;
    cv.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); console.warn('[world] graphics context lost, waiting to restore'); });
    cv.addEventListener('webglcontextrestored', () => { console.warn('[world] graphics context restored'); this.r.renderer.compile(this.r.scene, this.cam.camera); });
    window.addEventListener('resize', () => this.resize());
    this.resize();

    this.ready = new Promise((res) => {
      // compile every shader now, so the first look at a new area does not stall
      this.r.renderer.compile(this.r.scene, this.cam.camera);
      requestAnimationFrame(() => { this.frame(); this.bus.emit('world:ready', { level: this.level }); res(); });
    });
  }

  // ================================================================ helpers

  tileToWorld(t: Tile, out = new THREE.Vector3()) {
    const x = t.x + 0.5, z = t.y + 0.5;
    return out.set(x, this.terrain.heightAt(x, z), z);
  }

  private resolveTarget(target: Tile | EntityId): THREE.Vector3 {
    if (typeof target === 'string') {
      const e = this.ents.get(target);
      return e ? e.pos.clone() : new THREE.Vector3();
    }
    return this.tileToWorld(target);
  }

  private project(p: THREE.Vector3): { x: number; y: number } | null {
    const v = p.clone().project(this.cam.camera);
    if (v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) return null;
    return { x: (v.x + 1) / 2 * this.host.clientWidth, y: (1 - v.y) / 2 * this.host.clientHeight };
  }

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.cam.setAspect(w / Math.max(1, h));
    this.r.resize(w, h);
  }

  // ================================================================ entities

  spawn(kind: EntityKind, tile: Tile, opts: { id?: EntityId; facing?: Facing; faction?: Faction; name?: string; tags?: string[]; colour?: CrystalColour; seed?: number; body?: 'male' | 'female'; look?: string } = {}): EntityId {
    const id = opts.id ?? `${kind}#${this.nextAutoId++}`;
    if (this.ents.has(id)) void this.despawn(id, 'instant');
    const isProp = kind.startsWith('prop-');
    const model = isProp
      ? buildProp(kind, { colour: opts.colour, seed: opts.seed ?? ++this.spawnSerial, look: opts.look })
      : buildCharacter(kind, { colour: opts.colour, seed: opts.seed ?? ++this.spawnSerial, body: opts.body, look: opts.look });
    const facing = opts.facing ?? 4;
    const tags = [...(opts.tags ?? [])];
    const hidden = tags.includes('hidden');
    const e: Entity = {
      id, kind, model, tile: { ...tile }, facing, faction: opts.faction ?? (isProp ? 'neutral' : 'neutral'),
      name: opts.name, tags, visible: !hidden, pos: this.tileToWorld(tile), yaw: facingToYaw(facing), yawGoal: facingToYaw(facing),
      path: [], speed: 3, stride: 0, occupying: null, zones: new Set(), anim: 'idle', isPlayer: kind.startsWith('player-'), isProp,
    };
    model.root.position.copy(e.pos);
    model.root.rotation.y = -e.yaw;
    model.root.visible = e.visible;
    model.root.userData.entityId = id;
    model.root.traverse((o: THREE.Object3D) => { o.userData.entityId = id; });
    this.r.scene.add(model.root);
    patchTree(model.root); // one light for people and places: haze, rim, mottling
    this.ents.set(id, e);
    if (e.visible) this.occupy(e, tile);
    if (!isProp) model.play('idle');
    if (kind === 'prop-symbol-door') this.applyDoorBlock(e, 'sealed');
    if (e.isPlayer) this.updateZones(e);
    return id;
  }

  async despawn(id: EntityId, how: 'instant' | 'fade' | 'sink' = 'instant'): Promise<void> {
    const e = this.ents.get(id);
    if (!e) return;
    if (how !== 'instant') {
      if (how === 'fade') {
        e.model.root.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
          if (!m) return;
          const clone = (x: THREE.Material) => { const c = x.clone(); c.transparent = true; return c; };
          (o as THREE.Mesh).material = Array.isArray(m) ? m.map(clone) : clone(m);
        });
      }
      await new Promise<void>((resolve) => { e.fading = { t: 0, dur: how === 'fade' ? 0.8 : 1.4, how, resolve }; });
    }
    this.release(e);
    if (e.move) { e.move.reject(new Error('despawned')); e.move = undefined; }
    if (e.kind === 'prop-symbol-door') this.grid.unblock(e.tile.x, e.tile.y);
    this.r.scene.remove(e.model.root);
    e.model.dispose?.();
    this.ents.delete(id);
    if (this.hoverEnt === id) { this.hoverEnt = null; this.bus.emit('entity:hover', { id: null }); }
    if (this.followId === id) this.follow(null);
    this.fxl.hideCone(id);
  }

  private info(e: Entity): EntityInfo {
    return { id: e.id, kind: e.kind, tile: { ...e.tile }, facing: e.facing, faction: e.faction, name: e.name, tags: [...e.tags], visible: e.visible };
  }
  get(id: EntityId) { const e = this.ents.get(id); return e ? this.info(e) : null; }
  all() { return [...this.ents.values()].map((e) => this.info(e)); }
  at(tile: Tile) { return [...this.ents.values()].filter((e) => e.tile.x === tile.x && e.tile.y === tile.y).map((e) => this.info(e)); }

  setVisible(id: EntityId, visible: boolean) {
    const e = this.ents.get(id);
    if (!e || e.visible === visible) return;
    e.visible = visible;
    e.model.root.visible = visible;
    if (visible) { e.tags = e.tags.filter((t) => t !== 'hidden'); this.occupy(e, e.tile); }
    else this.release(e);
  }

  setState(id: EntityId, state: string) {
    const e = this.ents.get(id);
    if (!e) return;
    e.state = state;
    e.model.setState?.(this.modelState(e.kind, state));
    if (state === "dead" && !e.isProp) { void this.playAnim(id, "die"); this.release(e); }
    if (e.kind === 'prop-symbol-door') this.applyDoorBlock(e, state);
  }

  /** The game speaks in story states; some models name them differently. */
  private modelState(kind: EntityKind, state: string) {
    if (kind === "guardian") return ({ asleep: "dormant", dead: "broken", friendly: "active", hostile: "active", awake: "active" } as Record<string, string>)[state] ?? state;
    if (kind === "telsharin") return ({ friendly: "awake", hostile: "awake" } as Record<string, string>)[state] ?? state;
    return state;
  }

  private applyDoorBlock(e: Entity, state: string) {
    // An open door must also stop occupying its tile, or paths still treat it as a solid prop (agent 2, user playtest).
    if (state === 'open') {
      this.grid.unblock(e.tile.x, e.tile.y);
      this.release(e);
    } else {
      this.grid.block(e.tile.x, e.tile.y, true);
      if (e.visible && !e.occupying) this.occupy(e, e.tile);
    }
  }

  private occupy(e: Entity, t: Tile) {
    this.release(e);
    // small props you can step around still block the tile, so paths go round them
    this.grid.occupy(t, 1);
    e.occupying = { ...t };
  }
  private release(e: Entity) {
    if (e.occupying) { this.grid.occupy(e.occupying, -1); e.occupying = null; }
  }

  // ================================================================ movement

  moveAlong(id: EntityId, path: Tile[], speed = 3): Promise<void> {
    const e = this.ents.get(id);
    if (!e) return Promise.reject(new Error('no such entity'));
    if (e.move) { const old = e.move; e.move = undefined; old.resolve(); } // a new order replaces the old one
    if (!path.length) return Promise.resolve();
    e.path = path.map((t) => ({ ...t }));
    e.speed = speed;
    return new Promise((resolve, reject) => { e.move = { resolve, reject }; this.setLoop(e, speed > 4.2 ? 'run' : e.anim === 'crouch' ? 'crouch' : 'walk'); });
  }

  place(id: EntityId, tile: Tile, facing?: Facing) {
    const e = this.ents.get(id);
    if (!e) return;
    e.path = [];
    e.tile = { ...tile };
    this.tileToWorld(tile, e.pos);
    e.model.root.position.copy(e.pos);
    if (facing !== undefined) { e.facing = facing; e.yaw = e.yawGoal = facingToYaw(facing); }
    if (e.visible) this.occupy(e, tile);
    if (e.isPlayer) this.updateZones(e);
  }

  face(id: EntityId, target: Tile | EntityId) {
    const e = this.ents.get(id);
    if (!e) return;
    const p = this.resolveTarget(target);
    const dx = p.x - e.pos.x, dz = p.z - e.pos.z;
    if (Math.abs(dx) + Math.abs(dz) < 1e-3) return;
    e.yawGoal = Math.atan2(dx, -dz);
    e.facing = yawToFacing(e.yawGoal);
  }

  stop(id: EntityId) {
    const e = this.ents.get(id);
    if (!e) return;
    // finish the step in progress so we stay on the grid, then stop
    e.path = e.path.slice(0, 1);
  }

  private stepEntity(e: Entity, dt: number) {
    if (!e.path.length) return;
    const next = e.path[0];
    const goal = this.tileToWorld(next);
    // starting a new step: claim the tile
    if (!e.occupying || e.occupying.x !== next.x || e.occupying.y !== next.y) {
      const free = this.grid.isFree(next.x, next.y) || (e.occupying && e.occupying.x === next.x && e.occupying.y === next.y);
      if (!free) {
        e.path = [];
        this.setLoop(e, 'idle');
        const m = e.move; e.move = undefined;
        m?.reject(new Error('blocked'));
        return;
      }
      this.occupy(e, next);
    }
    const d = goal.clone().sub(e.pos);
    const flat = Math.hypot(d.x, d.z);
    if (flat > 1e-3) { e.yawGoal = Math.atan2(d.x, -d.z); }
    const stepLen = e.speed * dt;
    if (flat <= stepLen) {
      e.pos.copy(goal);
      e.tile = { ...next };
      e.path.shift();
      e.facing = yawToFacing(e.yawGoal);
      if (e.isPlayer) this.updateZones(e);
      if (!e.path.length) {
        this.setLoop(e, e.anim === 'crouch' ? 'crouch' : 'idle');
        this.bus.emit('entity:arrived', { id: e.id, tile: { ...e.tile } });
        const m = e.move; e.move = undefined;
        m?.resolve();
      }
    } else {
      e.pos.x += (d.x / flat) * stepLen;
      e.pos.z += (d.z / flat) * stepLen;
      // dust at the feet, heavier for big things, none on stone
      e.stride += stepLen;
      const heavy = e.kind === 'telsharin';
      if (e.stride > (heavy ? 0.7 : 0.95)) {
        e.stride = 0;
        const k = this.terrain.kindAt(e.pos.x, e.pos.z);
        if (k !== 'plaza' && e.kind !== 'guardian' && e.visible) this.fxl.burst('dust', e.pos, undefined, heavy ? 0.6 : 0.22);
      }
      e.pos.y = this.terrain.heightAt(e.pos.x, e.pos.z);
    }
  }

  private updateZones(e: Entity) {
    const now = new Set<string>();
    for (const z of this.level.zones) {
      const r = z.rect;
      if (e.tile.x >= r.x && e.tile.x < r.x + r.w && e.tile.y >= r.y && e.tile.y < r.y + r.h) now.add(z.id);
    }
    for (const z of e.zones) if (!now.has(z)) this.bus.emit('zone:leave', { zoneId: z, id: e.id });
    for (const z of now) if (!e.zones.has(z)) this.bus.emit('zone:enter', { zoneId: z, id: e.id });
    e.zones = now;
  }

  // ================================================================ animation

  private setLoop(e: Entity, a: AnimName) {
    if (e.anim === a && e.animTimer === undefined) return;
    e.anim = a;
    e.animTimer = undefined;
    e.model.play(a);
  }

  playAnim(id: EntityId, anim: AnimName): Promise<void> {
    const e = this.ents.get(id);
    if (!e) return Promise.resolve();
    if (LOOPS.includes(anim)) { this.setLoop(e, anim); return Promise.resolve(); }
    const len = e.model.play(anim);
    e.anim = anim;
    return new Promise((res) => setTimeout(() => {
      if (e.anim === anim && anim !== 'die') e.anim = e.path.length ? 'walk' : 'idle';
      res();
    }, Math.max(0, len) * 1000));
  }

  // ================================================================ grid queries

  isWalkable(tile: Tile, ignoreEntities = false) { return this.grid.isFree(tile.x, tile.y, ignoreEntities); }
  findPath(from: Tile, to: Tile, opts?: { maxLength?: number; ignoreEntities?: boolean; adjacentOk?: boolean }) {
    // the mover's own tile must not block its own path
    const own = [...this.ents.values()].filter((e) => e.occupying && e.occupying.x === from.x && e.occupying.y === from.y);
    own.forEach((e) => this.grid.occupy(e.occupying!, -1));
    try { return findPath(this.grid, from, to, opts); }
    finally { own.forEach((e) => this.grid.occupy(e.occupying!, 1)); }
  }
  reachable(from: Tile, steps: number) { return reachable(this.grid, from, steps); }
  lineOfSight(a: Tile, b: Tile) { return this.grid.lineOfSight(a, b); }
  distance(a: Tile, b: Tile) { return chebyshev(a, b); }

  // ================================================================ effects

  private heightOf(target: Tile | EntityId) {
    if (typeof target === 'string') return this.ents.get(target)?.model.height ?? 1.6;
    return 1;
  }

  fx(kind: FxKind, at: Tile | EntityId, opts: { colour?: FxColour; intensity?: number; duration?: number } = {}) {
    this.fxl.burst(kind, this.resolveTarget(at), opts.colour, opts.intensity ?? 1, this.heightOf(at));
    if (kind === 'hit' || kind === 'shatter') this.cam.shake(0.18 * (opts.intensity ?? 1), 0.25);
  }

  bolt(from: EntityId, to: Tile | EntityId, opts: { colour?: FxColour; kind?: 'beam' | 'shard' | 'slug' } = {}) {
    const a = this.resolveTarget(from); a.y += this.heightOf(from) * 0.65;
    const b = this.resolveTarget(to); b.y += this.heightOf(to) * 0.55;
    return this.fxl.bolt(a, b, opts.colour ?? 'amber', opts.kind ?? 'slug');
  }

  /**
   * The activation code: a teal pulse runs along the ruin floor's channels, in to the nearest ring,
   * round it, and out along the spoke that points at the target. Off the court it runs straight.
   * Resolves when the pulse reaches `to`.
   */
  seamPulse(from: Tile | EntityId, to: Tile | EntityId, opts: { colour?: CrystalColour; duration?: number } = {}): Promise<void> {
    const a = this.resolveTarget(from), b = this.resolveTarget(to);
    const colour: FxColour = opts.colour ?? 'teal';
    const floor = this.seamFloor;
    let pts: THREE.Vector3[];
    if (floor && Math.hypot(a.x - floor.x, a.z - floor.z) <= floor.r + 0.5) {
      const path = seamPath(floor.net, new THREE.Vector2(a.x - floor.x, a.z - floor.z), new THREE.Vector2(b.x - floor.x, b.z - floor.z));
      pts = path.map((p) => new THREE.Vector3(p.x + floor.x, floor.y + 0.035, p.y + floor.z));
    } else {
      pts = [a, b].map((p) => p.clone().setY(this.terrain.heightAt(p.x, p.z) + 0.05));
    }
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
    return this.fxl.pulseLine(pts, opts.duration ?? Math.max(1.4, len / 7), colour);
  }

  floatText(id: EntityId, text: string, tone: 'good' | 'bad' | 'neutral' | 'crystal' = 'neutral') {
    const e = this.ents.get(id);
    if (!e) return;
    this.fxl.floatText(e.pos.clone().setY(e.pos.y + e.model.height + 0.3), text, tone);
  }

  highlight(targets: Array<Tile | EntityId>, style: HighlightStyle) {
    const pts = targets.map((t) => {
      if (typeof t === 'string') { const e = this.ents.get(t); return e ? this.tileToWorld(e.tile) : null; }
      return this.tileToWorld(t);
    }).filter((p): p is THREE.Vector3 => !!p);
    return this.fxl.highlight(pts, style);
  }
  clearHighlight(handle?: number) { this.fxl.clearHighlight(handle); }

  private cones = new Map<EntityId, { range: number; angle: number; alert: boolean }>();
  showSightCone(id: EntityId, range: number, angle: number, alert = false) { this.cones.set(id, { range, angle, alert }); }
  hideSightCone(id: EntityId) { this.cones.delete(id); this.fxl.hideCone(id); }

  // ================================================================ camera and mode

  follow(id: EntityId | null) {
    this.followId = id;
    this.cam.followFn = id ? () => this.ents.get(id)?.pos ?? null : null;
    if (id) this.cam.resetPan();
  }

  focus(target: Tile | EntityId, opts: { zoom?: number; duration?: number } = {}) {
    this.cam.resetPan();
    return this.cam.focus(this.resolveTarget(target), opts.zoom, opts.duration ?? 0.8);
  }

  shake(intensity = 0.3, duration = 0.35) { this.cam.shake(intensity, duration); }

  toScreen(target: Tile | EntityId) {
    const p = this.resolveTarget(target);
    p.y += this.heightOf(target) + 0.2;
    return this.project(p);
  }

  setMode(mode: WorldMode) {
    this.mode = mode;
    const c = this.r.renderer.domElement;
    c.style.cursor = mode === 'cutscene' ? 'default' : 'pointer';
    if (mode === 'cutscene' || mode === 'dialogue') { this.fxl.hover.visible = false; this.fxl.entityRing.visible = false; }
  }
  getMode() { return this.mode; }

  setMood(mood: 'normal' | 'tense' | 'memory' | 'dim', duration = 1.2) { this.r.setMood(mood, duration); }
  setPaused(p: boolean) { this.paused = p; }

  setQuality(q: 'high' | 'medium' | 'low') {
    this.quality = q;
    this.r.setShadowSize(q === 'high' ? 2048 : 1024);
    this.r.setBloom(q !== 'low');
    this.fxl.setAmbient(q !== 'low', q !== 'low');
    occUniforms.uCloudK.value = q === 'low' ? 0 : 0.1;
    atmos.uSurface.value = q === 'low' ? 0 : 1;
    this.r.setPaint(0);
    atmos.uMottle.value = q === 'low' ? 0.5 : 1;
    this.scaleMax = q === 'low' ? 0.75 : 1;
    this.scale = q === 'high' ? 1 : Math.min(this.scale, this.scaleMax);
    this.scaleCooldown = 0;
    const base = Math.min(window.devicePixelRatio, 1.5);
    this.r.renderer.setPixelRatio(base * this.scale);
    this.r.composer.setPixelRatio(base * this.scale);
  }
  getQuality() { return this.quality; }

  // ================================================================ input

  private bindInput() {
    const c = this.r.renderer.domElement;
    let drag: { x: number; y: number; moved: boolean; button: number } | null = null;
    c.addEventListener('contextmenu', (ev) => ev.preventDefault());
    c.addEventListener('pointermove', (ev) => {
      if (ev.pointerType === 'touch') return;
      const rect = c.getBoundingClientRect();
      this.pointer.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      this.pointerIn = true;
      if (drag && drag.button === 1) {
        this.cam.dragPan(ev.clientX - drag.x, ev.clientY - drag.y, rect.height);
        drag.x = ev.clientX; drag.y = ev.clientY; drag.moved = true;
      }
    });
    c.addEventListener('pointerleave', () => { this.pointerIn = false; });
    c.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'touch') return;
      drag = { x: ev.clientX, y: ev.clientY, moved: false, button: ev.button };
      if (ev.button === 1) ev.preventDefault();
    });
    c.addEventListener('pointerup', (ev) => {
      if (ev.pointerType === 'touch') return;
      const d = drag; drag = null;
      if (!d || d.button === 1 || d.moved) return;
      if (ev.button !== 0 && ev.button !== 2) return;
      const btn = ev.button as 0 | 2;
      this.pick();
      if (this.hoverEnt) this.bus.emit('entity:click', { id: this.hoverEnt, button: btn });
      else if (this.hoverTile) this.bus.emit('tile:click', { tile: { ...this.hoverTile }, button: btn, shift: ev.shiftKey });
    });
    this.bindTouch(c);
    c.addEventListener('wheel', (ev) => { ev.preventDefault(); this.cam.zoomBy(ev.deltaY > 0 ? 1 / 1.12 : 1.12); }, { passive: false });
    window.addEventListener('keydown', (ev) => {
      const tgt = ev.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (this.mode !== 'cutscene' && !ev.ctrlKey && !ev.metaKey) {
        if (ev.code === 'KeyQ') { this.cam.rotate(-1); return; }
        if (ev.code === 'KeyE') { this.cam.rotate(1); return; }
        if (ev.code === 'Equal' || ev.code === 'NumpadAdd') { this.cam.zoomBy(1.12); return; }
        if (ev.code === 'Minus' || ev.code === 'NumpadSubtract') { this.cam.zoomBy(1 / 1.12); return; }
      }
      this.bus.emit('key:down', { key: ev.key, code: ev.code });
    });
  }

  /**
   * Touch: one finger taps, two fingers pinch to zoom and drag to pan.
   * There is no hover on glass, so the first tap on a person or thing selects it
   * (the ring shows, entity:hover fires) and a second tap on the same one acts.
   * Tapping the ground acts at once.
   */
  private bindTouch(c: HTMLCanvasElement) {
    c.style.touchAction = 'none';
    const pts = new Map<number, { x: number; y: number; x0: number; y0: number }>();
    let pinch: { d: number; cx: number; cy: number } | null = null;
    let multi = false;
    let selected: EntityId | null = null;
    const setPointer = (x: number, y: number) => {
      const r = c.getBoundingClientRect();
      this.pointer.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      this.pointerIn = true;
    };
    const two = () => {
      const [a, b] = [...pts.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    };
    c.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType !== 'touch') return;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY });
      if (pts.size === 2) { multi = true; pinch = two(); }
    });
    c.addEventListener('pointermove', (ev) => {
      const p = pts.get(ev.pointerId);
      if (!p) return;
      p.x = ev.clientX; p.y = ev.clientY;
      if (pts.size === 2 && pinch) {
        const now = two();
        if (pinch.d > 0) this.cam.zoomBy(now.d / pinch.d);
        this.cam.dragPan(now.cx - pinch.cx, now.cy - pinch.cy, c.getBoundingClientRect().height);
        pinch = now;
      }
    });
    const end = (ev: PointerEvent) => {
      const p = pts.get(ev.pointerId);
      if (!p) return;
      pts.delete(ev.pointerId);
      if (pts.size < 2) pinch = null;
      if (multi) { if (pts.size === 0) multi = false; return; }
      if (ev.type === 'pointercancel' || Math.hypot(p.x - p.x0, p.y - p.y0) > 12) return;
      setPointer(ev.clientX, ev.clientY);
      this.pick();
      if (this.hoverEnt) {
        if (selected === this.hoverEnt) { this.bus.emit('entity:click', { id: this.hoverEnt, button: 0 }); selected = null; }
        else selected = this.hoverEnt;
      } else if (this.hoverTile) {
        selected = null;
        this.bus.emit('tile:click', { tile: { ...this.hoverTile }, button: 0, shift: false });
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);

    // camera turn buttons, only where the main pointer is a finger
    if (window.matchMedia?.('(pointer: coarse)').matches) {
      const bar = document.createElement('div');
      Object.assign(bar.style, { position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '8px', zIndex: '5' });
      for (const [label, dir] of [['↺', -1], ['↻', 1]] as const) {
        const b = document.createElement('button');
        b.textContent = label;
        b.setAttribute('aria-label', dir < 0 ? 'Turn camera left' : 'Turn camera right');
        Object.assign(b.style, { width: '48px', height: '48px', borderRadius: '24px', border: '1px solid rgba(230,210,170,.45)', background: 'rgba(30,20,16,.7)', color: '#f1dfbd', fontSize: '22px' });
        b.addEventListener('click', () => this.cam.rotate(dir));
        bar.appendChild(b);
      }
      this.host.appendChild(bar);
    }
  }

  /** Update what is under the pointer. Entities win over ground. */
  private pick() {
    if (!this.pointerIn) return;
    this.raycaster.setFromCamera(this.pointer, this.cam.camera);
    let hitEnt: EntityId | null = null;
    if (this.mode !== 'cutscene') {
      const targets: THREE.Object3D[] = [];
      for (const e of this.ents.values()) {
        if (!e.visible || e.isPlayer || e.fading) continue;
        if (e.model.pickables) targets.push(...e.model.pickables); else targets.push(e.model.root);
      }
      const hits = this.raycaster.intersectObjects(targets, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o && !o.userData.entityId) o = o.parent;
        if (o) { hitEnt = o.userData.entityId; break; }
      }
    }
    // ground: intersect y = h(x, z) by fixed-point iteration on horizontal planes
    const ray = this.raycaster.ray;
    let h = 0, p = new THREE.Vector3();
    for (let i = 0; i < 5; i++) {
      const t = (h - ray.origin.y) / ray.direction.y;
      p = ray.origin.clone().addScaledVector(ray.direction, t);
      h = this.terrain.heightAt(p.x, p.z);
    }
    const tx = Math.floor(p.x), ty = Math.floor(p.z);
    const tile = tx >= 0 && ty >= 0 && tx < this.level.width && ty < this.level.height ? { x: tx, y: ty } : null;

    if (hitEnt !== this.hoverEnt) { this.hoverEnt = hitEnt; this.bus.emit('entity:hover', { id: hitEnt }); }
    if ((tile?.x !== this.hoverTile?.x) || (tile?.y !== this.hoverTile?.y)) { this.hoverTile = tile; this.bus.emit('tile:hover', { tile }); }
  }

  // ================================================================ frame

  private frame = () => {
    requestAnimationFrame(this.frame);
    this.clock.update();
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;
    const gdt = this.paused ? 0 : dt;

    this.pick();

    for (const e of [...this.ents.values()]) {
      this.stepEntity(e, gdt);
      // ease the turn
      let dy = e.yawGoal - e.yaw;
      while (dy > Math.PI) dy -= 2 * Math.PI;
      while (dy < -Math.PI) dy += 2 * Math.PI;
      e.yaw += dy * Math.min(1, gdt * 10);
      e.model.root.position.copy(e.pos);
      e.model.root.rotation.y = -e.yaw;
      e.model.update(gdt, this.t);
      if (e.fading) {
        const f = e.fading;
        f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        if (f.how === 'sink') e.model.root.position.y = e.pos.y - k * (e.model.height + 0.3);
        else e.model.root.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
          if (!m) return;
          (Array.isArray(m) ? m : [m]).forEach((x) => { x.opacity = 1 - k; });
        });
        if (k >= 1) { e.fading = undefined; f.resolve(); }
      }
      const cone = this.cones.get(e.id);
      if (cone) this.fxl.showCone(e.id, e.pos, e.yaw, cone.range, cone.angle, cone.alert);
    }

    // hover visuals
    const showHover = this.mode === 'explore' || this.mode === 'combat';
    if (showHover && this.hoverEnt && this.ents.get(this.hoverEnt)) {
      const e = this.ents.get(this.hoverEnt)!;
      this.fxl.entityRing.visible = true;
      this.fxl.entityRing.position.set(e.pos.x, e.pos.y + 0.05, e.pos.z);
      const hostile = e.faction === 'hostile';
      (this.fxl.entityRing.material as THREE.MeshBasicMaterial).color.set(hostile ? 0xff6a3a : 0xffd27a);
      this.fxl.entityRing.scale.setScalar(e.kind === 'telsharin' || e.kind === 'guardian' || e.kind === 'defender' ? 1.5 : 1);
      this.fxl.hover.visible = false;
    } else {
      this.fxl.entityRing.visible = false;
      if (showHover && this.hoverTile) {
        const p = this.tileToWorld(this.hoverTile);
        this.fxl.hover.visible = true;
        this.fxl.hover.position.set(p.x, p.y + 0.05, p.z);
        (this.fxl.hover.material as THREE.MeshBasicMaterial).color.set(this.grid.isFree(this.hoverTile.x, this.hoverTile.y) ? 0xffe2a8 : 0x8a5a4a);
      } else this.fxl.hover.visible = false;
    }

    this.cam.update(dt);
    this.r.followShadow(this.cam.target, this.cam.forward().multiplyScalar(6 + 10 * (1 - Math.sin(this.cam.pitch()))));
    this.r.update(dt, this.t, this.cam.camera);
    this.fxl.update(dt, this.t, this.cam.target);
    // points look the same size at every zoom
    const dpr = this.r.renderer.getPixelRatio();
    this.fxl.setPointScale(dpr * (8 / this.cam.halfHeight()));
    this.updateOcclusion(dt);
    this.adaptResolution(dt);
    this.r.render();
  };

  private adaptResolution(dt: number) {
    // The user asked for no automatic quality cuts, so High always renders at full resolution.
    if (this.quality === 'high') return;
    this.frameAvg += (dt * 1000 - this.frameAvg) * 0.05;
    if ((this.scaleCooldown -= dt) > 0) return;
    const base = Math.min(window.devicePixelRatio, 1.5);
    let next = this.scale;
    if (this.frameAvg > 30 && this.scale > 0.6) next = Math.max(this.quality === 'low' ? 0.6 : 0.75, this.scale - 0.05);
    else if (this.frameAvg < 17 && this.scale < this.scaleMax) next = Math.min(this.scaleMax, this.scale + 0.05);
    if (next !== this.scale) {
      this.scale = next;
      this.r.renderer.setPixelRatio(base * next);
      this.r.composer.setPixelRatio(base * next);
      this.scaleCooldown = 2;
    }
  }

  private occFade = 0;
  /**
   * The see-through circle opens only when solid scenery really stands between the camera and the
   * player (user playtest: a circle over open ground cut heads and lamps for no reason). Walk from
   * the player's head towards the camera over the grid, and compare each tile's recorded top with
   * the sight line. The circle fades in and out rather than popping.
   */
  private updateOcclusion(dt = 0.016) {
    const pl = [...this.ents.values()].find((e) => e.isPlayer && e.visible);
    occUniforms.uCloudT.value = this.t;
    if (!pl) { occUniforms.uOccOn.value = 0; return; }
    const head = pl.pos.clone(); head.y += 1.0;
    const cp = this.cam.camera.position;
    const dx = cp.x - head.x, dz = cp.z - head.z, flat = Math.hypot(dx, dz) || 1;
    const slope = (cp.y - head.y) / flat;
    let hidden = false;
    for (let s = 0.7; s < Math.min(14, flat); s += 0.35) {
      const x = head.x + (dx / flat) * s, z = head.z + (dz / flat) * s;
      if (this.grid.topAt(Math.floor(x), Math.floor(z)) > head.y + s * slope - 0.2) { hidden = true; break; }
    }
    this.occFade += ((hidden ? 1 : 0) - this.occFade) * Math.min(1, dt * 7);
    const v = head.clone().project(this.cam.camera);
    const dpr = this.r.renderer.getPixelRatio();
    const W = this.host.clientWidth * dpr, H = this.host.clientHeight * dpr;
    occUniforms.uOccOn.value = this.occFade > 0.03 ? 1 : 0;
    occUniforms.uOccCentre.value.set((v.x + 1) / 2 * W, (v.y + 1) / 2 * H);
    // wide enough to clear a tower column standing right in front of the player (walk-through, ruin fight)
    occUniforms.uOccRadius.value = Math.max(1, 230 * dpr * (8 / this.cam.halfHeight()) * this.occFade);
    occUniforms.uOccDepth.value = head.applyMatrix4(this.cam.camera.matrixWorldInverse).z;
    occUniforms.uOccMinY.value = pl.pos.y + 0.35;
  }

}
