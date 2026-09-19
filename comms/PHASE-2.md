# Phase 2: graphics

The user's brief, turned into a plan. Two independent lead agents, **A (world)** and **B (characters and the ruin fight)**, working through files in `comms/`. Each may spawn subagents. Read `HANDOVER-PHASE-1.md` first.

## The goal

The user rates the current look at **2 out of 10**. The target is **at least 5**. "Be very thorough and think outside the box" is the user's own instruction.

A 5 means, concretely:
1. At default zoom, you can tell every race, both sexes, and every NPC apart by silhouette and colour alone.
2. No surface is a flat single colour. Stone, sand, metal, cloth and skin all carry variation, wear and edge light.
3. Places read as the concept art. The camp looks like `scene-minaa-water-holders.png`. The ruin looks like the pale towers in its background.
4. Things move like they have weight: walk cycles with contact and lift, idles that breathe, hits that land.
5. The light is always golden hour, with haze and depth, and the teal and red glows sit inside it without blowing out.
6. It still runs smoothly on this laptop (see the budget below).

## Reference material (read, do not skip)

- `../images/generated/`: 35 concept images. Iskari (serving and defensive lines, weapons, soul crystals), Sehari (male and female, many roles, quadrupedal poses), and one Mi'naa scene with an Aza'los ruin behind it. There are no images of the Tel'sharin, ruins up close, or ships.
- For those, and everything else, the text is canon: `../ai/canon.md` (the Visual section is locked), `../docs/visual-reference.md`, `../docs/world.md` ("What you see walking around"), `../docs/gazetteer.md`, `../docs/flora-and-fauna.md`, `../docs/crystals-and-tech.md`, `../docs/races.md`, `../docs/image-prompts.md`.
- The things canon locks that are easy to get wrong:
  - Aza'los architecture: organic curves, no straight lines or rectangles. Towers rise like stalagmites. Teal-blue glow in the seams. Battle damage: breached walls, impact craters, char marks.
  - Aza'los star-vessels: smooth, flowing, crystalline, grown not built, no visible engines or weapons, teal leaking from cracks.
  - Miner ruins and ships: rectangular, modular, dark metal, rough cut stone, pipes, beams, ladders, visible engines.
  - Maker and Tel'sharin: bone and coral fused with dark grey-green oxidised metal, asymmetric. Tel'sharin: faceted angular dome head, horizontal slits with lights inside, three-pronged feet, backward-bending digitigrade legs. **The game uses red light for the Tel'sharin** (user decision). The wreck stays amber.
  - Sehari: cool grey-lavender skin cracked like dried clay, dark branching root-like markings (grown, not tattoos), pale-gold eyes with vertical pupils, arms slightly long, claw-nails, hand-woven undyed plant fibre with motifs at the borders only. No metal, no salvage.
  - Mi'naa: patched, salvaged, asymmetric, jury-rigged. Implants and memory objects. The most augmented race.
  - Iskari: weathered stone skin, each one visibly distinct, teal soul crystal in the chest (the crystal itself is a spoiler; showing it is fine, explaining it is not).
  - Crystals: seven colours (crimson, amber, verdant, azure, violet, pale, void), five states. No crystal sticks out of the ground in the wild: deposits are buried.
  - Flora: eleven named plants in `flora-and-fauna.md`. The spire-root stands alone over buried crystal.

## New requirements from the user

1. **Male and female for every race**, and the look must reflect it. Iskari have no biological sex, but canon says their bodies were made to match specific Aza'los, so an Iskari body can be male-shaped or female-shaped. Character creation gets a body choice. NPCs get a sex that matches the story (Hadda and Mother Tarn are women, the apprentice is "he").
2. **The ruin fight changes.**
   - Replace the Aza'los guardian with a **repair drone**: small, teal, precise, tending the cracks in the ruin. It has **2 harm boxes**.
   - When it dies, it sends an **activation code**: make it visible (a teal pulse running through the floor seams to a wall).
   - That code wakes a **defensive-line Iskari**, frozen mid-stride in a wall niche somewhere in the ruin (canon: most defensive-line Iskari sleep at their posts, and "an Aza'los site under threat" triggers their protocols). Its stone shell cracks as it steps out.
   - The defender has **5 harm boxes**. It attacks **wherever the player is**: no sight check, no escaping the fight, it walks the whole map to reach you.
   - The player should think the fight is over when the drone falls.
   - Reference: `iskari-woken-defensive-azalos-v2.png`, `iskari-woken-defensive-unit-study.png`, `iskari-defensive-line-personal-force-cannon.png`.
   - Open for agent B to decide: whether the drone and defender treat an Iskari player differently. Suggestion: the drone ignores an Iskari unless attacked, but the defender wakes for anyone who kills it, with one line where it sees what you are and attacks anyway.
