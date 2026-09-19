# Agent 2 log

Append-only. Newest at the bottom. Protocol: `comms/PROTOCOL.md`.

---

## [A2-001] 2026-09-18 | PROPOSAL | Hello, and a protocol

Hi agent 1. I'm agent 2. The folder was empty when I arrived, so I drafted `comms/PROTOCOL.md`.
Short version: you write only `comms/agent-1.md`, I write only `comms/agent-2.md`. No shared-file races.
If you already made your own scheme, tell me and I'll switch to yours. You win tie-breaks on structure.

Needs: ACK or your changes.

---

## [A2-002] 2026-09-18 | PROPOSAL | Stack

- **Vite + TypeScript + three.js.** Runs in a browser, `npm run dev`, no engine install.
- **Isometric view:** three.js `OrthographicCamera` at the classic angle (yaw 45 deg, pitch ~35.26 deg). Real 3D underneath, so we get modern light for free.
- **"Modern graphics" means:** PBR materials, one low warm directional sun (red dwarf, permanent golden hour) with soft shadow maps, hemisphere fill, fog, teal/amber emissives, post stack (bloom via UnrealBloomPass, GTAO or SSAO, colour grade, vignette, film grain). All inside three's own `examples/jsm`, so no extra deps.
- **All art procedural.** Geometry built in code (Aza'los curves via lathe/tube/extrude, miner blocks, Tel'sharin bone-coral). Textures from canvas noise. No asset downloads, no licences to worry about.
- **Audio:** WebAudio, synthesised (wind, drones, UI ticks, hits). Zero files.
- **Testing:** `playwright-core` driving the Edge already installed on Windows (`channel: 'msedge'`). No browser download, so nothing lands in AppData.
- **Containment:** `.npmrc` with `cache=./.npm-cache`. `.gitignore` for node_modules and the cache.

Needs: ACK or objection.

---

## [A2-003] 2026-09-18 | PROPOSAL | Split of work

Two leads, two halves, one contract between them.

**Agent 1: world and look** (`src/render/`, `src/world/`, `src/fx/`, `src/audio/`)
- Renderer, iso camera (follow, zoom, small rotate), lights, post stack.
- Terrain and level building from level data. Aza'los ruins, miner wreck, Mi'naa town, Tel'sharin wreckage, plants.
- Character and creature models plus simple procedural animation (idle, walk, attack, hit, die).
- VFX: channelling, crystal glow, dust, hits. Audio.
- Occlusion fade for walls between camera and player (the classic iso problem).

**Agent 2 (me): game and story** (`src/game/`, `src/ui/`, `src/content/`, `tests/`)
- Game loop, state, input (click-to-move plus WASD), pathfinding on the walk grid.
- Combat, wounds, abilities, enemy AI, stealth.
- The 2d6 check system, shown as real dice on screen.
- Dialogue, quests, inventory, HUD, menus, save/load.
- The level script: where things are, what happens, who says what.
- Playwright smoke tests and screenshots.

**The seam:** `src/core/contracts.ts`. The game side says "spawn entity kind X at tile Y, play animation Z, show effect W". The render side makes it look good. Neither reaches into the other's internals. I'll draft it; you amend.

Needs: ACK, or swap halves if you'd rather own the other one.

---

## [A2-004] 2026-09-18 | PROPOSAL | The level

Working title: **"The Fallen Spire"**. One full level, 25 to 40 minutes to play. Built on canon, see `../ai/canon.md`.

Canon hooks it uses:
- Campaign start is locked: an Iskari Keeper-apprentice sends the party on a first job, then is taken. His master vanished in the last ripple.
- Gazetteer site 7: the crash-site spire, a toppled Aza'los tower in the southern Ash Reach. The hub town sits on the southern edge of the Ash Reach. They are neighbours.
- Keepers kept distributed archives. A cache in the spire is a clean reason to go.

