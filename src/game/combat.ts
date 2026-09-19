// Turn-based combat. You move and act, then each enemy moves and strikes, and you roll to defend.
// No hit points. Guard soaks, then wounds fill. Canon rules live in src/rules/.

import type { EntityId, Tile } from '../core/contracts';
import type { CombatAction, CombatBarState } from '../ui/types';
import type { Game, EnemyRuntime } from './game';
import { cap, sleep, pickBark } from './game';
import { audio } from '../audio';
import { ENEMIES, EnemyDef, attackSpec, defendSpec, moveRange } from '../rules/combat';
import { ABILITIES, Ability, Effect, abilitiesFor } from '../rules/abilities';
import { SPEC_LABEL, STAT_LABEL } from '../rules/character';
import { takeHarm, Severity } from '../rules/wounds';
import { ITEMS, hasItem } from './state';

type Result = 'won' | 'escaped' | 'collapsed';

export class Combat {
  round = 0;
  turn: 'player' | 'enemy' = 'player';
  moveLeft = 0;
  /** Actions per turn. Two, so you can strike twice, or strike and use an ability. */
  actionsLeft = 2;
  get actionLeft() {
    return this.actionsLeft > 0;
  }
  /** Enemies you already traded blows with this round. They do not strike again in their turn. */
  engaged = new Set<EntityId>();
  selected: string | null = null;
  exposed = false;
  defendBonus = 0;
  hidden = false;
  log: string[] = [];
  stunned = new Map<EntityId, number>();
  /** Stunned for a story reason, not a hit: the woken Iskari facing an Iskari. */
  hesitating = new Set<EntityId>();
  lastSeen: Tile | null = null;
  private hl: number[] = [];
  private endTurn: (() => void) | null = null;
  private finished: ((r: Result) => void) | null = null;
  private acting = false;
  private over = false;

  constructor(
    private g: Game,
    private foes: EnemyRuntime[],
    private ambush: boolean,
  ) {
    g.ui.onCombatAction((a) => void this.onAction(a));
  }

  private get w() {
    return this.g.world;
  }

  private get me() {
    return this.w.get('player')!;
  }

  private alive() {
    return this.foes.filter((f) => !f.dead && !f.asleep && !f.friendly && this.w.get(f.id));
  }

  // ---------------------------------------------------------------- main loop

  async run(): Promise<Result> {
    const g = this.g;
    g.world.setMode('combat');
    g.world.setMood('tense', 1);
    for (const f of this.foes) {
      this.w.stop(f.id);
      this.w.hideSightCone(f.id);
      this.w.face(f.id, 'player');
    }
    this.w.face('player', this.foes[0].id);
    const names = [...new Set(this.foes.map((f) => ENEMIES[f.kind].name))].join(', ');
    const kind0 = this.foes[0].kind === 'guardian' ? 'drone' : this.foes[0].kind;
    const TITLE: Record<string, string> = { telsharin: 'It has seen you', dog: 'Teeth', drone: 'The drone turns', defender: 'It walks', scavenger: 'The old way' };
    await g.ui.banner(TITLE[kind0] ?? (this.ambush ? 'Ambush' : 'Combat'), pickBark('combat:start:' + kind0) ?? names);
    // An Iskari player: the woken one's crystal answers theirs, and it holds for one turn. Then it attacks anyway.
    if (g.s.character.race === 'iskari') {
      for (const f of this.foes) {
        if (f.kind === 'defender' && !g.s.flags.defenderHesitated) {
          g.s.flags.defenderHesitated = true;
          this.stunned.set(f.id, 1);
          this.hesitating.add(f.id);
        }
      }
    }

    return new Promise<Result>((resolve) => {
      this.finished = resolve;
      void this.loop();
    });
  }

  abort() {
    this.over = true;
    this.clearHl();
    this.endTurn?.();
    this.g.ui.combatBar(null);
  }

  private settled = false;

  private finish(r: Result) {
    if (this.settled) return;
    this.settled = true;
    this.over = true;
    this.clearHl();
    this.g.ui.combatBar(null);
    this.finished?.(r);
  }

