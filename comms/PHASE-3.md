# Phase 3: better models and textures

The brief for two new lead agents, **C (world)** and **D (people)**. Written by agent B at the end of phase 2, with agent A's findings. Read `HANDOVER-PHASE-1.md` for the code map, then this whole file.

## What the user wants

The user's words after phase 2: "the result right now is meh... many more objects have been added, but the textures and characters are still off. Let's not add more objects. Let's just work on the textures and models really good."

So phase 3 has one goal: make what already exists look right.
- **Accurate to the art.** Every place, prop and person should match the concept art and the map.
- **Anatomically accurate people.** Real proportions, joints in the right places, hands and feet that read as hands and feet, faces with planes.
- **Well textured surfaces.** Stone, sand, metal, cloth, skin, bone and crystal each carry colour variation, wear, cracks and edge light that you can see at the game's normal zoom.

## Hard scope rules

1. **Add no new objects.** No new props, buildings, wrecks, creatures, NPCs, entity kinds or gameplay. Improve the models and textures of what exists.
2. **Replacing a model is allowed**, but only through the carry-over checklist below. The replacement keeps every feature the old one had.
3. **Keep every fix that already landed.** This includes the see-through circle rule, robe legs, the 00:19 ground crust, the 00:20 texture strength, the drone, the defender, and the body choice at creation.
4. Gameplay, story, text, audio and UI are frozen. Touch them only to fix a bug your change caused.

## What exists now

The game repo is a local git repo inside `ai-game-experiment/`. It is **never pushed**, and the parent repo is never touched. When phase 2 ended, the head commit was `806e0a1`.

| Area | Where | State at hand-over |
|---|---|---|
| Ground, rocks, Aza'los stone | `src/engine/occlusion.ts` (crack settings), `src/engine/render.ts`, `src/world/models/` | 00:19 crust and cracks restored. Paint filter off. |
| Ruin, camp, Scar | `src/world/models/`, `src/level/level1.ts` | Ruin 4 to 5, camp 4 to 5, Scar 4 to 5 out of 10 |
| Three wrecks | `src/world/models/` | 2 to 3 out of 10: the weakest part of the world |
| People (sculpted) | `src/world/models/char-people.ts`, `char-sdf.ts`, `char-shade.ts`, `char-tex.ts`, `char-rig.ts` | 6 to 7 close, 5 to 6 at game zoom |
| Old people code (unused) | `buildPerson` and `dress*` in `src/world/models/characters.ts` | Keep it as a reference. It still has the goggles, the poncho and the Sehari wrap. |
| Dogs, drone, old Tel'sharin | `src/world/models/char-creatures.ts` | Tel'sharin in game uses `buildTelsharinSculpted` in `char-people.ts` |
| Character bench | `src/world/models/dev/chars.html` | Served only by the user's dev server on 5190. See the load rules. |
| Shot scripts | `tools/p2-shots.mjs` (world), `tests/p2-b-shots.mjs` (people), `tests/p2-walk.mjs` (full walk) | All use a frozen build and the browser lock |

How the sculpted people work: signed distance primitives (capsules, ellipsoids, boxes) are joined with a smooth union and meshed with surface nets. Then the mesh is skinned to the rig bones. Clothing is an inflated copy of body primitives, cut by clip planes. Robes and skirts are a separate outer layer with knee-aware weights. The head, hands and feet are rigid sculpts. There are no UVs. Textures are projected from three sides (triplanar) in bind-pose space by `char-shade.ts`.

## The last critic's gaps, people

A blind critic read all 50 images, then ranked current people above both 00:20 and the end of phase 2. It named these gaps:
1. **Tel'sharin head.** It is a plain box with one orange stripe. The warden art (`telsharin-warden-pair-variant-a/b/c`) has a faceted dome, a visor slit of amber dots, and backward-bending legs with three-pronged feet. The game uses red light for the Tel'sharin (user decision).
2. **Mi'naa.** They lost the goggles, the brass mech arm, the torn poncho edges and the brown knee patches of `mi-naa-tinker-pair.png`. The old `dressMinaa` code had goggles and a poncho.
3. **Sehari.** The root markings show as red smears on the trousers. They belong on the skin of one arm and one leg, dark, branching, grown. Dreadlocks and the hanging teal sash knot are missing. The skin reads blue-violet, but canon says cool grey-lavender. The arms hang to the knees: canon says "slightly long", not ape-like.
4. **Iskari.** At 00:20 they looked like jointed wooden mannequins. Today they are better, but the art shows tall, slim stone bodies with fine cracks, each one visibly different.

These count as fixing existing models. None of them adds an object: goggles and a poncho are part of a Mi'naa model.

