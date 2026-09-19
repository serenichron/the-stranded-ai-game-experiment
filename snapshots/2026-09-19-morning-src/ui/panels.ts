// Journal, inventory, character sheet, help and menu.
import { RACE_LABEL, RACE_PACKAGE, ROLE_LABEL, SPEC_LABEL, STATS, STAT_HINT, STAT_LABEL, type Character, type Spec } from '../rules/character';
import { abilitiesFor } from '../rules/abilities';
import type { InventoryItemView, JournalEntryView, MenuHandlers } from './types';
import { append, clear, h, signed, svg } from './dom';
import { G, RACE_GLYPH, itemGlyph } from './glyphs';

export type PanelId = 'journal' | 'inventory' | 'character' | 'menu' | 'help';

const TITLES: Record<PanelId, string> = {
  journal: 'Journal',
  inventory: 'Pack',
  character: 'Character',
  menu: 'Paused',
  help: 'How to play',
};
const KEYS: Record<PanelId, string> = { journal: 'J', inventory: 'I', character: 'K', menu: 'Esc', help: 'H' };

const CONTROLS: [string, string][] = [
  ['Left click', 'Move, talk, pick up, use'],
  ['Right click', 'Look closer at something'],
  ['C', 'Sneak on or off'],
  ['1 to 5', 'Choose an ability in combat'],
  ['Space', 'End your turn'],
  ['Q / E', 'Turn the camera'],
  ['Mouse wheel', 'Zoom'],
  ['J', 'Journal'],
  ['I', 'Pack'],
  ['K', 'Character sheet'],
  ['H', 'This help'],
  ['Esc', 'Menu, or close a panel'],
];

export class Panels {
  el: HTMLElement;
  private scrim: HTMLElement;
  private frames = {} as Record<PanelId, { root: HTMLElement; body: HTMLElement }>;
  private open: PanelId | null = null;
  private journal: JournalEntryView[] = [];
  private items: InventoryItemView[] = [];
  private onUse: ((id: string) => void) | null = null;
  private character: Character | null = null;
  private extra: string[] = [];
  private menu: MenuHandlers | null = null;
  private menuStatus = '';

  constructor() {
    this.scrim = h('div', { class: 'panel-scrim', onclick: () => this.closeAll() });
    this.el = h('div', { class: 'panels' }, this.scrim);
    for (const id of Object.keys(TITLES) as PanelId[]) {
      const body = h('div', { class: 'pn-body' });
      const root = h(
        'section',
        { class: `pn pn-${id} panel`, role: 'dialog', 'aria-label': TITLES[id] },
        h(
          'header',
          { class: 'pn-head' },
          h('h2', { class: 'sc' }, TITLES[id]),
          h('span', { class: 'keycap small' }, KEYS[id]),
          h('button', { class: 'pn-close', type: 'button', 'aria-label': 'Close', onclick: () => this.closeAll() }, svg(G.close)),
        ),
        body,
      );
      this.frames[id] = { root, body };
      this.el.append(root);
    }
  }

  toggle(p: PanelId) {
    if (this.open === p) return void this.closeAll();
    if (this.open) this.frames[this.open].root.classList.remove('open');
    this.open = p;
    this.render(p);
    this.frames[p].root.classList.add('open');
    this.el.classList.add('has-open');
    this.scrim.classList.toggle('dim', p === 'menu');
  }

  closeAll(): boolean {
    if (!this.open) return false;
    this.frames[this.open].root.classList.remove('open');
    this.open = null;
    this.el.classList.remove('has-open');
    return true;
  }

  setJournal(e: JournalEntryView[]) {
    this.journal = e;
    if (this.open === 'journal') this.render('journal');
  }
  setInventory(items: InventoryItemView[], onUse: (id: string) => void) {
    this.items = items;
    this.onUse = onUse;
    if (this.open === 'inventory') this.render('inventory');
  }
  setCharacter(c: Character, extra: { lines: string[] }) {
    this.character = c;
    this.extra = extra.lines;
    if (this.open === 'character') this.render('character');
  }
  setMenu(m: MenuHandlers) {
    this.menu = m;
    if (this.open === 'menu') this.render('menu');
  }