  private async loop() {
    let enemyFirst = this.ambush;
    while (!this.over) {
      this.round++;
      if (!enemyFirst) {
        await this.playerTurn();
        if (this.over) return;
        if (this.checkEnd()) return;
      }
      enemyFirst = false;
      await this.enemyTurn();
      if (this.over) return;
      if (this.checkEnd()) return;
      // Cooldowns tick at the end of each round.
      for (const k of Object.keys(this.g.cooldowns)) this.g.cooldowns[k] = Math.max(0, this.g.cooldowns[k] - 1);
    }
  }

  private checkEnd(): boolean {
    if (this.over) return true;
    const alive = this.alive();
    if (!alive.length) {
      void this.g.ui.banner('The fight is over').then(() => this.finish('won'));
      this.over = true;
      return true;
    }
    // Escape: nobody close, nobody can see you. Never from something relentless (the woken Iskari).
    if (alive.some((f) => ENEMIES[f.kind].relentless)) return false;
    const me = this.me;
    const seen = alive.some((f) => {
      const it = this.w.get(f.id)!;
      const d = this.w.distance(it.tile, me.tile);
      if (this.hidden) return d <= 3 && this.w.lineOfSight(it.tile, me.tile);
      return d <= 12 && (d <= 5 || this.w.lineOfSight(it.tile, me.tile));
    });
    if (!seen) {
      for (const f of alive) this.sendHome(f);
      void this.g.ui.banner('You got away').then(() => this.finish('escaped'));
      this.over = true;
      return true;
    }
    return false;
  }

  private sendHome(f: EnemyRuntime) {
    const it = this.w.get(f.id);
    if (!it) return;
    const path = this.w.findPath(it.tile, f.home);
    if (path) void this.w.moveAlong(f.id, path, 2).catch(() => undefined);
  }

  // ---------------------------------------------------------------- player turn

  private async playerTurn() {
    const g = this.g;
    this.turn = 'player';
    this.moveLeft = moveRange(g.s.character);
    this.actionsLeft = 2;
    this.engaged.clear();
    this.selected = null;
    await g.ui.banner('Your turn', `Round ${this.round}`);
    this.showMoveRange();
    this.bar();
    await new Promise<void>((res) => (this.endTurn = res));
    this.endTurn = null;
    this.clearHl();
  }

  onKey(k: string, code: string) {
    if (this.turn !== 'player' || this.acting) return;
    if (k === ' ' || k === 'enter' || code === 'Space') return void this.onAction({ type: 'end' });
    if (k === 'a') return void this.onAction({ type: 'select', what: this.selected === 'attack' ? null : 'attack' });
    if (/^[1-5]$/.test(k)) {
      const a = abilitiesFor(this.g.s.character)[Number(k) - 1];
      if (a) void this.onAction({ type: 'select', what: this.selected === a.id ? null : a.id });
    }
  }

  private async onAction(a: CombatAction) {
    if (this.turn !== 'player' || this.acting || this.over) return;
    audio.sfx('click');
    if (a.type === 'end') {
      this.endTurn?.();
      return;
    }
    if (a.type === 'item') return this.useItem(a.id);
    // select
    if (!a.what) {
      this.selected = null;
      this.showMoveRange();
      return this.bar();
    }
    if (!this.actionLeft) {
      this.g.toast('You have used both actions. Move, or end your turn.', 'neutral');
      return;
    }
    if (a.what === 'attack') {
      this.selected = 'attack';
      this.showTargets(this.attackRange(), false);
      return this.bar();
    }
    const ab = ABILITIES[a.what];
    if (!ab) return;
    const block = this.g.abilityBlock(ab);
    if (block) return this.g.toast(block, 'bad');
    if (ab.target === 'self') {
      this.actionsLeft--;
      this.selected = null;
      await this.act(async () => {
        await this.g.useAbility(ab, null);
        this.log.push(`You use ${ab.name}.`);
      });
      return;
    }
    this.selected = ab.id;
    this.showTargets(ab.range, !!ab.machinesOnly);
    this.bar();
  }

  onTileClick(tile: Tile) {
    if (this.turn !== 'player' || this.acting || this.over) return;
    const onEnemy = this.alive().find((f) => {
      const t = this.w.get(f.id)!.tile;
      return t.x === tile.x && t.y === tile.y;
    });
    if (onEnemy) return this.onEntityClick(onEnemy.id);
    if (this.moveLeft <= 0) return this.g.toast('No movement left this turn.', 'neutral');
    const path = this.w.findPath(this.me.tile, tile, { maxLength: this.moveLeft });
    if (!path || !path.length || path.length > this.moveLeft) {
      this.w.fx('miss', tile);
      return;
    }
    void this.act(async () => {
      this.clearHl();
      await this.w.moveAlong('player', path, 4.2).catch(() => undefined);
      this.moveLeft -= path.length;
      this.g.s.playerTile = { ...this.me.tile };
    });
  }