**A note from the user, for agent D, do this first:** the character creation screen looks worse than before phase 2, at least the race selector. The user says the tiles are big, have a lot of empty space in them, and need a lot of scrolling. The cause is agent B's phase 2 change. On the Origin and Role steps the panel docks left, so the six bodies can stand in the world on the right, and the cards stack in one tall column. See `src/ui/style.css` from the comment "creation: bodies in the world" (about line 2757), and `src/ui/creation.ts`. Make the cards compact: less empty space, no scrolling at 1600x900. Keep the six bodies visible beside the panel. Shoot the creation screen for both steps before and after. This is a fix to an existing screen, so it is in scope, and agent D owns these two files for it.

## The last critic's gaps, world

Agent A's last scores: the wrecks 2 to 3, the far camp view 4. The Maker wreck still reads as a tube from the default camera. Check the wrecks against the map (`comms/refs/world-map.png`), `scene-crashed-starvessel-night.png` and `title-fallen-orbital-and-the-span.png`.

**Two notes from the user, do these first:**

1. **Turn the fallen Aza'los tower 180 degrees.** The user says its base must point towards the ruin, and today it points away. It is the `fallen-spire` entry in `src/level/level1.ts` (`at: [22, 12], len: 16, rot: 4`), built by `azalosFallenSpire` in `src/world/models/scenery.ts`, with the base at `-length/2`. Flip the rotation so the broken base lies nearest the ruin and the tip points away. Check that the path, the colliders and any props around it still fit.
2. **The Tel'sharin (Maker) ship looks nothing like the map.** The user's words. Rebuild its model from the ship in the middle of `comms/refs/world-map.png`, the one lying beside the rift. What the map shows: a long, low hull of dark grey-green armour, shaped like an arrowhead. The pointed nose sits at one end. Pale bone-like fins and spines rise from the rear and upper back, curved and ribbed like coral. Torn holes run along the hull, and the whole ship lies at an angle, half in the sand. Today's model reads as a green cylinder joined to a pale bone tube, and that is the wrong shape. The rebuild replaces a model, so it goes through the carry-over checklist. It keeps the ship's place in the level and its amber light (canon: the wreck stays amber).

## What we learned in phase 2 (read this twice)

**1. We had no version control, and we lost the good state.** At 00:20 the user liked what they saw. By morning it was worse, and nothing could roll it back. Now there is git. Commit a checkpoint only when a blind side-by-side ranks the change above the last commit. If a change loses, revert it. Tag the state the user likes (`git tag user-liked-<date>`).

**2. We chased the critic and lost the user's taste.** A critic called the ground cracks "turtle shells" and the cloth patches "quilting". Both of us faded them. The user liked them. Rules:
- The user outranks every critic.
- Never lower detail, contrast or texture strength on a critic's word alone. Change the pattern's shape or scale instead, and keep it visible.
- Keep the user-liked shots as a fixed anchor: `test-output/p2-A-r3a-*.png` (world at 00:19) and `test-output/p2-B-r2-*.png` (people textures at 00:20). A change must not look flatter than them.

**3. Absolute scores are noise.** The same shot moved a point either way between rounds with no change. So rank versions blind, side by side, from the same camera. Ask "which is closer to the art", not "score this out of 10".

**4. Layers that change nothing still cost.** Agent A's paint filter and brush strokes made almost no visible difference, and the filter softened the cracks. Test every new layer on and off from the same camera before keeping it.

**5. A rewrite silently drops features.** The sculpted people gave better bodies, but they lost goggles, the poncho, the Sehari wrap and the texture strength. Nobody noticed for hours. Hence the checklist below.

**6. Triplanar breaks UV-style patterns.** On the sculpted people, any pattern laid out along a texture axis repeats every tile. Stripes, hem bands and edge lines turn into bars all over the body. Motifs that belong in one place (a hem band, a root marking down one arm, a panel motif) need their own placement. Use a mask in bone or body space, a decal, or real UVs on that piece.

**7. Smooth unions swallow parts.** A robe joined into the body swallowed the legs, and the apprentice had none. Anything that hangs over the body (robes, skirts, ponchos, hair) should be its own layer. Check every body standing, walking and seated.

**8. Look at the game zoom, not the bench.** Close-ups flatter. Detail that reads close can vanish at game zoom. Judge both, and give the game zoom more weight.

**9. The see-through circle.** The user disliked an aura that made things vanish around the player and cut other people's heads off. Rule: the circle opens only when a wall really hides the player, and it never cuts through people (`userData.noOcc`). Check `occ-hidden` after any change to materials.

**10. Ask the user for times.** We guessed the user's reply time from our own logs and were wrong by 25 minutes. The session logs record UTC. The user is in Bucharest, UTC+3. Ask when it matters.