  private render(p: PanelId) {
    const body = this.frames[p].body;
    clear(body);
    if (p === 'journal') this.renderJournal(body);
    if (p === 'inventory') this.renderInventory(body);
    if (p === 'character') this.renderCharacter(body);
    if (p === 'help') this.renderHelp(body);
    if (p === 'menu') this.renderMenu(body);
  }

  private renderJournal(body: HTMLElement) {
    if (!this.journal.length) return void body.append(h('p', { class: 'empty' }, 'Nothing written yet.'));
    const active = this.journal.filter((e) => !e.done);
    const done = this.journal.filter((e) => e.done);
    for (const e of [...active, ...done]) {
      body.append(
        h(
          'article',
          { class: `jn ${e.done ? 'done' : ''}` },
          h('h3', null, svg(G.quest, 'glyph jn-glyph'), h('span', { class: 'jn-title' }, e.title), e.done ? h('span', { class: 'sc jn-state' }, 'Done') : null),
          h('ul', null, ...e.lines.map((l, i) => h('li', { class: i === e.lines.length - 1 && !e.done ? 'latest' : '' }, l))),
        ),
      );
    }
  }

  private renderInventory(body: HTMLElement) {
    if (!this.items.length) return void body.append(h('p', { class: 'empty' }, 'Your pack is empty.'));
    const grid = h('div', { class: 'inv' });
    for (const it of this.items) {
      grid.append(
        h(
          'div',
          { class: `inv-item ${it.quest ? 'quest' : ''}` },
          h('div', { class: 'inv-icon' }, svg(itemGlyph(it.name, it.quest)), it.count > 1 ? h('span', { class: 'inv-count' }, String(it.count)) : null),
          h(
            'div',
            { class: 'inv-text' },
            h('div', { class: 'inv-name' }, it.name, it.quest ? h('span', { class: 'sc inv-quest' }, 'Errand') : null),
            h('div', { class: 'inv-desc' }, it.desc),
          ),
          it.usable
            ? h(
                'button',
                {
                  class: 'btn small',
                  type: 'button',
                  onclick: () => this.onUse?.(it.id),
                },
                'Use',
              )
            : null,
        ),
      );
    }
    body.append(grid);
  }

  private renderCharacter(body: HTMLElement) {
    const c = this.character;
    if (!c) return void body.append(h('p', { class: 'empty' }, 'No character yet.'));
    const stats = h('div', { class: 'cs-stats' });
    for (const s of STATS) {
      const v = c.stats[s];
      stats.append(
        h(
          'div',
          { class: 'cs-stat', 'data-tip': STAT_LABEL[s], 'data-tip-sub': STAT_HINT[s] },
          h('div', { class: `cs-v ${v < 0 ? 'neg' : v > 0 ? 'pos' : ''}` }, signed(v)),
          h('div', { class: 'sc' }, STAT_LABEL[s]),
        ),
      );
    }
    const specs = h('div', { class: 'cs-specs' });
    for (const [k, lvl] of Object.entries(c.specs) as [Spec, number][]) {
      specs.append(
        h(
          'div',
          { class: 'cs-spec' },
          h('span', null, SPEC_LABEL[k]),
          RACE_PACKAGE[c.race].includes(k) ? h('span', { class: 'cs-from sc' }, RACE_LABEL[c.race]) : null,
          h('span', { class: `lvl ${lvl >= 2 ? 'mastered' : ''}` }, lvl >= 2 ? 'Mastered +2' : 'Trained +1'),
        ),
      );
    }
    const abil = h('div', { class: 'cs-abil' });
    for (const a of abilitiesFor(c)) abil.append(h('div', { class: 'cs-a' }, h('div', { class: 'cs-a-name' }, a.name), h('div', { class: 'cs-a-desc' }, a.desc)));
    append(body, [
      h(
        'div',
        { class: 'cs-top' },
        h('div', { class: `cs-portrait race-${c.race}` }, svg(RACE_GLYPH[c.race])),
        h('div', null, h('div', { class: 'cs-name' }, c.name), h('div', { class: 'sc cs-sub' }, `${RACE_LABEL[c.race]} · ${ROLE_LABEL[c.role]}`)),
      ),
      stats,
      h('div', { class: 'cs-cols' }, h('div', null, h('h3', { class: 'sc' }, 'Skills'), specs), h('div', null, h('h3', { class: 'sc' }, 'Abilities'), abil)),
      this.extra.length ? h('div', { class: 'cs-extra' }, ...this.extra.map((l) => h('p', null, l))) : null,
    ]);
  }

