// Character creation: origin, role, stats, skills, name.
import {
  RACE_BLURB,
  RACE_LABEL,
  RACE_PACKAGE,
  ROLES,
  ROLE_BLURB,
  ROLE_LABEL,
  SPECS,
  SPEC_LABEL,
  STATS,
  STAT_HINT,
  STAT_LABEL,
  STAT_POINTS,
  SUGGESTED,
  SUGGESTED_PICKS,
  buildCharacter,
  canPick,
  pointsSpent,
  validateStats,
  type Race,
  type Role,
  type Spec,
  type Stat,
  type Stats,
} from '../rules/character';
import { ABILITIES, ROLE_ABILITY, abilitiesFor } from '../rules/abilities';
import type { CreationChoice, CreationPreview } from './types';
import { clear, h, signed, svg } from './dom';
import { RACE_GLYPH, ROLE_GLYPH } from './glyphs';

const RACES: Race[] = ['minaa', 'sehari', 'iskari'];
const DEFAULT_NAME: Record<Race, string> = {
  minaa: 'Tasko',
  sehari: 'Ruun',
  iskari: 'Vessel of the Ninth Stair',
};
const STEPS = ['Origin', 'Role', 'Stats', 'Skills', 'Name'];
const FALLBACK_PICKS: Spec[] = ['athletics', 'crystalLore', 'stealth', 'medicine', 'melee', 'ranged', 'survival', 'lore', 'insight'];

// Short descriptions for the skill cards. Plain, one line each.
const SPEC_HINT: Partial<Record<Spec, string>> = {
  archaeology: 'Read old sites and what was left in them.',
  lore: 'Know the stories, names and old history.',
  linguistics: 'Pick apart unknown words and scripts.',
  translator: "Carry meaning across tongues. Iskari only.",
  cartography: 'Read and make maps, find the way.',
  crystalLore: 'Know what each crystal does and how it breaks.',
  azalosTech: "Wake and work Aza'los devices.",
  minaaTech: "Fuse and run Mi'naa salvage.",
  telsharinTech: "Understand the machinery in the Tel'sharin.",
  mechanics: 'Repair and rig anything with moving parts.',
  melee: 'Fight up close.',
  ranged: 'Shoot, throw, hit at range.',
  athletics: 'Climb, jump, run, swim.',
  hardiness: 'Endure heat, thirst and pain.',
  stealth: 'Move unseen and unheard.',
  deception: 'Lie well and forge what you need.',
  sleight: 'Quick hands. Locks and pockets.',
  tracking: 'Read tracks and follow them.',
  survival: 'Find water, food and shelter.',
  naturalism: 'Know plants and creatures.',
  negotiation: 'Strike a deal both sides can take.',
  intimidation: 'Make people back down.',
  insight: 'See what someone is hiding.',
  channellingDepth: 'Draw deeper through a crystal. Sehari only.',
  boneSinging: 'Listen to old places, the way the old Sehari did. Sehari only.',
  medicine: 'Treat wounds and sickness.',
};

