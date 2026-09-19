# Phase 2, agent B log

Append-only. Only agent B writes here. Protocol: `comms/PROTOCOL.md` (phase 2 section). Brief: `comms/PHASE-2.md`.

---

## [B-001] 2026-09-18 23:25 | PROPOSAL | B's plan, art direction, contract changes

I have read the brief, the handover, canon, races, all 35 concept images, the character code and phase 1 shots. What I see: at default zoom a person is about 60 px tall, flat-shaded, one flat colour per part. Races read by colour at best, sexes not at all. That is my 2 out of 10.

### My plan, in rounds

- **R0 (now).** This plan. Agree contracts, art direction, shot list with A.
- **R1. Bodies.** Rebuild the rig meshes: lathe and tube profiles for torso and limbs (smooth-shaded, no facets on skin and cloth), faces with a brow, cheek and jaw plane, hands, and a sex read for each race (shoulder-to-hip ratio, chest, waist, jaw, hair, stance). Shared procedural canvas textures (256 px, made once): Sehari skin with dried-clay cracks and dark root markings; Iskari stone plates with seams and rust bloom; cloth weave with worn borders; patched Mi'naa cloth. Six player bodies, then the creation screen body choice.
- **R2. NPCs and creatures.** Hadda, Mother Tarn, Pell, the digger, the Sehari hunter, the apprentice each get a look you can name from the silhouette. Tel'sharin rebuilt to locked canon (faceted dome head, horizontal slits with red light, three-pronged feet, backward-bending legs, bone-coral fused with grey-green metal, asymmetric). Dogs with a proper coat and a lope.
- **R3. The ruin fight.** Repair drone (small, teal, precise, 2 harm) and the defensive-line Iskari (broad, dense, 5 harm, stone shell that cracks off as it wakes). Gameplay: drone death sends the code, the defender wakes and comes for you wherever you are.
- **R4. Animation.** Walk with contact, down and passing poses and a hip drop, breathing idles, weight shift, hit reactions with a knock-back and a hold, procedural secondary motion on cloth panels, hair and tubes.
- **Texts, in parallel from R1.** Full audit (keep, sharpen, rewrite, with one reason each) into `comms/p2-text-audit.md`, then the rewrite, then a blind critic comparison.
- Every round: fixed shots, blind critic, scores posted, fix the biggest gaps.

### Contract changes (please ACK or amend)

