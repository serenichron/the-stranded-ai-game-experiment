// The game controller. Owns the state, reads world events, runs scripts, and hands fights to Combat.

import type { Bus, EntityId, EntityInfo, IWorld, Tile, WorldEvents } from '../core/contracts';
import type { UI, HudState, Tone } from '../ui/types';
import type { Ctx } from '../story/types';
import { audio } from '../audio';
import { voice } from '../audio/voice';
import { DIALOGUES, BARKS } from '../story/dialogues';
import { LOOK } from '../story/look';
import { runDialogue } from './dialogue';
import {
  GameState,
  ITEMS,
  addCrystal,
  addItem,
  crystal,
  flag,
  hasItem,
  quest,
  rngFor,
  saveGame,
  markLive,
  loadGame,
  setFlag,
  takeItem,
} from './state';
import { Rng, Band } from '../rules/dice';
import { check, CheckSpec } from '../rules/check';
import { RACE_LABEL, ROLE_LABEL, SPEC_LABEL, STAT_LABEL, Spec, Stat } from '../rules/character';
import { ABILITIES, Ability, abilitiesFor, bestSpec } from '../rules/abilities';
import { ENEMIES, EnemyKind, moveRange } from '../rules/combat';
import { healOne, refillGuard, takeWound, woundPenalty, Severity, freshWounds } from '../rules/wounds';
import { Combat } from './combat';
import { buildEnding } from './ending';

const ENEMY_KIND: Record<string, EnemyKind> = {
  telsharin: 'telsharin',
  guardian: 'drone',
  drone: 'drone',
  defender: 'defender',
  dog: 'dog',
  'npc-scavenger': 'scavenger',
};

export interface EnemyRuntime {
  id: EntityId;
  kind: EnemyKind;
  harm: number; // harm taken
  home: Tile;
  homeFacing: number;
  asleep: boolean;
  dead: boolean;
  friendly: boolean;
  // stealth
  suspiciousUntil: number;
  ignoreUntil: number;
  patrol?: Tile[];
  patrolIdx: number;
  busy: boolean;
  /** The woken Iskari after a collapse: back at its post, awake, guarding the court. */
  guarding?: boolean;
}

export class Game {
  s: GameState;
  rng: Rng;
  seen = new Set<string>();
  enemies = new Map<EntityId, EnemyRuntime>();
  combat: Combat | null = null;
  busy = false; // a dialogue or cutscene is running
  sneaking = false;
  hidden = false; // Iskari stillness / slip away in explore
  nextRollBonus = 0;
  cooldowns: Record<string, number> = {};
  private moveToken = 0;
  private talkFocus: EntityId | null = null;
  private offs: Array<() => void> = [];
  private tickTimer = 0;
  private autoTimer = 0;
  private lastTick = performance.now();
  private region = '';
  private ended = false;
  private rollLock: Promise<unknown> = Promise.resolve();
  private onQuit: () => void;

  constructor(
    public world: IWorld,
    public bus: Bus<WorldEvents>,
    public ui: UI,
    state: GameState,
    onQuit: () => void,
  ) {
    this.s = state;
    this.rng = rngFor(state);
    this.onQuit = onQuit;
    this.seen = new Set((state.flags.__seen as string | undefined)?.split('|').filter(Boolean) ?? []);
  }

  // ---------------------------------------------------------------- lifecycle

  async start(fresh: boolean) {
    const w = this.world;
    const lvl = w.level;
    const tile = this.s.playerTile ?? lvl.playerSpawn;
    if (!w.get('player')) {
      w.spawn(`player-${this.s.character.race}` as any, tile, {
        body: this.s.character.body ?? 'male',
        look: this.s.character.role,
        id: 'player',
        faction: 'player',
        name: this.s.character.name,
        facing: lvl.playerFacing ?? 0,
      });
    } else w.place('player', tile);
    w.follow('player');
    w.setMode('explore');
    w.setMood('normal', 0.1);

    // Enemies from the level.
    for (const e of lvl.entities) {
      const kind = ENEMY_KIND[e.kind];
      // the woken Iskari starts neutral and dormant in its niche: it is an enemy only once it wakes
      if (!kind || (e.faction !== 'hostile' && kind !== 'defender')) continue;
      this.enemies.set(e.id, {
        id: e.id,
        kind,
        harm: this.s.enemyHarm[e.id] ?? 0,
        home: { ...e.tile },
        homeFacing: e.facing ?? 0,
        asleep: kind === 'defender',
        dead: false,
        friendly: false,
        suspiciousUntil: 0,
        ignoreUntil: 0,
        patrol: (e.opts?.patrol as Tile[] | undefined) ?? undefined,
        patrolIdx: 0,
        busy: false,
      });
    }
    this.restoreEntityStates();
    if (this.s.flags.__narration === 'off') voice.setEnabled(false);
    const q = this.s.flags.__quality;
    if (q === 'high' || q === 'medium' || q === 'low') w.setQuality(q);

    this.offs.push(
      this.bus.on('tile:click', (e) => this.onTileClick(e.tile, e.button)),
      this.bus.on('entity:click', (e) => this.onEntityClick(e.id, e.button)),
      this.bus.on('entity:hover', (e) => this.onHover(e.id)),
      this.bus.on('zone:enter', (e) => e.id === 'player' && this.onZone(e.zoneId)),
      this.bus.on('key:down', (e) => this.onKey(e.key, e.code)),
      this.bus.on('entity:arrived', (e) => {
        if (e.id === 'player') this.s.playerTile = { ...e.tile };
      }),
    );

    this.ui.setMenu({
      onSave: async () => this.save(true),
      onLoad: async () => {
        const st = await loadGame();
        if (!st) return 'No save found.';
        this.dispose();
        location.hash = 'continue';
        location.reload();
        return 'Loading...';
      },
      onQuitToTitle: () => {
        void this.save(false);
        markLive(false);
        this.dispose();
        this.onQuit();
      },
      storageNote: 'Saves go to the saves folder inside the game folder while the dev server runs.',
      narration: {
        get: () => voice.enabled,
        set: (on) => {
          voice.setEnabled(on);
          this.s.flags.__narration = on ? 'on' : 'off';
        },
      },
      quality: {
        get: () => this.world.getQuality(),
        set: (q) => {
          this.world.setQuality(q);
          this.s.flags.__quality = q;
          this.toast(`Graphics: ${q}.`, 'neutral');
        },
      },
    });

    this.ui.onHudAction((a) => {
      if (this.combat || this.busy) return;
      if (a === 'sneak') return this.setSneak(!this.sneaking);
      const ab = ABILITIES[a.ability];
      if (ab) void this.exploreAbility(ab);
    });
    this.ui.showHud(true);
    this.refresh();
    this.tickTimer = window.setInterval(() => this.tick(), 200);
    // Autosave: every 30 seconds out of combat, and whenever the tab is hidden or closed.
    this.autoTimer = window.setInterval(() => this.autosave(), 30000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') this.autosave();
    };
    const onLeave = () => this.autosave();
    document.addEventListener('visibilitychange', onHide);
    const onPointer = (ev: PointerEvent) => { this.pointer.x = ev.clientX; this.pointer.y = ev.clientY; };
    window.addEventListener('pointermove', onPointer);
    this.offs.push(() => window.removeEventListener('pointermove', onPointer));
    window.addEventListener('pagehide', onLeave);
    this.offs.push(
      () => document.removeEventListener('visibilitychange', onHide),
      () => window.removeEventListener('pagehide', onLeave),
    );
    markLive(true);
    audio.setMusic('explore', 3);

    if (fresh) {
      this.busy = true;
      await this.ui.narrate(
        [
          'The star never climbs higher than this. It hangs low and red over the Ash Reach, and every shadow is long.',
          'You came to this salvage camp because an Iskari asked for you by name.',
          'He is waiting by his tent. He has been waiting a long time. It is what Iskari do.',
        ],
        { title: "The Keeper's errand" },
      );
      this.busy = false;
      this.ui.toast('Left click to walk and talk. Press H for help.', 'neutral');
      quest(this.s, 'errand', "The Keeper's errand", 'An Iskari in the salvage camp asked for me by name. He waits by his tent.');
      this.refresh();
    }
  }

  dispose() {
    window.clearInterval(this.tickTimer);
    window.clearInterval(this.autoTimer);
    this.offs.forEach((f) => f());
    this.offs = [];
    this.combat?.abort();
    this.ui.showHud(false);
    this.ui.combatBar(null);
  }

  private restoreEntityStates() {
    for (const [id, st] of Object.entries(this.s.entityState)) {
      if (st === 'gone') {
        if (this.world.get(id)) void this.world.despawn(id, 'instant');
        const en = this.enemies.get(id);
        if (en) en.dead = true;
        continue;
      }
      // a save taken mid-wake resumes awake
      const st2 = st === 'waking' ? 'awake' : st;
      this.world.setState(id, st2);
      const en = this.enemies.get(id);
      if (en && st2 === 'asleep') en.asleep = true;
      if (en && st2 === 'dead') en.dead = true;
      if (en && st2 === 'friendly') en.friendly = true;
      if (en && en.kind === 'defender' && st2 === 'awake') {
        en.asleep = false;
        en.guarding = flag(this.s, 'defenderGuarding');
      }
    }
    // The drone leaves an Iskari alone unless the Iskari attacks it (agent B's call, DESIGN.md).
    const drone = this.drone();
    if (drone && !flag(this.s, 'droneAttacked') && (flag(this.s, 'guardianFriendly') || this.s.character.race === 'iskari')) drone.friendly = true;
    for (const [id, spawn] of Object.entries(this.s.flags)) {
      if (id.startsWith('__spawn:') && typeof spawn === 'string') {
        /* reserved for spawned entities; none persist across saves yet */
      }
    }
  }

  /** The ruin's repair drone. Old saves and levels call it guardian1. */
  drone(): EnemyRuntime | undefined {
    return this.enemies.get('drone1') ?? this.enemies.get('guardian1');
  }