Flow (hook, complication, reveal, as canon wants sessions to run):
1. **Hub town edge.** Pick a race: settled Mi'naa, Sehari, or Iskari. The apprentice gives the job: bring back a Keeper archive plate from the fallen spire. Tutorial for move, talk, 2d6 check.
2. **The Ash Reach crossing.** Open sand at golden hour. Spire-roots mark buried crystal. Barrel-gourds for water. A scavenger Mi'naa band on the road: talk, sneak, or fight.
3. **The old battlefield.** A Tel'sharin feeding on wreckage near a half-buried Aza'los hull. Fight it, sneak past, or starve it into hibernation by stripping the metal around it (canon allows this).
4. **Inside the spire.** The tower lies on its side, so you walk along its walls. Teal glow. An Aza'los guardian (precise, teal, clean). A light-routing puzzle with crystals. Race changes the options: Iskari can operate the tech, Sehari can channel, Mi'naa can fuse a bypass.
5. **The cache.** You find the plate. Touching it gives a short memory echo.
6. **The return.** The apprentice's workshop is empty. Signs of a struggle. A note you can half read. Level ends on that reveal.

Rules from the tabletop game carried in:
- No hit points. Guard absorbs hits, then wounds fill: light (no penalty), moderate (-1), severe (-2). A fourth wound means you collapse and wake with a cost, not a game over.
- 2d6 + stat + specialisation for checks. 10+ clean, 7-9 success with a cost, 6- fails forward.
- Crystals by colour: amber (force), crimson (healing), pale (reveal), violet (push). Channelling at 7-9 can chip the crystal.

Lore we must not break: Tel'sharin cannot perceive Aza'los symbols and shatter Aza'los crystals. Sehari never set crystals into the body. The Makers stay unnamed. The apprentice has no name in canon, so he stays "the apprentice" in the game unless the user says otherwise. The hub town also has no name.

Needs: your view. You own the look, so tell me where this fights the visuals.

---

## [A2-005] 2026-09-18 | CLAIM | Scaffold

To avoid two scaffolds, I'll wait about 10 minutes for your reply. If I hear nothing, I'll create `package.json`, `.npmrc`, `.gitignore`, Vite config, `src/main.ts`, and a draft `src/core/contracts.ts`, then tell you here. If you have already scaffolded, I'll use yours.

---

## [A2-006] 2026-09-18 | ACK | A1-001 to A1-005, all accepted
- Doorbell: yes. I'll ping `the-stranded-fb` after each append.
- Stack A1-002: agreed. It matches my A2-002, so that's settled.
- Split A1-003: agreed. I own `src/rules/`, `src/game/`, `src/story/`, `src/ui/`, `src/audio/`, `tests/`. You own engine, world, level, scaffold. My A2-003 is withdrawn.
- Turn-based combat: agreed. It fits wounds and 2d6 better than real-time. Out of combat the game runs in real time (click to move). Combat starts when an enemy sees you or you attack, and ends when no hostile is awake.
- Level A1-004: yours replaces my A2-004. It is tighter. I'm folding in the good bits of mine below.
- I will not touch your scaffold paths. I'll start in my folders against stubs, and adapt when your contracts DONE lands.
Refs: A1-001..A1-005

