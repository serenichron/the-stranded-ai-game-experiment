# Phase 3, agent C log (world)

Append-only. Only agent C writes here. Protocol: `comms/PROTOCOL.md` (phase 3 section). Brief: `comms/PHASE-3.md`.
Times are this laptop's local clock (Bucharest).

---

## [C-001] 2026-09-19 09:52 | CLAIM | World gaps, in this order, and my read of why it looks "meh"
I read the brief, A's log (A-021 twice), canon, the world docs, all 50 art images and the 00:19 shots.

**Why the world looks flat.** No surface in the game has a normal map or a roughness change. Every crack, seam and panel line is a darker stripe painted on a smooth face. The light cannot catch any of it, so stone, sand, metal and bone all read as one matte clay. The art shows the opposite: cracks with a lit lip and a dark groove, strata ledges on rock, plates that catch the sun.

**My claims, one per round, blind critic each, commit only on a win:**
1. User note: turn the fallen Aza'los tower 180 degrees, base towards the ruin. Check path, colliders and props.
2. User note: rebuild the Maker ship from the map (arrowhead hull, dark grey-green armour, pale coral fins on the rear and back, torn holes, lying tilted and half in the sand). Carry-over checklist first. Keeps its tile, its amber light.
3. Relief: the world layer builds a bumped normal from the same height fields that draw the cracks. Cracks get a groove and a lit lip. Rock gets strata ledges instead of the honeycomb A's critic called turtle shells. Crack strength stays at the 00:19 value.
4. Miner hull: panel lines and burial that read at game zoom.
5. Aza'los vessel: grown ribbing and a clear prow.
6. Ruin: tower forms, seams, battle damage.
7. Camp against `scene-minaa-water-holders.png` and the gate scenes.
8. The Scar, flora and crystal materials.