  defender(): EnemyRuntime | undefined {
    return this.enemies.get('defender1');
  }

  setEntityState(id: string, st: string) {
    this.s.entityState[id] = st;
    if (st === 'gone') return;
    this.world.setState(id, st);
  }

  async removeEntity(id: string, how: 'instant' | 'fade' | 'sink' = 'fade') {
    this.s.entityState[id] = 'gone';
    if (this.world.get(id)) await this.world.despawn(id, how);
  }

  // ---------------------------------------------------------------- HUD

  refresh() {
    const s = this.s;
    const c = s.character;
    const abil = abilitiesFor(c).map((a, i) => ({
      id: a.id,
      name: a.name,
      desc: a.desc,
      key: String(i + 1),
      cooldown: this.cooldowns[a.id] ?? 0,
      disabled: this.abilityBlock(a) ?? undefined,
      rollLabel: this.rollLabel(a),
    }));
    const hud: HudState = {
      name: c.name,
      race: c.race,
      role: c.role,
      raceLabel: RACE_LABEL[c.race],
      roleLabel: ROLE_LABEL[c.role],
      wounds: { light: s.wounds.light, moderate: s.wounds.moderate, severe: s.wounds.severe },
      guard: s.wounds.guard,
      guardMax: s.wounds.guardMax,
      penalty: woundPenalty(s.wounds),
      crystals: s.crystals.filter((x) => x.integrity > 0).map((x) => ({ colour: x.colour, integrity: x.integrity })),
      abilities: abil,
      sneaking: this.sneaking,
      objective: s.objective,
      mode: this.combat ? 'combat' : this.busy ? 'dialogue' : 'explore',
    };
    this.ui.updateHud(hud);
    this.ui.setJournal(s.quests.map((q) => ({ id: q.id, title: q.title, lines: q.lines, done: q.done })));
    this.ui.setInventory(
      Object.entries(s.items).map(([id, n]) => {
        const d = ITEMS[id] ?? { id, name: id, desc: '', usable: false };
        return { id, name: d.name, count: n, desc: d.desc, usable: d.usable && !this.combat, quest: d.quest };
      }).concat(
        s.crystals
          .filter((x) => x.integrity > 0)
          .map((x) => ({
            id: 'crystal:' + x.colour,
            name: `${x.colour[0].toUpperCase()}${x.colour.slice(1)} crystal`,
            count: 1,
            desc: CRYSTAL_DESC[x.colour] + ` Integrity ${x.integrity} of 3.`,
            usable: this.crystalUsable(x.colour),
            quest: false,
          })),
      ),
      (id) => void this.useItem(id),
    );
    const lines = [
      `Guard: ${s.wounds.guard} of ${s.wounds.guardMax}`,
      `Move in combat: ${moveRange(c)} tiles`,
      `Rolls made: ${s.rollsMade}`,
    ];
    this.ui.setCharacter(c, { lines });
  }

  rollLabel(a: Ability): string | undefined {
    if (!a.roll) return undefined;
    const spec = bestSpec(this.s.character, a.roll.specs);
    const mod = this.s.character.stats[a.roll.stat] + (spec ? (this.s.character.specs[spec] ?? 0) : 0);
    return `${STAT_LABEL[a.roll.stat]}${spec ? ' + ' + SPEC_LABEL[spec] : ''} (${mod >= 0 ? '+' : ''}${mod})`;
  }

  abilityBlock(a: Ability): string | null {
    if ((this.cooldowns[a.id] ?? 0) > 0) return `Ready in ${this.cooldowns[a.id]} turn(s).`;
    if (a.crystal && this.s.character.race === 'sehari' && !crystal(this.s, a.crystal)) return `You have no whole ${a.crystal} crystal.`;
    if (a.id === 'keeperFocus' && !hasItem(this.s, 'focus')) return 'You have no focus.';
    return null;
  }

  crystalUsable(colour: string) {
    if (this.s.character.race === 'sehari') return false; // Sehari channel them through abilities
    return colour === 'crimson' || colour === 'amber';
  }

  toast(text: string, tone: Tone = 'neutral') {
    this.ui.toast(text, tone);
  }

  objective(text: string) {
    this.s.objective = text;
    this.ui.toast(text, 'quest');
    audio.sfx('quest');
    this.refresh();
  }

  // ---------------------------------------------------------------- rolls

  /** One check through the dice panel. Serialised so two rolls never overlap on screen. */
  async roll(spec: CheckSpec): Promise<ReturnType<typeof check>> {
    const run = async () => {
      if (this.nextRollBonus) {
        spec = { ...spec, bonus: (spec.bonus ?? 0) + this.nextRollBonus, bonusLabel: spec.bonusLabel ?? 'Steady' };
        this.nextRollBonus = 0;
      }
      const r = check(this.rng, this.s.character, this.s.wounds, spec);
      this.s.rollsMade++;
      audio.sfx('dice-roll');
      await this.ui.roll(r);
      audio.sfx(r.band);
      this.world.floatText('player', `${r.total} ${r.bandText?.[r.band] ?? (r.band === 'full' ? 'full' : r.band === 'partial' ? 'partial' : 'miss')}`, r.band === 'full' ? 'good' : r.band === 'partial' ? 'neutral' : 'bad');
      return r;
    };
    const p = this.rollLock.then(run, run);
    this.rollLock = p.catch(() => undefined);
    return p;
  }

  async rollCheck(o: { stat: Stat; spec?: Spec; bonus?: number; label: string }): Promise<Band> {
    const r = await this.roll({ stat: o.stat, spec: o.spec, bonus: o.bonus, label: o.label });
    return r.band;
  }

  // ---------------------------------------------------------------- harm

  async wound(sev: Severity, reason?: string) {
    const r = takeWound(this.s.wounds, sev);
    this.world.fx('wound', 'player');
    this.world.shake(0.3, 0.25);
    if (r.kind === 'collapse') {
      await this.collapse();
      return;
    }
    audio.sfx('wound');
    this.world.floatText('player', `${cap(sev)} wound`, 'bad');
    this.toast(reason ? `${reason} ${cap(sev)} wound.` : `${cap(sev)} wound.`, 'bad');
    this.refresh();
  }

  async collapse() {
    audio.sfx('collapse');
    this.combat?.abort();
    this.combat = null;
    this.busy = true;
    this.s.collapses++;
    void this.world.playAnim('player', 'die');
    await this.ui.fade('black', 1200);
    this.ui.combatBar(null);
    // Canon: a fourth wound is a narrative cost, never a game over.
    const lost = this.loseSomething();
    const told = this.ui.narrate(
      [
        'The world tips sideways. The sand comes up to meet you.',
        'Voices. Hands under your arms. The smell of Mother Tarn\'s stew.',
        'You wake in the camp with your head bandaged. ' + lost,
      ],
      { title: 'You fall' },
    );
    await this.ui.fade('clear', 800);
    await told;
    await this.ui.fade('black', 400);
    this.s.wounds = freshWounds(this.s.wounds.guardMax);
    this.s.wounds.light = true;
    for (const en of this.enemies.values()) {
      if (en.dead || en.asleep) continue;
      en.harm = 0;
      this.s.enemyHarm[en.id] = 0;
      if (this.world.get(en.id)) this.world.place(en.id, en.home, en.homeFacing as any);
      if (en.kind === 'defender') {
        // it goes back to its post and stands guard, awake. The court is its to keep now.
        en.guarding = true;
        setFlag(this.s, 'defenderGuarding');
      }
    }
    this.world.place('player', this.world.level.playerSpawn);
    this.s.playerTile = { ...this.world.level.playerSpawn };
    this.world.setMode('explore');
    this.world.setMood('normal', 0.5);
    audio.setMusic('explore', 2);
    void this.world.playAnim('player', 'idle');
    await this.ui.fade('clear', 900);
    this.busy = false;
    this.refresh();
    const tarn = pickBark('collapse:tarn');
    if (tarn && this.world.get('npc-cook')) this.ui.bark(this.world.toScreen('npc-cook'), 'Mother Tarn', tarn, 5200);
  }

  private loseSomething(): string {
    const cr = this.s.crystals.find((c) => c.integrity > 0 && this.s.character.race !== 'sehari');
    if (hasItem(this.s, 'water')) {
      takeItem(this.s, 'water');
      return 'Your water gourd is gone. Someone drank it while you slept.';
    }
    if (hasItem(this.s, 'aloe')) {
      takeItem(this.s, 'aloe');
      return 'They used your dust-aloe on you. It is gone.';
    }
    if (cr) {
      cr.integrity = 0;
      return `Your ${cr.colour} crystal is missing. Nobody saw who took it.`;
    }
    return 'Your pack is lighter. You cannot remember what was in it. That frightens you more than the wound.';
  }

  // ---------------------------------------------------------------- input

  private onKey(key: string, code: string) {
    const k = key.toLowerCase();
    if (k === 'escape') {
      if (!this.ui.closePanels()) this.ui.togglePanel('menu');
      return;
    }
    if (k === 'j') return this.ui.togglePanel('journal');
    if (k === 'i') return this.ui.togglePanel('inventory');
    if (k === 'k') return this.ui.togglePanel('character');
    if (k === 'h' || k === '?') return this.ui.togglePanel('help');
    if (k === 'n') {
      voice.setEnabled(!voice.enabled);
      this.s.flags.__narration = voice.enabled ? 'on' : 'off';
      return this.toast(voice.enabled ? 'Narration on.' : 'Narration off.', 'neutral');
    }
    if (this.combat) {
      this.combat.onKey(k, code);
      return;
    }
    if (this.busy) return;
    if (k === 'c') {
      this.setSneak(!this.sneaking);
      return;
    }
    if (/^[1-5]$/.test(k)) {
      const a = abilitiesFor(this.s.character)[Number(k) - 1];
      if (a) void this.exploreAbility(a);
    }
    if (k === 'f5') void this.save(true);
  }

