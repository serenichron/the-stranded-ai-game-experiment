// Combat bar (bottom centre), enemy list and log (top right).
import type { CombatAction, CombatBarState } from './types';
import { append, clear, h, svg } from './dom';
import { G } from './glyphs';
import { abilityButton } from './hud';

export class CombatUI {
  bar: HTMLElement;
  side: HTMLElement;
  private enemies: HTMLElement;
  private log: HTMLElement;
  private handler: ((a: CombatAction) => void) | null = null;
  private lastLog: string[] = [];

  constructor() {
    this.bar = h('div', { class: 'cbar panel' });
    this.enemies = h('div', { class: 'enemies' });
    this.log = h('div', { class: 'clog', 'aria-live': 'polite' });
    this.side = h('div', { class: 'cside' }, this.enemies, this.log);
  }

  onAction(fn: (a: CombatAction) => void) {
    this.handler = fn;
  }

  private emit(a: CombatAction) {
    this.handler?.(a);
  }

  render(s: CombatBarState | null) {
    if (!s) {
      this.bar.classList.remove('open');
      this.side.classList.remove('open');
      this.lastLog = [];
      return;
    }
    this.bar.classList.add('open');
    this.side.classList.add('open');
    const mine = s.whoseTurn === 'player';
    this.bar.classList.toggle('enemy-turn', !mine);

    clear(this.bar);
    const moves = h('div', { class: 'cb-pips move', 'data-tip': 'Movement', 'data-tip-sub': `${s.moveLeft} of ${s.moveMax} tiles left this turn.` }, svg(G.foot));
    for (let i = 0; i < s.moveMax; i++) moves.append(h('i', { class: i < s.moveLeft ? 'on' : '' }));
    const action = h(
      'div',
      { class: `cb-pips act ${s.actionLeft ? 'ready' : ''}`, 'data-tip': 'Action', 'data-tip-sub': s.actionLeft ? 'You can still act this turn.' : 'Action spent this turn.' },
      svg(G.bolt),
      h('i', { class: s.actionLeft ? 'on' : '' }),
    );
    const info = h(
      'div',
      { class: 'cb-info' },
      h('div', { class: 'cb-round sc' }, `Round ${s.round}`),
      h('div', { class: `cb-turn ${mine ? 'you' : 'them'}` }, mine ? 'Your turn' : 'Enemy turn'),
      h('div', { class: 'cb-res' }, moves, action),
    );

    const noAct = !mine ? 'Wait for your turn.' : !s.actionLeft ? 'No action left this turn.' : undefined;
    const sel = (what: string) => this.emit({ type: 'select', what: s.selected === what ? null : what });

    const isRanged = /shoot|range/i.test(s.attackLabel);
    const attack = h(
      'button',
      {
        class: `abtn attack ${s.selected === 'attack' ? 'sel' : ''} ${noAct ? 'off' : ''}`,
        type: 'button',
        'data-tip': s.attackLabel,
        'data-tip-sub': [`Range ${s.attackRange}.`, noAct ?? ''].filter(Boolean).join('\n'),
        'aria-label': s.attackLabel,
        onclick: () => {
          if (!noAct) sel('attack');
        },
      },
      svg(isRanged ? G.bow : G.sword, 'glyph abtn-glyph'),
    );

    const abil = h('div', { class: 'cb-group' });
    for (const a of s.abilities) {
      abil.append(abilityButton(a, { selected: s.selected === a.id, blocked: noAct, onClick: () => sel(a.id) }));
    }

    const items = h('div', { class: 'cb-group items' });
    for (const it of s.items) {
      const off = it.count <= 0 ? 'None left.' : noAct;
      items.append(
        h(
          'button',
          {
            class: `abtn item ${off ? 'off' : ''}`,
            type: 'button',
            'data-tip': it.name,
            'data-tip-sub': [it.desc, off ?? ''].filter(Boolean).join('\n'),
            'aria-label': `${it.name}, ${it.count} left`,
            onclick: () => {
              if (!off) this.emit({ type: 'item', id: it.id });
            },
          },
          svg(G.flask, 'glyph abtn-glyph'),
          h('span', { class: 'abtn-count' }, String(it.count)),
        ),
      );
    }

    const end = h(
      'button',
      { class: 'btn end', type: 'button', disabled: !mine, 'data-tip': 'End turn', 'data-tip-sub': 'Space', onclick: () => this.emit({ type: 'end' }) },
      svg(G.skip),
      h('span', null, 'End turn'),
    );

    append(this.bar, [info, h('div', { class: 'cb-sep' }), attack, abil, s.items.length ? h('div', { class: 'cb-sep' }) : null, items, h('div', { class: 'cb-sep' }), end]);

    clear(this.enemies);
    for (const e of s.enemies) {
      if (e.hidden) continue;
      const boxes = h('div', { class: 'harm' });
      for (let i = 0; i < e.harmMax; i++) boxes.append(h('i', { class: i < e.harm ? 'on' : '' }));
      const down = e.harm >= e.harmMax;
      this.enemies.append(
        h(
          'div',
          { class: `enemy ${down ? 'down' : ''}` },
          h('div', { class: 'enemy-name' }, e.name, e.stunned > 0 ? h('span', { class: 'stun', 'data-tip': 'Stunned', 'data-tip-sub': `Loses its next ${e.stunned === 1 ? 'turn' : `${e.stunned} turns`}.` }, svg(G.stun), String(e.stunned)) : null),
          boxes,
        ),
      );
    }

    // Log: only animate new lines.
    // The game may send a sliding window, so find how much of the old tail it still starts with.
    let fresh: string[] | null = this.lastLog.length ? null : s.log;
    for (let k = Math.min(this.lastLog.length, s.log.length); k > 0 && !fresh; k--) {
      const tail = this.lastLog.slice(-k);
      if (tail.every((l, i) => s.log[i] === l)) fresh = s.log.slice(k);
    }
    if (fresh) {
      for (const line of fresh) this.log.append(h('div', { class: 'lline new' }, line));
    } else {
      clear(this.log);
      for (const line of s.log) this.log.append(h('div', { class: 'lline' }, line));
    }
    while (this.log.children.length > 8) this.log.firstElementChild?.remove();
    this.lastLog = [...s.log];
    this.log.scrollTop = this.log.scrollHeight;
  }
}
