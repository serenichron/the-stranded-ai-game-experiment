// Spoken narration for dialogue, narration cards, barks and look-at text.
// Free engines only, in this order:
//   0. Microsoft neural voices from the service behind Edge's Read Aloud, fetched by our dev server
//      (server/saves-plugin.ts, /__voice). Natural, accented, one per character.
//   1. The browser's own voices. Edge ships Microsoft "Natural" voices, which sound far better
//      than anything else free, and there are enough of them to give each speaker a voice.
//   2. Google Translate's TTS endpoint (the same trick BizAlchemy uses), with a different
//      English accent per speaker.
//   3. Any English browser voice at all.
// Text leaves the machine only for engines that run online (Edge's Natural voices, Google).

import { audio } from './index';

export type VoiceKey =
  | 'narrator'
  | 'apprentice'
  | 'foreman'
  | 'scav'
  | 'cook'
  | 'kid'
  | 'hunter'
  | 'record'
  | 'digger'
  | 'lookout';

interface VoiceSpec {
  neural: string; // Microsoft neural voice (Edge Read Aloud service, via /__voice). First choice.
  nr: string; // neural rate, e.g. '-5%'
  np: string; // neural pitch
  male: boolean; // Google's free voice is always female, so men never fall back to it first
  names: RegExp[]; // preferred browser voices, best first
  pitch: number;
  rate: number;
  gtts: string; // Google TTS language/accent fallback
}

// Casting. Pronouns come from the story text; where the story gives none, the voice is a free choice.
// Rates sit at or above 1: the first cast was too slow (user playtest).
const CAST: Record<VoiceKey, VoiceSpec> = {
  narrator: { neural: 'en-GB-RyanNeural', nr: '+0%', np: '-2%', male: true, names: [/Ryan.*Natural/i, /Thomas.*Natural/i, /George/i], pitch: 1, rate: 1.05, gtts: 'en-GB' },
  apprentice: { neural: 'en-GB-ThomasNeural', nr: '-6%', np: '-8%', male: true, names: [/Thomas.*Natural/i, /Guy.*Natural/i, /Christopher.*Natural/i, /George/i, /David/i], pitch: 0.92, rate: 1.0, gtts: 'en-GB' },
  foreman: { neural: 'en-AU-NatashaNeural', nr: '+4%', np: '+0%', male: false, names: [/Libby.*Natural/i, /Natasha.*Natural/i, /Sonia.*Natural/i, /Hazel/i], pitch: 1, rate: 1.1, gtts: 'en-AU' },
  scav: { neural: 'en-IE-EmilyNeural', nr: '+6%', np: '+0%', male: false, names: [/Emily.*Natural/i, /Molly.*Natural/i, /Susan/i], pitch: 1, rate: 1.12, gtts: 'en-IE' },
  cook: { neural: 'en-NZ-MollyNeural', nr: '+0%', np: '-4%', male: false, names: [/Natasha.*Natural/i, /Leah.*Natural/i, /Jenny.*Natural/i, /Hazel/i], pitch: 0.95, rate: 1.05, gtts: 'en-AU' },
  kid: { neural: 'en-GB-MaisieNeural', nr: '+2%', np: '+0%', male: false, names: [/Maisie.*Natural/i, /Ana.*Natural/i], pitch: 1.1, rate: 1.1, gtts: 'en-US' },
  hunter: { neural: 'en-ZA-LukeNeural', nr: '-8%', np: '-6%', male: true, names: [/Luke.*Natural/i, /William.*Natural/i, /Prabhat.*Natural/i, /David/i], pitch: 0.95, rate: 1.0, gtts: 'en-ZA' },
  record: { neural: 'en-GB-SoniaNeural', nr: '-8%', np: '-4%', male: false, names: [/Sonia.*Natural/i, /Aria.*Natural/i, /Jenny.*Natural/i, /Hazel/i], pitch: 0.97, rate: 1.0, gtts: 'en-GB' },
  digger: { neural: 'en-NZ-MitchellNeural', nr: '+4%', np: '+0%', male: true, names: [/Mitchell.*Natural/i, /Connor.*Natural/i, /William.*Natural/i, /Mark/i], pitch: 1, rate: 1.1, gtts: 'en-NZ' },
  lookout: { neural: 'en-AU-NatashaNeural', nr: '+4%', np: '+0%', male: false, names: [/Libby.*Natural/i, /Sonia.*Natural/i, /Hazel/i], pitch: 1, rate: 1.1, gtts: 'en-AU' },
};