export function runCreation(host: HTMLElement, preview?: CreationPreview): Promise<CreationChoice> {
  return new Promise((resolve) => {
    let step = 0;
    let race: Race | null = null;
    let bodySel: 'male' | 'female' = 'male';
    let role: Role | null = null;
    let stats: Stats = { body: 0, edge: 0, mind: 0, will: 0, presence: 0, resonance: 0 };
    let picks: Spec[] = [];
    let picksFor = '';
    let name = '';
    let nameTouched = false;
    let shown = -1;

    const stepper = h('ol', { class: 'cc-steps' });
    const body = h('div', { class: 'cc-body' });
    const back = h('button', { class: 'btn ghost', type: 'button' }, 'Back');
    const next = h('button', { class: 'btn primary', type: 'button' }, 'Next');
    const hint = h('div', { class: 'cc-hint' });
    const screen = h(
      'div',
      { class: 'screen creation' },
      h(
        'div',
        { class: 'cc-frame panel' },
        h('header', { class: 'cc-head' }, h('div', { class: 'sc cc-kicker' }, 'A new traveller'), stepper),
        body,
        h('footer', { class: 'cc-foot' }, back, hint, next),
      ),
    );
    host.append(screen);
    requestAnimationFrame(() => screen.classList.add('in'));

    const defaultPicks = (): Spec[] => {
      if (!race || !role) return [];
      const r = race;
      const ok = (s: Spec) => canPick(r, s) && !RACE_PACKAGE[r].includes(s);
      const out = SUGGESTED_PICKS[role].filter(ok);
      for (const s of FALLBACK_PICKS) if (out.length < 2 && ok(s) && !out.includes(s)) out.push(s);
      return out.slice(0, 2);
    };

    const valid = (): string | null => {
      if (step === 0) return race ? null : 'Choose where you come from.';
      if (step === 1) return role ? null : 'Choose what you do.';
      if (step === 2) return validateStats(stats);
      if (step === 3) return picks.length === 2 ? null : `Choose ${2 - picks.length} more.`;
      if (step === 4) return name.trim() ? null : 'Give a name.';
      return null;
    };

    const refreshFoot = () => {
      const err = valid();
      next.toggleAttribute('disabled', !!err);
      next.textContent = step === STEPS.length - 1 ? 'Begin the errand' : 'Next';
      back.style.visibility = step === 0 ? 'hidden' : 'visible';
      hint.textContent = err ?? '';
    };

    const renderSteps = () => {
      clear(stepper);
      STEPS.forEach((s, i) =>
        stepper.append(
          h('li', { class: i === step ? 'on' : i < step ? 'done' : '' }, h('span', { class: 'n' }, String(i + 1)), h('span', { class: 'sc' }, s)),
        ),
      );
    };

    const card = (opts: { on: boolean; glyph: string; title: string; text: string; extra?: Node | null; onPick: () => void; cls?: string }) =>
      h(
        'button',
        { class: `cc-card ${opts.cls ?? ''} ${opts.on ? 'on' : ''}`, type: 'button', 'aria-pressed': String(opts.on), onclick: opts.onPick },
        svg(opts.glyph, 'glyph cc-glyph'),
        h('div', { class: 'cc-card-title' }, opts.title),
        h('p', null, opts.text),
        opts.extra ?? null,
      );

    const renderRace = () => {
      body.append(h('h2', { class: 'cc-title' }, 'Where do you come from'));
      const grid = h('div', { class: 'cc-grid three' });
      for (const r of RACES) {
        grid.append(
          card({
            on: race === r,
            glyph: RACE_GLYPH[r],
            title: RACE_LABEL[r],
            text: RACE_BLURB[r],
            cls: `race-${r}`,
            extra: h(
              'div',
              { class: 'cc-chips' },
              h('div', { class: 'sc cc-mini' }, 'You know'),
              ...RACE_PACKAGE[r].map((s) => h('span', { class: 'chip' }, SPEC_LABEL[s])),
            ),
            onPick: () => {
              race = r;
              if (!nameTouched) name = DEFAULT_NAME[r];
              render();
            },
          }),
        );
      }
      body.append(grid);
      // Body shape. Iskari have no sex, but each body was made to match a particular Aza'los.
      const isk = race === 'iskari';
      const opt = (b: 'male' | 'female', label: string) =>
        h('button', {
          class: `btn ${bodySel === b ? 'primary' : 'ghost'} cc-body-btn`, type: 'button', 'aria-pressed': String(bodySel === b),
          onclick: () => { bodySel = b; render(); },
        }, label);
      body.append(
        h('div', { class: 'cc-bodyrow' },
          h('div', { class: 'sc cc-mini' }, 'Body'),
          opt('male', isk ? 'Broad-shouldered' : 'Man'),
          opt('female', isk ? 'Narrow-shouldered' : 'Woman'),
          h('p', { class: 'cc-bodynote' }, isk
            ? "Iskari have no sex. Each body was shaped to match one of the Aza'los."
            : 'Your body changes how you look. It changes nothing in the rules.'),
        ),
      );
    };

    const renderRole = () => {
      body.append(h('h2', { class: 'cc-title' }, 'What do you do'));
      const grid = h('div', { class: 'cc-grid three roles' });
      for (const r of ROLES) {
        const ab = ABILITIES[ROLE_ABILITY[r]];
        grid.append(
          card({
            on: role === r,
            glyph: ROLE_GLYPH[r],
            title: ROLE_LABEL[r],
            text: ROLE_BLURB[r],
            extra: ab ? h('div', { class: 'cc-ability' }, h('span', { class: 'sc' }, 'Ability'), ' ', ab.name) : null,
            onPick: () => {
              role = r;
              render();
            },
          }),
        );
      }
      body.append(grid);
    };

    const renderStats = () => {
      const spent = pointsSpent(stats);
      const left = STAT_POINTS - spent;
      body.append(
        h(
          'div',
          { class: 'cc-row-head' },
          h('h2', { class: 'cc-title' }, 'How you are made'),
          h(
            'div',
            { class: `cc-points ${left === 0 ? 'ok' : left < 0 ? 'over' : ''}` },
            h('span', { class: 'n' }, String(left)),
            h('span', { class: 'sc' }, left === 1 || left === -1 ? 'point left' : 'points left'),
          ),
        ),
        h('p', { class: 'cc-note' }, `Spend ${STAT_POINTS} points. Each stat runs from -1 to +3. Dropping one to -1 gives you a point back.`),
      );
      const list = h('div', { class: 'cc-stats' });
      const sugg = role ? SUGGESTED[role] : null;
      for (const s of STATS) {
        const v = stats[s];
        const set = (d: number) => {
          stats = { ...stats, [s]: v + d };
          render();
        };
        const pips = h('div', { class: 'cc-pips' });
        for (let i = -1; i <= 3; i++) {
          if (i === 0) pips.append(h('i', { class: 'zero' }));
          else pips.append(h('i', { class: (i > 0 ? v >= i : v <= i) ? (i < 0 ? 'on neg' : 'on') : '' }));
        }
        list.append(
          h(
            'div',
            { class: 'cc-stat' },
            h('div', { class: 'cc-stat-name' }, h('div', { class: 'sc' }, STAT_LABEL[s]), h('div', { class: 'cc-stat-hint' }, STAT_HINT[s as Stat])),
            h('button', { class: 'step', type: 'button', 'aria-label': `Lower ${STAT_LABEL[s]}`, disabled: v <= -1, onclick: () => set(-1) }, '−'),
            h('div', { class: `cc-stat-v ${v < 0 ? 'neg' : v > 0 ? 'pos' : ''}` }, signed(v)),
            h('button', { class: 'step', type: 'button', 'aria-label': `Raise ${STAT_LABEL[s]}`, disabled: v >= 3 || left <= 0, onclick: () => set(1) }, '+'),
            pips,
            sugg ? h('div', { class: 'cc-sugg', title: 'Suggested for your role' }, signed(sugg[s])) : null,
          ),
        );
      }
      body.append(list);
      body.append(
        h(
          'div',
          { class: 'cc-actions' },
          h(
            'button',
            {
              class: 'btn',
              type: 'button',
              disabled: !role,
              onclick: () => {
                if (role) stats = { ...SUGGESTED[role] };
                render();
              },
            },
            role ? `Use suggested for ${ROLE_LABEL[role]}` : 'Use suggested',
          ),
          h(
            'button',
            {
              class: 'btn ghost',
              type: 'button',
              onclick: () => {
                stats = { body: 0, edge: 0, mind: 0, will: 0, presence: 0, resonance: 0 };
                render();
              },
            },
            'Clear',
          ),
        ),
      );
    };

    const renderPicks = () => {
      if (!race || !role) return;
      const r = race;
      const key = `${race}/${role}`;
      if (picksFor !== key) {
        picks = defaultPicks();
        picksFor = key;
      }
      body.append(
        h(
          'div',
          { class: 'cc-row-head' },
          h('h2', { class: 'cc-title' }, 'What you have learned'),
          h('div', { class: `cc-points ${picks.length === 2 ? 'ok' : ''}` }, h('span', { class: 'n' }, `${picks.length}/2`), h('span', { class: 'sc' }, 'chosen')),
        ),
        h(
          'div',
          { class: 'cc-known' },
          h('span', { class: 'sc cc-mini' }, `${RACE_LABEL[r]} upbringing`),
          ...RACE_PACKAGE[r].map((s) => h('span', { class: 'chip fixed' }, SPEC_LABEL[s])),
        ),
        h('p', { class: 'cc-note' }, 'Pick two more. Each one is Trained, worth +1 on rolls that use it.'),
      );
      const grid = h('div', { class: 'cc-specs' });
      for (const s of SPECS) {
        if (RACE_PACKAGE[r].includes(s) || !canPick(r, s)) continue;
        const on = picks.includes(s);
        const full = !on && picks.length >= 2;
        grid.append(
          h(
            'button',
            {
              class: `cc-spec ${on ? 'on' : ''} ${full ? 'full' : ''}`,
              type: 'button',
              'aria-pressed': String(on),
              onclick: () => {
                if (on) picks = picks.filter((p) => p !== s);
                else if (picks.length < 2) picks = [...picks, s];
                else picks = [picks[1], s];
                render();
              },
            },
            h('span', { class: 'cc-spec-name' }, SPEC_LABEL[s]),
            h('span', { class: 'cc-spec-hint' }, SPEC_HINT[s] ?? ''),
          ),
        );
      }
      body.append(grid);
    };

    const renderName = () => {
      if (!race || !role) return;
      const input = h('input', {
        class: 'cc-name',
        type: 'text',
        maxlength: 40,
        spellcheck: 'false',
        value: name,
        placeholder: DEFAULT_NAME[race],
        'aria-label': 'Name',
      }) as HTMLInputElement;
      input.addEventListener('input', () => {
        name = input.value;
        nameTouched = true;
        refreshFoot();
        summaryName.textContent = name.trim() || DEFAULT_NAME[race!];
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !valid()) go(1);
      });
      const c = buildCharacter(name || DEFAULT_NAME[race], race, role, stats, picks);
      const summaryName = h('div', { class: 'sum-name' }, name.trim() || DEFAULT_NAME[race]);
      const statRow = h('div', { class: 'sum-stats' });
      for (const s of STATS) statRow.append(h('div', { class: 'sum-stat' }, h('span', { class: 'sc' }, STAT_LABEL[s]), h('b', null, signed(stats[s]))));
      const abil = h('div', { class: 'sum-abil' });
      for (const a of abilitiesFor(c)) abil.append(h('div', { class: 'sum-a' }, h('div', { class: 'sum-a-name' }, a.name), h('div', { class: 'sum-a-desc' }, a.desc)));
      body.append(
        h('h2', { class: 'cc-title' }, 'What they call you'),
        h('div', { class: 'cc-name-row' }, input, h('button', { class: 'btn ghost', type: 'button', onclick: () => { name = DEFAULT_NAME[race!]; nameTouched = false; render(); } }, 'Default')),
        h(
          'div',
          { class: 'sum-card' },
          h(
            'div',
            { class: 'sum-top' },
            h('div', { class: `sum-portrait race-${race}` }, svg(RACE_GLYPH[race])),
            h('div', null, summaryName, h('div', { class: 'sum-sub sc' }, `${RACE_LABEL[race]} · ${ROLE_LABEL[role]}`)),
          ),
          statRow,
          h(
            'div',
            { class: 'sum-specs' },
            ...Object.keys(c.specs).map((s) => h('span', { class: `chip ${RACE_PACKAGE[race!].includes(s as Spec) ? 'fixed' : ''}` }, SPEC_LABEL[s as Spec])),
          ),
          h('div', { class: 'sc cc-mini' }, 'Abilities'),
          abil,
        ),
      );
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    };

    const render = () => {
      clear(body);
      renderSteps();
      const inner = h('div', { class: step !== shown ? 'cc-step enter' : 'cc-step' });
      shown = step;
      const old = body;
      [renderRace, renderRole, renderStats, renderPicks, renderName][step]();
      // Move rendered children into an animated wrapper.
      while (old.firstChild) inner.append(old.firstChild);
      old.append(inner);
      refreshFoot();
      // On the first two steps the panel docks left and the six bodies stand in the world on the right.
      screen.classList.toggle('show-bodies', step <= 1 && !!preview);
      preview?.({ step, race, body: bodySel, role });
    };

    const go = (d: number) => {
      if (d > 0 && valid()) return;
      if (d > 0 && step === STEPS.length - 1) {
        screen.classList.remove('in');
        setTimeout(() => screen.remove(), 400);
        preview?.({ step, race, body: bodySel, role, done: true });
        resolve({ name: name.trim() || DEFAULT_NAME[race!], race: race!, role: role!, stats: { ...stats }, picks: [...picks], body: bodySel });
        return;
      }
      step = Math.max(0, Math.min(STEPS.length - 1, step + d));
      render();
      body.scrollTop = 0;
    };

    back.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    render();
  });
}