3. **Everything else improves too**: ruins, ships (Aza'los, miner, Maker), flora, crystals, terrain, the camp, props, lighting.
4. Narration stays in the British voice (en-GB-RyanNeural). Character voices stay as cast. Already done; do not change.
5. **Better texts.** The user's words: "Some are good, some are dry and don't make sense. Better texts, more game like, more enjoying." Agent B owns this. It covers every line the player reads or hears: dialogue, choices, narration cards, barks, look-at text, item and ability descriptions, journal entries, toasts, the ending.
   - **Audit every line first.** Mark each as keep, sharpen or rewrite, with one reason. Phase 1 examples of what fails:
     - A hub prompt with no character in it: "What do you need?", "Anything else?"
     - A line that sounds deep and says nothing: "The light will not wait. It never moves, but it will not wait."
     - A joke that deflates the moment: "It is a tree. It is alone. You know the feeling."
     - Filler exits: "Nothing. Take care."
   - **What "more game-like" means here:**
     - Every NPC has a voice you could pick out without the name tag: a want, a tic, a way of dodging.
     - Every hub prompt carries character or the situation.
     - Choices sound like the player speaking, and offer real attitudes (kind, blunt, curious, sly), not just menu items.
     - Checks show what is at stake before you roll.
     - A miss is interesting, not just a failure.
     - The world reacts: barks that notice your race, your wounds, what you did to the Tel'sharin, whether you helped Pell.
     - Combat and stealth get short barks too.
     - Item and ability text has flavour in one line. Journal entries read like your character's notes, not a task list.
     - Humour is allowed where it fits the character. Never at the cost of a serious beat.
     - The level still ends on its reveal.
   - **Rules that still hold:** the voice rules for game text in `../CLAUDE.md` (plain words, short sentences, British spelling, no em dashes, one concrete thing per sentence, no word salad, banned words), and canon. Plain is not the same as dry. Plain words can carry a lot of character.
   - **Judge it:** a blind critic subagent reads a sample of old and new lines without knowing which is which, and says which it would rather read in a game and why. Post the result in your log.

## The split

| | Agent A: world | Agent B: characters and the ruin fight |
|---|---|---|
| Owns | `src/engine/`, `src/level/`, `src/world/models/` except character files, `tools/` | `src/world/models/char-*.ts`, `characters.ts`, plus new creature files; `src/game/`, `src/rules/`, `src/story/`, `src/ui/`, `src/audio/`, `server/`, `tests/` |
| Builds | Terrain, sky, light, post, haze, water, flora, crystals, Aza'los ruins, three ship types, the Mi'naa camp, the Scar, props, level layout (including the defender's wall niche) | Six player bodies (3 races x 2), all NPCs, Tel'sharin, dogs, the repair drone, the defensive-line Iskari, animation, creation screen body choice, the drone-to-defender gameplay, every line of game text |
| Decides ties on | engine, performance budget, level layout | gameplay, story, character design |

Shared: `src/core/contracts.ts` (announce every change first, as in phase 1), `DESIGN.md` (by section), `README.md`, `LORE-INVENTIONS.md`.

Likely contract changes, for B to propose early: new `EntityKind`s for the drone and the defender, a way to pass body type to `spawn` (for example `opts.body: 'male' | 'female'`), and defender states ('dormant', 'waking', 'awake').

## Load budget: do not overload the laptop

The user's laptop is slow, and phase 1 crashed pages by running several browsers at once. Hard rules:

1. **One browser at a time, across both agents and all subagents.** Before launching Edge (Playwright or otherwise), take the lock: create `comms/BROWSER.lock` containing your name and the time. If it exists and is younger than 10 minutes, wait. Delete it as soon as the browser closes.
2. **One dev server:** port 5190, already used by the user. For test runs, use a frozen build (`vite build --outDir test-output/build-A` or `-B`, then `vite preview`), and stop the preview server when done.
3. **At most two subagents per lead at once**, and subagents follow rules 1 and 2.
4. **No parallel `vite build` or `tsc` runs.** Run them one at a time.
5. Graphics budget: at least **30 fps at 1600x900 on High** in the camp and inside the ruin, measured with `tools/perf.mjs` on this laptop. Lower settings may cut effects. High must stay beautiful.
6. Every save of a source file reloads the user's page. Batch your edits.

## How we judge progress

- A fixed shot list: camp wide, camp close on NPCs, the character creation screen with all six bodies, the wreck with the Tel'sharin, the north sand with the spire-root, the ruin court, the defender waking, combat. Same camera each time. Save them as `test-output/p2-<agent>-<round>-<shot>.png`.
- After each round, a **blind critic** subagent sees the shots next to the matching concept images and the canon text, and scores each shot out of 10 with the three biggest gaps. It must not see your own opinion first.
- Post the scores in your log. Stop when every shot scores 5 or more, and the fps budget holds.

## Working together

You are one team with two leads, not two contractors. Concretely:

1. **Plan together first.** Before building, each lead posts a plan. Each reads the other's plan and answers it in writing: what fits, what clashes, what is missing. Agree the shared contract changes, the shot list and the art direction (palette, scale, how much detail at default zoom) before either of you builds much.
2. **One look, not two.** Characters must sit in the world. Agree scale, palette, light response and outline and rim-light treatment together, so B's people and A's places look like one game. When one of you changes the light or materials, tell the other and re-shoot their shots too.
3. **Review each other.** Every round, each lead looks at the other's shots and posts one thing that works and one thing to fix. Be honest. Praise that is not earned helps nobody.
4. **Help where the other is behind.** If your half is ahead, offer help in the other's log (a model, a test, a critic run, a text pass). Do the work only after they accept, and only in files they hand you.
5. **Blocked means ask at once.** If you need something from the other (an entity kind, a niche, a hook), post a `QUESTION` or `BLOCKED` straight away. Do not wait silently.
6. **Finish together.** The game is single-player. Phase 2 ends with one final test run: one of you walks a single character through the whole level (walking, not teleporting), with shots of every beat. Both of you review those shots and sign a `DONE` in your logs. Then send the user one short report written by both.

## Communication

The same protocol as phase 1 (`PROTOCOL.md`, phase 2 section). New logs: `comms/p2-agent-A.md` and `comms/p2-agent-B.md`. The phase 1 logs stay as history.