  setSneak(on: boolean) {
    this.sneaking = on;
    void this.world.playAnim('player', on ? 'crouch' : 'idle');
    this.toast(on ? 'Sneaking. You move slowly and roll Stealth when seen.' : 'Walking normally. Enemies who see you will attack.', 'neutral');
    this.updateCones();
    this.refresh();
  }

  /** What the pointer last hovered, and where the pointer is: the camera can move the thing away without a mouse move. */
  private hoverId: EntityId | null = null;
  private pointer = { x: -1e4, y: -1e4 };

  /** Clear a hover label whose entity is no longer under the pointer (walk-through bug, phase 2). */
  private checkHover() {
    if (!this.hoverId) return;
    const at = this.world.toScreen(this.hoverId);
    if (!at || Math.hypot(at.x - this.pointer.x, at.y - this.pointer.y) > 280) this.onHover(null); // generous: the anchor is above the head
  }

  private onHover(id: EntityId | null) {
    this.hoverId = id;
    if (!id) return this.ui.hoverLabel(null);
    const e = this.world.get(id);
    if (!e) return this.ui.hoverLabel(null);
    const en = this.enemies.get(id);
    if (en) {
      const def = ENEMIES[en.kind];
      const st = en.dead ? 'Dead' : en.asleep ? 'Asleep' : en.friendly ? 'Watching' : `Harm ${en.harm} of ${def.harm}`;
      return this.ui.hoverLabel(def.name, st);
    }
    if (id === 'player') return this.ui.hoverLabel(this.s.character.name, `${RACE_LABEL[this.s.character.race]} ${ROLE_LABEL[this.s.character.role]}`);
    this.ui.hoverLabel(displayName(id, e), e.faction === 'neutral' ? 'Click to interact' : undefined);
  }

  private onTileClick(tile: Tile, button: number) {
    if (this.combat) return this.combat.onTileClick(tile);
    if (this.busy || button !== 0) return;
    void this.walkTo(tile);
  }

  private onEntityClick(id: EntityId, button: number) {
    if (this.combat) return this.combat.onEntityClick(id);
    if (this.busy) return;
    if (button === 2) {
      const e = this.world.get(id);
      const en = this.enemies.get(id);
      // a sleeping stone figure is not an enemy yet: never spoil it with the fight blurb
      const text = en && !(en.kind === 'defender' && en.asleep) ? ENEMIES[en.kind].blurb : LOOK[id];
      if (text) {
        this.toast(text, 'neutral');
        void voice.say(text, 'narrator');
      } else if (e) this.toast(displayName(id, e), 'neutral');
      return;
    }
    const en = this.enemies.get(id);
    if (en && !en.dead && !en.asleep && !en.friendly) {
      // Clicking an awake enemy starts a fight on your terms.
      void this.startCombat([id], false);
      return;
    }
    void this.interact(id);
  }

  async walkTo(tile: Tile, adjacentOk = false): Promise<boolean> {
    const me = this.world.get('player');
    if (!me) return false;
    const token = ++this.moveToken;
    const path = this.world.findPath(me.tile, tile, { adjacentOk });
    if (!path) {
      if (!adjacentOk) this.world.fx('miss', tile);
      return false;
    }
    if (path.length === 0) return true;
    this.world.stop('player');
    const speed = this.sneaking ? 2.2 : 4.2;
    try {
      await this.world.moveAlong('player', path, speed);
    } catch {
      return false;
    }
    if (token !== this.moveToken) return false;
    const now = this.world.get('player');
    if (now) this.s.playerTile = { ...now.tile };
    return true;
  }

  async interact(id: EntityId) {
    const e = this.world.get(id);
    const me = this.world.get('player');
    if (!e || !me) return;
    if (this.world.distance(me.tile, e.tile) > 1) {
      const ok = await this.walkTo(e.tile, true);
      if (!ok) return;
      const me2 = this.world.get('player');
      if (!me2 || this.world.distance(me2.tile, e.tile) > 1) return;
    }
    this.world.face('player', id);
    const script = this.world.level.entities.find((x) => x.id === id)?.script ?? id;
    this.talkFocus = id;
    try {
      await this.runScript(script, id);
    } finally {
      this.talkFocus = null;
    }
  }

  // ---------------------------------------------------------------- dialogue

  ctx(): Ctx {
    const g = this;
    const c: Ctx = {
      s: g.s,
      race: g.s.character.race,
      has: (i) => hasItem(g.s, i),
      flag: (k) => flag(g.s, k),
      set: (k, v) => setFlag(g.s, k, v ?? true),
      give: (i, n = 1) => {
        addItem(g.s, i, n);
        audio.sfx('pickup');
        g.refresh();
      },
      take: (i, n = 1) => {
        const ok = takeItem(g.s, i, n);
        g.refresh();
        return ok;
      },
      crystal: (col) => {
        addCrystal(g.s, col);
        audio.sfx('pickup');
        g.refresh();
      },
      hasCrystal: (col) => !!crystal(g.s, col),
      quest: (id, title, line, done) => {
        quest(g.s, id, title, line, done);
        g.refresh();
      },
      objective: (t) => g.objective(t),
      toast: (t, tone) => g.toast(t, tone),
      act: (name, arg) => g.act(name, arg),
      lastBand: null,
    };
    return c;
  }

  async talk(dialogueId: string, start = 'start') {
    const d = DIALOGUES[dialogueId];
    if (!d) return;
    const wasBusy = this.busy;
    this.busy = true;
    this.world.stop('player');
    this.world.setMode('dialogue');
    this.refresh();
    // Frame the speaker while they talk (agent 1's suggestion, A1-016).
    const focusId = this.talkFocus && this.world.get(this.talkFocus) ? this.talkFocus : null;
    if (focusId) void this.world.focus(focusId, { zoom: 1.35, duration: 0.8 });
    try {
      await runDialogue(
        {
          ui: this.ui,
          ctx: () => this.ctx(),
          rollCheck: (o) => this.rollCheck(o),
          seen: this.seen,
        },
        dialogueId,
        d,
        start,
      );
    } finally {
      this.s.flags.__seen = [...this.seen].join('|');
      if (focusId && !this.combat) this.world.follow('player');
      if (!this.combat) this.world.setMode('explore');
      this.busy = wasBusy && !!this.combat;
      if (!this.combat) this.busy = false;
      this.refresh();
    }
  }

  // ---------------------------------------------------------------- world actions used by dialogue

  async act(name: string, arg?: unknown): Promise<void> {
    const w = this.world;
    switch (name) {
      case 'open': {
        const id = String(arg);
        audio.sfx('door-open');
        w.fx('crystal-glow', id, { colour: 'azure' as any, intensity: 1.2 });
        this.setEntityState(id, 'open');
        await sleep(700);
        this.autosave();
        return;
      }
      case 'chip': {
        const cr = crystal(this.s, arg as any);
        if (cr) {
          cr.integrity--;
          if (cr.integrity <= 0) {
            audio.sfx('shatter');
            w.fx('shatter', 'player', { colour: cr.colour as any });
            this.toast(`Your ${cr.colour} crystal shatters.`, 'bad');
          } else this.toast(`Your ${cr.colour} crystal chips. Integrity ${cr.integrity} of 3.`, 'bad');
        }
        this.refresh();
        return;
      }
      case 'wound':
        await this.wound((arg as Severity) ?? 'light');
        return;
      case 'attack-drone': {
        // an Iskari chose to strike the drone that was ignoring them
        const d = this.drone();
        if (!d || d.dead) return;
        d.friendly = false;
        setFlag(this.s, 'droneAttacked');
        this.setEntityState(d.id, 'hostile');
        await this.startCombatSoon([d.id], false);
        return;
      }
      case 'heal-light':
        if (this.s.wounds.light) {
          this.s.wounds.light = false;
          this.toast('Your light wound feels better.', 'good');
        }
        refillGuard(this.s.wounds);
        this.refresh();
        return;
      case 'memory-start':
        audio.setMusic('memory', 2);
        audio.setAmbience('memory', 2);
        audio.sfx('memory-echo');
        w.setMood('memory', 1.5);
        w.fx('memory-echo', 'archive', { duration: 12 });
        this.setEntityState('archive', 'lit');
        await sleep(900);
        return;
      case 'memory-end':
        w.setMood('dim', 2);
        audio.setMusic('explore', 3);
        audio.setAmbience('spire', 3);
        this.setEntityState('archive', 'taken');
        setFlag(this.s, 'hasArchive');
        // While you were in the ruin, the apprentice was taken. The camp learns of it when you return.
        await this.removeEntity('apprentice', 'instant');
        this.setEntityState('tent-apprentice', 'open');
        this.autosave();
        return;
      case 'crack': {
        // Agent 1's tiles: bottom (8,33), top (8,28). 'top' means 'made it to the far side'.
        const bottom = { x: 8, y: 33 };
        const top = { x: 8, y: 28 };
        const cameFromNorth = !!this.s.flags.__crackFromNorth;
        const far = cameFromNorth ? bottom : top;
        const near = cameFromNorth ? top : bottom;
        await this.ui.fade('black', 400);
        const spot = this.nearestWalkable(arg === 'top' ? far : near);
        w.place('player', spot);
        this.s.playerTile = spot;
        if (arg === 'top') setFlag(this.s, 'crackClimbed');
        await this.ui.fade('clear', 500);
        if (arg === 'top' && !cameFromNorth && !flag(this.s, 'ruinFound')) {
          quest(this.s, 'dedwaka', 'The ded-waka', 'You climbed the crack and left the ded-waka behind you.');
          this.objective('Find the ruin in the north-east. Look for teal light.');
        }
        return;
      }
      case 'crack-back': {
        const cameFromNorth = !!this.s.flags.__crackFromNorth;
        const spot = this.nearestWalkable(cameFromNorth ? { x: 8, y: 28 } : { x: 8, y: 33 });
        w.place('player', spot);
        this.s.playerTile = spot;
        return;
      }
      case 'reveal-buried': {
        const id = 'crystal-buried';
        if (w.get(id)) {
          w.setVisible(id, true);
          w.fx('crystal-glow', id, { colour: 'pale' as any });
          await sleep(500);
          await this.removeEntity(id, 'fade');
        }
        addCrystal(this.s, 'pale');
        this.toast('Received: pale crystal', 'crystal');
        audio.sfx('pickup');
        this.refresh();
        return;
      }
      case 'dogs-leave': {
        for (const id of ['dog1', 'dog2']) {
          const en = this.enemies.get(id);
          if (!en || en.dead) continue;
          en.friendly = true;
          this.setEntityState(id, 'friendly');
          void this.wander(id, this.world.level.playerSpawn);
        }
        setFlag(this.s, 'dogsCalmed');
        return;
      }
      case 'dogs-half': {
        const en = this.enemies.get('dog2');
        if (en && !en.dead) {
          en.friendly = true;
          this.setEntityState('dog2', 'friendly');
          void this.wander('dog2', this.world.level.playerSpawn);
        }
        setFlag(this.s, 'dogsMet');
        await this.startCombatSoon(['dog1'], true);
        return;
      }
      case 'dogs-fight':
        setFlag(this.s, 'dogsMet');
        await this.startCombatSoon(['dog1', 'dog2'], true);
        return;
      case 'pell-leave':
        if (w.get('pell')) void this.world.moveAlong('pell', this.pathAway('pell', 14), 3).catch(() => undefined).then(() => this.removeEntity('pell', 'fade'));
        return;
      case 'pell-fight': {
        const me = w.get('player')!;
        const t = this.nearestWalkable({ x: me.tile.x - 4, y: me.tile.y + 2 });
        const id2 = w.spawn('npc-scavenger', t, { id: 'band1', faction: 'hostile', name: 'Band-shen' });
        this.world.setState('pell', 'hostile');
        for (const id of ['pell', id2]) {
          this.enemies.set(id, {
            id,
            kind: 'scavenger',
            harm: 0,
            home: w.get(id)!.tile,
            homeFacing: 0,
            asleep: false,
            dead: false,
            friendly: false,
            suspiciousUntil: 0,
            ignoreUntil: 0,
            patrolIdx: 0,
            busy: false,
          });
        }
        await this.startCombatSoon(['pell', id2], true);
        return;
      }
      case 'ending':
        this.ui.closeDialogue();
        await this.finish();
        return;
    }
  }

