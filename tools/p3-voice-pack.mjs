// Build the voice pack: render every fixed line with the same neural voices the dev server uses,
// so a published build (GitHub Pages) speaks in the right voice with no server behind it.
//
//   node tools/p3-voice-pack.mjs            render what is missing into public/voice/
//   node tools/p3-voice-pack.mjs --dry      list what would be rendered, render nothing
//
// The runtime looks a line up by the same id (src/audio/voice.ts, packId). Lines the extractor
// cannot see (names, race variants built at runtime) fall back to the browser's own voice.
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';

// ---------------------------------------------------------------- the cast (mirrors src/audio/voice.ts)
// one voice for every line, the British narrator (user call, 2026-09-21)
const CAST = {
  narrator: { neural: 'en-GB-RyanNeural', nr: '+0%', np: '+0%' },
  apprentice: { neural: 'en-GB-RyanNeural', nr: '+0%', np: '+0%' },
  foreman: { neural: 'en-GB-RyanNeural', nr: '+0%', np: '+0%' },
  scav: { neural: 'en-GB-RyanNeural', nr: '+0%', np: '+0%' },
  cook: { neural: 'en-GB-RyanNeural', nr: '+0%', np: '+0%' },
  kid: { neural: 'en-GB-RyanNeural', nr: '+0%', np: '+0%' },
  hunter: { neural: 'en-GB-RyanNeural', nr: '+0%', np: '+0%' },
  record: { neural: 'en-GB-RyanNeural', nr: '+0%', np: '+0%' },
  digger: { neural: 'en-GB-RyanNeural', nr: '+0%', np: '+0%' },
  lookout: { neural: 'en-GB-RyanNeural', nr: '+0%', np: '+0%' },
};
const SPEAKER_TO_VOICE = {
  apprentice: 'apprentice', foreman: 'foreman', scav: 'scav', cook: 'cook',
  kid: 'kid', hunter: 'hunter', digger: 'digger', record: 'record',
};

// ---------------------------------------------------------------- text handling (mirrors voice.ts)
// what the voice is handed, not what the player reads (sayable() in src/audio/voice.ts)
const SAY_AS = [
  [/Mi[’']naa/g, 'Minaa'],
  [/Aza[’']los/g, 'Azalos'],
  [/Tel[’']sharin/g, 'Telsharin'],
  [/ded-waka/g, 'dead-waka'],
];
const sayable = (x) => SAY_AS.reduce((s, [re, to]) => s.replace(re, to), x);
const clean = (t) => t.replace(/\[([^\]]+)\]/g, '$1').replace(/\s+/g, ' ').trim();
function sentences(text, max = 400) {
  const out = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf('. ', max);
    if (cut < max * 0.4) cut = rest.lastIndexOf(' ', max);
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}
export const packId = (voiceName, rate, pitch, text) =>
  createHash('sha256').update(`${voiceName}|${rate}|${pitch}|${text}`).digest('hex').slice(0, 20);

// ---------------------------------------------------------------- find the lines
/** Plain single-quoted or double-quoted string literals, with no ${...} in them. */
function literals(src) {
  const out = [];
  const re = /(^|[\s([{,:=?])(['"])((?:\\.|(?!\2)[^\\\n])*)\2/g;
  let m;
  while ((m = re.exec(src))) {
    const raw = m[3];
    if (raw.includes('${') || raw.length < 12 || !raw.includes(' ')) continue;
    out.push({ at: m.index, text: raw.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, ' ') });
  }
  return out;
}
/** Which speaker was named last before this point in the file. */
function speakersByOffset(src) {
  const marks = [];
  const re = /speaker:\s*'(\w+)'/g;
  let m;
  while ((m = re.exec(src))) marks.push({ at: m.index, who: m[1] });
  return (at) => {
    let who = '';
    for (const k of marks) { if (k.at > at) break; who = k.who; }
    return who;
  };
}

const files = [
  'src/story/dialogues.ts',
  'src/story/look.ts',
  'src/game/game.ts',
  'src/game/ending.ts',
  'src/game/combat.ts',
];
const wanted = new Map(); // id -> { voice, rate, pitch, text }
let seenLines = 0;
for (const f of files) {
  if (!existsSync(f)) continue;
  const src = readFileSync(f, 'utf8');
  const who = speakersByOffset(src);
  for (const { at, text } of literals(src)) {
    // speech reads as a sentence: it ends in punctuation and starts with a capital or a quote
    if (!/[.!?"']$/.test(text.trim()) || !/^["'A-Z(]/.test(text.trim())) continue;
    const key = CAST[SPEAKER_TO_VOICE[who(at)] ?? 'narrator'] ? (SPEAKER_TO_VOICE[who(at)] ?? 'narrator') : 'narrator';
    const c = CAST[key];
    seenLines++;
    for (const chunk of sentences(clean(text))) {
      const id = packId(c.neural, c.nr, c.np, chunk);
      if (!wanted.has(id)) wanted.set(id, { voice: c.neural, rate: c.nr, pitch: c.np, text: chunk, key });
    }
  }
}

mkdirSync('public/voice', { recursive: true });
const have = new Set(readdirSync('public/voice').filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)));
const stale = [...have].filter((id) => !wanted.has(id));
for (const id of stale) { unlinkSync(`public/voice/${id}.mp3`); have.delete(id); }
if (stale.length) console.log(`pruned ${stale.length} clips no line needs`);
const todo = [...wanted.entries()].filter(([id]) => !have.has(id));
console.log(`${seenLines} lines, ${wanted.size} clips, ${have.size} already rendered, ${todo.length} to do`);
if (process.argv.includes('--dry')) {
  for (const [id, c] of todo.slice(0, 10)) console.log(' ', id, c.key, JSON.stringify(c.text.slice(0, 70)));
  process.exit(0);
}

// ---------------------------------------------------------------- render
async function render(c) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(c.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const safe = sayable(c.text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const { audioStream } = tts.toStream(safe, { rate: c.rate, pitch: c.pitch });
  return await new Promise((ok, fail) => {
    const parts = [];
    const timer = setTimeout(() => fail(new Error('timeout')), 20000);
    audioStream.on('data', (b) => parts.push(b));
    audioStream.on('close', () => { clearTimeout(timer); ok(Buffer.concat(parts)); });
    audioStream.on('error', (e) => { clearTimeout(timer); fail(e); });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let done = 0, failed = 0;
for (const [id, c] of todo) {
  // the service refuses a long burst, so pause between clips and give each one three goes
  let ok = false;
  for (let tryNo = 1; tryNo <= 3 && !ok; tryNo++) {
    try {
      const buf = await render(c);
      if (buf.length < 500) throw new Error('empty audio');
      writeFileSync(`public/voice/${id}.mp3`, buf);
      have.add(id);
      done++;
      ok = true;
    } catch (e) {
      if (tryNo === 3) { failed++; console.error('failed', id, c.key, JSON.stringify(c.text.slice(0, 50)), String(e).slice(0, 80)); }
      else await sleep(1500 * tryNo);
    }
  }
  await sleep(250);
    if (done % 25 === 0 && done) console.log(`  ${done}/${todo.length}`);
}
writeFileSync('public/voice/index.json', JSON.stringify([...have].sort()));
console.log(`rendered ${done}, failed ${failed}, pack now ${have.size} clips`);