  onEntityClick(id: EntityId) {
    if (this.turn !== 'player' || this.acting || this.over) return;
    const f = this.alive().find((x) => x.id === id);
    if (!f) return;
    if (!this.selected) {
      if (!this.actionLeft) return this.g.toast('You have used both actions this turn.', 'neutral');
      this.selected = 'attack';
    }
    const sel = this.selected;
    const it = this.w.get(id)!;
    const d = this.w.distance(this.me.tile, it.tile);
    if (sel === 'attack') {
      const range = this.attackRange();
      if (d > range) return this.g.toast(range === 1 ? 'Too far. Move next to it first.' : `Out of range. Range ${range}.`, 'neutral');
      if (d > 1 && !this.w.lineOfSight(this.me.tile, it.tile)) return this.g.toast('You cannot see it from here.', 'neutral');
      this.actionsLeft--;
      this.selected = null;
      void this.act(() => this.attack(f));
      return;
    }
    const ab = ABILITIES[sel!];
    if (!ab) return;
    if (ab.machinesOnly && !ENEMIES[f.kind].machine) return this.g.toast(`${ab.name} only works on machines.`, 'neutral');
    if (d > ab.range) return this.g.toast(`Out of range. Range ${ab.range}.`, 'neutral');
    if (d > 1 && !this.w.lineOfSight(this.me.tile, it.tile)) return this.g.toast('You cannot see it from here.', 'neutral');
    this.actionsLeft--;
    this.selected = null;
    // Abilities do not settle an exchange: the target still acts on its turn (user playtest: amber stun-locked it).
    void this.act(async () => {
      this.w.face('player', id);
      await this.abilityVisual(ab, id);
      const band = await this.g.useAbility(ab, id);
      this.hidden = false;
      this.log.push(`${ab.name}: ${band ?? 'done'}.`);
    });
  }

  async useItem(id: string) {
    if (this.turn !== 'player' || this.acting || this.over) return;
    if (!this.actionLeft) return this.g.toast('Using an item takes an action. You have none left.', 'neutral');
    const name = id.startsWith('crystal:') ? id.split(':')[1] + ' crystal' : (ITEMS[id]?.name ?? id);
    await this.act(async () => {
      const ok = await this.g.applyItem(id);
      if (ok) {
        this.actionsLeft--;
        this.log.push(`You use ${name}.`);
      }
    });
  }

  /** Wrap a player action: lock input, run it, then refresh the bar and check the end. */
  private async act(fn: () => Promise<void>) {
    this.acting = true;
    this.clearHl();
    try {
      await fn();
    } finally {
      this.acting = false;
    }
    this.g.refresh();
    if (this.over) return;
    if (this.checkEnd()) {
      this.endTurn?.();
      return;
    }
    if (this.actionLeft || this.moveLeft > 0) {
      this.showMoveRange();
      this.bar();
    } else {
      this.bar();
      await sleep(350);
      this.endTurn?.();
    }
  }

  private attackMode(): 'melee' | 'ranged' {
    const r = this.g.s.character.role;
    return r === 'ranged' || r === 'scout' ? 'ranged' : 'melee';
  }

  private attackRange() {
    return this.attackMode() === 'ranged' ? 6 : 1;
  }

  private async attack(f: EnemyRuntime) {
    const g = this.g;
    const mode = this.attackMode();
    const it = this.w.get(f.id)!;
    this.w.face('player', f.id);
    const spec = attackSpec(g.s.character, mode, 0, mode === 'melee' ? `Strike the ${ENEMIES[f.kind].name}` : `Shoot the ${ENEMIES[f.kind].name}`);
    audio.sfx('swing');
    const anim = this.w.playAnim('player', 'attack');
    if (mode === 'ranged') await this.w.bolt('player', f.id, { kind: 'slug' });
    const r = await g.roll(spec);
    await anim;
    this.hidden = false;
    this.engaged.add(f.id);
    const name = ENEMIES[f.kind].name;
    // One roll per exchange (docs/build-order.md, combat pacing).
    // 10+: you hit clean. 7 to 9: you hit, and it hits back. 6 or less: it hits you.
    if (r.band === 'miss') {
      this.w.fx('miss', it.tile);
      this.w.floatText(f.id, 'Miss', 'neutral');
      this.log.push(`You miss the ${name}.`);
      await this.hitBack(f, 'full');
      return;
    }
    await this.hurt(f, r.band === 'full' ? 2 : 1);
    if (r.band === 'partial' && !f.dead) {
      this.log.push(`You hit the ${name}, and it hits back.`);
      await this.hitBack(f, 'light');
    }
  }

