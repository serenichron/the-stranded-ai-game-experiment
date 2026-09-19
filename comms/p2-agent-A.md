# Phase 2, agent A log

Append-only. Only agent A writes here. Protocol: `comms/PROTOCOL.md` (phase 2 section). Brief: `comms/PHASE-2.md`.

---

## [A-001] 2026-09-18 23:25 | PROPOSAL | My plan, and what I think is wrong now
I read the brief, canon, the world docs, the three scene paintings, the defender art and all of my code. Here is my diagnosis, then the plan. Please answer it in your log: what fits, what clashes, what is missing.

**Why it looks like a 2 (my half).** Five causes, biggest first.
1. **One colour.** Sun, sky light and sand are all orange, so shadows are brown and everything is the same hue. The paintings have pale bone-cream sand, *lavender* shadows and a lavender-pink sky. Cool shadows against warm light is what makes golden hour read.
2. **No sky, no horizon, no depth.** The camera is orthographic at 33 degrees. It can never show a horizon, and ortho has no atmospheric depth. Every painting is built on a horizon with a low pale sun and hazed hoodoos.
3. **Flat shading.** Every shared material has `flatShading: true`. That, more than polygon count, is why it reads as a 2005 low-poly game. The house style is soft brushwork.
4. **Flat surfaces.** Vertex colour only, no wear, no edge light, no cavity dark, no large-scale colour variation.
5. **Places do not match the art.** The ruin is cones and lumps. The camp is shacks on orange sand. The ridges are piles of faceted boulders.

**Plan, in rounds. Each round: fixed shots, blind critic, scores posted, fix the biggest gaps.**
- **R0, baseline.** I write `tools/p2-shots.mjs`: one browser, a frozen build, every world shot in one session, lock file honoured. Shoot the current game. Blind critic scores it. That is the number we beat.
- **R1, light and camera (the whole screen changes).**
  - Palette and light re-keyed from the paintings. Warm peach sun, lavender sky light, so shadows go cool.
  - A sky dome with a low pale sun disc, a gradient from peach at the horizon to dusty lavender, thin cloud wisps.
  - **Camera: perspective with a narrow lens (about 30 degrees), and pitch that lowers as you zoom in.** Default zoom stays close to today's angle. Zoomed in, the horizon, sky and hazed hoodoos appear behind the scene, like the paintings. Q/E, wheel, pan, picking and `toScreen` keep working. No contract change.
  - Distance and height fog in the same warm haze, so far things fade.
  - One world shader layer on every lit material (the occlusion hook already reaches them): smooth shading, world-space colour mottling, brush-noise in the light, cavity and ground-contact darkening, a soft warm rim on sun-facing edges.
  - A backdrop ring past the map: mesas, hoodoo spires, two broken Aza'los towers and ship ribs on the horizon.
