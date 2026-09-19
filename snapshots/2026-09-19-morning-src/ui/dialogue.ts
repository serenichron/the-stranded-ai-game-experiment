// Dialogue panel: portrait, speaker, typed text, numbered choices with odds.
import type { DialogueView } from './types';
import { clear, emphasis, h, isTyping, pct, reducedMotion } from './dom';
import { portraitSvg } from './portraits';

export class DialoguePanel {
  el: HTMLElement;
  private portrait: HTMLElement;
  private speaker: HTMLElement;
  private text: HTMLElement;
  private choices: HTMLElement;
  private typing = 0;
  private finishTyping: (() => void) | null = null;
  private pick: ((i: number) => void) | null = null;
  private view: DialogueView | null = null;
  private resolver: ((i: number) => void) | null = null;
  private locked = false;

  constructor() {
    this.portrait = h('div', { class: 'dlg-portrait' });
    this.speaker = h('div', { class: 'dlg-speaker sc' });
    this.text = h('div', { class: 'dlg-text' });
    this.choices = h('ol', { class: 'dlg-choices' });
    this.el = h(
      'div',
      { class: 'dlg panel', role: 'dialog', 'aria-live': 'polite' },
      this.portrait,
      h('div', { class: 'dlg-main' }, this.speaker, this.text, this.choices),
    );
    this.text.addEventListener('click', () => this.finishTyping?.());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  private onKey(e: KeyboardEvent) {
    if (!this.resolver || !this.view || this.locked || isTyping(e)) return;
    const k = e.key;
    if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      if (this.finishTyping) return this.finishTyping();
      if (this.view.choices.length === 0) this.pick?.(0);
      return;
    }
    if (/^[1-9]$/.test(k)) {
      const i = Number(k) - 1;
      const c = this.view.choices[i];
      if (!c || c.disabled) return;
      e.preventDefault();
      this.finishTyping?.();
      this.pick?.(i);
    }
  }

  show(view: DialogueView): Promise<number> {
    // A new line replaces any pending one.
    if (this.resolver) this.resolver(-1);
    this.view = view;
    this.el.classList.add('open');
    this.el.classList.toggle('narration', !view.speaker);
    clear(this.portrait);
    const kind = view.portrait ?? (view.speaker ? 'player' : 'narrator');
    this.portrait.innerHTML = portraitSvg(kind);
    this.portrait.dataset.kind = kind;
    this.speaker.textContent = view.speaker;
    this.speaker.style.display = view.speaker ? '' : 'none';
    this.renderChoices(view);
    this.choices.classList.remove('show');

    return new Promise<number>((resolve) => {
      let settled = false;
      const done = (i: number) => {
        if (settled) return;
        settled = true;
        this.resolver = null;
        this.pick = null;
        if (i >= 0) resolve(i);
      };
      this.resolver = done;
      this.pick = (i) => {
        if (!this.locked) done(i);
      };
      this.typeText(view.text, () => this.choices.classList.add('show'));
    });
  }

  /** Dim the choices and ignore input, e.g. while a roll is showing. */
  setLocked(on: boolean) {
    this.locked = on;
    this.el.classList.toggle('locked', on);
  }

  close() {
    this.el.classList.remove('open');
    cancelAnimationFrame(this.typing);
    this.finishTyping = null;
    this.resolver = null;
    this.pick = null;
    this.view = null;
  }

  private typeText(text: string, after: () => void) {
    cancelAnimationFrame(this.typing);
    clear(this.text);
    const segs = emphasis(text);
    const spans = segs.map((s) => {
      const el = s.em ? h('em') : h('span');
      this.text.append(el);
      return el;
    });
    const total = segs.reduce((n, s) => n + s.text.length, 0);
    const paint = (n: number) => {
      let left = n;
      segs.forEach((s, i) => {
        const take = Math.max(0, Math.min(s.text.length, left));
        spans[i].textContent = s.text.slice(0, take);
        left -= s.text.length;
      });
    };
    const finish = () => {
      cancelAnimationFrame(this.typing);
      paint(total);
      this.text.classList.remove('typing');
      this.finishTyping = null;
      after();
    };
    if (reducedMotion() || total === 0) return finish();
    this.text.classList.add('typing');
    const start = performance.now();
    const cps = 90; // characters per second
    const tick = (t: number) => {
      const n = Math.floor(((t - start) / 1000) * cps);
      if (n >= total) return finish();
      paint(n);
      this.typing = requestAnimationFrame(tick);
    };
    this.finishTyping = finish;
    paint(0);
    this.typing = requestAnimationFrame(tick);
  }

  private renderChoices(view: DialogueView) {
    clear(this.choices);
    if (view.choices.length === 0) {
      this.choices.append(
        h(
          'li',
          { class: 'dlg-choice continue' },
          h('button', { type: 'button', onclick: () => this.pick?.(0) }, h('span', { class: 'num' }, '↵'), h('span', { class: 'ctext' }, 'Continue')),
        ),
      );
      return;
    }
    view.choices.forEach((c, i) => {
      const odds = c.odds
        ? h(
            'span',
            { class: 'odds', 'aria-label': `Miss ${pct(c.odds.miss)}, at a cost ${pct(c.odds.partial)}, full ${pct(c.odds.full)}` },
            h('span', { class: 'odds-bar' }, h('i', { class: 'miss', style: `flex-grow:${c.odds.miss}` }), h('i', { class: 'partial', style: `flex-grow:${c.odds.partial}` }), h('i', { class: 'full', style: `flex-grow:${c.odds.full}` })),
            h(
              'span',
              { class: 'odds-tip panel' },
              h('span', { class: 'o-miss' }, `Miss ${pct(c.odds.miss)}`),
              h('span', { class: 'o-partial' }, `At a cost ${pct(c.odds.partial)}`),
              h('span', { class: 'o-full' }, `Full ${pct(c.odds.full)}`),
            ),
          )
        : null;
      const btn = h(
        'button',
        {
          type: 'button',
          disabled: !!c.disabled,
          onclick: () => {
            this.finishTyping?.();
            this.pick?.(i);
          },
        },
        h('span', { class: 'num' }, String(i + 1)),
        h(
          'span',
          { class: 'ctext' },
          c.tag ? h('span', { class: 'tag' }, c.tag + ' ') : null,
          ...emphasis(c.text).map((s) => (s.em ? h('em', null, s.text) : s.text)),
          c.disabled ? h('span', { class: 'why' }, c.disabled) : null,
          c.stakes ? h('span', { class: 'stakes' }, c.stakes) : null,
        ),
        odds,
      );
      this.choices.append(
        h('li', { class: `dlg-choice ${c.disabled ? 'disabled' : ''} ${c.seen ? 'seen' : ''}`, style: `--i:${i}` }, btn),
      );
    });
  }
}
