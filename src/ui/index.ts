// The DOM UI. Implements the UI contract in ./types.ts.
import './style.css';
import type { CheckResult } from '../rules/check';
import type { Character } from '../rules/character';
import type {
  CombatAction,
  CombatBarState,
  CreationChoice,
  CreationPreview,
  DialogueView,
  EndingSummary,
  HudState,
  InventoryItemView,
  JournalEntryView,
  MenuHandlers,
  Tone,
  UI,
} from './types';
import { append, clear, h, isTyping, reducedMotion, richText, wait } from './dom';
import { DicePanel } from './dice';
import { DialoguePanel } from './dialogue';
import { Hud } from './hud';
import { CombatUI } from './combat';
import { Panels, type PanelId } from './panels';
import { runCreation } from './creation';

export type { UI } from './types';

/** Wait for a click on `el`, or Space / Enter anywhere. */
function advance(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      el.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey, true);
      resolve();
    };
    const onClick = () => done();
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        done();
      }
    };
    el.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey, true);
  });
}

class DomUI implements UI {
  private root = h('div', { class: 'st-root' });
  private layers = {
    hud: h('div', { class: 'layer layer-hud' }),
    combat: h('div', { class: 'layer layer-combat' }),
    dialogue: h('div', { class: 'layer layer-dialogue' }),
    panels: h('div', { class: 'layer layer-panels' }),
    roll: h('div', { class: 'layer layer-roll' }),
    banner: h('div', { class: 'layer layer-banner' }),
    screen: h('div', { class: 'layer layer-screen' }),
    fade: h('div', { class: 'layer layer-fade' }),
    top: h('div', { class: 'layer layer-top' }),
  };
  private hudAction: ((a: 'sneak' | { ability: string }) => void) | null = null;
  private hud = new Hud({
    panel: (p) => this.panels.toggle(p),
    action: (a) => this.hudAction?.(a),
  });
  private dice = new DicePanel();
  private dlg = new DialoguePanel();
  private combat = new CombatUI();
  private panels = new Panels();
  private toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
  private hover = h('div', { class: 'hover-label' });
  private tip = h('div', { class: 'tooltip panel' });
  private fadeEl = h('div', { class: 'fader' });
  private bannerEl = h('div', { class: 'banner' });
  private barkEl = h('div', { class: 'bark' });
  private barkTimer = 0;
  private mouse = { x: -999, y: -999 };