- **R2, the ruin.** Rebuilt to the paintings: stalagmite towers with flowing vertical ridges, teal seams running up them, arched openings, walls that bend. Floor with inlaid concentric teal rings and spoke seams (the defender art shows exactly this). Battle damage: breaches, craters, char. **The defender's niche.** A seam network so the drone's code pulse can run along real seams to the niche.
- **R3, the camp**, rebuilt towards `scene-minaa-water-holders.png`: a stone cistern with a pipe spout pouring water, a hand pump, torn tarps on poles, stacked stone blocks, water jugs, scaffold huts. One Aza'los tower fragment at the camp edge with huts built onto it, as in the painting.
- **R4, the rest.** Three wrecks (Maker bone-coral in the gap, a miner hull half-buried in the north-west sand, as the gazetteer puts it, and a grown teal Aza'los vessel in the east). The eleven plants, instanced. Crystals with fake subsurface. The Scar with strata and blight. Ridges rebuilt as layered rock, not boulder piles.
- **R5, polish and fps.** Then the joint walk-through.

**Art direction to agree with you before either of us builds much.**
- Palette (sampled from the paintings): sand `#d8c2a0` lit, shadows lavender `#8a7b8c`. Sky `#e9b995` at the horizon to `#b49fb2` above. Aza'los stone `#e2d7c3`, seams teal `#5fe0d0`. Tarps rust `#a4502e` and ochre `#c8904a`. Maker amber stays `#ff5e14`. The Tel'sharin stays red.
- Light response: I'd like your characters to get the same world shader layer (fog, cool shadow, warm rim), applied in `spawn`. Then people and places are lit by one hand. I can do it on my side with no change to your files. Say yes or no.
- No hard outlines (canon: "no hard outlines"). Separation comes from the rim light and value contrast.
- Scale: 1 tile = 1 metre stays. Doors, niches and stairs sized to that.
- One thing I noticed in your area: `PALETTE.skinSehari` is `0x8f7a63`, a warm brown. Canon locks cool grey-lavender.

**Contract changes I propose (you propose yours, the brief lists body, drone, defender):**
1. `IWorld.seamPulse(from: Tile | EntityId, to: Tile | EntityId, opts?: { colour?: CrystalColour; duration?: number }): Promise<void>`. A teal pulse runs along the floor seams from the drone's body to the niche. It resolves when it reaches the wall, so you can crack the shell on that beat.
2. A new kind `prop-niche`, states `'sealed' | 'cracking' | 'empty'`. It is the alcove plus a crust of sand-stone and dust over the dormant figure. On `cracking` the crust breaks and falls. Your defender entity stands inside it on the same tile. If you would rather own the crust in the defender model, say so and I'll build only the alcove.

**Questions for you.**
- Q1. Where do you want the niche? My suggestion: the east wall of the court, tile (51, 14), facing west into the court, so the pulse crosses the whole floor. It also sits off the main route, so a player may walk past it without noticing.
- Q2. The drone's patrol. I'll put visible cracks in the ruin walls with half-mended teal filler. Want patrol points next to them, so it looks like it is tending them?
- Q3. Shot list. I'll script camp wide, camp close, wreck with the Tel'sharin, north sand with the spire-root, ruin court, and the niche. Creation screen, defender waking and combat need your game state. Do you want to add them to my script through a hook, or shoot them yourself with the same camera settings?

**What I will not touch:** anything in your folders. When I need a change there, I'll send the exact diff.
Refs: PHASE-2.md
Needs: your plan in your log, and answers to Q1 to Q3, and yes or no on the shared light layer.

## [A-002] 2026-09-18 23:45 | DECISION | Contract changes agreed; I save them now
ACK to B-001 items 1 to 3 and to your amendments in B-002. Both sides have ACKed every item, so I am saving the diff below to `src/core/contracts.ts` straight after this message. I also make the `world.ts` edits (body and look passed from level opts and from `spawn`, `modelState` pass-through for `drone` and `defender`), because that file is mine.

```ts
// EntityKind, machines:
  | 'drone'               // Aza'los repair drone, teal, precise. States: 'tending' | 'hostile' | 'dead'
  | 'defender'            // defensive-line Iskari. States: 'dormant' | 'waking' | 'awake' | 'dead'
// EntityKind, props:
  | 'prop-niche'          // wall alcove for the dormant defender. States: 'dark' | 'lit' | 'empty'
// IWorld.spawn opts gain:
  body?: 'male' | 'female'; look?: string;
// IWorld, under effects:
  /** A teal pulse along the ruin's floor seams. Resolves when it reaches `to`. */
  seamPulse(from: Tile | EntityId, to: Tile | EntityId, opts?: { colour?: CrystalColour; duration?: number }): Promise<void>;
```
`ModelOpts` in `src/world/models/types.ts` gains `body?` and `look?` too. `guardian` stays as a drone alias until you tell me to drop it. `seamPulse` lands as a working stub first (a plain glow travelling straight to the target, resolving on arrival), so your gameplay can call it today. The real seam network comes with the ruin rebuild in my R2.

**Level.** I'll switch `guardian1` to `drone1` when you send the entity lines. The niche goes at (51, 14), facing west, with (50, 14) and the path to the court floor kept clear. The alcove is 2.8 m tall and 1.2 m deep, as you asked. Crack tiles for the patrol come with R2.

**Scale.** Yes. I'll frame the default zoom so a 1.8 m person is about 100 px tall at 1600x900.

**Rim light.** Mine. It is part of the world layer, so do not add your own. Tag glows with `userData.glow = true` and the layer leaves them alone.

**Shot hook.** Agreed: my script calls `window.__game.shot(name)` when it exists, then sets the camera. Your shot names go under your prefix.

**Round 0 baseline** is shot: `test-output/p2-A-r0-*.png`. Headless fps on this laptop: camp 31, wreck 39, north 30, ruin court 27. So the ruin is already under budget before we add anything. I'll win that back in R1.
Refs: B-001, B-002
Needs: nothing. Your entity lines for drone1 and defender1 when ready.

## [A-003] 2026-09-18 23:52 | DONE | Contract saved, spawn passes body and look, seamPulse stub live
- `src/core/contracts.ts`: `drone`, `defender`, `prop-niche`, `body?` and `look?` on `spawn`, and `seamPulse`. Exactly the A-002 diff.
- `src/world/models/types.ts`: `ModelOpts` has `body?` and `look?`.
- `src/engine/world.ts`: the level spawn loop passes `opts.body` and `opts.look` into `buildCharacter`, and so does `spawn`. `modelState` already passes `drone` and `defender` states straight through. `guardian` keeps its old mapping.
- `seamPulse` works now as a stub: a teal glow runs straight along the ground and the promise resolves on arrival.
- `npx tsc --noEmit` is clean for the whole project.
Next for me: R1, light, sky, camera and the world shader layer.
Refs: A-002
Needs: nothing

## [A-004] 2026-09-19 00:05 | REVIEW | Round 0 baseline: blind critic scores
Shots: `test-output/p2-A-r0-*.png` (frozen build, `?freeroam`). The critic saw the shots, the paintings and canon text, and nothing from me.

| Shot | Score | Biggest gaps |
|---|---|---|
| camp-wide | 3 | flat facets everywhere; saturated orange ground with brown shadows; toy-box buildings, spring is a teal disc with no stonework |
| camp-close | 3 | people are grey mannequins (yours); nobody works the water; lamp glow blows out to white |
| wreck | 3 | Tel'sharin is a green box (yours); Maker hull is a dark lump, amber is one flare not seam light; the gap reads as open sand |
| north-sand | 3 | spire-root is a thin stick; fallen spire reads as a bent pipe; a crystal floats in the air (breaks the no-crystal-in-ground spirit) |
| ruin-court | 5 | towers are clumps one or two figures tall; teal seams look like thin bright decals; no battle damage, no platform or spokes |
| niche | 4 | facets and black shadows dominate; no readable niche; doors are flat slabs with line art |

Critic's single biggest lift: smooth normals, a light ramp with cool lavender shadows, world-space brush noise, and height haze. That is my R1, so I'm on it. Its people notes (mannequins, Tel'sharin features) are for you.
Refs: A-001
Needs: nothing

## [A-005] 2026-09-19 01:10 | DONE | R1 light and camera, R2 ruin: what changed, and what you need
Shots: `test-output/p2-A-r1*.png` and `p2-A-r2*.png`. Critic run on all of them comes next.

**R1, the whole screen (affects your shots too, please re-shoot):**
- **Camera is perspective now**, 30 degree lens. Pitch follows zoom: 50 degrees far out, 38 at zoom 1, down to 9 fully in. Fully zoomed in you see the horizon, like the paintings. Your `focus(id, { zoom: 1.35 })` in dialogue now also drops the camera a little, which frames faces better. Zoom range is 0.65 to 2.4. `toScreen`, picking and pan all work as before.
- **Light re-keyed from the paintings.** Warm peach sun from the north-west (azimuth 315, 19 degrees), lavender sky light, so every shadow is cool lavender. Sky dome with a pale sun disc and cloud streaks. Distance and height haze in the same colours as the sky.
- **Your characters get the world layer** in `spawn`, as agreed: haze, warm rim on the sun side, colour mottling. Glows tagged `userData.glow` skip mottling. One thing I see: white Iskari materials read very bright, almost blown, next to the sand. If your stone base is near white, try a value nearer `PALETTE.stone` (0xcfc4ae) and let my rim do the lifting.
- Smooth shading on all my scenery, sandstone rocks, pebbles and rust scrub over the ground, a skyline of mesas, hoodoos and broken towers past the map.

**R2, the ruin:**
- A raised court (0.6 m) with a stepped rim, paved slabs, and teal channels: three rings and eight spokes. Walls are now continuous poured-stone runs with one teal line along each face. Seven great towers: a crowning cluster of three behind the inner hall (22, 18.5 and 16 m, one snapped), four round the wheel. Scorch on some, bites out of the wall crest, cracks in the floor.
- **`seamPulse` is real now.** From any point on the court it runs in to the nearest ring, round it, and out along the spoke that points at the target. It resolves when it arrives. Off the court it runs straight. Shot: `p2-A-r2e-pulse.png`.
- **`prop-niche` is built.** States `'dark' | 'lit' | 'empty'`. `'lit'` pulses the arch seam bright, `'empty'` settles to a low glow. The alcove is 1.7 m wide, 2.9 m tall, 0.9 m deep. Your defender stands on the tile centre. The wall is solid behind it, and (50, 14) is clear. Shot: `p2-A-r2c-niche.png` (the niche is spawned by my shot script, since your GO has not come yet).
- **Crack tiles for the drone's patrol** (each has a half-mended teal crack on the wall beside it): **(35, 10), (34, 18), (38, 22)**. From there the pulse to the niche runs 15 to 17 m, crossing most of the court.

**Load rules:** I build into `test-output/build-A-next` and copy into `build-A` only if the build works (`tools/p2-build.sh`), and I honour the lock. Your half-finished `char-creatures.ts` broke two of my builds tonight; no harm, the script now keeps the old build. Headless fps on this laptop is noise while the user is playing (the same settings read 37, then 27), so I'll do the real budget measurement at a quiet moment.

Refs: B-003
Needs: your GO for drone1, niche1, defender1 in the level. A re-shoot of your shots under the new light.

## [A-006] 2026-09-19 01:20 | DONE | Ruin entities swapped in; creation line-up tiles
- `level1.ts`: `guardian1` is gone. `drone1` (patrol: (35,10), (34,18), (38,22), (42,17)), `niche1` and `defender1` at (51, 14) facing west, exactly your B-003 lines plus the patrol. Typecheck clean for the whole project.
- The hover ring is the large size for `defender` too, as for the Tel'sharin.
- **Creation line-up:** (17, 48) sits in the oasis, with a reed-cane on (16, 48) and a sun-date tree on (18, 47). Use **y = 50, x 14 to 19** instead: open packed ground, nothing on it, and I will keep that row clear. The camp's south shacks frame it nicely from the default camera.
Refs: B-004
Needs: nothing

## [A-007] 2026-09-19 01:45 | REVIEW | Round 2: blind critic scores
Frozen build, `test-output/p2-A-r2-*.png`. Critic saw shots, paintings and canon only.

| Shot | r0 | r2 | Biggest gaps now |
|---|---|---|---|
| camp-wide | 3 | 4 | bare sand plane; striped flat roofs, no torn canvas; no stone basin at the spring |
| camp-close | 3 | 4 | shacks are untextured boxes, no pipes or rivets; foreground walls read as blockout; no water in a water camp |
| wreck | 3 | 3 | Maker hull is faceted cones, no bone-coral; open sand, not a rocky gap; debris is confetti |
| north-sand | 3 | 4 | loose crystals stand upright (reads as crystal in the ground); spire-root is a stick; one salmon-pink palette |
| ruin-court | 5 | 5 | form is right, surfaces flat matte; teal wall seams hoop the towers; floor channels are a straight-line radar grid (canon bans straight lines); red sign-board clashes |
| niche | 4 | 5 | floor lines read as road markings; amber crystal is the brightest thing in the shot |
| pulse | new | 5 | pulse lights one arc but not the stone around it; light washed lilac-white |

Critic's lift: a painterly material pass (cracks, crevice dirt, brushwork) and a palette pushed from pink to ochre, rust and bone. I agree. My next steps, in order: warmer light; curved floor channels with a soft under-glow; crystals lying down and dimmer; a carved stone stele for the ring clue instead of the wooden board; a surface layer with cracks and crevice dirt; then the camp (R3) and the wreck and spire-root (R4).

**Character notes the critic listed for you** (one line each, from the same shots): Iskari read as pale mannequins with a tile pattern, no wrap or inlay; the Tel'sharin at the wreck is still a box on stick legs in my frozen build (your new head may not have been in it yet); the dormant defender is lit as bright as the court; Mi'naa at camp are dark silhouettes; dogs and the drone have no silhouette at this distance.
Refs: A-004
Needs: nothing

## [A-008] 2026-09-19 02:05 | PROPOSAL | New references: the world map, and an archive of early concept art
The user added the world map: `comms/refs/world-map.png`. There is also `../source/reference-images/` (archive, not canon; its README says the pictures are current): a crashed star-vessel, two Mi'naa hub-town gates, a fallen Aza'los orbital, three Tel'sharin renders (sent to you already).

What the map tells us, and what I will do with it:
- **The Scar** is a thin, black, zigzag fissure with small side cracks, and a narrow rust-brown band along both lips fading into pale sand. Ours is a 19 m wide chasm band. I am rebuilding it as the map draws it.
- **Aza'los cities**: raised round platforms, ring walls broken into separate arcs, rings and spokes on the floor (our court already matches), tall pale towers with glowing teal slits and windows. I'll add the slits and window glows to the towers.
- **Mi'naa buildings**: tight stacks of small boxes, one to three storeys, flat or single-pitch roofs in rust-red, dark brown and blue-grey. The hub-town gate paintings add huts on stilts against the towers, ladders, cables strung on the stone, hide dome huts and patchwork awnings. That is my camp rebuild.
- **Miner ships**: long chains of dark brown rectangular modules with panel lines, like a freight train. Miner sites are rectangular: a sunken grid, a squared trench with a pale rim. The miner hull in the north-west sand gets this shape.
- **The Maker wreck**: long, dark grey-green, spiky fins and bone ribs, rust and amber catching on it, like a fish skeleton or a claw. The archive's star-vessel painting adds a long drag trench gouged into the sand, a hull split in two, sand drifted against it. The Maker wreck in the gap gets both.
- **Palette**: pale peach-cream sand, grey-green rock, teal only as small accents. Same correction the critic asked for.
- For you, if useful: the hub-town gate paintings show Mi'naa dress and a rhino-like pack beast; the map shows no people.
Refs: A-007
Needs: nothing

## [A-009] 2026-09-19 02:40 | DONE | B-006 fixed: the see-through circle
Thank you for catching it and doing your half.
1. `occlusion.ts`: materials tagged `userData.noOcc` get `NO_OCC` and are never cut. It is in the cache key.
2. The circle opens only when solid scenery really stands between the camera and the player. The level builder now records, for every blocked tile, how tall the solid thing on it is (`grid.tops`). Each frame I walk from the player's head towards the camera and compare each tile's top with the sight line. No raycast against meshes, so it costs almost nothing. The circle fades in and out over about a seventh of a second, no popping.
3. Thin props are not cut in the open any more, because the circle is off in the open. When a shack does hide you, what is in front of you inside the circle still thins, which is the point of it.
Shots: `test-output/p2-A-r3d-camp-close.png` (player by the stall, NPCs by a lamp: nothing cut) and `p2-A-r3d-occ-hidden.png` (behind a shack: the roof thins over the player).
Also landed since A-008: the Scar rebuilt from the map (narrow zigzag fissure, stained lips, hairline side cracks), the camp's cistern with pipe, torn canvas, jars, cut stone, a tower with a stilt hut at the camp edge, a new spire-root, cracks on stone, rock and packed ground.
Refs: B-006
Needs: nothing

## [A-010] 2026-09-19 03:05 | REVIEW | Round 3: blind critic scores (honest: no net gain yet)
Frozen build, `test-output/p2-A-r3-*.png`. References now include the world map and the crashed star-vessel painting.

| Shot | r0 | r2 | r3 | Biggest gaps now |
|---|---|---|---|---|
| camp-wide | 3 | 4 | 3 | top-down, spread-out camp, no towers or skyline; shacks too clean; palms read as Earth trees |
| camp-close | 3 | 4 | 4 | tower in the back works but is small; foreground roofs are big flat planes |
| wreck | 3 | 3 | 3 | hull reads as a green blob with cones; trench not in frame; gap is an empty bowl |
| miner-hull | new | | 2 | hull hidden under the old miner-ruin lattice; no visible chain or engines |
| aza-vessel | new | | 2 | vessel is player-sized, reads as a pebble; Maker spikes steal the foreground |
| north-sand | 3 | 4 | 3 | glass-thistle reads as crystals in the ground; berry scrub reads as garden plants; no horizon |
| scar | new | | 3 | reads as an irrigation ditch: neat stepped walls; plants growing on its lip (canon: dead ground) |
| ruin-court | 5 | 5 | 5 | towers still read as fat stumps from this height; little battle damage; seams read as surface tubes |
| niche | 4 | 5 | 4 | niche arch reads as a decal |
| pulse | new | 5 | 5 | pulse reads, but as a UI effect |

My read: the new geometry is right in kind but wrong in scale and framing. At the default camera, things are too small or cut off to register, and flat shading on big planes still says "low-poly". Next, in order:
1. **Scale.** Aza'los vessel to 22 m, miner hull to 16 m and clear of the old ruin, Maker wreck bigger with the trench in view, ruin towers taller and slimmer.
2. **The Scar:** deeper, jagged walls, no plants within 6 m of the lip.
3. **Glass-thistle** to dull bone-grey stems (it reads as crystal); no scrub or moss near the Scar.
4. **A painterly pass in post**: a cheap edge-aware smoothing (Kuwahara-style, one pass at half resolution) to break the facets, then re-check fps.
5. **Shot cameras:** keep default zoom as the game plays, but the critic is right that my shot list never shows a horizon. I'll add one low shot per place.

**For you (critic's character notes):** player reads as a cream mannequin; some feet float or cast no contact shadow (miner-hull, aza-vessel); the Tel'sharin in my frozen build still lacks the dome head and digitigrade legs; the dormant defender reads as glossy mecha, not stone; the Sehari hunter reads dark and human; the drone reads as a toy; camp NPCs too small to tell apart.
Refs: A-007
Needs: nothing

## [A-011] 2026-09-19 03:40 | DONE | Maker wreck rebuilt from the map; paint pass; wreck scale; Scar
- **User note:** the Maker wreck "looks like the cadaver of a whale". I cropped the map at 4x and rebuilt it to match: a faceted sage-grey armour front (overlapping plate sleeves, blade prow, rust ribs in the gaps, amber in the seams, one sleeve torn open) grown into a porous bone rear with finger-prongs curling up and back, and small bone prongs at the join. 19 m, prow north, the drag trench behind it. Shots `p2-A-r4-wreck.png`, `p2-A-r4-maker-whole.png`.
- **Paint pass:** a four-quadrant Kuwahara filter in the grade shader, blended at 0.75. It turns flat faces into soft brush patches and keeps edges. Cost measured at about 1 fps. Off on Low.
- Miner hull now 12 m on the west sand, clear of the old ruin. Aza'los vessel now 17 m in the east sand. Ruin towers 40% taller and slimmer.
- The Scar: jagged lip, a broken ledge, then the long drop. Nothing grows within 7 m of the lip; twist-weed sits a little way back, as canon says. Glass-thistle is bone-grey now (it read as loose crystals).
- New low shots show the horizon: `p2-A-r4-camp-low.png`, `p2-A-r4-ruin-low.png`.
- fps, frozen build, High, 1600x900: 31 (niche) to 49. Every shot holds 30.
Refs: A-010
Needs: nothing

## [A-012] 2026-09-19 04:05 | REVIEW | Round 4: blind critic scores
| Shot | r3 | r4 | Biggest gaps now |
|---|---|---|---|
| camp-wide | 3 | 4 | flat roof fills, no grime or patching; no towers behind; spring reads as a white box |
| camp-close | 4 | 4 | big plain foreground planes; palm trunk a smooth tube |
| camp-low | new | 4 | spring has no water shine; jars are plain primitives |
| wreck | 3 | 3 | from this height the armour reads smooth; bone holes square (since fixed) |
| maker-whole | new | 3 | silhouette still reads bullet plus sausage; prongs too few and plain |
| miner-hull | 2 | 2 | was hidden by the west ridge; now moved to open sand (`p2-A-r5b-miner-hull.png`, reads as the map's box chain) |
| aza-vessel | 2 | 3 | reads as a dome with a sticker crack; no furrow |
| north-sand | 3 | 4 | spire-root reads as a generic acacia |
| scar | 3 | 5 | rim too tidy, no dark void at the bottom |
| ruin-court | 5 | 5 | one beige putty; rings too regular |
| ruin-low | new | 5 | best mood shot: haze, horizon, the arch framing the camp |
| niche | 4 | 5 | floor channels have no inset |
| pulse | 5 | 5 | strongest effect in the game; nearby stone should catch teal |
Since the critic ran: brush strokes in every albedo and a warm-top, cool-bottom bias (no fps cost measured), the miner hull moved and lightened. Next: the camp (water, roofs, grime), then the vessel's crash furrow.
Character notes for you from this round: Iskari player reads as an undressed rig with seams; the Tel'sharin is a thin stick at wreck distance; the dormant defender reads as brown rubble (it should be smooth pale stone with teal veins); one camp NPC kneels on a black square that reads as a missing texture.
Refs: A-010
Needs: nothing

## [A-013] 2026-09-19 04:30 | DONE | Camp pass, and a second circle fix
- Shack roofs are real corrugated sheet now, rust running down from the nail lines. Cistern stone darker with grime at the base. Water visible, teal, a soft sun sheen (not white).
- **The see-through circle opened over the spring**, because the canvas canopy counted as a wall. Only solid features (walls, towers, shacks, rocks, wrecks) record a height now; canvas, pipes, jars and plants never open the circle. Shots `p2-A-r5e-camp-low.png` (spring visible, nothing cut) and `p2-A-r5e-occ-hidden.png` (behind a shack, still opens).
- South ridge boulders sunk deeper so they no longer overhang the slope.
Refs: A-012
Needs: nothing

## [A-014] 2026-09-19 04:50 | ANSWER | B-008, B-009: crate lid, line-up row, where my half stands
- **Crate lid:** the prop-chest body is salvage-brown or weathered green-grey now, and its inner top plate is mid-brown. No more black square.
- **Line-up row:** a new `clear` feature keeps x 31 to 39, y 40 to 42 free of scatter and ground cover. It stays walkable. Nothing solid of mine stands there.
- **My half, honestly:** round 4 scored the ruin court, Scar, niche, pulse and low ruin view at 5, and the camp at 4. The wrecks scored 2 to 3 before I rebuilt the Maker wreck from the map and moved the miner hull, so they are unscored now. I'm running round 5 on a fresh build straight away. fps on High holds 31 to 49 across my shots.
- **The walk-through:** yes, I'll review every `p2-walk-*.png` shot with you. One caveat: your walk build may predate my last three changes (crate lid, circle over canvas, camp roofs). If it does, the camp shots will show the old versions, and I'll say so in my review rather than mark them down.
Refs: B-008, B-009
Needs: a ping when the walk shots are done

## [A-015] 2026-09-19 05:05 | BUG | fps readings are poisoned while the user plays
Round 5 shots measured 12 to 18 fps everywhere, from 31 to 49 an hour before. I checked before blaming code:
- no test browser was running (the lock was free);
- one Edge process (pid 10952, not headless) held the GPU at 99%. That is the user's game tab on 5190, which renders every frame;
- hiding every character in my frozen build lifted the camp from 14 to 18 fps. So your sculpted people cost about 4 fps at the camp, and the rest of the drop is contention.
So any fps number taken while the user's tab is open is not a measurement. The budget check has to wait for a quiet moment, with the user's tab closed or hidden (browsers stop rendering hidden tabs). Please treat your 30 to 42 readings the same way. I'll do one clean final measurement of the frozen build for both halves when the user steps away, and post it here.
Also landed: the Aza'los vessel now has a crash furrow running north to its bow.
Refs: B-009
Needs: nothing

## [A-016] 2026-09-19 05:25 | REVIEW | Round 5: blind critic scores (flat; honest read)
| Shot | r4 | r5 | Main gap now |
|---|---|---|---|
| camp-wide | 4 | 4 | ground has no wear, no damp sand at the spring |
| camp-close | 4 | 3 | big plain foreground slabs; wood, cloth and metal all read as one matte |
| camp-low | 4 | 5 | water glared white (since fixed: rough, dimmer) |
| wreck / maker-whole | 3 | 3 | from above the armour reads as a tube; lies on the sand, not in it |
| miner-hull | 2 | 2 | reads as bunkers; not half-buried |
| aza-vessel | 3 | 3 | reads as a dome with a painted line |
| north-sand | 4 | 3 | spire-root reads as a generic acacia |
| scar | 5 | 4 | lip not red enough (since fixed: deeper rust and violet) |
| ruin-court | 5 | 5 | too much uniform teal; rings too clean |
| ruin-low | 5 | 5 | rocks read as eggs with drawn cracks |
| niche | 5 | 4 | niche frame as bright as everything else, so not dormant |
| pulse | 5 | 4 | channels already lit, so the pulse has nothing to beat (since fixed: channels rest dim, halo gone, half the wall seams gone) |
My honest read: rounds 4 and 5 differ by about a point either way on the same shots, which is critic noise. My half sits at 3 to 5. The ruin and the low views hold at 5. The camp is at 4, the wrecks at 2 to 3. Not every shot at 5 yet.
Also landed: `DESIGN.md` Look section rewritten for phase 2.
Refs: A-012
Needs: nothing

## [A-017] 2026-09-19 05:45 | REVIEW | Walk-through shots, and my sign-off
Reviewed the 17 shots stamped 02:56 to 03:04 (the older same-numbered files are from the hung run).
**Works:** the whole level walks, with no teleports and no errors. The drone, the pulse, the defender stepping out and the fight all happen in the court, where I built them. The camp return is lovely: water in the cistern, torn canvas, the empty crate. The spire-root shot shows the Sehari hunter and the miner hull reading as the map's box chain.
**To fix, mine:** in shots 10 and 11 (defender wake and fight) a tall tower column stands between the camera and the player, and the see-through circle was too small to clear it. Fixed now: the circle is about half as wide again. It only opens when a wall really hides the player, so open ground is unaffected.
**To fix, yours:** a "The Keeper's apprentice / click to interact" tooltip hangs bottom-right in the ruin shots (05, 10, 11), though he is far away in the camp. It looks like a hover label that never cleared.
Note: your walk build (02:53) predates my crate lid, circle-over-canvas fix and dimmer floor seams, so those do not show in it.

**DONE, agent A, with honest scores.** My half builds, runs, and holds its canon. Blind critic, last two rounds: the ruin court, low views, niche and pulse at 4 to 5; the camp at 4 (5 in the low view); the Scar at 4 to 5; the three wrecks at 2 to 3. The brief's target was 5 on every shot. The wrecks and the far camp view do not reach it, and I will say so to the user plainly. The fps budget is not yet measured cleanly (A-015).
Refs: B-010
Needs: the tooltip fix; then the joint report and the quiet five minutes for fps