  // ---------------------------------------------------------------- scripts

  async runScript(script: string, id: EntityId) {
    const s = this.s;
    const w = this.world;
    const race = s.character.race;

    // Dialogue-backed scripts.
    const talkMap: Record<string, string> = {
      apprentice: 'apprentice',
      'npc-cook': 'cook',
      'npc-lookout': 'foreman',
      'npc-hunter': 'hunter',
      'sign-rings': 'signRings',
      archive: 'archive',
    };
    if (script === 'apprentice' && flag(s, 'hasArchive')) return;
    if (script in talkMap) {
      if (script === 'archive' && hasItem(s, 'archive')) return this.toast('The niche is empty now.');
      if (script !== 'sign-rings' && script !== 'archive') this.world.face(id, 'player');
      if (flag(s, 'hasArchive') && BARKS[`${script}:after`]) return this.bark(id, BARKS[`${script}:after`]);
      return this.talk(talkMap[script]);
    }

    switch (script) {
      case 'scav1':
        this.world.face(id, 'player');
        return this.talk('scav');
      case 'npc-digger':
        this.world.face(id, 'player');
        {
          const r = s.character.race;
          const key = flag(s, 'hasArchive') ? 'npc-digger:after'
            : flag(s, 'telDead') ? 'npc-digger:telDead'
            : flag(s, 'telAsleep') ? 'npc-digger:telAsleep'
            : flag(s, 'crackClimbed') ? 'npc-digger:crackClimbed' : 'npc-digger';
          const lines = key === 'npc-digger' ? [...(BARKS['npc-digger'] ?? []), ...(BARKS['npc-digger:' + r] ?? [])] : BARKS[key];
          return this.bark(id, lines);
        }
      case 'tent-apprentice':
        if (flag(s, 'hasArchive')) return this.talk('tent');
        return this.toast("The apprentice's tent. Wax tablets in neat rows. You do not go in uninvited.");
      case 'symbol-door':
        if (flag(s, 'doorOpen')) return;
        return this.talk('symbolDoor');
      case 'inner-door':
        if (flag(s, 'innerOpen')) return;
        return this.showText(
          isk(race)
            ? 'The inner door has no marks at all. You feel it waiting for the three sockets in the hall below.'
            : 'The inner door is smooth. No marks, no seam. Teal threads run from it down towards the hall with the three sockets.',
        );
      case 'lever-a':
      case 'lever-b':
      case 'lever-c':
        return this.toggleLever(script);
      case 'spring1':
        audio.sfx('drink');
        refillGuard(s.wounds);
        if (!flag(s, 'springHealed') && s.wounds.light) {
          s.wounds.light = false;
          setFlag(s, 'springHealed');
          this.toast('Cold water, straight from the deep rock. Guard restored, and your light wound eases.', 'good');
        } else this.toast('Cold water, straight from the deep rock. Guard restored.', 'good');
        this.refresh();
        return;
      case 'gourd1':
      case 'gourd2':
      case 'gourd3':
        if (flag(s, 'cut:' + script)) return this.toast('You have already cut this gourd. It is sealing itself with sap.');
        setFlag(s, 'cut:' + script);
        addItem(s, 'water');
        audio.sfx('pickup');
        this.toast('You cut the barrel-gourd and fill your flask. Received: water.', 'good');
        this.refresh();
        return;
      case 'lamp-1':
      case 'lamp-2':
      case 'lamp-3': {
        const cur = s.entityState[id] === 'out' ? 'lit' : 'out';
        this.setEntityState(id, cur);
        audio.sfx('click');
        return;
      }
      case 'sign-1':
        return this.showText('Painted letters on a plank: *DED-WAKA. NO GO EST.* Someone has drawn a skull under it. The skull has four eyes.');
      case 'chest-1':
      case 'chest-2':
      case 'chest-3':
      case 'chest-4':
        return this.openChest(script, id);
      case 'crystal-pale':
      case 'crystal-crimson':
      case 'crystal-amber': {
        const col = script.split('-')[1] as 'pale' | 'crimson' | 'amber';
        audio.sfx('pickup');
        w.fx('crystal-glow', id, { colour: col as any });
        addCrystal(s, col);
        await this.removeEntity(id, 'fade');
        this.toast(`Received: ${col} crystal. ${CRYSTAL_DESC[col]}`, 'crystal');
        this.refresh();
        return;
      }
      case 'crystal-buried':
        return this.toast('The sand here is cooler than it should be.');
      case 'metal1':
      case 'metal2':
      case 'metal3':
      case 'metal4':
        return this.metalPile(id);
      case 'tel1':
        return this.telAsleepInteract(id);
      case 'guardian1':
      case 'drone1': {
        const g = this.enemies.get(id);
        if (g?.dead) return this.showText('The drone lies on its side on the floor. Its eye is dark. It is smaller than it looked in the air.');
        if (g?.friendly) return this.talk('droneIskari');
        if (g?.asleep) return this.showText('The drone hangs still beside the socket, its eye dim. The court is quiet enough for it now.');
        return;
      }
      case 'defender1': {
        const d = this.defender();
        if (d?.dead) return this.showText('It lies where it fell. The light in its chest has gone out. The stone looks older now, and very tired.');
        if (d && !d.asleep) return;
        return this.showText(
          this.s.character.race === 'iskari'
            ? 'A stone figure stands in the niche, caught in the middle of a step. It is broader than you, and made the way you were made. Sand has crusted over it. You do not want to stand here long.'
            : 'A stone figure stands in the niche, caught in the middle of a step. Sand has crusted over it like bark. Someone carved a guard, a long time ago, and made it very well.',
        );
      }
      case 'niche1':
        return this.showText('A tall curved alcove in the wall. A thin seam of teal runs round its arch.');
      case 'dog1':
      case 'dog2':
        return this.showText('The dog watches you, then goes back to gnawing a strip of old leather.');
      case 'pell':
        return this.talk('scav', 'gully');
    }
    this.toast(displayName(id, w.get(id)));
  }

  async showText(text: string) {
    this.busy = true;
    await this.ui.dialogue({ speaker: '', portrait: 'narrator', text, choices: [] });
    this.ui.closeDialogue();
    this.busy = false;
  }

  bark(id: EntityId, lines: string[]) {
    const key = 'bark:' + id;
    const n = Number(this.s.flags[key] ?? 0);
    const line = lines[n % lines.length];
    this.s.flags[key] = n + 1;
    const at = this.world.toScreen(id);
    this.ui.bark(at, displayName(id, this.world.get(id)), line, 4200);
  }

  private async openChest(script: string, id: EntityId) {
    const s = this.s;
    if (s.entityState[id] === 'open') return this.toast('Empty.');
    this.setEntityState(id, 'open');
    audio.sfx('open');
    const loot: Record<string, [string, number][]> = {
      'chest-1': [['aloe', 1]],
      'chest-2': [['water', 1], ['chargeFruit', 1]],
      'chest-3': [['aloe', 2], ['scrap', 1]],
      'chest-4': [['tag', 1], ['water', 1]],
    };
    const got = loot[script] ?? [];
    for (const [it, n] of got) addItem(s, it, n);
    const names = got.map(([it, n]) => (n > 1 ? `${n} x ` : '') + (ITEMS[it]?.name ?? it)).join(', ');
    this.toast(got.length ? `Received: ${names}` : 'Empty.', 'good');
    if (script === 'chest-4') await this.showText('A dented locker of dark metal, square-cornered. Miner work. Inside, wrapped in rotten cloth, a stamped tag in a script nobody reads any more.');
    this.refresh();
  }

