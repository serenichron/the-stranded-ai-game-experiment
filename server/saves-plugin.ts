// Dev-server middleware so save files live in ./saves/ inside this folder, not in the browser profile.
//   GET    /__saves/:slot  -> ./saves/:slot.json (null if missing)
//   PUT    /__saves/:slot  -> writes body to ./saves/:slot.json
//   DELETE /__saves/:slot  -> removes it
// The game falls back to localStorage when this endpoint is absent (static build).

import type { Plugin } from 'vite';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// Neural voices: the free service behind Edge's Read Aloud button, fetched by the dev server.
// Clips are cached in memory for the session, so a repeated line costs nothing.
const voiceCache = new Map<string, Buffer>();
async function neural(voiceName: string, text: string, rate: string, pitch: string): Promise<Buffer> {
  const key = `${voiceName}|${rate}|${pitch}|${text}`;
  const hit = voiceCache.get(key);
  if (hit) return hit;
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const { audioStream } = tts.toStream(safe, { rate, pitch });
  const buf = await new Promise<Buffer>((ok, fail) => {
    const parts: Buffer[] = [];
    const timer = setTimeout(() => fail(new Error('neural voice timeout')), 15000);
    audioStream.on('data', (c: Buffer) => parts.push(c));
    audioStream.on('close', () => {
      clearTimeout(timer);
      ok(Buffer.concat(parts));
    });
    audioStream.on('error', (e: Error) => {
      clearTimeout(timer);
      fail(e);
    });
  });
  tts.close();
  if (!buf.length) throw new Error('empty audio');
  if (voiceCache.size > 400) voiceCache.clear();
  voiceCache.set(key, buf);
  return buf;
}

export function savesPlugin(): Plugin {
  const dir = resolve(process.cwd(), 'saves');
  return {
    name: 'stranded-saves',
    configureServer(server) {
      // GET /__voice?v=en-GB-RyanNeural&r=+0%&p=+0%&q=text -> mp3. Used first by src/audio/voice.ts.
      server.middlewares.use('/__voice', async (req, res) => {
        try {
          const u = new URL(req.url ?? '', 'http://x');
          const q = (u.searchParams.get('q') ?? '').slice(0, 600);
          const v = (u.searchParams.get('v') ?? 'en-GB-RyanNeural').replace(/[^a-zA-Z-]/g, '');
          const r = (u.searchParams.get('r') ?? '+0%').replace(/[^0-9+%-]/g, '');
          const p = (u.searchParams.get('p') ?? '+0%').replace(/[^0-9+%-]/g, '');
          if (!q) {
            res.statusCode = 400;
            return res.end('no text');
          }
          const buf = await neural(v, q, r, p);
          res.setHeader('content-type', 'audio/mpeg');
          res.setHeader('cache-control', 'max-age=86400');
          res.end(buf);
        } catch (e) {
          res.statusCode = 502;
          res.end('voice failed: ' + (e instanceof Error ? e.message : ''));
        }
      });
      // Free narration voice: the game asks us, we ask Google Translate TTS without a localhost referrer
      // (Google answers 404 when it sees one). Nothing is stored. Used by src/audio/voice.ts.
      server.middlewares.use('/__tts', async (req, res) => {
        try {
          const u = new URL(req.url ?? '', 'http://x');
          const q = (u.searchParams.get('q') ?? '').slice(0, 200);
          const tl = (u.searchParams.get('tl') ?? 'en-GB').replace(/[^a-zA-Z-]/g, '');
          if (!q) {
            res.statusCode = 400;
            return res.end('no text');
          }
          const g = await fetch(
            `https://translate.google.com/translate_tts?ie=UTF-8&total=1&idx=0&textlen=${q.length}&client=tw-ob&q=${encodeURIComponent(q)}&tl=${tl}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } },
          );
          if (!g.ok) {
            res.statusCode = 502;
            return res.end('tts ' + g.status);
          }
          res.setHeader('content-type', 'audio/mpeg');
          res.setHeader('cache-control', 'max-age=86400');
          res.end(Buffer.from(await g.arrayBuffer()));
        } catch {
          res.statusCode = 502;
          res.end('tts failed');
        }
      });
      server.middlewares.use('/__saves/', (req, res) => {
        const slot = (req.url ?? '').replace(/^\//, '').replace(/[^a-z0-9-]/gi, '');
        if (!slot) {
          res.statusCode = 400;
          return res.end('bad slot');
        }
        const file = resolve(dir, `${slot}.json`);
        if (req.method === 'GET') {
          // An empty slot answers 200 with null, so the browser console stays clean.
          res.setHeader('content-type', 'application/json');
          if (!existsSync(file)) return res.end('null');
          res.setHeader('content-type', 'application/json');
          return res.end(readFileSync(file, 'utf8'));
        }
        if (req.method === 'DELETE') {
          if (existsSync(file)) rmSync(file);
          return res.end('ok');
        }
        if (req.method === 'PUT' || req.method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              JSON.parse(body);
              mkdirSync(dir, { recursive: true });
              writeFileSync(file, body, 'utf8');
              res.end('ok');
            } catch {
              res.statusCode = 400;
              res.end('bad json');
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end('method');
      });
    },
  };
}
