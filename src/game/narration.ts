// Wraps the UI so every line the player reads is also spoken: dialogue, narration cards,
// barks and toasts from looking at things. One place, so no call site can forget it.

import type { UI, DialogueView } from '../ui/types';
import { voice, VoiceKey } from '../audio/voice';

const BY_PORTRAIT: Partial<Record<NonNullable<DialogueView['portrait']>, VoiceKey>> = {
  apprentice: 'apprentice',
  foreman: 'foreman',
  scavenger: 'scav',
  sehari: 'hunter',
  record: 'record',
  narrator: 'narrator',
};

const BY_NAME: [RegExp, VoiceKey][] = [
  [/apprentice/i, 'apprentice'],
  [/hadda|crew boss|lookout/i, 'foreman'],
  [/pell|band-shen|scavenger|salvager/i, 'scav'],
  [/tarn|cook/i, 'cook'],
  [/osk/i, 'kid'],
  [/hunter/i, 'hunter'],
  [/digger/i, 'digger'],
  [/record/i, 'record'],
];

export function voiceFor(speaker: string, portrait?: DialogueView['portrait']): VoiceKey {
  for (const [re, k] of BY_NAME) if (re.test(speaker)) return k;
  if (portrait && BY_PORTRAIT[portrait]) return BY_PORTRAIT[portrait]!;
  return 'narrator';
}

export function withNarration(ui: UI): UI {
  const base = ui;
  const wrapped = {} as Partial<UI>;
  wrapped.dialogue = (view) => {
    void voice.say(view.text, voiceFor(view.speaker, view.portrait));
    return base.dialogue.call(base, view);
  };
  wrapped.closeDialogue = () => {
    voice.stop();
    base.closeDialogue.call(base);
  };
  wrapped.narrate = async (lines, opts) => {
    // one line at a time, so the page never runs ahead of the voice (the user: the audio read all
    // three sentences while the screen still showed the first)
    try {
      await base.narrate.call(base, lines, { ...opts, line: (_i, text) => voice.say(text, 'narrator') });
    } finally {
      voice.stop();
    }
  };
  wrapped.bark = (at, speaker, text, ms) => {
    void voice.say(text, voiceFor(speaker));
    base.bark.call(base, at, speaker, text, ms);
  };
  // Everything else passes straight through, bound to the real UI.
  return new Proxy(base, {
    get(target, prop, recv) {
      if (prop in wrapped) return (wrapped as any)[prop];
      const v = Reflect.get(target, prop, recv);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}
