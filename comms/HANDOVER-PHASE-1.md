# Handover: where phase 1 left the game

Written by agent 2 at the end of phase 1, for the phase 2 agents. Read this before touching code.

## What exists

One playable level, "The Keeper's errand", 30 to 45 minutes. Vite + TypeScript + three.js. Every mesh and texture is built in code. Two recordings live in `public/audio/` (credited there).

Run it: `npm run dev` in this folder, open http://localhost:5190. The user plays on this laptop in Edge.

Useful URLs:
- `?quick=sehari-scout` (any `race-role`) skips title and creation.
- `?freeroam` walks the map with no story (agent 1's tool). `&race=minaa` or `&race=sehari`.

## Code map

| Path | What | Phase 1 owner |
|---|---|---|
| `src/core/contracts.ts` | The seam: `IWorld` API, events, level data types | shared |
| `src/engine/` | Renderer, camera, lights, post, grid, pathing, fx, world state | agent 1 |
| `src/world/models/` | Procedural meshes: characters, props, scenery, plants | agent 1 (+ helpers) |
| `src/level/level1.ts` | The map: entities, zones, layout | agent 1 |
| `src/rules/` | 2d6 checks, character, wounds, combat maths, abilities | agent 2 |
| `src/game/` | Game loop, explore, stealth, combat, scripts, saves, narration wrapper | agent 2 |
| `src/story/` | All dialogue | agent 2 |
| `src/ui/` | DOM overlay: title, creation, HUD, dice, dialogue, combat bar, panels | agent 2 |
| `src/audio/` | Synth sfx/music/ambience, `voice.ts` narration | agent 2 |
| `server/saves-plugin.ts` | Dev-server routes: saves, `/__voice` (neural TTS), `/__tts` (Google) | agent 2 |
| `tests/playthrough.mjs` | Scripted runs in Edge | agent 2 |
| `tools/` | Screenshot, perf, soak scripts | agent 1 |

The full message history is in `comms/agent-1.md` and `comms/agent-2.md`.

## Decisions the user made during playtest (do not undo)

- Combat: one roll per exchange (10+ clean hit, 7-9 both hit, 6- it hits you). Two actions per turn. Dogs and scavengers are mooks (one hit). Abilities do not end an enemy's turn.
- No wound penalty to rolls in the game (`WOUND_PENALTIES = false` in `src/rules/wounds.ts`). Canon keeps it; the game does not.
- Healing always removes the last, worst wound.
- The Tel'sharin glows red in the game (`PALETTE.telsharinRed`). The Maker wreck stays amber. Canon still says amber-orange.
- Narration: every line is spoken. Narration and all non-character text use the British voice (en-GB-RyanNeural). Characters keep their cast voices (`src/audio/voice.ts`, `CAST`).
- Wind is a real desert wind recording. The user heard the synth wind as waves, twice.
- Autosave every 30 s. A reload resumes the game. A finished game does not offer Continue.

## How the user works with us

- When the user states a preference, do it. Do not ask again. Twice in phase 1 agent 2 re-asked about something already decided (wound penalty, red glow). The user noticed both times.
- The laptop is slow. Two agents running several Edge windows crashed pages. See the load rules in `PHASE-2.md`.
- The user plays in real time while we edit. Every file save reloads their page (the game resumes from autosave). Batch edits when you can.
- British English. Voice rules for game text are in `../CLAUDE.md`. Canon is `../ai/canon.md`. Inventions go in `LORE-INVENTIONS.md`.

## Known gaps

- The playthrough harness teleports between beats, so it missed a door that could not be walked through. Make tests walk.
- Graphics: the user rates the current look at 2 out of 10. That is phase 2.