// Browser voice names by sex, so a fallback never gives a man's line to a woman's voice or the reverse.
const MALE = /Ryan|Thomas|Guy|Christopher|Eric|Roger|Steffan|Brian|Andrew|Davis|Tony|Jason|William|Connor|Mitchell|Luke|Prabhat|Chilemba|Abeo|Wayne|Ken|Liam|Elliot|Alfie|Noah|Oliver|George|David|Mark|James|Daniel|Male/i;
const FEMALE = /Sonia|Libby|Maisie|Aria|Jenny|Michelle|Ana|Emma|Ava|Natasha|Emily|Molly|Leah|Neerja|Clara|Hollie|Bella|Abbi|Olivia|Hazel|Susan|Zira|Heera|Female/i;

const hasNative = typeof window !== 'undefined' && 'speechSynthesis' in window;
let enabled = true;
let token = 0;
let current: HTMLAudioElement | null = null;
let gttsBroken = false;
const chosen = new Map<VoiceKey, SpeechSynthesisVoice | null>();

function voices(): SpeechSynthesisVoice[] {
  return hasNative ? speechSynthesis.getVoices() : [];
}

if (hasNative) speechSynthesis.addEventListener?.('voiceschanged', () => chosen.clear());

function pick(key: VoiceKey): SpeechSynthesisVoice | null {
  if (chosen.has(key)) return chosen.get(key)!;
  const all = voices().filter((v) => /^en/i.test(v.lang));
  // Edge fills its voice list late. Do not remember "no voice" from before the list arrived.
  if (!all.length) return null;
  const spec = CAST[key];
  const sexOk = (v: SpeechSynthesisVoice) => (spec.male ? MALE.test(v.name) && !FEMALE.test(v.name) : FEMALE.test(v.name));
  let v: SpeechSynthesisVoice | null = null;
  for (const re of spec.names) {
    v = all.find((x) => re.test(x.name) && sexOk(x)) ?? null;
    if (v) break;
  }
  const spread = (list: SpeechSynthesisVoice[]) => list[Object.keys(CAST).indexOf(key) % list.length];
  if (!v) {
    const natural = all.filter((x) => /natural/i.test(x.name) && sexOk(x));
    if (natural.length) v = spread(natural);
  }
  if (!v) {
    const any = all.filter(sexOk);
    if (any.length) v = spread(any);
  }
  chosen.set(key, v);
  return v;
}