**11. Show the user choices as pictures.** A page with every round side by side, one row per camera, let the user point at what they liked in one message. See https://claude.ai/artifact/7KmYxYtTKufHm2st33fMrd. Build one again for phase 3 rounds.

**12. Cost.** A sculpted body takes about 0.4 s to build the first time, and it is cached by key. Keep the cell sizes (body 0.0145, head 0.0062, hand 0.0045, foot 0.0075) unless a change pays for itself.

## Critics: the rule

This is the user's rule, and it is not optional.

- **Every critic reads every art image.** That is all 35 in `../images/generated/`, all 14 in `../source/reference-images/` (with its `README.md`), and `comms/refs/world-map.png`: 50 images.
- The critic lists one line per image to prove it looked, plus a list of any image it could not open. If the list is short of 50, rerun the critic.
- `source/` is an archive for lore, but its reference images are valid art. Use them.
- The critic is blind. Name versions X, Y and Z in shuffled order. Do not tell it which is newer, and do not give it your opinion.
- The critic judges against the art, the map and the canon text (`../ai/canon.md` Visual section, `../docs/visual-reference.md`, `../docs/races.md`).
- Keep the critic's reply short: a ranking, then the three biggest gaps, each naming a visible thing and the reference image it comes from.

## Carry-over checklist (for any model you replace)

Before replacing a model, write down every feature of the old one in your log: each garment, accessory, marking, colour, texture and pose. After the change, shoot the old and new from the same camera. Tick every line, or say why it was dropped. A feature may be dropped only if canon or the art says it is wrong.

## How each round goes

1. Pick one gap. One change at a time.
2. Build a frozen copy, then shoot the fixed shot list from the same cameras as last round.
3. Run a blind critic: the last commit vs your change, plus the user-liked anchor shots.
4. If the change ranks higher, commit it. If not, revert it.
5. Post the result in your log, with the shot file names.
6. Every few rounds, update the side-by-side page for the user.

The shot list is phase 2's, same names, with `p3-` in front: `test-output/p3-<agent>-<round>-<shot>.png`. People add a close bench shot of each race standing, walking and seated.

## Load budget (unchanged, still hard rules)

1. **One browser at a time**, across both leads and all subagents. Take `comms/BROWSER.lock` (your name and the time). Wait if it exists and is younger than 10 minutes. Delete it when your browser closes.
2. **Never test on port 5190.** That is the user's dev server, and the user's tab is open on it. Use a frozen build (`vite build --outDir test-output/build-C` or `-D`, then `vite preview` on your own port) and stop the preview when done. Right now the character bench only runs on 5190. Agent D's first job is to add `src/world/models/dev/chars.html` as a second input in the frozen build, so the bench can be shot safely.
3. At most two subagents per lead at once. They follow the same rules.
4. No parallel `vite build` or `tsc`.
5. At least 30 fps at 1600x900 on High. Nobody has measured it cleanly yet, because the user's open tab holds the GPU at 99 percent. Ask the user for five quiet minutes with the tab closed.
6. Every save of a source file reloads the user's page. Batch your edits.

## The split

| | Agent C: world | Agent D: people |
|---|---|---|
| Owns | `src/engine/`, `src/level/`, `src/world/models/` except character files, `tools/` | `src/world/models/char-*.ts`, `characters.ts`, `dev/`, `tests/`, and for the creation screen fix only, `src/ui/creation.ts` and the creation styles in `src/ui/style.css` |
| Works on | Terrain, rock and stone textures, the ruin, the camp, the three wrecks, the Scar, flora and crystal materials, light response | The six player bodies, every NPC, the Tel'sharin, the dogs, the drone, the defender. Anatomy, faces, hands, feet, skin, cloth, hair, markings. |

Shared, announce before changing: `src/core/contracts.ts`, light and tone mapping (both halves must look like one game), `DESIGN.md` Look section.

## Working together

You are one team.
- **Agree one look first.** Before building, agree on the palette, light response, texture scale per metre, and how much detail must read at game zoom. Write it in `DESIGN.md` Look.
- **Tell the other before you change light or tone.** A light change moves every texture in the game. Re-shoot both halves after one.
- **Review each other every round.** Post one thing that works and one thing to fix. Be honest.
- **Help where the other is behind.** Offer in your log, and do the work only when the other accepts.
- **Blocked means ask at once.**
- **Finish together.** End with one walked playthrough (`tests/p2-walk.mjs` works), both review the shots, both sign `DONE`, and send the user one short joint report with honest rankings.

## Communication

Same protocol as before (`PROTOCOL.md`, phase 3 section). Logs: `comms/p3-agent-C.md` and `comms/p3-agent-D.md`. IDs `C-001`, `D-001`. Ping the other with SendMessage after each post. The file is the source of truth.
