// The explore HUD: portrait plate, wounds, guard, crystals, abilities, objective.
import { SEVERITIES, WOUND_TEXT } from '../rules/wounds';
import type { HudAbility, HudState } from './types';
import { clear, h, svg } from './dom';
import { ABILITY_GLYPH, G, RACE_GLYPH, STRIP_GLYPH, WOUND_GLYPH } from './glyphs';

export type HudPanel = 'journal' | 'inventory' | 'character' | 'help' | 'menu';
export interface HudHandlers {
  panel(p: HudPanel): void;
  action(a: 'sneak' | { ability: string }): void;
}

const STRIP: { id: HudPanel | 'sneak'; label: string; key: string }[] = [
  { id: 'journal', label: 'Journal', key: 'J' },
  { id: 'inventory', label: 'Pack', key: 'I' },
  { id: 'character', label: 'Character', key: 'K' },
  { id: 'sneak', label: 'Sneak', key: 'C' },
  { id: 'help', label: 'Help', key: 'H' },
  { id: 'menu', label: 'Menu', key: 'Esc' },
];

const SEV_LABEL = { light: 'Light', moderate: 'Moderate', severe: 'Severe' } as const;
const CRYSTAL_LABEL = { amber: 'Amber crystal', crimson: 'Crimson crystal', pale: 'Pale crystal', violet: 'Violet crystal' } as const;
const CRYSTAL_USE = { amber: 'Force.', crimson: 'Healing.', pale: 'Reveals what is hidden.', violet: 'Pushes.' } as const;

export function abilityButton(a: HudAbility, opts: { selected?: boolean; blocked?: string; onClick?: () => void } = {}): HTMLElement {
  const reason = a.cooldown > 0 ? `Ready in ${a.cooldown} ${a.cooldown === 1 ? 'turn' : 'turns'}.` : a.disabled ?? opts.blocked;
  const tip = [a.desc, a.rollLabel ? `Roll: ${a.rollLabel}` : '', reason ?? ''].filter(Boolean).join('\n');
  const initials = a.name
    .split(/\s+/)
    .filter((w) => w.length > 2 || w === a.name)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  const btn = h(
    'button',
    {
      class: `abtn ${opts.selected ? 'sel' : ''} ${reason ? 'off' : ''}`,
      type: 'button',
      'data-tip': a.name,
      'data-tip-sub': tip,
      'aria-label': `${a.name}. ${reason ?? ''}`,
      'aria-disabled': reason ? 'true' : null,
      onclick: () => {
        if (!reason) opts.onClick?.();
      },
    },
    ABILITY_GLYPH[a.id] ? svg(ABILITY_GLYPH[a.id], 'glyph abtn-glyph') : h('span', { class: 'abtn-mono' }, initials),
    h('span', { class: 'abtn-key' }, a.key),
    a.cooldown > 0 ? h('span', { class: 'abtn-cd' }, String(a.cooldown)) : null,
  );
  return btn;
}

export class Hud {
  el: HTMLElement;
  private objective: HTMLElement;
  private objText: HTMLElement;
  private plate: HTMLElement;
  private portrait: HTMLElement;
  private name: HTMLElement;
  private sub: HTMLElement;
  private wounds: HTMLElement;
  private guard: HTMLElement;
  private penalty: HTMLElement;
  private crystals: HTMLElement;
  private abilities: HTMLElement;
  private sneak: HTMLElement;
  private lastObjective = '';

  private sneakBtn: HTMLElement | null = null;
  private strip: HTMLElement;