/** Split into sentences under 190 characters: long utterances cut out in some browsers, and Google caps at 200. */
function sentences(text: string, max = 190): string[] {
  const raw = text.match(/[^.!?]*[.!?]+["')\]]?\s*|[^.!?]+$/g) ?? [text];
  const out: string[] = [];
  for (let s of raw.map((x) => x.trim()).filter(Boolean)) {
    while (s.length > max) {
      const cut = s.lastIndexOf(' ', max);
      out.push(s.slice(0, cut > 0 ? cut : max));
      s = s.slice(cut > 0 ? cut + 1 : max);
    }
    if (s) out.push(s);
  }
  // Join short sentences into chunks, so the online voice makes fewer requests and fewer pauses.
  const chunks: string[] = [];
  for (const x of out) {
    const last = chunks[chunks.length - 1];
    if (last && last.length + x.length + 1 <= max) chunks[chunks.length - 1] = last + ' ' + x;
    else chunks.push(x);
  }
  return chunks;
}

/** Clean game text for speech: no *emphasis* stars, and 'ded-waka' read as two words. */
function clean(t: string) {
  return t.replace(/\*/g, '').replace(/ded-waka/gi, 'ded waka').replace(/\s+/g, ' ').trim();
}

function speakNative(text: string, key: VoiceKey, my: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (!hasNative) return resolve(false);
    const u = new SpeechSynthesisUtterance(text);
    const v = pick(key);
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-GB';
    u.pitch = CAST[key].pitch;
    u.rate = CAST[key].rate;
    u.volume = Math.min(1, audio.getVolume('master') * 1.1);
    let started = false;
    u.onstart = () => (started = true);
    u.onend = () => resolve(true);
    u.onerror = () => resolve(started);
    speechSynthesis.speak(u);
    // Some browsers never start an utterance. Give up after 4 s so the queue cannot hang.
    setTimeout(() => {
      if (!started && my === token) {
        speechSynthesis.cancel();
        resolve(false);
      }
    }, 4000);
  });
}

// Failures in a row. After 3 the neural engine rests for 30 s, then is tried again. It is never dropped
// for good: the user wants the British voice for all narration, not a fallback.
const HAS_VOICE_SERVER = import.meta.env.DEV;
let neuralFails = 0;
let neuralRestUntil = 0;
const neuralResting = () => !HAS_VOICE_SERVER || (neuralFails >= 3 && performance.now() < neuralRestUntil);
const nUrl = (text: string, key: VoiceKey) =>
  `/__voice?v=${CAST[key].neural}&r=${encodeURIComponent(CAST[key].nr)}&p=${encodeURIComponent(CAST[key].np)}&q=${encodeURIComponent(text)}`;

function prefetchNeural(text: string, key: VoiceKey) {
  if (neuralResting()) return;
  void fetch(nUrl(text, key)).catch(() => undefined); // warms the server cache
}

function speakNeural(text: string, key: VoiceKey): Promise<boolean> {
  return new Promise((resolve) => {
    if (neuralResting()) return resolve(false);
    const a = new Audio(nUrl(text, key));
    a.volume = Math.min(1, audio.getVolume('master'));
    current = a;
    a.onended = () => {
      neuralFails = 0;
      resolve(true);
    };
    a.onerror = () => {
      neuralFails++;
      if (neuralFails >= 3) neuralRestUntil = performance.now() + 30000;
      resolve(false);
    };
    a.play().catch(() => resolve(false));
  });
}

const gUrl = (text: string, key: VoiceKey) =>
  // Through our dev server (server/saves-plugin.ts): Google rejects a localhost referrer.
  `/__tts?q=${encodeURIComponent(text.slice(0, 200))}&tl=${CAST[key].gtts}`;

/** Start downloading the next chunk while this one plays, so there is no gap between them. */
function prefetch(text: string, key: VoiceKey) {
  if (gttsBroken || !HAS_VOICE_SERVER) return;
  const a = new Audio();
  a.preload = 'auto';
  a.src = gUrl(text, key);
}

function speakGoogle(text: string, key: VoiceKey): Promise<boolean> {
  return new Promise((resolve) => {
    if (gttsBroken || !HAS_VOICE_SERVER) return resolve(false);
    const a = new Audio(gUrl(text, key));
    a.volume = Math.min(1, audio.getVolume('master'));
    a.playbackRate = CAST[key].rate * 1.1; // Google's voice is slow by default
    current = a;
    a.onended = () => resolve(true);
    a.onerror = () => {
      gttsBroken = true;
      resolve(false);
    };
    a.play().catch(() => resolve(false));
  });
}