  /** The other half of an exchange: the enemy you traded with strikes you, if it can reach you. */
  private async hitBack(f: EnemyRuntime, how: 'full' | 'light') {
    const def = ENEMIES[f.kind];
    const it = this.w.get(f.id);
    if (!it || f.dead) return;
    const d = this.w.distance(it.tile, this.me.tile);
    if (d > def.reach || (d > 1 && !this.w.lineOfSight(it.tile, this.me.tile))) {
      this.log.push(`The ${def.name} is too far away to answer.`);
      return;
    }
    this.w.face(f.id, 'player');
    await this.w.playAnim(f.id, 'attack');
    const sev: Severity = how === 'light' ? 'light' : def.hits;
    await this.applyHarm(def, sev);
  }

  private async abilityVisual(ab: Ability, target: EntityId) {
    const colour: any = ab.id === 'keeperFocus' ? 'teal' : ab.crystal ?? 'amber';
    const kind = ab.id === 'channelAmber' ? 'shard' : ab.id === 'aimedShot' ? 'slug' : 'beam';
    if (ab.range > 1) {
      audio.sfx(ab.id === 'keeperFocus' ? 'teal-lance' : ab.id === 'shockCell' ? 'shock' : ab.id === 'channelAmber' ? 'channel-amber' : 'swing');
      void this.w.playAnim('player', ab.anim as any);
      await this.w.bolt('player', target, { colour, kind });
    } else {
      audio.sfx('sparks');
      await this.w.playAnim('player', 'attack');
    }
  }

  /** Effects from abilities that need the fight: damage, push, stun, free move, defence bonus. */
  async applyEffect(e: Effect, target: EntityId | null, ab: Ability) {
    const f = target ? this.foes.find((x) => x.id === target) : undefined;
    switch (e.kind) {
      case 'damage':
        if (f && !f.dead) await this.hurt(f, e.amount);
        break;
      case 'push':
        if (f && !f.dead) await this.push(f, e.tiles);
        break;
      case 'stun':
        if (f && !f.dead) {
          this.stunned.set(f.id, Math.max(this.stunned.get(f.id) ?? 0, e.turns));
          this.w.floatText(f.id, `Stunned ${e.turns}`, 'good');
          this.w.fx('crystal-glow', f.id, { colour: 'amber' as any, intensity: 0.8 });
        }
        break;
      case 'freeMove':
        this.moveLeft += e.tiles;
        this.w.floatText('player', `+${e.tiles} move`, 'good');
        break;
      case 'defendBonus':
        this.defendBonus += e.amount;
        this.w.floatText('player', `+${e.amount} defence`, 'good');
        break;
    }
  }

  hidePlayer() {
    this.hidden = true;
    this.lastSeen = { ...this.me.tile };
    this.w.floatText('player', 'Hidden', 'good');
    this.log.push('You go still. They lose track of you.');
  }

  private async hurt(f: EnemyRuntime, amount: number) {
    const def = ENEMIES[f.kind];
    f.harm = Math.min(def.harm, f.harm + amount);
    this.g.s.enemyHarm[f.id] = f.harm;
    this.w.fx('hit', f.id);
    this.w.floatText(f.id, `-${amount}`, 'bad');
    audio.sfx('enemy-hit');
    this.w.shake(0.15, 0.15);
    const HIT: Record<string, string> = { dog: 'The dog yelps and backs off a step.', telsharin: 'Bone cracks. The red light stutters.', drone: 'Stone chips fly off the drone. It wobbles.', guardian: 'Stone chips fly off the drone. It wobbles.', defender: 'A slab breaks off its arm. It keeps coming.', scavenger: 'The band-shen stumbles and swears.' };
    this.log.push(HIT[f.kind] ?? pickBark('combat:hit') ?? `${def.name} takes ${amount} harm.`);
    if (f.harm >= def.harm) {
      await this.down(f);
    } else {
      await this.w.playAnim(f.id, 'hit');
    }
    this.bar();
  }

