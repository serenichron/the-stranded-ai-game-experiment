// Runs a Dialogue tree through the UI. Checks roll through the dice panel.

import type { Ctx, DChoice, Dialogue, DNode, Text } from '../story/types';
import { SPEAKERS } from '../story/types';
import type { DialogueChoiceView, UI } from '../ui/types';
import { SPEC_LABEL, STAT_LABEL } from '../rules/character';
import { bestSpec } from '../rules/abilities';
import { bandOdds } from '../rules/dice';
import { modifiersFor } from '../rules/check';

export interface DialogueHost {
  ui: UI;
  ctx(): Ctx;
  /** Roll a check and show it. Returns the band. */
  rollCheck(spec: { stat: any; spec?: any; bonus?: number; label: string }): Promise<'full' | 'partial' | 'miss'>;
  seen: Set<string>; // "dialogueId:nodeId:choiceIndex"
}

const txt = (t: Text | undefined, c: Ctx) => (typeof t === 'function' ? t(c) : (t ?? ''));

export async function runDialogue(host: DialogueHost, id: string, d: Dialogue, startAt = 'start'): Promise<void> {
  let nodeId: string | null = startAt;
  let guard = 0;
  const c = host.ctx();
  while (nodeId && guard++ < 200) {
    const node: DNode | undefined = d[nodeId];
    if (!node) break;
    if (node.do) await node.do(c);

    const visible = (node.choices ?? []).map((ch, i) => ({ ch, i })).filter(({ ch, i }) => {
      if (ch.if && !ch.if(c)) return false;
      if (ch.once && host.seen.has(`${id}:${nodeId}:${i}`)) return false;
      return true;
    });

    const speaker = node.speaker ? SPEAKERS[node.speaker] : undefined;
    const views: DialogueChoiceView[] = visible.map(({ ch, i }) => choiceView(host, c, ch, `${id}:${nodeId}:${i}`));

    const picked = await host.ui.dialogue({
      speaker: speaker?.name ?? '',
      portrait: speaker?.portrait ?? 'narrator',
      text: txt(node.text, c),
      choices: views,
    });

    if (!visible.length) {
      if (node.end) break;
      nodeId = typeof node.next === 'function' ? node.next(c) : (node.next ?? null);
      continue;
    }

    const { ch, i } = visible[Math.max(0, Math.min(picked, visible.length - 1))];
    const lockReason = ch.lock?.(c);
    if (lockReason) continue; // UI should not allow it, but stay on this node if it does
    host.seen.add(`${id}:${nodeId}:${i}`);
    if (ch.do) await ch.do(c);

    if (ch.check) {
      const spec = bestSpec(c.s.character, ch.check.specs);
      const band = await host.rollCheck({ stat: ch.check.stat, spec, bonus: ch.check.bonus, label: ch.check.label });
      c.lastBand = band;
      nodeId = band === 'full' ? ch.check.full : band === 'partial' ? ch.check.partial : ch.check.miss;
      continue;
    }
    if (!ch.next) break;
    nodeId = ch.next;
    // A choice that points at an `end` node with no text still shows that node once.
  }
  host.ui.closeDialogue();
}

function choiceView(host: DialogueHost, c: Ctx, ch: DChoice, key: string): DialogueChoiceView {
  const v: DialogueChoiceView = { text: txt(ch.text, c) };
  const lock = ch.lock?.(c);
  if (lock) v.disabled = lock;
  if (host.seen.has(key)) v.seen = true;
  let tag = ch.tag ? txt(ch.tag, c) : '';
  if (ch.check) {
    const spec = bestSpec(c.s.character, ch.check.specs);
    const terms = modifiersFor(c.s.character, c.s.wounds, {
      stat: ch.check.stat,
      spec,
      bonus: ch.check.bonus,
      label: ch.check.label,
    });
    const mod = terms.reduce((a, t) => a + t.value, 0);
    const parts = [STAT_LABEL[ch.check.stat as keyof typeof STAT_LABEL]];
    if (spec) parts.push(SPEC_LABEL[spec]);
    const sign = mod >= 0 ? `+${mod}` : `${mod}`;
    tag = `${tag ? tag + ' ' : ''}[${parts.join(' + ')} ${sign}]`;
    v.odds = bandOdds(mod);
    const st = [ch.check.win && `Win: ${ch.check.win}`, ch.check.risk && `Risk: ${ch.check.risk}`].filter(Boolean).join('  ·  ');
    if (st) v.stakes = st;
  }
  if (tag) v.tag = tag;
  return v;
}