  constructor() {
    const L = this.layers;
    L.hud.append(this.hud.el, this.barkEl);
    L.combat.append(this.combat.side, this.combat.bar);
    L.dialogue.append(this.dlg.el);
    L.panels.append(this.panels.el);
    L.roll.append(this.dice.el);
    L.banner.append(this.bannerEl);
    L.fade.append(this.fadeEl);
    L.top.append(this.toasts, this.hover, this.tip);
    this.root.append(L.hud, L.combat, L.dialogue, L.panels, L.roll, L.banner, L.screen, L.fade, L.top);
    this.root.classList.add('hud-hidden');
    if (reducedMotion()) this.root.classList.add('still');

    window.addEventListener('mousemove', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY };
      this.placeHover();
      this.placeTip();
    });
    this.root.addEventListener('mouseover', (e) => this.onTipOver(e));
    this.root.addEventListener('mouseleave', () => this.tip.classList.remove('show'));
  }

  mount(root: HTMLElement): void {
    root.append(this.root);
  }

  // ---------- tooltips ----------

  private tipTarget: HTMLElement | null = null;
  private onTipOver(e: MouseEvent) {
    const t = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]') ?? null;
    if (t === this.tipTarget) return;
    this.tipTarget = t;
    if (!t) return void this.tip.classList.remove('show');
    clear(this.tip);
    this.tip.append(h('div', { class: 'tip-title' }, t.dataset.tip ?? ''));
    const sub = t.dataset.tipSub;
    if (sub) for (const line of sub.split('\n')) this.tip.append(h('div', { class: 'tip-sub' }, line));
    this.tip.classList.add('show');
    this.placeTip();
  }

  private placeTip() {
    if (!this.tip.classList.contains('show')) return;
    if (this.tipTarget && !this.tipTarget.isConnected) {
      this.tipTarget = null;
      this.tip.classList.remove('show');
      return;
    }
    const r = this.tip.getBoundingClientRect();
    let x = this.mouse.x + 18;
    let y = this.mouse.y - r.height - 14;
    if (x + r.width > innerWidth - 8) x = this.mouse.x - r.width - 18;
    if (y < 8) y = this.mouse.y + 22;
    this.tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  private placeHover() {
    if (!this.hover.classList.contains('show')) return;
    const r = this.hover.getBoundingClientRect();
    let x = this.mouse.x + 20;
    let y = this.mouse.y + 18;
    if (x + r.width > innerWidth - 8) x = this.mouse.x - r.width - 14;
    if (y + r.height > innerHeight - 8) y = this.mouse.y - r.height - 12;
    this.hover.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  // ---------- screens ----------

  title(opts: { canContinue: boolean }): Promise<'new' | 'continue'> {
    return new Promise((resolve) => {
      const pick = (v: 'new' | 'continue') => {
        screen.classList.remove('in');
        window.removeEventListener('keydown', onKey);
        setTimeout(() => screen.remove(), 700);
        resolve(v);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter') pick(opts.canContinue ? 'continue' : 'new');
      };
      const motes = h('div', { class: 'motes', 'aria-hidden': 'true' });
      for (let i = 0; i < 18; i++) {
        motes.append(
          h('i', {
            style: `left:${(Math.random() * 60).toFixed(1)}%; top:${(20 + Math.random() * 75).toFixed(1)}%; --d:${(8 + Math.random() * 10).toFixed(1)}s; --delay:${(-Math.random() * 12).toFixed(1)}s; --s:${(0.5 + Math.random()).toFixed(2)}`,
          }),
        );
      }
      const screen = h(
        'div',
        { class: 'screen title-screen' },
        motes,
        h(
          'div',
          { class: 'title-block' },
          h('div', { class: 'title-kicker sc' }, 'A tale of the red sun'),
          h('h1', { class: 'title-main' }, 'The Stranded'),
          h('div', { class: 'title-rule' }, h('i'), h('span', { class: 'title-gem' }), h('i')),
          h('div', { class: 'title-sub' }, "The Keeper's Errand"),
          h(
            'nav',
            { class: 'title-menu' },
            opts.canContinue ? h('button', { class: 'tbtn', type: 'button', onclick: () => pick('continue') }, 'Continue') : null,
            h('button', { class: 'tbtn', type: 'button', onclick: () => pick('new') }, 'New journey'),
          ),
        ),
        h('div', { class: 'title-foot' }, 'The ruins keep what we lost.'),
      );
      this.layers.screen.append(screen);
      window.addEventListener('keydown', onKey);
      requestAnimationFrame(() => requestAnimationFrame(() => screen.classList.add('in')));
    });
  }

  createCharacter(preview?: CreationPreview): Promise<CreationChoice> {
    return runCreation(this.layers.screen, preview);
  }

  async narrate(lines: string[], opts?: { title?: string; line?: (i: number, text: string) => Promise<void> }): Promise<void> {
    const page = h('div', { class: 'nar-page' });
    const hint = h('div', { class: 'nar-hint sc' }, 'Click to continue');
    const screen = h(
      'div',
      { class: 'screen narrate' },
      h('div', { class: 'nar-inner' }, opts?.title ? h('div', { class: 'nar-title sc' }, opts.title) : null, opts?.title ? h('div', { class: 'nar-rule' }) : null, page),
      hint,
    );
    this.layers.screen.append(screen);
    await wait(20);
    screen.classList.add('in');
    const perPage = 5;
    for (let i = 0; i < lines.length; i++) {
      if (i > 0 && i % perPage === 0) {
        page.classList.add('turn');
        await wait(reducedMotion() ? 0 : 350);
        clear(page);
        page.classList.remove('turn');
      }
      const p = h('p', { class: 'nar-line' }, richText(lines[i]));
      page.append(p);
      requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('in')));
      hint.classList.remove('show');
      const shown = wait(reducedMotion() ? 0 : 900).then(() => hint.classList.add('show'));
      // the narrator reads this line; the card turns when the reading ends or the player clicks
      const spoken = opts?.line?.(i, lines[i]);
      await (spoken ? Promise.race([advance(screen), spoken.then(() => wait(450))]) : advance(screen));
      p.classList.add('in', 'now');
      void shown;
    }
    screen.classList.remove('in');
    await wait(reducedMotion() ? 50 : 600);
    screen.remove();
  }

  ending(summary: EndingSummary): Promise<void> {
    return new Promise((resolve) => {
      const btn = h('button', { class: 'tbtn', type: 'button' }, 'Return to title');
      const stats = h('div', { class: 'end-stats' }, ...summary.stats.map((s) => h('div', { class: 'end-stat' }, h('div', { class: 'end-v' }, s.value), h('div', { class: 'sc' }, s.label))));
      const screen = h(
        'div',
        { class: 'screen ending' },
        h(
          'div',
          { class: 'end-inner' },
          h('div', { class: 'sc end-kicker' }, 'The errand ends'),
          h('h1', { class: 'end-title' }, summary.title),
          h('div', { class: 'title-rule' }, h('i'), h('span', { class: 'title-gem' }), h('i')),
          h('div', { class: 'end-lines' }, ...summary.lines.map((l, i) => h('p', { style: `--i:${i}` }, richText(l)))),
          h('p', { class: 'end-coda', style: `--i:${summary.lines.length + 1}` }, richText(summary.coda)),
          stats,
          btn,
        ),
      );
      this.layers.screen.append(screen);
      requestAnimationFrame(() => requestAnimationFrame(() => screen.classList.add('in')));
      btn.addEventListener('click', () => {
        screen.classList.remove('in');
        setTimeout(() => screen.remove(), 700);
        resolve();
      });
    });
  }

  // ---------- HUD ----------

  showHud(visible: boolean): void {
    this.root.classList.toggle('hud-hidden', !visible);
  }

  updateHud(s: HudState): void {
    this.hud.update(s);
    this.root.dataset.mode = s.mode;
  }

  toast(text: string, tone: Tone = 'neutral'): void {
    const t = h('div', { class: `toast ${tone}` }, h('span', { class: 'toast-mark' }), h('span', null, richText(text)));
    this.toasts.append(t);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
    setTimeout(() => {
      t.classList.remove('in');
      t.classList.add('out');
      setTimeout(() => t.remove(), 500);
    }, 3400);
  }

  bark(at: { x: number; y: number } | null, speaker: string, text: string, ms = 3200): void {
    clearTimeout(this.barkTimer);
    const b = this.barkEl;
    clear(b);
    if (speaker) b.append(h('div', { class: 'bark-who sc' }, speaker));
    b.append(h('div', { class: 'bark-text' }, richText(text)));
    b.classList.toggle('free', !at);
    if (at) {
      b.style.left = `${Math.round(at.x)}px`;
      b.style.top = `${Math.round(at.y)}px`;
    } else {
      b.style.left = '';
      b.style.top = '';
    }
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    this.barkTimer = window.setTimeout(() => b.classList.remove('show'), ms);
  }

  hoverLabel(text: string | null, sub?: string): void {
    if (!text) return void this.hover.classList.remove('show');
    clear(this.hover);
    this.hover.append(h('div', { class: 'hl-text' }, text));
    if (sub) this.hover.append(h('div', { class: 'hl-sub sc' }, sub));
    this.hover.classList.add('show');
    this.placeHover();
  }

  // ---------- dice ----------

  roll(r: CheckResult): Promise<void> {
    // Old choices must not look live while the dice decide.
    this.dlg.setLocked(true);
    return this.dice.roll(r);
  }

  // ---------- dialogue ----------

  dialogue(view: DialogueView): Promise<number> {
    this.root.classList.add('in-dialogue');
    this.dlg.setLocked(false);
    return this.dlg.show(view);
  }

  closeDialogue(): void {
    this.root.classList.remove('in-dialogue');
    this.dlg.setLocked(false);
    this.dlg.close();
  }

  // ---------- combat ----------

  combatBar(state: CombatBarState | null): void {
    this.root.classList.toggle('in-combat', !!state);
    this.combat.render(state);
  }

  onCombatAction(fn: (a: CombatAction) => void): void {
    this.combat.onAction(fn);
  }

  onHudAction(fn: (a: 'sneak' | { ability: string }) => void): void {
    this.hudAction = fn;
  }

  async banner(text: string, sub?: string): Promise<void> {
    const b = this.bannerEl;
    clear(b);
    append(b, [h('div', { class: 'banner-rule' }), h('div', { class: 'banner-text' }, text), sub ? h('div', { class: 'banner-sub sc' }, sub) : null, h('div', { class: 'banner-rule' })]);
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    await wait(reducedMotion() ? 900 : 1150);
    b.classList.remove('show');
  }

  // ---------- panels ----------

  setJournal(entries: JournalEntryView[]): void {
    this.panels.setJournal(entries);
  }
  setInventory(items: InventoryItemView[], onUse: (id: string) => void): void {
    this.panels.setInventory(items, onUse);
  }
  setCharacter(c: Character, extra: { lines: string[] }): void {
    this.panels.setCharacter(c, extra);
  }
  togglePanel(p: PanelId): void {
    this.panels.toggle(p);
  }
  closePanels(): boolean {
    return this.panels.closeAll();
  }
  setMenu(hd: MenuHandlers): void {
    this.panels.setMenu(hd);
  }

  // ---------- fade ----------

  async fade(to: 'black' | 'clear', ms = 600): Promise<void> {
    const f = this.fadeEl;
    f.style.transitionDuration = `${ms}ms`;
    void f.offsetWidth;
    f.classList.toggle('black', to === 'black');
    await wait(ms);
  }
}

export function createUI(): UI {
  return new DomUI();
}