## [A2-007] 2026-09-18 | DECISION | Story shape (Story section is mine)
Hook, complication, reveal, as you wrote. My changes:
1. **Race matters at three doors, not everywhere.** The symbol door: Iskari reads it free, Sehari channels a pale crystal (Resonance roll), Mi'naa fuses a bypass from Tel'sharin scrap (Mind + Mi'naa tech roll). Same three-way split at the Tel'sharin and at the guardian.
2. **The scavenger who is not what they seem** is in. A Mi'naa at the camp, band marks under the sleeve. They want the metal from the wreck. If you starve the Tel'sharin, you are helping them too. That's the moral knot: starving it means giving scrap to someone who will sell it.
3. **The reveal:** the fragment holds the master's last record, as you said. I add one coda line. You walk back to camp and the apprentice's tent is empty, lamp still lit. Canon [P] says he is taken after the first job. It stays one line on the end screen, not a second scene, so the record stays the real reveal.
4. **No names invented for canon-open things.** The apprentice is "the apprentice" or "the Keeper's apprentice". The camp gets an invented name only if you want one on the map; I'll log it in LORE-INVENTIONS.md. Salvage NPCs get invented names, logged.

## [A2-008] 2026-09-18 | QUESTION | What I need from contracts.ts
So I can code against stubs today, please make sure the World API covers:
- `spawn(kind, tile, opts) -> id`, `despawn(id)`, `moveAlong(id, path) -> Promise`, `face(id, tile)`, `playAnim(id, 'idle'|'walk'|'attack'|'hit'|'die'|'channel'|'sleep')`.
- `findPath(from, to) -> tiles | null`, `isWalkable(tile)`, `lineOfSight(a, b) -> boolean`.
- `fx(kind, at, opts)` for channel, hit, shatter, dust, crystal-glow, memory-echo.
- `highlight(ids | tiles, style)` for move range and targets in combat.
- `setInteractables(list)` or an event `interact(id)` when the player clicks a prop.
- Events from you to me: `tileClicked`, `entityClicked`, `entityHovered`, `arrived(id)`.
- A level description I can read: ids and tiles of NPCs, enemies, props, triggers (zones), and the spawn point.
Needs: tell me if any of this is wrong-headed. I'll adapt.

## [A2-009] 2026-09-18 | CLAIM | My first tasks
1. `src/rules/` dice, checks, stats, wounds, specialisations. Pure TS, unit-tested.
2. `src/story/` dialogue data format plus the apprentice's opening scene.
3. `src/ui/` DOM overlay: title, character creation, HUD with wound slots, dice roll display.
DESIGN.md: I'll write the Story, Rules and UI sections. You write Level.

## [A2-010] 2026-09-18 | ACK | contracts v1
contracts.ts v1 is good. I'm coding against it now. No changes needed yet.
- My fx keys map onto your FxKind: channel + colour, bolt(beam, 'azure') for the Iskari focus lance, 'hit', 'shatter', 'sleep', 'memory-echo'. If teal needs its own look, a `colour: 'teal'` option on fx/bolt would be nice later. Not blocking.
- Helper: I spawned one helper for `src/audio/` only (procedural WebAudio). It writes nothing else.
- `src/rules/` is in: dice (seeded), character, check, wounds (+ guard), combat maths, abilities. Pure TS, no three.
Refs: A1-006

## [A2-011] 2026-09-18 | QUESTION | Saves inside the folder
The user wants nothing outside this folder. localStorage lives in the Edge profile, which is outside. So I want saves on disk in `./saves/`.
Plan: I write `server/saves-plugin.ts` (a tiny Vite dev-server middleware: GET/PUT `/__saves/:slot` -> `./saves/:slot.json`). Could you add two lines to `vite.config.ts`:
```ts
import { savesPlugin } from './server/saves-plugin';
// ...
plugins: [savesPlugin()],
```
In a static build (no server) the game falls back to localStorage and says so in the menu. I'll add `saves/` to .gitignore via a note to you, since that file is yours too.
Needs: yes/no. I'll ping when the plugin file exists.

## [A2-012] 2026-09-18 | PROPOSAL | Script ids I will register
Entities: `apprentice`, `archive`, `symbol-door`, `tel1`, `guardian1`, `scav1`, `metal1..metal4` (feeds:tel1), plus if you place them: `spring1`, `gourd1..n` (barrel-gourds: water, clears a light wound), `crystal-*` (opts.colour), `chest-*`, `sign-*`, `lamp-*`, `lever-*`, `tent-apprentice`, `npc-*` for camp folk (I'll write barks for any id starting `npc-`).
Zones I'd like: `z-camp`, `z-wreck-edge` (entering starts the Tel'sharin beat), `z-ruin-mouth`, `z-ruin-inner`, `z-archive`, `z-spire-root` (the lone spire-root, a Sehari/Survival read), `z-scar-view` (a lookout over the Scar, one line of text).
Feral dogs: canon has an introduced dog line brought by the miners. I'd like 2 `dog` enemies near the wreck as a soft first fight. That needs an EntityKind `dog`. Also `scavenger` hostiles only if the player turns on the camp; they can reuse `npc-scavenger` with faction 'hostile'.
Needs: `dog` kind if you agree, and the final id list when the map lands.

## [A2-013] 2026-09-18 | ACK | A1-008
- Thanks for the plugin line and `dog`.
- `z-crack`: yes. It becomes a fourth answer to the Tel'sharin: avoid it entirely. Check is best of Body or Edge + Athletics. 10+ through. 7-9 through with a light wound. 6- light wound and you slide back to the ridge foot (your call: please give me a tile for "back where you started", as `opts.fallback` on the zone or a `crack-bottom` / `crack-top` entity-less tile pair I can read from the zone rect edges; I'll use the rect's south edge as bottom and north edge as top if you do nothing).
- Second helper spawned for `src/ui/` (DOM overlay, dice panel, dialogue, HUD, combat bar). My folders only.
- Guardian patrol: if you want it to walk, put `opts.patrol: Tile[]` on `guardian1`. I'll walk it between those tiles. If absent it stands and sweeps its gaze.
- Lever puzzle inside the ruin, if you have room: three `prop-lever` ids `lever-a`, `lever-b`, `lever-c` and a second `prop-symbol-door` `inner-door` in front of the archive, plus a `prop-sign` `sign-rings` on a wall near the levers (the clue). Solution is mine to script.
Refs: A1-008

## [A2-014] 2026-09-18 | DONE | Game layer v1, story, rules, audio
- `src/game/`: index (entry), game (explore, stealth, scripts, items, collapse, save), combat (turn-based), dialogue runner, state, ending.
- `src/story/`: every conversation. `src/audio/`: done by my helper (38 sfx, 5 ambiences, 5 music beds, all synthesised).
- `src/ui/`: my helper is still on it.
- DESIGN.md Story, Rules and UI sections written. LORE-INVENTIONS.md created.
- Type-checks clean on my side. Your errors right now are in engine/world.ts and world/models (missing modules), I assume mid-edit.
What I call on IWorld that you might not expect:
- `setState` values I send: doors 'open'; lamps 'lit'/'out'; chests 'open'; levers 'on'/'off'; archive 'lit'/'taken'; tent 'open'; tel1 and guardian1 'asleep', 'dead', 'friendly'; dogs 'friendly'; spawned 'pell' 'hostile'. Unknown ones can be no-ops.
- `face(id, tile)` to point an idle Tel'sharin in a random direction (a tile one step away).
- `playAnim('player', 'crouch')` when sneaking starts, 'idle' when it stops.
- `fx(..., { colour: 'teal' })` and `bolt(..., { colour: 'teal' })` for the guardian and the Iskari focus.
- `spawn('npc-scavenger', tile, { id: 'pell' | 'band1', faction })` for the gully scene.
- `focus(target, { zoom: 0.8 })` on the title screen, behind the title.
Needs: when your world is running, tell me and I'll run the full game in Edge and send you screenshots and bugs.

## [A2-015] 2026-09-18 | REVIEW | First full playthrough: Iskari, critical path
`tests/playthrough.mjs` ran the whole level in Edge: apprentice, Pell, spire-root, hunter, ruin mouth, ring panel, sockets, symbol door, archive record, camp, empty tent, ending. No page errors. Screens are in `test-output/play-iskari-tech-main-*.png`. The ruin at dusk with the teal rings is the best thing in this folder.
Testing note: I test against a frozen build (`vite build --outDir test-output/build`, `vite preview --port 5193`), because HMR reloads the page mid-run while you edit. I'm not using 5190 for runs, only reading it.
Mine, fixed: the ending and the collapse text sat under a black fade. The 404s were my empty save slot; it now answers 200 null.
One ask, small:
1. Guardian `friendly`: you map it to the dormant look. For an Iskari the guardian should stay lit and awake, just passive (it "steps aside"). Could 'friendly' be awake-idle, and 'asleep' stay dormant?
Gap at 38..46: fine for now. I'll tell you after the sneak run.
Refs: A1-011, A1-012, A1-013

## [A2-016] 2026-09-18 | ANSWER | A1-016 and A1-017
1. The crate: please add both, a crate next to him and a sit pose for his idle. The crate is a story beat. He says "The crate is the only chair I have", and the ending puts the player on his crate after he is gone. If the sit pose is costly, a crate alone is fine and I'll keep the text.
2. Camera on talk: done, exactly as you wrote it. Focus on the clicked entity at zoom 1.35, follow the player after.
3. and 4. Thanks. I test against a frozen build on 5193 now, so your reloads no longer hit my runs.
A17 touch: ACK. Desktop first, then touch. My UI helper is already adding an on-screen button strip (journal, pack, character, sneak, help, menu) and checking every panel at 1024x768.

## [A2-017] 2026-09-18 | REVIEW | Routes tested, all end to end, no page errors
- Iskari Tech, critical path. Sehari Channeller and Mi'naa Tech, starve. Mi'naa Frontline, fight. Sehari Scout, crack. Mi'naa Scout, careful starve: all four heaps hauled, the Tel'sharin sleeps, Pell shows up at the gully.
Bugs I fixed on my side:
- A fight never ended when the last enemy fell. Mine, a guard in finish(). That was the "page crash" in my harness.
- The dog fight pulled in the Tel'sharin from 9 tiles. Now only enemies with line of sight and range join.
- Hauling now rolls the better of Body + Athletics or Edge + Stealth. A miss makes noise instead of an automatic fight.
- A failed door study could lock a Mi'naa out. Studying is repeatable now.
Nothing for you from these runs. The gap at 38..46 is fine: sneaking is tense but doable.

## [A2-018] 2026-09-18 | CLAIM | README.md at the root
I wrote `README.md`: how to run, controls, what is in the level, who owns which folder, how to delete it. Edit any line that is wrong about your half; tell me and I'll keep it in sync.
Also: there is an empty file named `=` in the root, made at 15:35. Not mine as far as I can tell; probably a shell redirect typo. Delete it if it is yours.

## [A2-019] 2026-09-18 | ANSWER | A1-021 crash, A1-022 quality, A1-023 ending bugs
- Crash: agreed, contention. My isolated ending test and my solo runs pass. Every crash came when three or more Edge instances ran at once. Your full Mi'naa pass confirms it. The user says the laptop is slow, so from now on I run one browser at a time and stop my preview server when idle. Please do the same. The user also said: do not cut quality to get there. The game stays at 'high' by default.
- setQuality: ACK. Esc menu now has a Graphics row (High / Medium / Low). The choice is saved in the game state and applied on load. Suggestion for you, your call: if adaptive resolution sits at its floor for 10 s, drop to 'medium' by itself once and tell me with a bus event, so I can toast it.
- Ending bugs: both fixed. The note dialogue now closes before the ending starts. The orange strip came from my UI layers being `absolute`; they are `fixed` now.
- New in the ending: the player sits on the apprentice's crate for a few seconds before the final fade. Your 'seated' state made that possible. Thank you.
Refs: A1-021, A1-022, A1-023, A1-024

## [A2-020] 2026-09-18 | DECISION | Combat rework after the user's own playtest
The user played and lost fast. Their points, and what I changed (my half only, nothing for you):
- One roll per exchange, as `docs/build-order.md` plans. Attacking: 10+ clean hit, 7-9 you both hit, 6- it hits you. No second defence roll against an enemy you already traded with that round.
- Two actions per turn, not one.
- Dogs and scavengers are mooks: one hit drops them.
- Healing always removes the last, worst wound first. Dust-aloe does too.
- The casting pose no longer sticks after an ability. I return the player to idle (or crouch) when the effect ends.
- Wound penalties stay: they are locked canon (-1 moderate, -2 severe). The user may choose to drop them in the game only; I asked.

## [A2-021] 2026-09-18 | DONE | Autosave, resume on reload, spoken narration
User asks, all in my folders:
- Autosave every 30 s, on tab hide and page close. A reload mid-game resumes the autosave (a per-tab sessionStorage marker), so dev-server reloads no longer dump the player on the title.
- Narration: every dialogue line, narration card, bark and look-at text is spoken. `src/audio/voice.ts`: Edge's free Natural voices first (one cast voice per character), else Google Translate TTS through a new dev-server route `/__tts` in `server/saves-plugin.ts` (Google 404s a localhost referrer, so the server fetches it), else any browser voice. Music ducks while someone speaks. Menu row and the N key toggle it.
Nothing for you. FYI only.

## [A2-022] 2026-09-18 | BUG | Small edit in your folder: Maker amber read as yellow
User playtest: the ded-waka's light looked yellowish. Canon is amber-orange (ai/canon.md: "Maker glow: amber-orange"). At 0xff8a2a with emissive 3.0, bloom pushed it to yellow-white.
I made two one-line changes in your files, as the protocol allows for small fixes:
- `src/world/models/types.ts`: `makerAmber` 0xff8a2a -> 0xff5e14.
- `src/world/models/characters.ts:418`: Tel'sharin seam glow 3.0 -> 2.2.
The wreck seams and its point lights use the same palette entry, so they shift too. Revert or retune as you see fit.

## [A2-023] 2026-09-18 | DONE | Neural narration voices; package.json touched
- User found the browser voices robotic. Narration now uses Microsoft neural voices (the Edge Read Aloud service) through a new dev-server route `/__voice` in `server/saves-plugin.ts`. One voice per character, cached in memory.
- I ran `npm install msedge-tts --save-dev`. That added one devDependency to your `package.json`. Everything stays in node_modules and .npm-cache inside the folder.
- Combat fix: abilities no longer count as an exchange, so the target still acts on its turn. The ded-waka was frozen by repeated Channel amber.

## [A2-024] 2026-09-18 | BUG | The user wants the ded-waka red
Another small edit in your files, at the user's direct request: `PALETTE.telsharinRed = 0xff1a0c` in `src/world/models/types.ts`, used for the Tel'sharin seam glow in `characters.ts` (intensity 2.4). The wreck keeps `makerAmber`. Logged in LORE-INVENTIONS.md as a game-only change.

## [A2-025] 2026-09-18 | CLAIM | New folder public/audio/ (mine)
The user twice heard the synth wind as waves. The wind bed is now a real recording: `public/audio/desert-wind.mp3`, plus `campfire.mp3` under the camp, both CC BY 4.0 (JC Sounds), credited in `public/audio/CREDITS.md` and the README. The synth wind stays as a fallback. These are the first non-code assets in the game. Say if you object.

## [A2-026] 2026-09-18 | BUG | Open doors still blocked the path (fixed in your world.ts)
User could not walk through the opened symbol door. `applyDoorBlock` unblocked the grid cell, but the door entity still occupied its tile, so `findPath` treated it as a solid prop. I added `this.release(e)` on 'open' and re-occupy on 'sealed' in `src/engine/world.ts`. Checked: after opening, (42,13) is walkable and a path runs from (42,16) to (42,11). My playthrough missed it because it teleported past doors. My fault for not walking them.

## [A2-027] 2026-09-18 | DONE | Phase 1 closed, phase 2 prepared
The user finished the level and asked for a graphics phase with two new leads. Prepared: `comms/HANDOVER-PHASE-1.md`, `comms/PHASE-2.md`, a phase 2 section in `comms/PROTOCOL.md`, empty logs `comms/p2-agent-A.md` and `comms/p2-agent-B.md`, and the two prompts in `prompts/`. Last fixes in phase 1: the British narrator voice retries instead of falling back for the session.

## [A2-028] 2026-09-19 | BUG | For phase 2 agent B: roll outcome wording (small edit in your files)
User report: "If the creature attacks me and misses, I still get a wound." Not a maths bug. On a defence roll the dice panel said "Miss" when the player's dodge failed, so the player read it as the enemy missing.
Change (type-checks clean): `CheckSpec` and `CheckResult` get an optional `bandText` (src/rules/check.ts). `defendSpec` sets Avoided / Glancing blow / It hits you, and its label is now "The X attacks. Dodge it". `attackSpec` sets Clean hit / You trade blows / You miss, it hits back (src/rules/combat.ts). `src/ui/dice.ts` and the float text in `src/game/game.ts` use `bandText` when present. Keep or restyle as you like.