  constructor(private handlers: HudHandlers) {
    this.strip = h('div', { class: 'hud-strip' });
    for (const b of STRIP) {
      const btn = h(
        'button',
        {
          class: `sbtn sbtn-${b.id}`,
          type: 'button',
          'data-tip': `${b.label} (${b.key})`,
          'data-tip-sub': b.id === 'sneak' ? 'Move quietly. Enemies notice you later.' : null,
          'aria-label': `${b.label}, key ${b.key}`,
          onclick: () => (b.id === 'sneak' ? this.handlers.action('sneak') : this.handlers.panel(b.id)),
        },
        svg(STRIP_GLYPH[b.id], 'glyph'),
        h('span', { class: 'sbtn-key' }, b.key),
      );
      if (b.id === 'sneak') {
        btn.setAttribute('aria-pressed', 'false');
        this.sneakBtn = btn;
      }
      this.strip.append(btn);
    }
    this.objText = h('span', { class: 'obj-text' });
    this.objective = h(
      'div',
      { class: 'hud-obj' },
      svg(G.quest, 'glyph obj-glyph'),
      h('div', null, h('div', { class: 'obj-kicker sc' }, 'Objective'), this.objText),
    );
    this.portrait = h('div', { class: 'hud-portrait' });
    this.name = h('div', { class: 'hud-name' });
    this.sub = h('div', { class: 'hud-sub sc' });
    this.wounds = h('div', { class: 'hud-wounds' });
    this.guard = h('div', { class: 'hud-guard' });
    this.penalty = h('div', { class: 'hud-penalty', 'data-tip': 'Wound penalty', 'data-tip-sub': 'Applied to every roll until the wound is treated.' });
    this.crystals = h('div', { class: 'hud-crystals' });
    this.abilities = h('div', { class: 'hud-abilities' });
    this.sneak = h('div', { class: 'hud-sneak' }, svg(G.eye), h('span', { class: 'sc' }, 'Sneaking'));
    this.plate = h(
      'div',
      { class: 'hud-plate panel' },
      this.portrait,
      h(
        'div',
        { class: 'hud-info' },
        h('div', { class: 'hud-id' }, this.name, this.penalty),
        this.sub,
        h('div', { class: 'hud-bars' }, this.wounds, this.guard),
        this.crystals,
      ),
    );
    this.el = h(
      'div',
      { class: 'hud' },
      this.objective,
      h('div', { class: 'hud-bottom' }, h('div', { class: 'hud-top-row' }, this.strip, this.sneak), h('div', { class: 'hud-row' }, this.plate, this.abilities)),
    );
  }

  update(s: HudState) {
    this.el.dataset.mode = s.mode;
    this.el.dataset.race = s.race;
    if (s.objective !== this.lastObjective) {
      this.lastObjective = s.objective;
      this.objText.textContent = s.objective;
      this.objective.classList.toggle('empty', !s.objective);
      this.objective.classList.remove('flash');
      void this.objective.offsetWidth;
      this.objective.classList.add('flash');
    }
    if (this.portrait.dataset.race !== s.race) {
      this.portrait.dataset.race = s.race;
      this.portrait.innerHTML = RACE_GLYPH[s.race];
    }
    this.name.textContent = s.name;
    this.sub.textContent = `${s.raceLabel} · ${s.roleLabel}`;

    clear(this.wounds);
    for (const sev of SEVERITIES) {
      this.wounds.append(
        h(
          'div',
          { class: `wslot ${sev} ${s.wounds[sev] ? 'on' : ''}`, 'data-tip': `${SEV_LABEL[sev]} wound${s.wounds[sev] ? '' : ', open'}`, 'data-tip-sub': WOUND_TEXT[sev] },
          svg(WOUND_GLYPH[sev]),
        ),
      );
    }

    clear(this.guard);
    this.guard.setAttribute('data-tip', `Guard ${s.guard} of ${s.guardMax}`);
    this.guard.setAttribute('data-tip-sub', 'Guard soaks a hit before a wound lands. It refills after a fight.');
    for (let i = 0; i < s.guardMax; i++) this.guard.append(h('i', { class: i < s.guard ? 'on' : '' }));

    this.penalty.textContent = String(s.penalty);
    this.penalty.classList.toggle('show', s.penalty < 0);

    clear(this.crystals);
    for (const c of s.crystals) {
      if (c.integrity <= 0) continue;
      const ticks = h('span', { class: 'ticks' });
      for (let i = 0; i < 3; i++) ticks.append(h('i', { class: i < c.integrity ? 'on' : '' }));
      this.crystals.append(
        h(
          'div',
          { class: `crys ${c.colour}`, 'data-tip': CRYSTAL_LABEL[c.colour], 'data-tip-sub': `${CRYSTAL_USE[c.colour]} Integrity ${c.integrity} of 3.` },
          svg(G.crystal),
          ticks,
        ),
      );
    }

    clear(this.abilities);
    for (const a of s.abilities) this.abilities.append(abilityButton(a, { onClick: () => this.handlers.action({ ability: a.id }) }));

    this.sneak.classList.toggle('show', s.sneaking);
    this.sneakBtn?.classList.toggle('on', s.sneaking);
    this.sneakBtn?.setAttribute('aria-pressed', String(s.sneaking));
  }
}