  // ---------------------------------------------------------------- the ded-waka and its food

  private telState() {
    return this.enemies.get('tel1');
  }

  private async metalPile(id: EntityId) {
    const s = this.s;
    const tel = this.telState();
    const race = s.character.race;
    const telAwake = tel && !tel.dead && !tel.asleep;
    this.busy = true;
    const choices = [
      { text: 'Haul it into the gully, quietly.', tag: this.haulTag() },
      { text: 'Break off a piece of scrap.', tag: race === 'minaa' ? "[Mi'naa: you could fuse this]" : undefined },
      { text: 'Leave it.' },
    ];
    const pick = await this.ui.dialogue({
      speaker: '',
      portrait: 'narrator',
      text: telAwake
        ? 'Torn plating, bone-grey and green, heaped like a meal. Fresh scrape marks show where the feeding tube has been.'
        : 'Torn plating, bone-grey and green. Nothing feeds on it now.',
      choices: telAwake ? choices : choices.slice(1),
    });
    this.ui.closeDialogue();
    this.busy = false;
    const choice = telAwake ? pick : pick + 1;
    if (choice === 1) {
      if (flag(s, 'scrapPiece:' + id)) return this.toast('You already took what comes loose from this heap.');
      setFlag(s, 'scrapPiece:' + id);
      addItem(s, 'scrap');
      audio.sfx('metal-drag', { volume: 0.5 });
      this.toast("Received: Tel'sharin scrap", 'good');
      this.refresh();
      if (telAwake) await this.noise(id, 0.4);
      return;
    }
    if (choice !== 0 || !telAwake) return;

    const h = this.haulRoll();
    const r = await this.roll({ stat: h.stat, spec: h.spec, label: 'Haul the plating away' });
    if (r.band === 'miss') {
      audio.sfx('metal-drag');
      this.toast('It is heavier than it looks. The heap crashes back down.', 'bad');
      await this.noise(id, 0.9);
      return;
    }
    audio.sfx('metal-drag');
    this.world.fx('dust', id);
    await this.removeEntity(id, 'sink');
    setFlag(s, 'hauled:' + id);
    const left = ['metal1', 'metal2', 'metal3', 'metal4'].filter((m) => s.entityState[m] !== 'gone').length;
    this.toast(left ? `You drag the plating into the gully. ${left} heap${left > 1 ? 's' : ''} left.` : 'You drag the last heap into the gully.', 'good');
    quest(s, 'dedwaka', 'The ded-waka', `You hauled a heap of plating into the gully. ${left} left.`);
    this.refresh();
    if (r.band === 'partial') {
      this.toast('The plating shrieks on the rocks.', 'bad');
      await this.noise(id, 0.8);
    }
    if (!left && !this.combat) await this.telHibernates();
  }

  /** Hauling is strength or care: the better of Body + Athletics and Edge + Stealth. */
  private haulRoll(): { stat: Stat; spec?: Spec } {
    const c = this.s.character;
    const a = c.stats.body + (c.specs.athletics ?? 0);
    const b = c.stats.edge + (c.specs.stealth ?? 0);
    return a >= b ? { stat: 'body', spec: c.specs.athletics ? 'athletics' : undefined } : { stat: 'edge', spec: c.specs.stealth ? 'stealth' : undefined };
  }

  private haulTag(): string {
    const h = this.haulRoll();
    const c = this.s.character;
    const mod = c.stats[h.stat] + (h.spec ? (c.specs[h.spec] ?? 0) : 0);
    return `[${STAT_LABEL[h.stat]}${h.spec ? ' + ' + SPEC_LABEL[h.spec] : ''} ${mod >= 0 ? '+' : ''}${mod}]`;
  }

  /** A noise near the Tel'sharin. It turns. If it can see you, it rolls against your stealth. */
  private async noise(at: EntityId, loud: number) {
    const tel = this.telState();
    if (!tel || tel.dead || tel.asleep || this.combat) return;
    audio.sfx('telsharin-growl', { volume: 0.4 + loud * 0.4 });
    this.world.face(tel.id, 'player');
    tel.suspiciousUntil = performance.now() + 3500;
    this.world.showSightCone(tel.id, this.sightOf(tel), 90, true);
    const me = this.world.get('player')!;
    const it = this.world.get(tel.id)!;
    const d = this.world.distance(me.tile, it.tile);
    if (d <= this.sightOf(tel) && this.world.lineOfSight(it.tile, me.tile)) {
      if (loud >= 1) return this.startCombat([tel.id], true);
      await this.detect(tel, true);
    }
  }

  async telHibernates() {
    const tel = this.telState();
    if (!tel || tel.dead || tel.asleep) return;
    this.busy = true;
    await this.world.focus(tel.id, { duration: 1.2 });
    audio.sfx('telsharin-sleep');
    this.world.fx('sleep', tel.id, { duration: 4 });
    await this.world.playAnim(tel.id, 'sleep');
    tel.asleep = true;
    this.setEntityState(tel.id, 'asleep');
    this.world.hideSightCone(tel.id);
    await this.ui.narrate(
      [
        'The feeding tube slides back into its chest. It searches the empty sand around it. Once. Twice.',
        'The red in its seams dims to the colour of embers. Its legs fold under it.',
        'It will sleep now. The records say it can sleep for centuries.',
      ],
      { title: 'The ded-waka sleeps' },
    );
    setFlag(this.s, 'telAsleep');
    quest(this.s, 'dedwaka', 'The ded-waka', 'You starved the ded-waka. It sleeps.', true);
    this.objective('Go north through the gap to the ruin.');
    this.world.follow('player');
    this.busy = false;
    this.autosave();
    // Pell comes for the plating.
    if (!flag(this.s, 'pellGone')) await this.pellArrives();
  }

  private async pellArrives() {
    const me = this.world.get('player')!;
    const t = this.nearestWalkable({ x: me.tile.x - 3, y: me.tile.y + 1 });
    if (this.s.entityState['scav1'] !== 'gone') await this.removeEntity('scav1', 'instant');
    this.world.spawn('npc-scavenger', t, { id: 'pell', faction: 'neutral', name: 'Pell' });
    this.world.face('pell', 'player');
    this.world.face('player', 'pell');
    await sleep(400);
    await this.talk('scav', 'gully');
    setFlag(this.s, 'pellGone');
  }

  private async telAsleepInteract(id: EntityId) {
    const tel = this.telState();
    const race = this.s.character.race;
    if (!tel) return;
    if (!tel.asleep && !tel.dead) return;
    if (race === 'minaa' && !hasItem(this.s, 'feeder') && !flag(this.s, 'feederTried')) {
      this.busy = true;
      const pick = await this.ui.dialogue({
        speaker: '',
        portrait: 'narrator',
        text: tel.dead
          ? 'The body lies still. The feeding tube hangs half out of its chest, soft at one end, hard at the other.'
          : 'It sleeps. The feeding tube hangs half out of its chest. Your hands already know how a thing like that could be fused.',
        choices: [
          { text: 'Cut the tube free and fuse it to your kit.', tag: "[Mind + Tel'sharin tech]" },
          { text: 'Leave it.' },
        ],
      });
      this.ui.closeDialogue();
      this.busy = false;
      if (pick !== 0) return;
      setFlag(this.s, 'feederTried');
      const spec = bestSpec(this.s.character, ['telsharinTech', 'minaaTech', 'mechanics']);
      const r = await this.roll({ stat: 'mind', spec, label: 'Take the feeding tube' });
      if (r.band === 'miss') return this.toast('The tube crumbles in your hands like wet bark.', 'bad');
      addItem(this.s, 'feeder');
      this.toast('Received: salvage-feeder. +1 to Shock cell.', 'good');
      if (r.band === 'partial') await this.wound('light', 'The cut edge bites.');
      this.refresh();
      return;
    }
    return this.showText(
      tel.dead
        ? 'The red light is gone from its seams. Up close, the bone is real bone. Someone was this, once.'
        : race === 'iskari'
          ? 'It sleeps. Standing this close, something old in your chest goes tight. You step back before you decide to.'
          : 'It sleeps. Red light moves in its seams, very slowly, like breathing.',
    );
  }

  // ---------------------------------------------------------------- the ring sockets

  private async toggleLever(id: string) {
    const s = this.s;
    if (flag(s, 'innerOpen')) return this.toast('The sockets are quiet now. The way is open.');
    const on = s.entityState[id] === 'on';
    this.setEntityState(id, on ? 'off' : 'on');
    audio.sfx('click');
    this.world.fx('crystal-glow', id, { colour: 'azure' as any, intensity: on ? 0.3 : 1 });
    const st = (x: string) => s.entityState[x] === 'on';
    if (!on && id === 'lever-b') {
      this.toast('The middle socket flares. A hum runs through the floor.', 'bad');
      audio.sfx('guardian-hum');
      const g = this.drone();
      if (g && !g.dead && !g.asleep && !g.friendly) {
        g.suspiciousUntil = performance.now() + 5000;
        this.world.face(g.id, 'player');
        this.world.showSightCone(g.id, this.sightOf(g), 90, true);
      }
    }
    if (st('lever-a') && st('lever-c') && !st('lever-b')) {
      setFlag(s, 'innerOpen');
      await sleep(400);
      this.busy = true;
      await this.world.focus('inner-door', { duration: 1 });
      audio.sfx('door-open');
      this.setEntityState('inner-door', 'open');
      this.world.fx('crystal-glow', 'inner-door', { colour: 'azure' as any, intensity: 1.5 });
      const g = this.drone();
      if (g && !g.dead && !g.friendly) {
        g.asleep = true;
        this.setEntityState(g.id, 'asleep');
        this.world.hideSightCone(g.id);
        this.world.fx('sleep', g.id, { colour: 'azure' as any });
        void this.world.playAnim(g.id, 'sleep');
      }
      await sleep(900);
      this.world.follow('player');
      this.busy = false;
      this.toast('Teal light runs up the walls to the inner door. It opens. The drone settles by the socket and goes still.', 'quest');
      quest(s, 'errand', "The Keeper's errand", 'The outer sockets lit, the middle dark. The inner door opened.');
      this.objective('Enter the archive behind the inner door.');
    }
  }