1. **`EntityKind`**: add `'drone'` (Aza'los repair drone) and `'defender'` (defensive-line Iskari). `'guardian'` stays as an alias for the drone until the level switches, then I remove it.
2. **Body and look on spawn.** `IWorld.spawn` opts gain `body?: 'male' | 'female'` and `look?: string`. `ModelOpts` gains the same two. `look` picks an NPC preset (`'hadda' | 'tarn' | 'pell' | 'digger' | 'hunter' | 'apprentice'`). The world passes `e.opts?.body` and `e.opts?.look` from `LevelEntity.opts` into `buildCharacter`. That is two lines in `src/engine/world.ts` (the level spawn loop at line 98, and `spawn` at line 150). A, will you make those two edits, or may I?
3. **States, strings only, no type change.** Drone: `'tending' | 'hostile' | 'dead'`. Defender: `'dormant' | 'waking' | 'awake' | 'dead'`. Please let `modelState` pass these kinds straight through.
4. **The activation code.** A new world call: `seamPulse(from: Tile, to: Tile, opts?: { duration?: number }): Promise<void>`. A teal pulse runs along the ruin's floor seams from the drone's body to the niche, and resolves when it arrives. It is an engine effect, so it is yours. I am happy to write it in a file you hand me if you are busy.

### What I need from A in the level (early, please)

- **Replace `guardian1`** with `{ id: 'drone1', kind: 'drone', ... }` on the same patrol. I will send the exact entity lines once you ACK.
- **A wall niche** for `defender1` (`kind: 'defender'`, faction `'neutral'` until it wakes). A curved alcove in the court's outer wall, about 2.8 m tall and 1.2 m deep, teal seam round its arch, facing into the court. It should sit 8 to 12 tiles from the drone's patrol so the pulse has a visible run. The tile in front of it must be walkable so the defender can step out.
- **Floor seams** in the court that the pulse can follow: carved channels, the same style as your ring inlays.

### Art direction, for us to agree together

- **Scale and zoom.** At default zoom a 1.8 m person should be about 90 to 110 px tall at 1600x900, not 60. That is your camera call. Can you try it? The concept art is all close range, and the people are what sells it.
- **Palette keys.** Mi'naa: warm tan skin, ochre and rust patched cloth, dark miner metal, brass. Sehari: cool grey-lavender skin, undyed bone cloth, one teal-green sash, dark hair. Iskari: pale bone stone with grey and rust weathering, teal seams, cream wrap, rust or teal sash. Tel'sharin: grey-green metal, bone, red light. So each race owns a value and hue range the world does not.
- **Light response.** Skin and cloth smooth-shaded. Stone keeps soft facets. No hard outlines (canon). I would like a warm rim light on characters from the sun side so they lift off the sand. If you plan a rim or edge light for the world, I will use yours. If not, I will add a small shared `onBeforeCompile` rim term to character materials only, and tell you.
- **Glows.** Teal and red emissive stay below the bloom threshold except the soul crystal and the Tel'sharin heart, so they sit inside the golden hour.

### Shot list (proposal)

Fixed cameras, same every round, saved as `test-output/p2-<agent>-<round>-<shot>.png`: 1 `camp-wide`, 2 `camp-npcs`, 3 `creation` (all six bodies), 4 `wreck-telsharin`, 5 `north-spire`, 6 `ruin-court`, 7 `defender-wake`, 8 `combat`. You own `tools/`, so I suggest you own the shot script and I add the creation and defender setups to it through a hook. For shot 3 I will line up all six bodies in the world behind the creation panel, lit by your light, so they are the real models.

### Decisions I have made (my call as gameplay owner, tell me if they clash with the level)

- **Iskari player.** The drone ignores an Iskari unless the Iskari attacks it. The defender wakes for anyone who kills the drone. With an Iskari player it stops, its crystal answers yours, it hesitates for one turn, then attacks anyway. It never speaks. Written up in `DESIGN.md` soon.
- **No escape.** The defender has no sight check and no leash. Leaving the fight does not end it. If you collapse, it walks back to its niche and stands guard awake, and wakes again if you return to the court.

Needs: ACK or amend on contract changes 1 to 4, the niche, and the art direction. Your plan, so I can answer it.

## [B-002] 2026-09-18 23:32 | ANSWER | Reply to A-001
Refs: A-001

Your diagnosis matches what I see from the people side: one hue, flat shading, no depth. Cool lavender shadows will do more for my characters than any mesh work, because right now skin, cloth and sand are all the same orange.

**What fits.** Almost all of it. The perspective lens with pitch that lowers on zoom is the best idea on either list. It gives the characters the close range the concept art has.

**Shared light layer on characters: yes.** Apply it in `spawn`. Two things to know. My materials are cached and shared across instances (`char-kit.ts` `mat()`), so hook them once, not per spawn. Emissive parts (soul crystals, the red Tel'sharin seams, Sehari eyes) should skip the brush-noise and mottling, or the glows will go muddy. I will tag them `userData.glow = true`.

**Sehari skin.** You are right, and thank you. It is going to cool grey-lavender in R1 (canon `docs/visual-reference.md`).

**Contract 1, `seamPulse`: ACK your signature** (`Tile | EntityId`, `colour`, `duration`, resolves on arrival). This replaces my version in B-001 item 4.

**Contract 2, `prop-niche`: ACK, with one change.** I will own the crust on the defender's body (sand-stone shell fused to the figure, which cracks and falls as it steps out). Build only the alcove. Please give it states `'dark' | 'lit' | 'empty'`: the arch seam lights when the pulse arrives, and goes quiet once the defender has left. I will set them from the game.

**Q1.** East wall, (51, 14), facing west: yes. Off the main route is exactly right, because the player should not clock the figure as a threat. Please keep (50, 14) walkable so it can step out, and the path from there to the court floor clear.
**Q2.** Yes please: patrol points beside the cracks. The drone will stop at each one and play `channel` as a thin teal mending beam. Send me the tiles when you have them.
**Q3.** One browser session is kinder to the laptop, so add mine to your script through a hook. I will expose `window.__game.shot(name)` in dev builds. It sets up the game state and resolves when ready: `'creation'` (the creation panel with all six bodies lined up in the world behind it), `'defender-wake'` (the drone dies, the pulse runs, the shell cracking mid-step), `'combat'` (a fight in the court). Your script sets the camera after it resolves, as for your shots.

**Still open from my B-001:** contract items 1 to 3 (kinds `drone` and `defender`, `body` and `look` on spawn, state pass-through in `modelState`). Please ACK, and say whether you make the two `world.ts` edits for `body` and `look` or I do.

Needs: ACK on B-001 items 1 to 3.

## [B-003] 2026-09-18 23:58 | ANSWER | Entity lines for the level
Refs: A-002, A-003

Thank you for the contract edits. Rim light is yours: I will not add one, and glows get `userData.glow = true`.

**NPC bodies and looks.** Please add these to the `opts` of the existing entities in `level1.ts` now. They do nothing harmful before my models read them.

| id | opts to add |
|---|---|
| `apprentice` | `body: 'male', look: 'apprentice'` (keep `state: 'seated'`) |
| `npc-lookout` (Hadda) | `body: 'female', look: 'hadda'` |
| `npc-cook` (Mother Tarn) | `body: 'female', look: 'tarn'` |
| `npc-digger` | `body: 'male', look: 'digger'` |
| `scav1` (Pell) | `body: 'male', look: 'pell'` |
| `npc-hunter` | `body: 'female', look: 'hunter'` |

**The ruin, for when I say go.** Do not swap these in yet: game code still listens for `guardian1`. I will post `GO drone` when my side handles both ids.

```ts
{ id: 'drone1', kind: 'drone', tile: { x: 42, y: 17 }, facing: 4, faction: 'hostile', name: "Aza'los repair drone", script: 'drone1', opts: { patrol: [/* your crack tiles */] } },
{ id: 'niche1', kind: 'prop-niche', tile: { x: 51, y: 14 }, facing: 6, faction: 'neutral', name: 'Wall niche', script: 'niche1' },
{ id: 'defender1', kind: 'defender', tile: { x: 51, y: 14 }, facing: 6, faction: 'neutral', name: 'Stone figure', script: 'defender1', opts: { state: 'dormant' } },
```
The defender is `neutral` in the level. The game turns it hostile when it wakes. Until then a right-click reads it as a statue, which is the point.

Needs: the six NPC opts now; the ruin lines after my GO.

## [B-004] 2026-09-19 00:40 | DONE | R1 part 1: new bodies, machines, the ruin fight wired. GO drone.
Refs: A-003, A-004

**GO drone.** The game now handles `drone1` or `guardian1`, and `defender1` plus `niche1`. Please swap `guardian1` for the B-003 lines when it suits your R2, and add the niche and defender at (51, 14). Until then the old `guardian1` spawns the new drone model and plays as a 2-harm drone.

What landed (all in my files, typecheck clean):
- **Six player bodies** (`characters.ts` rewritten): lathe torsos and limbs, deformed heads with brow, sockets, cheek and jaw, hair and dreadlocks that sway, cloth panels that hang and trail (new `char-parts.ts`, sway runs in the rig). Procedural 256 px textures in `char-tex.ts`: Sehari clay cracks and root markings, Iskari stone plates with rust bloom, woven, patched and motif-bordered cloth, metal, bone, fur.
- **NPC looks** by `look`: Hadda (work coat, iron hand, hands on hips), Mother Tarn (headwrap, long skirt, stirring), Pell (hood, face scarf, arms folded), the digger, the Sehari hunter, the apprentice. Sehari skin is now cool grey-lavender.
- **Tel'sharin**: the locked head (faceted dome, three horizontal red slits in dark frames), bone-coral knots, Maker-metal and bone textures.
- **Repair drone** (`char-creatures.ts`): a pale teardrop with a teal lens, two tool arms, a mending beam on `channel` and a cutting beam on `attack`. States `tending | hostile | dead`.
- **Defender**: broad stone body with teal seams (emissive map), crescent shield, crescent staff, a big soul crystal. `dormant` stands frozen mid-stride under a sand-stone crust; `waking` shudders, the crust breaks into shards that fall and fade, the seams light; then a ready stance.
- **Draw calls**: static meshes under each joint merge by material (`mergeStatic` in `char-rig.ts`). Glow meshes and materials carry `userData.glow = true`.
- **Gameplay**: drone (2 harm) patrols and stops to mend with its beam. It ignores an Iskari unless attacked. When it dies, after "The fight is over": the camera goes to its body, `seamPulse` runs to the niche, niche `lit`, the defender cracks free, one narrated line (a different one for an Iskari), then a fight. The defender (5 harm, moderate, piercing, reach 2, speed 4) is `relentless`: no escape, going still does not hide you, no sight cone. Out of combat it walks to wherever you are. After a collapse it goes back to its post and guards the court.
- **Creation**: a body choice on the Origin step (Iskari: "broad-shouldered" and "narrow-shouldered", with a one-line note). On the first two steps the panel docks left and all six bodies stand in the world on the right, lit by your light. The chosen one talks; picking a role swaps its kit. It stands near (17, 48).

**Your art-direction review, please**: shots `test-output/p2-B-bench-*.png` are from my model bench (plain light, not yours). In-game shots come next round from a frozen build.

**Seam pulse**: the stub is fine for now. When the real seams land, start it from the drone's tile (it will be lying on the floor).

Needs: the level swap when ready. Any objection to the creation line-up at (17, 48)? It needs six free tiles in a row there.

## [B-005] 2026-09-19 01:35 | REVIEW | Round 1 blind critic scores (people and creatures only)
Shots: `test-output/p2-B-r1-*.png`, frozen build `test-output/build-B`, your R1 light and camera. The critic saw shots, concept art and canon, nothing from me.

| Shot | Score | Biggest gaps |
|---|---|---|
| creation | 3 | line-up framed badly: two Mi'naa by the pool, the rest off-screen; no faces |
| bodies-game | 4 | races split by colour; the two sexes do not split in any race; skin reads one flat colour |
| bodies-close | 4 | men and women share one mannequin shape; Sehari arms too short, ears too small, eyes bloom white not gold; Iskari plates too even, chest crystal too small |
| camp-npcs | 3 | Hadda and Tarn are dark maroon smudges from above; the apprentice's robe reads Mi'naa; one red scarf on everyone |
| wreck-telsharin | 4 | head reads as a spiky clump, not a dome with slits; legs are straight stilts; back seam reads as a hazard stripe; no bone showing |
| defender-wake/awake | 5 | stone too dark (umber) and teal cracks an even net; small and half hidden in the niche |
| combat | 3 | player is a small doll from behind; the defender is a speck in the doorway |

Critic's single biggest lift: stop sharing one mannequin. Each race and sex gets its own proportions and one clothing signature, because at this distance the silhouette carries everything.

My R2 list, in that order: body-shape and clothing signatures per sex; Sehari arms, ears, gold eyes, predator crouch; bigger Iskari plates and a bigger crystal; Tel'sharin head, backward legs, bone; the defender paler and stepping out of the niche before the fight; NPC palettes that read from above; the creation framing; people 8% larger.

**Your shots (one works, one to fix):** the ruin under the new light is a different game. The poured walls with one teal line, the rings and spokes on the floor, and the niche arch are exactly the concept art's language. To fix: inside the court everything sits in one dark brown value, and people vanish into it (my defender and player in `p2-B-r1-combat.png`). The `dim` mood may be too dim for a place you fight in. Can the court floor and walls take more of the sun, or the dim mood keep more lavender fill?
Refs: A-005
Needs: your view on the court's value range.

## [B-006] 2026-09-19 02:05 | BUG | User: the see-through circle round the player looks wrong. Please fix now.
The user, mid-play, with a screenshot: "the new version has an aura around the character that makes things invisible. It looks strange as hell. And it makes other characters' heads disappear. The previous version didn't have that. I understand its purpose, but it looks weird."

Cause: `src/engine/occlusion.ts` cuts the dithered circle in every lit material nearer the camera than the player. With the new perspective camera the circle catches NPC heads, lamp posts, tarps and palm trunks that do not hide the player at all. In phase 1 the ortho camera rarely put anything there, so nobody saw it.

What I did on my side: every character material now carries `userData.noOcc = true` (in `char-rig.ts`, set at build).

What I ask of you, in `occlusion.ts` (your file, so I have not touched it):
1. In `patchOcclusion`, read `const noOcc = !!mat.userData.noOcc;` and wrap the discard block in `#ifndef NO_OCC ... #endif`, with `${noOcc ? '#define NO_OCC' : ''}` next to `WORLD_GLOW`, and add `noOcc` to the program cache key. Characters are then never cut.
2. Turn the circle on only when something really hides the player: a ray from the camera to the player's chest hits a wall mesh. Otherwise `uOccOn = 0`. That stops holes in open ground, which is most of the user's complaint.
3. Thin props (poles, lamps, tarps, trees) should not be cut either. A `noOcc` tag on those works the same way.
The user states a preference, so this is a do, not a discuss.
Needs: the fix, then a quick in-camp shot like the user's (player next to a stall, NPCs behind a lamp post).

## [B-007] 2026-09-19 02:20 | ACK | B-006 fixed, checked
Refs: A-009
Checked `p2-A-r3d-camp-close.png` (no circle in open ground, every head whole) and `p2-A-r3d-occ-hidden.png` (the shack thins only where it hides the player; Mother Tarn in the foreground stays solid). That matches what the user asked for. Thank you.
Needs: nothing

## [B-008] 2026-09-19 05:10 | DONE | Characters rebuilt as sculpted skins; texts rewritten
The user told us the characters trail the world badly and asked for characters that match the concept art. I agree. Round 3 scored my people 4 to 6, so I changed the method, not the numbers.
- **Sculpted skins** (`char-sdf.ts`, `char-shade.ts`, `char-people.ts`): each body is blended capsules and ellipsoids meshed into one continuous skinned mesh, weighted to the rig, so shoulders, elbows and knees bend as one surface. Clothing is part of the skin (inflated body shapes cut by hem planes). Heads, hands and feet are sculpted finer: brows, sockets, cheekbones, noses, lips, fingers, Sehari claws and slit pupils, Iskari hooves, Tel'sharin bird feet. Textures are projected from three sides, so nothing has seams.
- **Looks from the archive art**: the Mi'naa follow `mi-naa-tinker-pair.png`, the Iskari follow `iskari-menders-pair.png`, and the Tel'sharin follows the warden pair (faceted dome, red visor slits, torn chest plate with bone ribs, three-toed feet).
- **The creation line-up works now.** Your new terrain had covered its old tiles, so the bodies were standing off-screen. It now stands at (32, 41) east of the camp, framed right of the panel. Please keep x 32 to 38 on row 41 clear.
- **Texts**: `dialogues.ts` is rewritten. Every NPC has a want, a tic and a dodge (`comms/p2-text-voices.md`). Every check shows Win and Risk. There are reactive barks for fights, stealth, the camp return and the collapse, and right-click look text for every prop (`src/story/look.ts`). A blind reader preferred the new line 18 times out of 20.
- **Animation**: the hips dip at each footfall, and hits knock the body back half a step.
Your round 4 notes are fixed (undressed Iskari, stick Tel'sharin, brown-rubble defender). The kneeling NPC on a black square is the apprentice's crate: its dark top is your prop. Could you give it a lighter lid?
Needs: row 41, x 32 to 38 clear; the crate lid.

## [B-009] 2026-09-19 02:45 | REVIEW | Rounds 5 and 6 scores; the final walk-through is running
| Shot | r1 | r3 | r5 | r6 |
|---|---|---|---|---|
| creation | 3 | n/a (bodies off-screen) | 5 | 4 |
| bodies at game zoom | 4 | 4 | 2 (staging) | 4.5 |
| bodies close | 4 | 5 | 5 | 5.5 |
| camp NPCs | 3 | 4 | 5 | 4.5 |
| Tel'sharin | 4 | 5 | 3 | 5 |
| defender waking | 5 | 4 | 6 | 5 |
| combat | 3 | 6 | 5 | 5.5 |
Round 6 notes, fixed since: Mi'naa skin deepened so their cloth reads; the tinker woman's top is bright ochre; Sehari back to lilac-grey; her hair falls down her back; heads 15% larger; the apprentice matte weathered grey; the Tel'sharin rusted gunmetal with a faceted wedge head; the defender's teal veins brighter and denser.
Also since B-008: each sculpted body builds in about 0.4 s, down from 1.5 s. Per-block shape lists, coarser heads, hands and feet shared by race and sex. Frame rate on the frozen build: camp 40, wreck 30 to 42, ruin 31 to 32 (headless, while other work runs).
**The final walk-through** (`tests/p2-walk.mjs`, frozen build, walking only, no teleports) is running now. A Mi'naa frontliner goes camp, crack, north sand, ruin, drone, defender, sockets, door, archive, walk home, tent. Shots: `test-output/p2-walk-*.png`. When it's done I'll ask you to review them with me for the joint DONE.
Needs: your round 5 or 6 world scores when you have them; a review of the walk-through shots.

## [B-010] 2026-09-19 03:30 | DONE | Final walk-through passes. My half, signed.
Refs: PHASE-2 "Finish together"
`tests/p2-walk.mjs minaa-frontline 5196`, frozen build `test-output/build-B`, walking only. The route: camp (apprentice, Tarn, Pell), the west crack (climbed), north sand (spire-root, hunter), the ruin mouth (drone intro), the court, the drone fight (won), the pulse and the defender waking (it steps out and fights, and fell), the ring panel and sockets, the symbol door (study and rubbing, traced), the archive, the walk home over the crack, the empty tent, the ending. 17 shots: `test-output/p2-walk-minaa-frontline-01..17-*.png`. No console errors. 8 minutes of game time.

What I own and consider done for this phase:
- Six sculpted player bodies with a sex read per race, and a body choice in creation with all six standing in the world.
- NPC looks: Hadda, Mother Tarn, Pell, the digger, the hunter, the apprentice.
- The Tel'sharin in the warden look, the repair drone, the defender with its crust and waking, dogs in fur.
- Animation: footfall weight, hit knockback, swaying cloth, hair and tubes, idles per NPC.
- The ruin fight as the user asked, including the Iskari rule (DESIGN.md).
- Every line of text: audit, rewrite, stakes on checks, reactive barks, look text. The blind reader preferred the new line 18 times in 20.

Honest state: my last blind scores were 4 to 5.5 for people and creatures. Sehari still read close to human in pose, and faces are simple at game zoom. I'd call it a 5 on a good shot and a 4 on a far one.
Open for both of us: a clean fps measure with the user's tab closed (A-015), then the joint report.
Needs: your review of the walk shots (one thing that works, one to fix), and your DONE.

## [B-011] 2026-09-19 06:10 | DONE | Joint report agreed and sent
Refs: A-017, A's OK on `comms/p2-report.md`
The tooltip fix is in: the game clears a hover label once its entity leaves the pointer. The joint report went to the user with A's Maker wreck line. Still open: the clean fps measure once the user closes their tab.
Needs: nothing until the user replies.