  private async down(f: EnemyRuntime) {
    const def = ENEMIES[f.kind];
    this.g.onEnemyDown(f);
    audio.sfx('enemy-die');
    if (f.kind === 'telsharin') this.w.fx('sleep', f.id, { duration: 3 });
    if (f.kind === 'guardian' || f.kind === 'drone' || f.kind === 'defender') this.w.fx('shatter', f.id, { colour: 'teal' as any });
    await this.w.playAnim(f.id, 'die');
    this.w.setState(f.id, 'dead');
    this.log.push(pickBark('combat:down:' + (f.kind === 'guardian' ? 'drone' : f.kind)) ?? `The ${def.name} falls.`);
    if (f.kind === 'dog' || f.kind === 'scavenger') {
      setTimeout(() => void this.g.removeEntity(f.id, 'sink'), 1500);
    }
  }

  private async push(f: EnemyRuntime, tiles: number) {
    const it = this.w.get(f.id)!;
    const me = this.me.tile;
    const dx = Math.sign(it.tile.x - me.x);
    const dy = Math.sign(it.tile.y - me.y);
    const path: Tile[] = [];
    let cur = it.tile;
    for (let i = 0; i < tiles; i++) {
      const nx = { x: cur.x + dx, y: cur.y + dy };
      if (!this.w.isWalkable(nx)) break;
      path.push(nx);
      cur = nx;
    }
    if (path.length) {
      this.w.floatText(f.id, 'Pushed', 'neutral');
      await this.w.moveAlong(f.id, path, 9).catch(() => undefined);
      this.w.face(f.id, 'player');
    }
  }

  // ---------------------------------------------------------------- enemy turn

  private async enemyTurn() {
    this.turn = 'enemy';
    this.bar();
    const alive = this.alive();
    if (!alive.length) return;
    await this.g.ui.banner(alive.length === 1 ? `The ${ENEMIES[alive[0].kind].name} moves` : 'They move');
    for (const f of alive) {
      if (this.over) return;
      if (f.dead || f.asleep) continue;
      await this.enemyAct(f);
      this.bar();
      await sleep(250);
    }
    this.g.refresh();
  }