// While someone speaks, music and ambience drop well back so the voice sits on top.
let duckedFrom: { music: number; ambience: number } | null = null;
function duck(on: boolean) {
  if (on && duckedFrom === null) {
    duckedFrom = { music: audio.getVolume('music'), ambience: audio.getVolume('ambience') };
    audio.setVolume('music', duckedFrom.music * 0.35);
    audio.setVolume('ambience', duckedFrom.ambience * 0.3);
  } else if (!on && duckedFrom !== null) {
    audio.setVolume('music', duckedFrom.music);
    audio.setVolume('ambience', duckedFrom.ambience);
    duckedFrom = null;
  }
}

let castLogged = false;
/** Once, list who got which voice. Open the browser console (F12) to see it. */
function logCast() {
  if (castLogged || !voices().length) return;
  castLogged = true;
  const rows = (Object.keys(CAST) as VoiceKey[]).map((k) => {
    const v = pick(k);
    if (!neuralResting()) return `${k}: ${CAST[k].neural} (neural)`;
    return `${k}: ${v ? v.name : CAST[k].male ? 'none (male, no browser voice)' : 'Google Translate, ' + CAST[k].gtts}`;
  });
  console.info('[narration] voice cast\n' + rows.join('\n'));
}

export const voice = {
  get enabled() {
    return enabled;
  },
  setEnabled(on: boolean) {
    enabled = on;
    if (!on) voice.stop();
  },

  /** Stop whatever is speaking now. */
  stop() {
    token++;
    if (hasNative) speechSynthesis.cancel();
    if (current) {
      current.pause();
      current = null;
    }
    duck(false);
  },

  /**
   * Speak text. Replaces anything already speaking. Resolves when done or stopped.
   * Text inside [square brackets] is read by the narrator, the rest by the speaker.
   */
  async say(text: string, key: VoiceKey = 'narrator'): Promise<void> {
    voice.stop();
    if (!enabled || audio.muted || !text) return;
    const my = token;
    const parts: { t: string; k: VoiceKey }[] = [];
    const re = /\[([^\]]+)\]/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) parts.push({ t: text.slice(last, m.index), k: key });
      parts.push({ t: m[1], k: 'narrator' });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ t: text.slice(last), k: key });

    logCast();
    duck(true);
    for (const p of parts) {
      const chunks = sentences(clean(p.t), neuralResting() ? 190 : 400);
      for (let i = 0; i < chunks.length; i++) {
        const s = chunks[i];
        if (my !== token) return;
        // First choice: the neural voice, fetched by our dev server. Warm the next chunk meanwhile.
        if (!neuralResting()) {
          if (chunks[i + 1]) prefetchNeural(chunks[i + 1], p.k);
          else if (parts[parts.indexOf(p) + 1]) prefetchNeural(clean(parts[parts.indexOf(p) + 1].t).slice(0, 400), parts[parts.indexOf(p) + 1].k);
          if (await speakNeural(s, p.k)) continue;
          // The narrator gets one retry: a single dropped request should not swap the British voice out.
          if (p.k === 'narrator' && my === token && (await speakNeural(s, p.k))) continue;
          if (my !== token) return;
        }
        // Order: a Natural browser voice, then for women Google, then any browser voice of the right sex,
        // and Google last of all for men (its only voice is a woman's).
        const native = pick(p.k);
        const useNativeFirst = !!native && (/natural|online/i.test(native.name) || CAST[p.k].male);
        let ok = false;
        if (useNativeFirst) ok = await speakNative(s, p.k, my);
        else {
          if (chunks[i + 1]) prefetch(chunks[i + 1], p.k);
          ok = await speakGoogle(s, p.k);
        }
        if (!ok && my === token) ok = useNativeFirst ? await speakGoogle(s, p.k) : await speakNative(s, p.k, my);
        if (!ok) break;
      }
    }
    if (my === token) duck(false);
  },

  /** Several lines in a row, as one narration. */
  async sayAll(lines: string[], key: VoiceKey = 'narrator') {
    await voice.say(lines.join(' '), key);
  },
};

// Warm the voice list: some browsers fill it only after the first call.
if (hasNative) speechSynthesis.getVoices();