  private renderHelp(body: HTMLElement) {
    const list = h('dl', { class: 'help' });
    for (const [k, v] of CONTROLS) list.append(h('dt', null, ...k.split(' / ').flatMap((p, i) => (i ? [' ', h('span', { class: 'keycap' }, p)] : [h('span', { class: 'keycap' }, p)]))), h('dd', null, v));
    body.append(
      list,
      h('p', { class: 'help-note' }, 'Checks roll two dice plus a stat and a skill. 10 or more is a full success. 7 to 9 works, at a cost. 6 or less is a miss.'),
    );
  }

  private renderMenu(body: HTMLElement) {
    const status = h('div', { class: 'menu-status' }, this.menuStatus);
    const run = async (fn: () => Promise<string>) => {
      status.textContent = 'Working…';
      try {
        this.menuStatus = await fn();
      } catch (e) {
        this.menuStatus = e instanceof Error ? e.message : 'That did not work.';
      }
      status.textContent = this.menuStatus;
    };
    const m = this.menu;
    body.append(
      h(
        'div',
        { class: 'menu' },
        h('button', { class: 'btn menu-btn primary', type: 'button', onclick: () => this.closeAll() }, 'Resume'),
        h('button', { class: 'btn menu-btn', type: 'button', disabled: !m, onclick: () => m && run(m.onSave) }, 'Save'),
        h('button', { class: 'btn menu-btn', type: 'button', disabled: !m, onclick: () => m && run(m.onLoad) }, 'Load'),
        h('button', { class: 'btn menu-btn', type: 'button', onclick: () => this.toggle('help') }, 'How to play'),
        m?.quality ? this.qualityRow(m.quality) : null,
        m?.narration ? this.narrationRow(m.narration) : null,
        h(
          'button',
          {
            class: 'btn menu-btn ghost',
            type: 'button',
            disabled: !m,
            onclick: () => {
              this.closeAll();
              m?.onQuitToTitle();
            },
          },
          'Quit to title',
        ),
        status,
        m?.storageNote ? h('p', { class: 'menu-note' }, m.storageNote) : null,
      ),
    );
  }

  private narrationRow(n: NonNullable<MenuHandlers['narration']>): HTMLElement {
    const row = h('div', { class: 'menu-quality' }, h('span', { class: 'sc' }, 'Narration'));
    const opts = [[true, 'On'], [false, 'Off']] as const;
    const btns = opts.map(([on, label]) =>
      h('button', {
        class: 'btn ghost' + (n.get() === on ? ' on' : ''),
        type: 'button',
        'data-tip': on ? 'Every line is read aloud (N).' : 'Silent reading (N).',
        onclick: () => {
          n.set(on);
          btns.forEach((b, i) => b.classList.toggle('on', opts[i][0] === on));
        },
      }, label),
    );
    row.append(...btns);
    return row;
  }

  private qualityRow(q: NonNullable<MenuHandlers['quality']>): HTMLElement {
    const row = h('div', { class: 'menu-quality' }, h('span', { class: 'sc' }, 'Graphics'));
    const levels = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] as const;
    const btns = levels.map(([id, label]) =>
      h('button', {
        class: 'btn ghost' + (q.get() === id ? ' on' : ''),
        type: 'button',
        'data-tip': id === 'low' ? 'For slow laptops: no bloom, no dust, lower resolution.' : id === 'medium' ? 'Softer shadows, fewer effects.' : 'Everything on.',
        onclick: () => {
          q.set(id);
          btns.forEach((b, i) => b.classList.toggle('on', levels[i][0] === id));
        },
      }, label),
    );
    row.append(...btns);
    return row;
  }
}