  private async enemyAct(f: EnemyRuntime) {
    const def = ENEMIES[f.kind];
    if (this.engaged.has(f.id)) {
      this.log.push(`The ${def.name} is still reeling from your exchange.`);
      return;
    }
    const st = this.stunned.get(f.id) ?? 0;
    if (st > 0 && this.hesitating.delete(f.id)) {
      this.stunned.set(f.id, 0);
      this.w.floatText(f.id, 'Hesitates', 'crystal');
      this.log.push('The crystal in its chest flares at yours. It holds still for one breath.');
      return;
    }
    if (st > 0) {
      this.stunned.set(f.id, st - 1);
      this.w.floatText(f.id, 'Stunned', 'good');
      this.log.push(`The ${def.name} is stunned and loses its turn.`);
      return;
    }
    const it = () => this.w.get(f.id)!;
    const me = this.me;

    // Hidden: it searches, and only finds you close up.
    if (this.hidden && def.relentless) {
      // it does not look for you: it knows where you are
      this.hidden = false;
      this.w.floatText(f.id, '!', 'bad');
      this.log.push(`Going still does not fool the ${def.name}.`);
    }
    if (this.hidden) {
      const d = this.w.distance(it().tile, me.tile);
      if (d <= 2 && this.w.lineOfSight(it().tile, me.tile)) {
        this.hidden = false;
        this.w.floatText(f.id, '!', 'bad');
        this.log.push(`The ${def.name} finds you.`);
      } else {
        const t = this.lastSeen ?? me.tile;
        const guess = this.g.nearestWalkable({ x: t.x + Math.round(this.g.rng.next() * 6 - 3), y: t.y + Math.round(this.g.rng.next() * 6 - 3) });
        const path = this.w.findPath(it().tile, guess, { maxLength: 12 });
        if (path && path.length) await this.w.moveAlong(f.id, path.slice(0, def.speed), 3.5).catch(() => undefined);
        this.w.floatText(f.id, '?', 'neutral');
        return;
      }
    }

    // A hurt Tel'sharin next to food eats instead of fighting. Starving it matters even mid-fight.
    if (f.kind === 'telsharin' && f.harm > 0) {
      const food = this.w
        .all()
        .find((e) => e.tags.includes(`feeds:${f.id}`) && this.w.distance(e.tile, it().tile) <= 1);
      if (food) {
        f.harm -= 1;
        this.g.s.enemyHarm[f.id] = f.harm;
        this.w.face(f.id, food.id);
        audio.sfx('telsharin-feed');
        this.w.fx('channel', f.id, { colour: 'amber' as any });
        await this.w.playAnim(f.id, 'attack');
        this.w.floatText(f.id, 'Feeds +1', 'bad');
        this.log.push(pickBark('combat:feeds') ?? `The ${def.name} feeds on the plating and mends.`);
        return;
      }
    }

    const inReach = () => {
      const d = this.w.distance(it().tile, this.me.tile);
      return d <= def.reach && (d <= 1 || this.w.lineOfSight(it().tile, this.me.tile));
    };

    if (!inReach()) {
      const path = this.w.findPath(it().tile, this.me.tile, { adjacentOk: true });
      if (path && path.length) {
        // Walk only as far as needed to strike, up to its speed.
        let steps = Math.min(def.speed, path.length);
        for (let i = 1; i <= Math.min(def.speed, path.length); i++) {
          const t = path[i - 1];
          const d = this.w.distance(t, this.me.tile);
          if (d <= def.reach && (d <= 1 || this.w.lineOfSight(t, this.me.tile))) {
            steps = i;
            break;
          }
        }
        if (f.kind === 'telsharin') audio.sfx('telsharin-growl', { volume: 0.5 });
        if (f.kind === 'dog') audio.sfx('dog-bark', { volume: 0.6 });
        await this.w.moveAlong(f.id, path.slice(0, steps), f.kind === 'dog' ? 6 : 3.5).catch(() => undefined);
      }
    }
    if (!inReach()) {
      this.log.push(`The ${def.name} closes in.`);
      return;
    }
    await this.strike(f, def);
  }

  private async strike(f: EnemyRuntime, def: EnemyDef) {
    const g = this.g;
    this.w.face(f.id, 'player');
    this.w.face('player', f.id);
    const anim = this.w.playAnim(f.id, 'attack');
    if (f.kind === 'guardian' || f.kind === 'drone') {
      audio.sfx('teal-lance');
      await this.w.bolt(f.id, 'player', { colour: 'teal' as any, kind: 'beam' });
    } else if (f.kind === 'scavenger' && this.w.distance(this.w.get(f.id)!.tile, this.me.tile) > 1) {
      audio.sfx('swing');
      await this.w.bolt(f.id, 'player', { kind: 'slug' });
    } else if (f.kind === 'telsharin') {
      audio.sfx('telsharin-growl');
    } else audio.sfx('swing');
    await anim;

    const spec = defendSpec(g.s.character, def, false, this.defendBonus);
    const r = await g.roll(spec);
    this.defendBonus = 0;
    if (r.band === 'full') {
      this.w.floatText('player', 'Avoided', 'good');
      this.w.fx('miss', 'player');
      this.log.push(`You avoid the ${def.name}.`);
      return;
    }
    const sev: Severity = r.band === 'partial' ? (def.hits === 'severe' ? 'moderate' : 'light') : def.hits;
    await this.applyHarm(def, sev, r.band === 'miss' && def.pierce);
  }

  /** Harm lands on the player: guard soaks it first, then a wound fills. */
  private async applyHarm(def: EnemyDef, sev: Severity, pierce = false) {
    const g = this.g;
    const res = takeHarm(g.s.wounds, sev, pierce);
    void this.w.playAnim('player', 'hit');
    this.w.fx('hit', 'player');
    if (res.kind === 'guard') {
      audio.sfx('guard');
      this.w.floatText('player', '-1 guard', 'neutral');
      this.log.push(`Your guard takes the ${def.name}'s blow.`);
    } else if (res.kind === 'wound') {
      audio.sfx('wound');
      this.w.fx('wound', 'player');
      this.w.shake(0.35, 0.25);
      this.w.floatText('player', `${cap(res.severity)} wound`, 'bad');
      this.log.push(pickBark('combat:wounded:' + res.severity) ?? `The ${def.name} gives you a ${res.severity} wound.`);
      g.toast(`${cap(res.severity)} wound.${res.severity === 'severe' ? ' One more and you go down.' : ''}`, 'bad');
    } else {
      this.log.push('You go down.');
      this.finish('collapsed');
      await g.collapse();
      return;
    }
    g.refresh();
  }