  // ---------------------------------------------------------------- zones

  private async onZone(zoneId: string) {
    const s = this.s;
    switch (zoneId) {
      case 'z-wreck-edge':
        if (!flag(s, 'sawTel') && !this.combat && !flag(s, 'telDead') && !flag(s, 'telAsleep')) {
          this.world.stop('player');
          this.busy = true;
          await this.world.focus('tel1', { duration: 1.2 });
          audio.sfx('telsharin-feed');
          await this.talk('telFirst');
          this.world.follow('player');
          if (s.character.race === 'iskari') {
            const tel = this.telState();
            if (tel) this.world.showSightCone(tel.id, this.sightOf(tel), 90, true);
          }
          if (!this.sneaking) this.toast('Press C to sneak. Sight cones show where it can see.', 'neutral');
          this.updateCones();
        }
        return;
      case 'z-crack': {
        if (flag(s, 'crackClimbed') || this.combat) return;
        const me = this.world.get('player');
        s.flags.__crackFromNorth = !!me && me.tile.y <= 29;
        this.world.stop('player');
        return this.talk('crack');
      }
      case 'z-spire-root':
        if (flag(s, 'dugRoot') || flag(s, 'rootSeen')) return;
        setFlag(s, 'rootSeen');
        this.world.stop('player');
        return this.talk('spireRoot');
      case 'z-scar-view':
        if (flag(s, 'scarSeen')) return;
        setFlag(s, 'scarSeen');
        this.world.stop('player');
        return this.talk('scarView');
      case 'z-ruin-mouth':
        if (!flag(s, 'ruinFound')) {
          setFlag(s, 'ruinFound');
          quest(s, 'errand', "The Keeper's errand", 'You found the ruin. Pale stone, curved halls, teal light.');
          this.objective('Get through the symbol door.');
        }
        if (!flag(s, 'sawGuardian') && this.drone()) {
          const d = this.drone()!;
          this.world.stop('player');
          await this.world.focus(d.id, { duration: 1 });
          await this.talk('droneFirst');
          if (flag(s, 'guardianFriendly')) {
            d.friendly = true;
            this.setEntityState(d.id, 'tending');
            this.world.hideSightCone(d.id);
          }
          this.world.follow('player');
          this.updateCones();
          this.autosave();
        }
        return;
      case 'z-camp':
        if (!flag(s, 'hasArchive')) {
          const key = (flag(s, 'pellGone') || flag(s, 'pellReported')) && !flag(s, 'saidPellGone') ? 'pellGone'
            : flag(s, 'telDead') && !flag(s, 'saidTelDead') ? 'telDead'
            : flag(s, 'telAsleep') && !flag(s, 'saidTelAsleep') ? 'telAsleep' : null;
          if (key) {
            setFlag(s, key === 'pellGone' ? 'saidPellGone' : key === 'telDead' ? 'saidTelDead' : 'saidTelAsleep');
            const line = pickBark('camp:return:' + key);
            if (line && this.world.get('npc-lookout')) this.ui.bark(this.world.toScreen('npc-lookout'), 'Hadda, crew boss', line, 5200);
          }
        }
        if (flag(s, 'hasArchive') && !flag(s, 'campReturn')) {
          setFlag(s, 'campReturn');
          this.objective("Find the apprentice. His crate is empty.");
          this.world.highlight(['tent-apprentice'], 'interact');
        }
        return;
    }
  }

  // ---------------------------------------------------------------- the world tick: stealth, patrols, ambience

  private tick() {
    this.checkHover();
    const now = performance.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (!this.ended) this.s.playSeconds += dt;
    this.updateRegion();
    if (this.combat || this.busy) return;

    for (const en of this.enemies.values()) {
      if (en.dead || en.asleep) continue;
      if (!this.world.get(en.id)) continue;
      if (en.kind === 'defender') { this.hunt(en); if (this.combat) return; continue; }
      if (en.friendly) {
        // the drone keeps mending while an Iskari walks past
        if (en.kind === 'drone' || en.kind === 'guardian') this.idle(en, now);
        continue;
      }
      this.idle(en, now);
      if (this.canSee(en)) {
        if (now < en.ignoreUntil) continue;
        void this.detect(en, false);
        return;
      }
    }
  }

  private updateRegion() {
    const me = this.world.get('player');
    if (!me) return;
    const { x, y } = me.tile;
    const inZone = (id: string) => {
      const z = this.world.level.zones.find((q) => q.id === id);
      return !!z && x >= z.rect.x && x < z.rect.x + z.rect.w && y >= z.rect.y && y < z.rect.y + z.rect.h;
    };
    const ruin = x >= 34 && y <= 25;
    const region = inZone('z-camp') ? 'camp' : ruin ? 'spire' : x >= 32 && y >= 27 ? 'wreck' : 'desert';
    if (region === this.region) return;
    this.region = region;
    if (!this.combat && !flag(this.s, '__memory')) audio.setAmbience(region as any, 3);
    if (!this.combat) this.world.setMood(region === 'spire' ? 'dim' : 'normal', 2);
  }

  sightOf(en: EnemyRuntime): number {
    let r = ENEMIES[en.kind].sight;
    // A feeding Tel'sharin watches its food. Its eyes only reach far when something has made it look up.
    if (en.kind === 'telsharin' && performance.now() >= en.suspiciousUntil) r = 4;
    if (en.kind === 'telsharin' && this.s.character.race === 'iskari') r += 2; // it knows what you are
    if (this.sneaking) r -= 1;
    return r;
  }

  canSee(en: EnemyRuntime): boolean {
    if (this.hidden) return false;
    const me = this.world.get('player');
    const it = this.world.get(en.id);
    if (!me || !it) return false;
    const d = this.world.distance(me.tile, it.tile);
    const range = this.sightOf(en);
    if (d > range) return false;
    if (d <= 1) return true; // you are right next to it
    const suspicious = performance.now() < en.suspiciousUntil;
    const half = suspicious ? 70 : 50;
    const ang = (Math.atan2(me.tile.x - it.tile.x, -(me.tile.y - it.tile.y)) * 180) / Math.PI;
    const face = it.facing * 45;
    let diff = Math.abs(((ang - face + 540) % 360) - 180);
    if (diff > half) return false;
    return this.world.lineOfSight(it.tile, me.tile);
  }

  private detecting = false;

  async detect(en: EnemyRuntime, forced: boolean) {
    if (this.detecting || this.combat) return;
    this.detecting = true;
    try {
      const def = ENEMIES[en.kind];
      if (en.kind === 'dog' && !flag(this.s, 'dogsMet') && !flag(this.s, 'dogsCalmed')) {
        this.world.stop('player');
        setFlag(this.s, 'dogsMet');
        audio.sfx('dog-bark');
        await this.talk('dogsCalm');
        return;
      }
      if (!this.sneaking && !forced) {
        this.world.stop('player');
        audio.sfx('alert');
        this.world.floatText(en.id, '!', 'bad');
        await this.startCombat([en.id], true);
        return;
      }
      this.world.stop('player');
      const spec = bestSpec(this.s.character, ['stealth']);
      const r = await this.roll({ stat: 'edge', spec, label: `Stay hidden from the ${def.name}` });
      if (r.band === 'full') {
        en.ignoreUntil = performance.now() + 5000;
        this.world.floatText(en.id, '?', 'neutral');
        const b = pickBark('stealth:unseen'); if (b) this.toast(b, 'good');
        return;
      }
      if (r.band === 'partial') {
        audio.sfx('suspicious');
        this.world.floatText(en.id, '?', 'bad');
        this.world.face(en.id, 'player');
        en.suspiciousUntil = performance.now() + 4000;
        en.ignoreUntil = performance.now() + 2200; // a moment to get out of sight
        this.world.showSightCone(en.id, this.sightOf(en), 90, true);
        this.toast(pickBark('stealth:suspicious') ?? 'It heard something. Get out of its sight.', 'bad');
        return;
      }
      audio.sfx('alert');
      this.world.floatText(en.id, '!', 'bad');
      { const b = pickBark('stealth:spotted'); if (b) this.toast(b, 'bad'); }
      await this.startCombat([en.id], true);
    } finally {
      this.detecting = false;
    }
  }

  private idleAt = new Map<string, number>();

