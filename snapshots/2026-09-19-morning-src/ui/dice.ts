// The dice panel. Two CSS 3D cubes tumble and land, the terms slide in, then the band.
import type { CheckResult } from '../rules/check';
import type { Band } from '../rules/dice';
import { clear, h, reducedMotion, signed } from './dom';

export const BAND_TEXT: Record<Band, string> = {
  full: 'Full success',
  partial: 'Success, at a cost',
  miss: 'Miss',
};

// Pip positions on a 3x3 grid, cells 1..9.
const PIPS: Record<number, number[]> = {
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

// Face placement and the cube rotation that brings each value to the front.
const FACES: { v: number; place: string }[] = [
  { v: 1, place: 'rotateY(0deg)' },
  { v: 6, place: 'rotateY(180deg)' },
  { v: 2, place: 'rotateY(90deg)' },
  { v: 5, place: 'rotateY(-90deg)' },
  { v: 3, place: 'rotateX(90deg)' },
  { v: 4, place: 'rotateX(-90deg)' },
];
const SHOW: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  2: [0, -90],
  5: [0, 90],
  3: [-90, 0],
  4: [90, 0],
};

function makeDie(): { el: HTMLElement; cube: HTMLElement } {
  const cube = h('div', { class: 'die-cube' });
  for (const f of FACES) {
    const face = h('div', { class: 'die-face', style: `transform: ${f.place} translateZ(var(--die-half))` });
    for (let i = 1; i <= 9; i++) face.append(h('i', { class: PIPS[f.v].includes(i) ? 'pip on' : 'pip' }));
    cube.append(face);
  }
  const el = h('div', { class: 'die' }, h('div', { class: 'die-shadow' }), h('div', { class: 'die-tilt' }, cube));
  return { el, cube };
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class DicePanel {
  el: HTMLElement;
  private head: HTMLElement;
  private dice: HTMLElement;
  private terms: HTMLElement;
  private result: HTMLElement;
  private timers: number[] = [];
  private anims: Animation[] = [];
  private finish: (() => void) | null = null;
  private hideTimer = 0;

  constructor() {
    this.head = h('div', { class: 'roll-label' });
    this.dice = h('div', { class: 'roll-dice' });
    this.terms = h('div', { class: 'roll-terms' });
    this.result = h('div', { class: 'roll-result' });
    this.el = h(
      'div',
      { class: 'roll-panel panel', role: 'status', 'aria-live': 'polite' },
      h('div', { class: 'roll-kicker sc' }, 'The dice'),
      this.head,
      h('div', { class: 'roll-body' }, this.dice, h('div', { class: 'roll-side' }, this.terms, this.result)),
    );
    this.el.addEventListener('click', () => this.finish?.());
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private reset() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    for (const a of this.anims) a.cancel();
    this.anims = [];
    clearTimeout(this.hideTimer);
  }

  roll(r: CheckResult): Promise<void> {
    this.finish?.();
    this.reset();
    const quick = reducedMotion();
    clear(this.dice);
    clear(this.terms);
    clear(this.result);
    this.head.textContent = r.label;
    this.el.dataset.band = '';
    this.el.classList.remove('landed');
    this.el.classList.add('open');

    const cubes = [makeDie(), makeDie()];
    const tumble = quick ? 0 : 720;
    cubes.forEach((d, i) => {
      this.dice.append(d.el);
      const [fx, fy] = SHOW[r.dice[i]];
      const end = `rotateX(${fx}deg) rotateY(${fy}deg) rotateZ(0deg)`;
      d.cube.style.transform = end;
      if (!quick) {
        const sx = fx + 360 * (2 + i) + rnd(-60, 60);
        const sy = fy + 360 * (1 + i) * (i ? -1 : 1) + rnd(-60, 60);
        const sz = rnd(-200, 200);
        this.anims.push(
          d.cube.animate(
            [
              { transform: `rotateX(${sx}deg) rotateY(${sy}deg) rotateZ(${sz}deg)` },
              { transform: end },
            ],
            { duration: tumble + i * 90, easing: 'cubic-bezier(.2,.7,.25,1)' },
          ),
        );
        this.anims.push(
          d.el.animate(
            [
              { transform: `translate(${rnd(-26, 26)}px, -46px) scale(.8)` },
              { transform: 'translate(0, 6px) scale(1.02)', offset: 0.62 },
              { transform: 'translate(0, -5px)', offset: 0.8 },
              { transform: 'translate(0, 0) scale(1)' },
            ],
            { duration: tumble + i * 90, easing: 'ease-out' },
          ),
        );
      }
    });

    const landAt = quick ? 0 : tumble + 60;
    const step = quick ? 0 : 110;
    const rows: HTMLElement[] = [];
    rows.push(
      h('div', { class: 'term dice-term' }, h('span', { class: 'term-v' }, String(r.dice[0] + r.dice[1])), h('span', { class: 'term-l' }, `Dice, ${r.dice[0]} and ${r.dice[1]}`)),
    );
    for (const t of r.terms) {
      if (t.value === 0 && t.label !== r.terms[0]?.label) continue;
      rows.push(
        h(
          'div',
          { class: `term ${t.value < 0 ? 'neg' : t.value > 0 ? 'pos' : 'zero'}` },
          h('span', { class: 'term-v' }, signed(t.value)),
          h('span', { class: 'term-l' }, t.label),
        ),
      );
    }
    const band = h('div', { class: 'band' }, r.bandText?.[r.band] ?? BAND_TEXT[r.band]);
    const total = h('div', { class: 'total' }, h('span', { class: 'total-n' }, String(r.total)), band);

    this.later(landAt, () => this.el.classList.add('landed'));
    rows.forEach((row, i) => this.later(landAt + i * step, () => this.terms.append(row)));
    const totalAt = landAt + rows.length * step + (quick ? 0 : 80);
    this.later(totalAt, () => {
      this.result.append(total);
      this.el.dataset.band = r.band;
    });

    const doneAt = Math.max(1600, totalAt + 450);
    return new Promise<void>((resolve) => {
      let done = false;
      const end = () => {
        if (done) return;
        done = true;
        this.finish = null;
        this.reset();
        // Snap everything into place so a skip still shows the result.
        for (const a of this.anims) a.finish();
        if (!this.result.firstChild) {
          for (const row of rows) if (!row.isConnected) this.terms.append(row);
          this.result.append(total);
        }
        this.el.dataset.band = r.band;
        this.el.classList.add('landed');
        this.hideTimer = window.setTimeout(() => this.el.classList.remove('open'), 900);
        resolve();
      };
      this.finish = end;
      this.later(doneAt, end);
    });
  }
}