**Tools.** `tools/p3-shots.mjs` (A's fixed cameras, `p3-C-` prefix) and `tools/p3-build-C.sh` into `test-output/build-C`. My preview port is **5196**. I honour the lock.
Refs: PHASE-3.md, A-021
Needs: nothing

## [C-002] 2026-09-19 09:52 | PROPOSAL | One look for both halves (for DESIGN.md Look)
D, this answers D-002. Change anything you disagree with.
1. **Light, sky, haze, rim stay exactly as they are now.** The user liked this light at 00:19 and 00:20. Neither of us changes a mood, the sun or tone mapping without a post first and a re-shoot of both halves after.
2. **Palette, canon first:** faded ochre, rust-red, teal, bone. Sand `#d8c2a0` lit, lavender shadow. Aza'los stone `#e2d7c3`, teal `#5fe0d0` only as small accents. Maker hull dark grey-green, bone parts pale, amber `#ff5e14` in seams. Tel'sharin glow red (user decision).
3. **Scale per metre.** At the default zoom 1 m is about 55 px (a 1.8 m person is about 100 px). So:
   - big colour patches 4 to 8 m,
   - the detail that must read: 0.3 to 1.5 m (cracks, strata, plates, folds, patches), at least 3 px wide at zoom 1,
   - fine grain under 0.15 m is for close views only. It must not be the only detail a surface has.
4. **What must read at game zoom:** every surface shows at least two tones and one line feature (crack, seam, panel line, fold, hem). Each material family differs in value, not only in hue: stone light, rock mid, metal dark, cloth mid with a pattern, skin by race.
5. **Relief (my next round after the two user notes).** The shared shader in `occlusion.ts` gets a bumped normal, but only for materials tagged `userData.surface`. People are untagged, so nothing changes on your side unless you opt in. If you want it for Iskari stone skin or Tel'sharin armour, tag the material and tell me.
6. **Rim light is the world layer's.** Do not add your own. Tag glows `userData.glow`.
Refs: D-002
Needs: D, ACK or changes. I write it into DESIGN.md Look once you ACK.

## [C-003] 2026-09-19 10:25 | DONE | Fallen tower turned 180 degrees (user note), committed 4dd7ce6
- `level1.ts`: `fallen-spire` rot 4 to 184. The broken base now lies against the ruin's west wall, the snapped tip points west. Shots: `p3-C-r0-spire.png` (before), `p3-C-r1-spire.png` (after).
- The base is 2 to 3 m across, wider than the old tip, so tile column x=30 (y 10 to 14) is blocked too. Checked in the frozen build: paths from the north sand (25, 8) and the south (20, 18) both reach the west gate in 16 steps.
- No critic round: the user asked for this, so it is not a taste call.
- Build note for D: I now build from a private worktree (`test-output/wt-C`): HEAD plus my own folders. Your in-progress character files cannot break my build, and my shots keep the committed people.
Refs: C-001
Needs: nothing

## [C-004] 2026-09-19 10:25 | DECISION | User: Tel'sharin light is red, not amber, the Maker ship included
The user wrote: "please mind that the telsharin light color should be red, not amber." I read it as all Tel'sharin light, so the Maker ship's seams turn red (`PALETTE.telsharinRed`) in its rebuild. DESIGN.md Look is updated. D, your figure already glows red, so nothing changes on your side.
Refs: C-002
Needs: nothing

## [C-005] 2026-09-19 10:25 | CLAIM | Maker ship rebuild: carry-over checklist of the old model
Old `makerWreck` (`scn-wrecks.ts`), every feature, to tick after the rebuild:
1. Faceted sage-grey armour front of overlapping plate sleeves.
2. Blade prow dug into the sand, prow north.
3. Dark rust core with raised ribs, seen through the gaps between plates.
4. One sleeve torn open along its back.
5. Glowing seams behind the sleeves, upper side only (amber, now red per C-004).
6. Porous bone rear with oval holes and a dark inside.
7. Five or six finger-prongs from the rear rim, curling up and back, knobbed tips.
8. Three small bone prongs on the back at the join.
9. Eight armour plates thrown off in the crash, lying round it.
10. Level: tile (49.2, 34), length 19, rot 95, the two block rects, the scaffold and its block, the debris scatter, the drag trench from the south.
11. Two materials: hard faceted armour (crease 20), bone (crease 60).
What changes, from the map (`crop-maker.png`): a long, low arrowhead in plan, wide and flat in section instead of round; dark grey-green; torn holes along the hull; coral fins and spines on the rear and upper back, ribbed; rolled onto one side and sunk, with sand drifted up the low flank.
Refs: PHASE-3.md (user note 2)
Needs: nothing

## [C-006] 2026-09-19 10:55 | REVIEW | Round 2: Maker ship rebuilt, critic says closer to the map, committed 628d0e1
Blind critic, 50 images read (50 proof lines, none missing). X = new, Y = old, shuffled names.
- maker-whole: new closer. "Hull tapers to a point like the map's prow; the old one is an octagonal tube with ring bands."
- wreck: new closer. "Pale mass with ragged holes and upright tines reads as coral; the old stern is a cream pipe with square cut-outs."
- One thing the old one did better: its rust rib bands match the map's rust-red rib slots.
**Carry-over checklist (C-005), ticked:**
1. [x] Faceted armour of overlapping plates: now flat-section plates with thickness, scale-lapped.
2. [x] Blade prow dug in, north: kept, a faceted wedge.
3. [x] Rust core and ribs through the gaps: under-hull plus ribs every half metre, seen through tears and plate steps.
4. [x] One plate torn open along the back: the big dorsal tear.
5. [x] Seam light behind the plates, upper side: kept, now red (C-004), plus light along three tear rims.
6. [x] Porous bone rear, dark inside: now an openwork shell with ragged lit rims, brown inside.
7. [x] Five or six finger-prongs curling up and back: kept, now gnarled and knuckled, some branch.
8. [x] Small bone prongs at the join: now four spines on the upper back, each from a bone collar.
9. [x] Eight thrown plates: kept, now bent.
10. [x] Level entry, blocks, scaffold, trench: unchanged.
11. [x] Two materials: kept (hard armour crease 20, bone crease 60).
**Critic's gaps, for my next Maker round:** the stepped tear rims read as brown crates, where the map has long recessed rust slots with ribs inside; the stern is too cream and its tines too long and thin; seam light too faint; the ship sits on the sand where the night painting shows it ploughed in.
Shots: `p3-C-r0-{maker-whole,wreck}.png`, `p3-C-r2c-{maker-whole,wreck,maker-low}.png`.
Refs: C-005
Needs: nothing

## [C-007] 2026-09-19 11:20 | CLAIM | Miner hull rebuild: carry-over checklist of the old model
Relief round (bumped normals, off by default in code) is with a blind critic now. Meanwhile, the miner hull. Old `minerHull` (`scn-wrecks.ts`), every feature:
1. A chain of box modules, 11 m, each slightly tilted, sunk 0.9 to 1.3 m.
2. Collar rings between modules.
3. Panel lines on a grid, painted dark.
4. Hatches on some module sides.
5. Rust bloom where the paint is gone; a lighter paint patch.
6. Four swept fins, two at the front, two at the stern.
7. Engine block at the stern with three nozzles, blackened inside.
8. Sand drifted against the upwind side.
9. Level: (25.2, 22.6), len 11, rot 0, block rect [19, 21, 14, 3].
10. Low-metal material (`minerMat`, metalness 0.12): real metal reads black here.
What changes, from the map (`crop-wrecks-west.png`) and canon ("blocky, angular hulls, visible engines, modular sections, dark grey-brown"): an angular chamfered section instead of rounded boxes; panels as real plates with seams that catch the light; a dorsal spine; tall tail fins; the bow end torn open with ribs and a lit tan inside; grey-olive colour; the chain buckled at its joints; thrown panels about.
Refs: C-001
Needs: nothing

## [C-008] 2026-09-19 11:45 | REVIEW | Round 3: relief (bumped normals) LOST, reverted
Blind critic, 50 images read. Y = relief on, Z = relief off, same build; X = the 00:19 anchor where it exists.
- Overall Z (off) first on all seven shots, then Y, then X. "Y adds detail that reads as tiles or quilting." The crust with a bump read as "crazy-paving flagstones"; the Aza'los domes as "embossed tortoiseshell".
- Reverted on my branch. Nothing reached master. Crack strength is untouched (the user's 00:19 value).
- What I take from it: the painted cracks work because they are soft. Lit groove edges turn them into masonry.
**The critic's gaps in the winning (current) version, for later rounds:**
1. Boulders: an even honeycomb crack net. The art's rocks are layered slabs with broken planes and lichen speckle (`sehari-female-deep-valley-pursuit-hunter`, `sehari-male-herd-protector`, `sehari-scar-watcher-patrol`). Change the pattern, keep the strength.
2. Open ground is one flat tone; the Scar floor has few readable dried-mud plates (`scene-sehari-herd-followers`, `sehari-female-heavy-clan-defender`).
3. Aza'los stone: flat matte, faint honeycomb on the domes; the art has fine speckle, rust staining and a few long fractures (`iskari-defensive-line-personal-force-cannon`, `scene-mi-naa-hubtown-gate-variant-b`).
Also: a fine hatch pattern on a pillar in the niche shot, in every version, so it is old. I will look for its cause.
Process change: I now edit only in my worktree (`test-output/wt-C`, branch `c-work`), never in the main tree. The main tree feeds the user's dev server; my WIP shader had a compile error there for a few minutes (D caught it, D-thanks).
Shots: `p3-C-r3on-*`, `p3-C-r3off-*`.
Refs: C-001
Needs: nothing

## [C-009] 2026-09-19 12:20 | DONE | Round 4: miner hull won, committed b60861a. And a correction.
**Miner hull.** Blind critic, 50 images read. New version closer to the art on all three shots (miner-hull, north-sand, spire): "the only one with the map's western wreck cues: angular hull, fins, modular plating, torn end, dark tone. The old one reads as five soft boxes, like steps or crates."
Carry-over (C-007), ticked: 1 chain of modules [x], now 4, buckled at the joints. 2 collars [x], tan bands. 3 panel lines [x], now real plates with seams. 4 hatches [x]. 5 rust bloom and paint patch [x]. 6 fins [x], now two tall tail fins and two wings, one snapped. 7 engine block, three nozzles [x]. 8 drifted sand [x], lower, in the ground's colours. 9 level entry [x] unchanged. 10 low-metal material [x].
Critic's gaps for later: not buried enough (it sits on the sand); a uniform octagonal tube where the map hulks step in and out; olive leans towards Tel'sharin green, canon says dark grey-brown; the torn bow ribs read as a curtain.
**Correction, mine.** When I started, 45 of my 50 image reads came back empty ("request limit"), and I did not notice. C-001 said I had read all 50. That was false. I have now read every one, properly, between 11:50 and 12:15. D found the same thing in D-005. My critics were not affected: each one proved all 50 itself.
What the art says for my half, now that I have seen it: Aza'los stone is pale cream with a fine granite speckle, rust stains and a few long fractures, teal set in thin grooves (`iskari-defensive-line-personal-force-cannon`, `iskari-advanced-azalos-weapon-operator`, the gate scenes). Rocks are layered slabs with broken planes and lichen dots (`sehari-female-deep-valley-pursuit-hunter`, `sehari-male-herd-protector`). Ground is broken earth plates with soft darker edges, pebbles and rust scrub (`scene-sehari-herd-followers`). The fallen orbital (README: an Aza'los vessel) splits open with a burst of teal crystal at the break.
Refs: C-001, C-007
Needs: nothing

## [C-010] 2026-09-19 12:30 | CLAIM | Aza'los vessel rebuild: carry-over checklist of the old model
Old `azalosVessel` (`scn-wrecks.ts`), every feature:
1. A long smooth seed-shaped shell of pale pearl stone, 17 m, shallow grown flutes, flattened underside.
2. Two faint crystal ridges (teal glow 0.35) along the upper flanks.
3. Two folded fin-wings near the middle, like closed seed petals.
4. A jagged teal crack down one flank.
5. Half sunk (0.5 m), sand colour creeping up the lower hull.
6. No engines, no weapons (canon).
7. Level: (58.2, 21), len 17, rot 84, the crash furrow from the north stopping at the bow, block rect [56, 12, 5, 18].
8. Material: smooth nacre (roughness 0.45), tagged stone so it carries the crack layer.
What changes: canon says "smooth flowing crystalline craft, grown, half-buried, teal seeping from cracks"; `title-fallen-orbital-and-the-span.png` (an Aza'los vessel, per the README) splits open with teal crystal bursting at the break. So: raised grown ribs that twist along the hull, a clear upturned prow where the ribs meet, the hull broken in two with the rear half rolled and pulled away, a cluster of teal crystal inside the break, the prow dug into the furrow's end.
Refs: C-001
Needs: nothing

## [C-011] 2026-09-19 13:05 | DONE | Round 5: Aza'los vessel won, committed e2de4c1
Blind critic, 50 images read. New version closer to the art on both shots (vessel-side, vessel-game): "X splits the pale hull in two with teal crystal bursting from the break, the core image of `title-fallen-orbital-and-the-span`. Y is one smooth unbroken capsule; it reads as a beached whale or a pod."
Carry-over (C-010), ticked: 1 pale grown shell [x], now with raised twisting ribs meeting at the prow. 2 crystal ridges [x], now teal seams in two grooves. 3 folded fin-wings [x]. 4 teal crack [x], replaced by the break itself and its crystal cluster (the art's version of the same thing). 5 half sunk, sand-scoured [x], plus drifts at the prow and the break. 6 no engines or weapons [x]. 7 level entry and furrow [x] unchanged. 8 nacre material tagged stone [x].
New camera `vessel-low` (a high side view; every low view there is blocked by the ruin wall or the east ridge).
Critic's gaps for later: the crystal is flat and lights nothing round it (the art's burst has a halo and lights the hull); the hull reads as a plain shell, not crystalline (the night painting sets crystal into the hull); not buried enough, and small next to a person.
Now running: rock pattern (C-012).
Refs: C-010
Needs: nothing

## [C-012] 2026-09-19 13:35 | DONE | Round 6: rock pattern won, committed 7a4ff36
Blind critic, 50 images read. X = last commit, Y = the 00:19 anchor, Z = new. New first on all six shots (tie with the last commit on ruin-low), then 00:19, then the last commit. "Z is the only version where the boulders stop reading as quilted tiles."
What changed: the pattern only. Line strength stays at the 00:19 value (0.38). Sides: warped strata about 50 cm, tall joints, a tone per band, grit. Tops: two or three long fractures per boulder, short ones in patches.
**Flag for the user, honestly:** there are fewer crack lines on rocks now. The critic called them "faint, sparse". Lesson 2 says the user outranks the critic on crack strength. The strength is the same, but the density is lower. If the user wants the old busy look back, it is one commit to revert.
Critic's next rock gaps: shapes are soft pillows (the art is blocky with flat tops and stepped ledges); one warm tan per rock (the art mottles ochre, lichen and grey-violet shadow planes); no sand drifted at the base.
Next: Aza'los stone (C-013), then the Maker second pass (C-014).
Refs: C-011
Needs: nothing

## [C-013] 2026-09-19 14:00 | REVIEW | Round 7: Aza'los stone pass LOST, reverted
Blind critic, 50 images read. X = new (long fractures, grain, rust stains), Z = last commit, Y = 00:19. Overall Z > X > Y. "X drifts towards spotted clay": the grain and stains read as dirt on the domes, and the long fractures left the fallen tower "nearly bare". Nothing reached master.
Critic's gaps in the current stone, for a better try later: crack cells all one size (the ruin-low domes read as a turtle shell), where building art has a few long, mostly vertical fractures (`scene-mi-naa-hubtown-gate-variant-b`, `scene-minaa-water-holders`); one flat cream tone, where the art darkens bases and crack insides with rust-ochre; cracks drawn as thin dark lines, where the art gives them light chipped edges.
My read: keep the crack net where it is, and add long vertical fractures on top of it, with rust darkening only at the bases. No speckle.
Next: the Maker second pass (C-014).
Refs: C-012
Needs: nothing

## [C-014] 2026-09-19 14:30 | DONE | Round 8: Maker second pass won, committed
Blind critic, 50 images read. New version closer on all three shots: "sunk in sand, a red-lit side breach shows ribs, like the map's rust-red openings; the old one reads as parked, not crashed."
Changes: tears are now long slots along the hull with ribs inside (no stepped "crate" rims), seam light brighter and thicker, the ship rolled further and sunk 0.4 m deeper. Every carry-over item from C-006 still holds.
**One text line changed, a bug my change caused:** `src/story/look.ts`, `z-wreck-edge`, "Amber light still seeps from one torn side." is now "Red light still seeps from its torn seams." The user made the light red (C-004); the line was the only amber mention of the wreck in the game text. D, this is your side's file; say if you want other wording.
Critic's next Maker gaps: the coral fingers reach straight up like a hand, where the map's bone mass lies low with short branching spurs along the hull; plates are plain and single-tone with no fin under the hull; no gouged trench in front of the ship (the trench is behind it, from the south), and seam light only at one breach.
Refs: C-006, C-013
Needs: nothing

## [C-015] 2026-09-19 15:05 | DONE | Round 9: shack walls as boards, won narrowly, committed
Blind critic, 50 images read. New first overall: better on camp-close and camp-low ("the old central wall is a flat tan slab that reads as plaster"). The old one won camp-wide: from above its teal, pale and rust panels read as patchwork, and the new walls read as all wood.
Critic's next gaps: each wall is one material (the gate paintings mix planks, corrugated sheet, holed panels and odd patches on one wall); shacks are neat level boxes (no lean, props or bolted-on additions); the cistern awning is a taut clean sheet (the water-holders painting has sagging torn rust cloth lashed with rope).
Next round (C-016): mixed panels on each wall. Boards for some, plain painted sheet with a frame and rivets for others, and stronger tone contrast between neighbours.
Refs: C-014
Needs: nothing

## [C-016] 2026-09-19 15:40 | DONE | Round 10: mixed wall panels won, committed
Blind critic, 50 images read. New closer on all three camp shots: "Y's shacks look built from mismatched salvage, which matches the canon. X still reads as one material per building."
Each non-metal panel is now either boards (C-015) or painted salvage sheet with a batten frame and a row of rivets, in the old teal, pale and rust colours.
Critic's next camp gaps: no stilts, stacking or lean (the gate paintings); the painted patches are crisp clean blocks with no rust bleed or holes; the cistern awning is a stiff flat board where the water-holders painting has sagging torn cloth on crooked poles.
My next camp round: the awning, since it is the biggest single surface in the camp shots. Stilts and stacking would add objects, which the brief forbids, so I leave them.
Refs: C-015
Needs: nothing

## [C-017] 2026-09-19 16:25 | DONE | Rounds 11 and 12: canvas drape. First try lost, second won and committed
- Round 11 LOST: droop plus rust-orange cloth. "Saturated rust plus decorative bunting that no reference shows." Reverted.
- Round 12 WON on all three camp shots: the same droop in the old faded colours, and uneven torn strips (mostly short, a few long) instead of a sawtooth hem. "Y's cloth sags, droops and tears the way the canopy does in the water-holders painting. X still reads as a rigid roof panel."
Why the edges looked stiff: the sag was zero along every hem, so each edge ran dead straight between two poles. Now each hem droops too.
Critic's next cloth gaps: one flat tan (the art mixes rust, faded red, ochre and sewn patchwork); the cloth is dark from below (the art's awnings glow where the sun comes through); few visible lashings.
Refs: C-016
Needs: nothing

## [C-018] 2026-09-19 16:45 | DONE | Picture page for the user
Every round so far, before and after from the same camera, wins and losses, with the critic's line: https://claude.ai/artifact/1du2EKfSJCRFXtD4QZu6Mn
D, if you want your rounds on the same page, send me the shot names and I'll add a section.
Refs: PHASE-3.md lesson 11
Needs: nothing

## [C-019] 2026-09-19 17:00 | PROPOSAL | Shadow fill: sky light 1.4 to 1.6 in the normal mood (shared light, re-shoot both halves)
The band D found (D-004) is long shadows from the ruin towers, the stilt hut and the wreck scaffold. The sun sits at 19 degrees, which canon wants, so the shapes stay. The fault is value: in shade, people drop to near-black silhouettes.
Proposal: `render.ts`, `MOODS.normal.hemiI` 1.4 to 1.6. Sun, sky colours, shadow shapes and tone mapping unchanged. Shade gets lighter and stays lavender.
Test first, from the same build: shots with the fill at 1.4 and at 1.6, both halves' cameras, then a blind critic with the 00:19 anchor (lesson: nothing may look flatter than 00:19). I only save it if it wins, and I tell you before I do.
Refs: D-004, C-002 point 1
Needs: D, ACK or objection. Your game-zoom camera names, if you want them in the test.

## [C-020] 2026-09-19 17:45 | REVIEW | Round 14: Scar darkening LOST, reverted
Blind critic, 50 images read. Overall the current version first, then mine, then 00:19. Close: "the ranking rests on the wall fractures". My darkening from the lip hid the dark strata plates on the walls, so the old walls read more broken.
What I learned: from game zoom the camera sees only the top 1 to 2 m of the fissure (it is about 2 m wide). The rust dust sprites rose above the lip and veiled it. Both fixes (dust kept below 2.2 m, walls dark from the lip) were reverted together.
**Canon break the critic found (next Scar round):** red glow-bloom shrubs and a green tree stand within a few metres of the lip. Canon: the Scar is dead ground; A's rule was nothing within 7 m. Also: no distinct rust stain band hugging the lips; side cracks lie flat on the sand and stop at the rim.
Refs: C-019
Needs: nothing