  private idle(en: EnemyRuntime, now: number) {
    if (en.busy) return;
    const next = this.idleAt.get(en.id) ?? 0;
    if (now < next) return;
    if (now < en.suspiciousUntil) return;
    if (en.kind === 'telsharin') {
      // It feeds and looks around, slowly.
      const it = this.world.get(en.id);
      const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
      const [dx, dy] = dirs[Math.floor(this.rng.next() * 8)];
      if (it) this.world.face(en.id, { x: it.tile.x + dx, y: it.tile.y + dy });
      this.world.showSightCone(en.id, this.sightOf(en), 100, false);
      this.idleAt.set(en.id, now + 2600 + this.rng.next() * 2200);
      return;
    }
    if (en.patrol && en.patrol.length) {
      en.busy = true;
      const target = en.patrol[en.patrolIdx % en.patrol.length];
      en.patrolIdx++;
      const it = this.world.get(en.id);
      const path = it ? this.world.findPath(it.tile, target) : null;
      const drone = en.kind === 'drone' || en.kind === 'guardian';
      const done = () => {
        en.busy = false;
        this.idleAt.set(en.id, performance.now() + (drone ? 3200 : 1800));
      };
      // the drone stops at each crack and mends it with a thin beam before moving on
      const arrive = () => {
        if (!drone || en.dead || en.asleep) return void this.world.playAnim(en.id, 'idle');
        void this.world.playAnim(en.id, 'channel');
        audio.sfx('guardian-hum', { volume: 0.25 });
        setTimeout(() => { if (!en.dead && !this.combat) void this.world.playAnim(en.id, 'idle'); }, 2600);
      };
      if (path && path.length) {
        void this.world.playAnim(en.id, 'walk');
        this.world.moveAlong(en.id, path, 1.6).then(done, done).then(arrive);
      } else { done(); arrive(); }
      if (!en.friendly) this.world.showSightCone(en.id, this.sightOf(en), 100, false);
      return;
    }
    if (en.kind === 'dog') {
      en.busy = true;
      const home = en.home;
      const t = this.nearestWalkable({ x: home.x + Math.round(this.rng.next() * 4 - 2), y: home.y + Math.round(this.rng.next() * 4 - 2) });
      const it = this.world.get(en.id);
      const path = it ? this.world.findPath(it.tile, t, { maxLength: 6 }) : null;
      const done = () => {
        en.busy = false;
        this.idleAt.set(en.id, performance.now() + 2000 + this.rng.next() * 3000);
      };
      if (path && path.length) this.world.moveAlong(en.id, path, 2).then(done, done);
      else done();
      if (this.sneaking) this.world.showSightCone(en.id, this.sightOf(en), 100, false);
      return;
    }
    this.idleAt.set(en.id, now + 3000);
  }

  updateCones() {
    for (const en of this.enemies.values()) {
      if (en.dead || en.asleep || en.friendly || !this.world.get(en.id)) {
        this.world.hideSightCone(en.id);
        continue;
      }
      if (en.kind === 'defender') { this.world.hideSightCone(en.id); continue; }
      const show = this.sneaking || en.kind === 'telsharin' || en.kind === 'guardian' || en.kind === 'drone';
      if (show) this.world.showSightCone(en.id, this.sightOf(en), 100, false);
      else this.world.hideSightCone(en.id);
    }
  }

  private async wander(id: EntityId, toward: Tile) {
    const it = this.world.get(id);
    if (!it) return;
    const t = this.nearestWalkable({ x: Math.round((it.tile.x + toward.x) / 2), y: Math.round((it.tile.y + toward.y) / 2) });
    const path = this.world.findPath(it.tile, t);
    if (path) await this.world.moveAlong(id, path, 3).catch(() => undefined);
  }

  // ---------------------------------------------------------------- combat

  /**
   * Start a fight once the conversation that caused it has closed.
   * Dialogue runs a node's action before the player reads its line, so starting at once
   * would put the fight under an open dialogue box (user playtest).
   */
  async startCombatSoon(ids: EntityId[], ambush: boolean) {
    void (async () => {
      await sleep(50);
      while (this.busy) await sleep(100);
      await this.startCombat(ids, ambush);
    })();
  }

  async startCombat(ids: EntityId[], ambush: boolean) {
    if (this.combat) return;
    // Never fight under a dialogue box: it would keep the number keys and lock its own buttons.
    this.ui.closeDialogue();
    this.world.stop('player');
    this.moveToken++;
    this.hidden = false;
    // Everyone awake and hostile nearby joins.
    const me = this.world.get('player');
    const join = new Set(ids);
    for (const en of this.enemies.values()) {
      if (en.dead || en.asleep || en.friendly) continue;
      const it = this.world.get(en.id);
      if (!it || !me) continue;
      // Only enemies that could plausibly notice the fight join it.
      const d = this.world.distance(it.tile, me.tile);
      if (d <= Math.min(8, this.sightOf(en) + 1) && this.world.lineOfSight(it.tile, me.tile)) join.add(en.id);
    }
    const list = [...join].map((id) => this.enemies.get(id)).filter((x): x is EnemyRuntime => !!x && !x.dead && !x.asleep && !x.friendly);
    if (!list.length) return;
    for (const en of list) en.busy = false;
    this.combat = new Combat(this, list, ambush);
    audio.setMusic('tense', 1.5);
    this.refresh();
    const result = await this.combat.run();
    this.combat = null;
    if (result === 'collapsed') return;
    refillGuard(this.s.wounds);
    this.world.setMode('explore');
    this.world.setMood(this.region === 'spire' ? 'dim' : 'normal', 1.5);
    audio.setMusic('explore', 3);
    this.ui.combatBar(null);
    this.cooldowns = {};
    this.updateCones();
    this.refresh();
    if (result === 'won') {
      this.toast('The fight is over. Your guard comes back as your breathing slows.', 'good');
      await this.afterFight();
    } else if (result === 'escaped') {
      this.toast('You got away. It has lost you, for now.', 'neutral');
    }
    this.autosave();
  }

  private async afterFight() {
    const tel = this.telState();
    if (tel?.dead && !flag(this.s, 'telDead')) {
      setFlag(this.s, 'telDead');
      quest(this.s, 'dedwaka', 'The ded-waka', 'I fought the ded-waka and it fell. The red went out of its seams, one by one.', true);
      this.objective('Go north through the gap to the ruin.');
    }
    const dw = this.defender();
    if (dw?.dead && !flag(this.s, 'defenderDead')) {
      setFlag(this.s, 'defenderDead');
      quest(this.s, 'errand', "The Keeper's errand", 'The stone guard from the niche is down. Its crystal went out slowly, like a lamp running dry.');
    }
    const g = this.drone();
    if (g?.dead && !flag(this.s, 'guardianDead')) {
      setFlag(this.s, 'guardianDead');
      quest(this.s, 'errand', "The Keeper's errand", 'I brought down the repair drone. The court is quiet now.');
      // The fight is over. It is not. (user brief: the player should believe the drone was the end)
      if (dw && !dw.dead && dw.asleep) await this.wakeDefender(g.id);
    }
    const band = ['pell', 'band1'].map((id) => this.enemies.get(id)).filter(Boolean) as EnemyRuntime[];
    if (band.length && band.every((b) => b.dead) && !flag(this.s, 'bandBeaten')) {
      setFlag(this.s, 'bandBeaten');
      quest(this.s, 'pell', 'Covered is covered', 'Pell and a band-shen came for the plating. You drove them off. It stays with the camp.', true);
    }
  }

  /**
   * The drone's last act: an activation code runs through the floor seams to the east wall, and a
   * defensive-line Iskari wakes at its post (canon: "an Aza'los site under threat" triggers them).
   * It comes for the player at once, and it does not stop.
   */
  async wakeDefender(fromId: string) {
    const dw = this.defender();
    if (!dw || dw.dead || !dw.asleep) return;
    const w = this.world;
    const isk = this.s.character.race === 'iskari';
    this.busy = true;
    try {
      await sleep(1400);
      w.stop('player');
      await w.focus(fromId, { zoom: 1.2, duration: 0.8 });
      audio.sfx('guardian-hum');
      w.fx('crystal-glow', fromId, { colour: 'teal' as any, intensity: 1.4 });
      await this.showText('The drone lies on its side. Its eye goes dark. Then a thread of teal light runs out of it and down into the floor.');
      setFlag(this.s, 'codeSent');
      const pulse = w.seamPulse(fromId, dw.id, { colour: 'teal' as any, duration: 2.4 });
      void w.focus(dw.id, { zoom: 1.2, duration: 2.2 });
      await pulse;
      if (w.get('niche1')) this.setEntityState('niche1', 'lit');
      audio.sfx('door-open');
      await sleep(500);
      // the shell cracks and falls; it takes the step it was frozen in
      this.setEntityState(dw.id, 'waking');
      audio.sfx('collapse', { volume: 0.7 });
      w.shake(0.4, 1.6);
      w.fx('dust', dw.id, { intensity: 2, duration: 2 });
      await sleep(2500);
      dw.asleep = false;
      dw.guarding = false;
      this.setEntityState(dw.id, 'awake');
      if (w.get('niche1')) this.setEntityState('niche1', 'empty');
      setFlag(this.s, 'defenderAwake');
      // it steps out of the niche onto the court, so the fight has a body in the open
      const it = w.get(dw.id);
      const me = w.get('player');
      if (it && me) {
        const out = w.findPath(it.tile, me.tile, { adjacentOk: true });
        if (out && out.length) {
          void w.playAnim(dw.id, 'walk');
          await w.moveAlong(dw.id, out.slice(0, 2), 1.4).catch(() => undefined);
          void w.playAnim(dw.id, 'idle');
        }
      }
      w.face(dw.id, 'player');
      await this.showText('In the east wall, a stone figure you took for a statue cracks down the middle. Sand pours off it. It finishes the step it was frozen in.');
      await this.showText(
        isk
          ? 'It turns its head to you. The crystal in its chest flares, and yours answers. You know it the way you know your own hands. It raises the staff anyway.'
          : 'It turns its head to you. Teal light runs in every crack of it. It does not ask why you are here.',
      );
      quest(this.s, 'errand', "The Keeper's errand", 'The drone sent something into the floor as it died. A stone guard woke in the east wall.');
    } finally {
      this.busy = false;
      w.follow('player');
    }
    await this.startCombat([dw.id], false);
  }

  /** Out of combat, an awake defender hunts: it walks to wherever you are. After a collapse it guards the court instead. */
  private hunt(dw: EnemyRuntime) {
    if (dw.busy) return;
    const me = this.world.get('player');
    const it = this.world.get(dw.id);
    if (!me || !it) return;
    if (dw.guarding) {
      // back at its post: anyone who walks into the court is a threat again
      const inCourt = me.tile.x >= 33 && me.tile.x <= 52 && me.tile.y >= 5 && me.tile.y <= 24;
      if (inCourt) void this.startCombat([dw.id], false);
      return;
    }
    const d = this.world.distance(me.tile, it.tile);
    if (d <= 6) { void this.startCombat([dw.id], false); return; }
    const path = this.world.findPath(it.tile, me.tile, { adjacentOk: true });
    if (!path || !path.length) return;
    dw.busy = true;
    const done = () => { dw.busy = false; };
    void this.world.playAnim(dw.id, 'walk');
    this.world.moveAlong(dw.id, path.slice(0, 6), 2.6).then(done, done);
  }