  // ---------------------------------------------------------------- highlights and the bar

  private clearHl() {
    for (const h of this.hl) this.w.clearHighlight(h);
    this.hl = [];
  }

  private showMoveRange() {
    this.clearHl();
    if (this.turn !== 'player' || this.moveLeft <= 0) return;
    const tiles = this.w.reachable(this.me.tile, this.moveLeft);
    if (tiles.length) this.hl.push(this.w.highlight(tiles, 'move'));
    const foes = this.alive().map((f) => f.id);
    if (foes.length) this.hl.push(this.w.highlight(foes, 'danger'));
  }

  private showTargets(range: number, machinesOnly: boolean) {
    this.clearHl();
    const me = this.me.tile;
    const ok = this.alive().filter((f) => {
      const t = this.w.get(f.id)!.tile;
      const d = this.w.distance(me, t);
      if (machinesOnly && !ENEMIES[f.kind].machine) return false;
      return d <= range && (d <= 1 || this.w.lineOfSight(me, t));
    });
    const out = this.alive().filter((f) => !ok.includes(f));
    if (ok.length) this.hl.push(this.w.highlight(ok.map((f) => f.id), 'target'));
    if (out.length) this.hl.push(this.w.highlight(out.map((f) => f.id), 'danger'));
    if (!ok.length) this.g.toast(range === 1 ? 'Nothing in reach. Move next to an enemy first.' : `Nothing in range ${range}.`, 'neutral');
    if (this.moveLeft > 0) {
      const tiles = this.w.reachable(me, this.moveLeft);
      if (tiles.length) this.hl.push(this.w.highlight(tiles, 'move'));
    }
  }

  bar() {
    const g = this.g;
    const c = g.s.character;
    const mode = this.attackMode();
    const stat = mode === 'melee' ? 'body' : 'edge';
    const spec = mode === 'melee' ? 'melee' : 'ranged';
    const mod = c.stats[stat] + (c.specs[spec] ?? 0);
    const abilities = abilitiesFor(c).map((a, i) => ({
      id: a.id,
      name: a.name,
      desc: a.desc,
      key: String(i + 1),
      cooldown: g.cooldowns[a.id] ?? 0,
      disabled: g.abilityBlock(a) ?? (this.actionLeft ? undefined : 'You have used both actions this turn.'),
      rollLabel: g.rollLabel(a),
    }));
    const items = ['aloe', 'water', 'chargeFruit']
      .filter((id) => hasItem(g.s, id))
      .map((id) => ({ id, name: ITEMS[id].name, count: g.s.items[id], desc: ITEMS[id].desc }));
    for (const cr of g.s.crystals)
      if (cr.integrity > 0 && g.crystalUsable(cr.colour))
        items.push({ id: 'crystal:' + cr.colour, name: `${cap(cr.colour)} crystal`, count: 1, desc: cr.colour === 'crimson' ? 'Burn it out to heal your worst wound.' : 'Burn it out to make every ability ready.' });
    const state: CombatBarState = {
      round: this.round,
      whoseTurn: this.turn,
      moveLeft: this.moveLeft,
      moveMax: moveRange(c),
      actionLeft: this.actionLeft,
      attackLabel: `${mode === 'melee' ? 'Strike' : 'Shoot'} (${STAT_LABEL[stat]} + ${SPEC_LABEL[spec]} ${mod >= 0 ? '+' : ''}${mod})`,
      attackRange: this.attackRange(),
      selected: this.selected,
      abilities,
      items,
      enemies: this.foes
        .filter((f) => !f.dead && this.w.get(f.id))
        .map((f) => ({
          id: f.id,
          name: ENEMIES[f.kind].name,
          harm: f.harm,
          harmMax: ENEMIES[f.kind].harm,
          stunned: this.stunned.get(f.id) ?? 0,
          hidden: false,
        })),
      log: this.log.slice(-6),
    };
    g.ui.combatBar(state);
  }
}