  onEnemyDown(en: EnemyRuntime) {
    en.dead = true;
    this.s.enemyHarm[en.id] = ENEMIES[en.kind].harm;
    this.s.entityState[en.id] = 'dead';
    this.world.hideSightCone(en.id);
  }

  // ---------------------------------------------------------------- abilities out of combat

  async exploreAbility(a: Ability) {
    if (a.target !== 'self') return this.toast(`${a.name} needs a target. Use it in a fight.`, 'neutral');
    const block = this.abilityBlock(a);
    if (block) return this.toast(block, 'bad');
    const useful = a.full.some((e) => e.kind === 'heal' || e.kind === 'hide');
    if (!useful) return this.toast(`${a.name} is for fights.`, 'neutral');
    if (a.full.some((e) => e.kind === 'heal') && !(this.s.wounds.light || this.s.wounds.moderate || this.s.wounds.severe))
      return this.toast('You have no wounds to heal.', 'neutral');
    this.busy = true;
    try {
      await this.useAbility(a, null);
    } finally {
      this.busy = false;
    }
  }

  /** Shared by explore and combat. Returns the band, or null when no roll was needed. */
  async useAbility(a: Ability, target: EntityId | null): Promise<Band | null> {
    const s = this.s;
    let band: Band = 'full';
    void this.world.playAnim('player', a.anim as any);
    this.world.fx(a.fx.startsWith('channel') ? 'channel' : 'crystal-glow', 'player', {
      colour: (a.crystal ?? (a.id === 'keeperFocus' ? 'azure' : 'amber')) as any,
    });
    if (a.roll) {
      const spec = bestSpec(s.character, a.roll.specs);
      let bonus = 0;
      let bonusLabel: string | undefined;
      if (a.id === 'shockCell' && hasItem(s, 'feeder')) {
        bonus += 1;
        bonusLabel = 'Salvage-feeder';
      }
      if (a.id === 'aimedShot') {
        bonus += 1;
        bonusLabel = 'Aim';
      }
      if (a.roll.stat === 'resonance' && flag(s, '__chargeFruit')) {
        bonus += 2;
        bonusLabel = 'Charge-fruit';
        setFlag(s, '__chargeFruit', false);
      }
      const r = await this.roll({ stat: a.roll.stat, spec, bonus, bonusLabel, label: a.name });
      band = r.band;
    }
    const effects = band === 'full' ? a.full : band === 'partial' ? a.partial : a.miss;
    this.cooldowns[a.id] = a.cooldown;
    for (const e of effects) {
      switch (e.kind) {
        case 'heal': {
          const h = healOne(s.wounds);
          this.world.fx('channel', 'player', { colour: 'crimson' as any });
          if (h) this.toast(`${cap(h)} wound healed.`, 'good');
          break;
        }
        case 'guard':
          s.wounds.guard = Math.min(s.wounds.guardMax + 2, s.wounds.guard + e.amount);
          this.world.floatText('player', `+${e.amount} guard`, 'good');
          audio.sfx('guard');
          break;
        case 'hide':
          if (this.combat) this.combat.hidePlayer();
          else {
            this.hidden = true;
            setTimeout(() => (this.hidden = false), 6000);
            this.toast('You are hidden for a few breaths.', 'good');
          }
          break;
        case 'chipCrystal':
          if (a.crystal) await this.act('chip', a.crystal);
          break;
        case 'backlash':
          await this.wound('light', 'Backlash.');
          break;
        case 'cooldown':
          this.cooldowns[a.id] = Math.max(this.cooldowns[a.id] ?? 0, e.turns + 1);
          break;
        case 'nextRoll':
          this.nextRollBonus += e.amount;
          this.world.floatText('player', `+${e.amount} next roll`, 'good');
          break;
        default:
          if (this.combat) await this.combat.applyEffect(e, target, a);
      }
    }
    if (!this.combat) this.cooldowns = {}; // cooldowns count combat turns only
    // 'channel', 'sleep' and 'walk' loop in the world, so end the pose once the effect is done.
    void this.world.playAnim('player', this.sneaking ? 'crouch' : 'idle');
    this.refresh();
    return a.roll ? band : null;
  }

  // ---------------------------------------------------------------- items

  async useItem(id: string) {
    const s = this.s;
    if (this.combat) return this.combat.useItem(id);
    const done = await this.applyItem(id);
    if (done) this.refresh();
  }

  /** Returns true if the item was used. */
  async applyItem(id: string): Promise<boolean> {
    const s = this.s;
    if (id.startsWith('crystal:')) {
      const col = id.split(':')[1];
      const cr = crystal(s, col as any);
      if (!cr) return false;
      if (col === 'crimson') {
        const h = healOne(s.wounds);
        if (!h) {
          this.toast('You have no wounds to heal.', 'neutral');
          return false;
        }
        cr.integrity = 0;
        audio.sfx('shatter');
        this.world.fx('shatter', 'player', { colour: 'crimson' as any });
        this.toast(
          s.character.race === 'minaa'
            ? `You crack the crimson crystal into your kit's cell. ${cap(h)} wound healed. The crystal is spent.`
            : `You hold the crimson crystal to your focus until it burns out. ${cap(h)} wound healed.`,
          'good',
        );
        return true;
      }
      if (col === 'amber') {
        cr.integrity = 0;
        this.cooldowns = {};
        this.world.fx('channel', 'player', { colour: 'amber' as any });
        this.toast('You burn the amber crystal to recharge your tools. All abilities are ready.', 'good');
        return true;
      }
      return false;
    }
    if (!hasItem(s, id)) return false;
    switch (id) {
      case 'aloe':
        const healed = healOne(s.wounds);
        if (!healed) {
          this.toast('You have no wounds to heal.', 'neutral');
          return false;
        }
        takeItem(s, 'aloe');
        this.toast(`The sap stings, then cools. ${cap(healed)} wound healed.`, 'good');
        audio.sfx('pickup');
        return true;
      case 'water':
        takeItem(s, 'water');
        refillGuard(s.wounds);
        audio.sfx('drink');
        this.toast('Warm, green-tasting water. Guard restored.', 'good');
        return true;
      case 'chargeFruit':
        takeItem(s, 'chargeFruit');
        setFlag(s, '__chargeFruit', true);
        this.toast('It fizzes on your tongue. +2 to your next Resonance roll.', 'crystal');
        return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- helpers

  nearestWalkable(t: Tile): Tile {
    const w = this.world;
    if (w.isWalkable(t)) return t;
    for (let r = 1; r < 8; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const c = { x: t.x + dx, y: t.y + dy };
          if (w.isWalkable(c)) return c;
        }
    return t;
  }

  pathAway(id: EntityId, dist: number): Tile[] {
    const it = this.world.get(id);
    if (!it) return [];
    const t = this.nearestWalkable({ x: it.tile.x - dist, y: it.tile.y });
    return this.world.findPath(it.tile, t) ?? [];
  }

  // ---------------------------------------------------------------- saving and the end

  async save(manual = false): Promise<string> {
    const me = this.world.get('player');
    if (me) this.s.playerTile = { ...me.tile };
    for (const en of this.enemies.values()) this.s.enemyHarm[en.id] = en.harm;
    this.s.flags.__seen = [...this.seen].join('|');
    const where = await saveGame(this.s);
    const line = where === 'disk' ? 'Saved to the saves folder.' : 'Saved in this browser (no dev server found).';
    if (manual) this.toast(line, 'good');
    return line;
  }

  autosave() {
    if (this.combat || this.ended) return;
    void this.save(false);
  }

  private async finish() {
    // A finished errand is not something to continue: the title offers only a new journey.
    this.s.flags.__completed = true;
    this.ended = true;
    markLive(false);
    this.busy = true;
    await this.save(false);
    audio.setMusic('ending', 3);
    // The coda: you sit on his crate, where he always sat (A1-018/020 gave us the crate and the pose).
    const crate = this.world.level.entities.find((e) => e.id === 'apprentice')?.tile;
    if (crate) {
      await this.ui.fade('black', 700);
      this.world.place('player', crate, 4);
      this.world.setState('player', 'seated');
      void this.world.focus('player', { zoom: 1.5, duration: 0.1 });
      await this.ui.fade('clear', 900);
      await sleep(2600);
    }
    await this.ui.fade('black', 1600);
    this.ui.showHud(false);
    // Show the ending under the fade, then lift the fade so it can be read.
    const shown = this.ui.ending(buildEnding(this.s));
    await this.ui.fade('clear', 1400);
    await shown;
    this.dispose();
    this.onQuit();
  }
}

export const CRYSTAL_DESC: Record<string, string> = {
  amber: 'Amber holds raw force. Most tools and cells in camp run on it.',
  crimson: 'Crimson mends the body. Burn it out to close a wound.',
  pale: 'Pale shows what is hidden. Hold it to old marks and they light up.',
  violet: 'Violet pushes. It throws force across a room.',
};

const isk = (r: string) => r === 'iskari';

/** A random line for a bark key, or null if the key has none. */
export function pickBark(key: string): string | null {
  const l = BARKS[key];
  return l && l.length ? l[Math.floor(Math.random() * l.length)] : null;
}

export function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function displayName(id: string, e: EntityInfo | null | undefined): string {
  if (id === 'npc-lookout') return 'Hadda, crew boss';
  if (id === 'npc-cook') return 'Mother Tarn';
  if (id === 'scav1') return 'Pell';
  return e?.name ?? id;
}
